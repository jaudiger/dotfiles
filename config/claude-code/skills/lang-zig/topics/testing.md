# Testing Patterns

## Primitives

### Basic test

```zig
fn add(a: u32, b: u32) u32 {
    return a + b;
}

test "add returns the sum" {
    try std.testing.expectEqual(@as(u32, 3), add(1, 2));
}
```

### Doctests (named after declarations)

A `test` whose name is a declaration identifier doubles as documentation
for that declaration; the formatter renders it next to the symbol.

```zig
/// Returns the larger of two integers.
fn max(a: i32, b: i32) i32 {
    return if (a > b) a else b;
}

test max {
    try std.testing.expectEqual(@as(i32, 5), max(3, 5));
}
```

### Testing assertions

The most common helpers from `std.testing`:

- `expect(condition)`: assert truthy
- `expectEqual(expected, actual)`: assert equality
- `expectEqualStrings(expected, actual)`: string comparison with a useful diff
- `expectError(expected_error, result)`: assert a specific error
- `allocator`: leak-detecting allocator that fails the test if memory is not freed

### Skipping tests programmatically

```zig
test "requires network" {
    if (!network_available) return error.SkipZigTest;
}
```

### Compile-time tests

Prefix an assertion with `comptime` so the test runner evaluates it at compile
time. The build fails immediately if the property breaks, before the suite
even runs.

```zig
const Header = packed struct { kind: u8, length: u24 };

test "Header is 4 bytes at comptime" {
    comptime try std.testing.expectEqual(4, @sizeOf(Header));
}
```

A normal runtime test that reads a `comptime`-known constant works too, but
does not force compile-time evaluation: it just runs once like any other test.

### Testing I/O

Use `std.testing.io` as the I/O equivalent of `std.testing.allocator`:

```zig
test "http request" {
    const io = std.testing.io;
    var http_client: std.http.Client = .{
        .allocator = std.testing.allocator,
        .io = io,
    };
    defer http_client.deinit();
}
```

### Fuzz testing with Smith

A fuzz test receives a `*std.testing.Smith`, a finite-entropy RNG that the
runner drives with successively larger entropy buffers and shrinks
automatically on failure.

```zig
fn fuzzTest(_: void, smith: *std.testing.Smith) !void {
    var sum: u64 = 0;
    while (!smith.eosWeightedSimple(7, 1)) {
        sum += smith.value(u8);
    }
    try std.testing.expect(sum != 1234);
}
```

The determinism contract is `(seed, entropy_size)`: any failure reproduces
from that pair, and the runner shrinks the failing case by binary-searching
the smallest entropy that still triggers it.

## Approaches

The patterns below are larger disciplines a codebase adopts, not stdlib APIs
to call. They compose: a deterministic simulation drives a model-based
comparison whose internal state is checked by invariant helpers, and whose
formatted output is locked down with snapshot tests.

### Custom deterministic PRNG discipline

When recorded seeds must reproduce across compiler upgrades, the stdlib PRNG
is a liability on three fronts: the default algorithm can change between
releases, the API can change between releases, and floating-point helpers
can produce different bit patterns across hardware. Vendor a small PRNG with
a stable surface that is integer-only.

```zig
const Prng = struct {
    state: [4]u64,

    pub fn from_seed(seed: u64) Prng { ... }
    pub fn int(self: *Prng, comptime T: type) T { ... }
    pub fn range_inclusive(self: *Prng, comptime T: type, min: T, max: T) T { ... }
    pub fn enum_weighted(self: *Prng, comptime E: type, weights: EnumWeights(E)) E { ... }
};
```

A small implementation of an integer-only generator is enough; xoshiro256++
and splitmix64 are common choices. The discipline is the point: no floats in
the public API, no dependency on `std.Random.DefaultPrng`, no algorithm
change without a major version bump of the test suite.

### Model-based property testing

Pair the real implementation with a trivially-correct reference (the model),
drive both with the same random operation stream, and assert observable
state matches after every step.

```zig
test "stack matches an ArrayList model" {
    var prng = std.Random.DefaultPrng.init(0xC0FFEE);
    const random = prng.random();

    var real: Stack(u32) = .empty;
    defer real.deinit(std.testing.allocator);

    var model: std.ArrayList(u32) = .empty;
    defer model.deinit(std.testing.allocator);

    const Op = enum { push, pop };

    for (0..1024) |_| {
        try std.testing.expectEqual(model.items.len, real.count());
        switch (random.enumValue(Op)) {
            .push => {
                const value = random.int(u32);
                try real.push(std.testing.allocator, value);
                try model.append(std.testing.allocator, value);
            },
            .pop => {
                const expected = if (model.items.len == 0) null else model.pop();
                try std.testing.expectEqual(expected, real.pop());
            },
        }
    }
}
```

Weight the op enum so the interesting state is reached often. A read-heavy
stream that mostly pops finds nothing because the structure stays empty.

### Invariant verification helpers

Encode the structural invariants of a type as a `verify` method that walks
itself and asserts every property. Call it from each mutating operation under
a compile-time flag, so fuzz and debug builds get continuous invariant
checking while release builds compile the calls out.

```zig
const verify_invariants = @import("build_options").verify_invariants;

const SinglyLinkedList = struct {
    head: ?*Node = null,
    count: u32 = 0,

    pub fn verify(list: *const SinglyLinkedList) void {
        var n: u32 = 0;
        var it = list.head;
        while (it) |node| : (it = node.next) n += 1;
        std.debug.assert(n == list.count);
    }

    pub fn push(list: *SinglyLinkedList, node: *Node) void {
        if (verify_invariants) list.verify();
        node.next = list.head;
        list.head = node;
        list.count += 1;
        if (verify_invariants) list.verify();
    }
};
```

Model-based testing and invariant helpers cover different things: the model
checks that observable behavior is right, `verify` checks that the internal
representation never enters an impossible state.

### Exhaustive enumeration

When the input space is small, replace random sampling with deterministic
enumeration. A generator object exposes the same draw primitives as a PRNG,
but the outer `while (!gen.done())` loop walks every reachable choice
sequence to completion.

```zig
test "every 3-bit triple satisfies the parity property" {
    var gen: Gen = .{};
    var seen: u32 = 0;
    while (!gen.done()) {
        const a = gen.int_inclusive(u1, 1);
        const b = gen.int_inclusive(u1, 1);
        const c = gen.int_inclusive(u1, 1);
        try std.testing.expectEqual(a ^ b ^ c, parity(a, b, c));
        seen += 1;
    }
    try std.testing.expectEqual(@as(u32, 8), seen);
}
```

`done()` returns false on the first call to start the iteration, then on
each subsequent call rightmost-increments the recorded choice sequence
subject to the bounds the test requested. The implementation is a stack of
`(value, bound)` pairs and runs in time proportional to the product of the
bounds.

Use this as a complement to random fuzzing, not a replacement: enumeration
is exhaustive but only feasible for tiny state spaces; random fuzzing scales
but only samples.

### Deterministic simulation

For stateful systems whose failure modes only surface under specific
interleavings, drive the entire system from a single seed and run it in
virtual time. Every nondeterministic decision (delivery order, latency,
fault injection, crash and restart, disk corruption) consumes from the same
PRNG. The determinism contract is `(seed, code_version)`: any failure
reproduces exactly from that pair, no matter how rare.

```zig
const Simulator = struct {
    prng: Prng,
    time_ns: u64 = 0,
    network: Network,
    storage: Storage,
    nodes: [node_count]Node,

    pub fn init(seed: u64) Simulator { ... }

    pub fn tick(sim: *Simulator) void {
        sim.time_ns += tick_ns;

        if (sim.prng.ratio(packet_drop)) sim.network.drop_one(&sim.prng);
        if (sim.prng.ratio(node_crash)) sim.crash_random(&sim.prng);

        for (&sim.nodes) |*node| node.tick(sim.time_ns);
        sim.network.deliver_ready(sim.time_ns, &sim.prng);
    }
};

test "cluster converges under faults" {
    const seed = std.crypto.random.int(u64);
    errdefer std.debug.print("FAILED seed={x}\n", .{seed});

    var sim: Simulator = .init(seed);
    for (0..1_000_000) |_| sim.tick();
    try sim.expect_converged();
}
```

The costs the codebase pays before this pattern is available: a vendored
deterministic PRNG (see above), every clock reading routed through a virtual
`time_ns`, every I/O operation routed through a swappable abstraction, and
a top-level entry point that logs the seed on failure so a CI flake
reproduces locally. The payoff is that a single failing seed found in CI
can be replayed in a debugger indefinitely.

### Inline snapshot tests

The test asserts that a value formats to a literal multiline string embedded
in the test source. The literal records its own source location via
`@src()`, and an env var rewrites the literal in place when the expected
value legitimately changes. Reviewing the diff is the review of the snapshot
change.

```zig
test "render tree" {
    try expect_snapshot(@src(),
        \\Node {
        \\  left: leaf(1)
        \\  right: leaf(2)
        \\}
    , render_tree(&example));
}
```

The mechanic is straightforward: the helper compares the actual formatted
output to the embedded string and either succeeds, fails the test, or when
`SNAP_UPDATE=1` is set in the environment reads its own source file,
locates the multiline string starting at `@src().line + 1`, and rewrites it.
Rerunning produces a clean diff the reviewer can inspect.

The pattern requires a formatting convention the rewriter can find. The
simplest is to insist the snapshot literal immediately follows the `@src()`
line and consists of contiguous `\\` multiline string lines; the rewriter
splices the new content between the prefix before that block and the suffix
after it.

Adopt a small in-tree helper or pull in an existing snapshot library. The
pattern shines for code generators, pretty-printers, and any test where the
expected value is a structured blob nobody wants to write by hand.

## Test organization

### Comptime test aggregator

A top-level file containing only a single `comptime` block that pulls in
every test-bearing sibling forces the compiler to walk those files and
discover their `test {}` blocks. The test runner builds and runs the
aggregator, giving a single binary that contains the whole suite.

```zig
comptime {
    _ = @import("parser.zig");
    _ = @import("lexer.zig");
    _ = @import("codegen.zig");
    _ = @import("vm.zig");
}
```

This is distinct from a compile-time test above: the imports themselves run
at compile time, but the `test {}` blocks they pull in still run at the
normal test-runner time. Pair with a small self-test that walks the source
directory and regenerates the import list, so adding a new file does not
silently drop its tests.

## References

- matklad, [Test Case Minimization](https://matklad.github.io/2026/04/20/test-case-minimization.html)
- matklad, [Generate All the Things](https://matklad.github.io/2021/11/07/generate-all-the-things.html)
- Jane Street, [Using ASCII Waveforms to Test Hardware Designs](https://blog.janestreet.com/using-ascii-waveforms-to-test-hardware-designs/)
- Ian Henry, [My Kind of REPL](https://ianthehenry.com/posts/my-kind-of-repl/)
