# Design Patterns

> **Source**: [matklad: Programming Aphorisms](https://matklad.github.io/2026/02/11/programming-aphorisms.html),
> [matklad: Strictly Monotonic Time](https://matklad.github.io/2026/01/23/strictly-monotonic-time.html),
> [matklad: Zig defer Patterns](https://matklad.github.io/2024/03/21/defer-patterns.html),
> [matklad: Zig And Rust](https://matklad.github.io/2023/03/26/zig-and-rust.html)

## Options Struct Pattern

Separate **positional dependency arguments** (resources the function needs to do its job) from **behavioral options** (configuration that varies per call site):

```zig
pub const HistoryOptions = struct {
    file: []const u8,

    pub fn from_environment(
        environment: *const std.process.EnvMap,
    ) HistoryOptions {
        // ...
    }
};

pub fn readHistory(
    io: std.Io,
    gpa: Allocator,
    options: HistoryOptions,
) ReadHistoryError!void {
    // io, gpa = positional deps (passed through to callees)
    // options = behavioral config (consumed by this function)
}
```

### Positional vs Named Arguments

- **Positional arguments**: Dependencies like `io`, `gpa` (allocator), `arena`. These are resources passed transitively to callees. Use canonical names.
- **Named arguments** (options struct): Behavior-variant configuration consumed by the current function. Use a dedicated struct with defaults.

### Naming Conventions

- `gpa` for general-purpose allocator
- `arena` for arena allocator
- `io` for I/O context
- `options` for the behavioral configuration struct

These are the canonical names. In application `main`, obtain them from Juicy Main: `init.gpa`, `init.io`, `init.arena`.

### Provide Shortcuts Across Layers

Add convenience constructors that bridge abstraction boundaries:

```zig
pub const HistoryOptions = struct {
    file: []const u8,

    /// Shortcut: read options from environment variables
    pub fn from_environment(
        environment: *const std.process.EnvMap,
    ) HistoryOptions {
        // ...
    }
};
```

---

## Named/Default Arguments via Anonymous Structs

```zig
pub inline fn request(
    method: std.http.Method,
    uri: std.Uri,
    options: struct {
        headers: ?HeaderMap = null,
        timeout_ms: u32 = 30_000,
    },
) !Response {
    // ...
}

// Call with named fields:
try request(.GET, uri, .{ .timeout_ms = 5_000 });
```

When the function only unpacks the options struct into a target type or forwards the fields to a callee, mark it `pub inline fn`. The options struct then collapses at the call site and adds no runtime cost over passing the fields positionally.

---

## Mixin Pattern (Zero-Bit Field)

Use `@fieldParentPtr` with a zero-bit struct to add methods to a type via composition:

```zig
pub fn CounterMixin(comptime Self: type) type {
    return struct {
        pub fn increment(mixin: *@This()) void {
            const parent: *Self = @fieldParentPtr("counter", mixin);
            parent.count += 1;
        }
    };
}

pub const Foo = struct {
    count: u32 = 0,
    counter: CounterMixin(Foo) = .{},
};

// Usage: foo.counter.increment()
```

---

## Multi-Phase Resource Lifecycle

When a resource's safe-operation envelope changes over its lifetime, model the lifetime as an explicit state enum. Move between states through dedicated transition functions, and assert the expected state at the entry of every public method. This turns "called at the wrong time" from a silent bug into a loud crash at the boundary where the misuse actually happens.

```zig
const Phase = enum { init, running, deinit };

const Resource = struct {
    parent: Allocator,
    phase: Phase,

    pub fn init(parent: Allocator) Resource {
        return .{ .parent = parent, .phase = .init };
    }

    pub fn transitionToRunning(self: *Resource) void {
        assert(self.phase == .init);
        self.phase = .running;
    }

    pub fn transitionToDeinit(self: *Resource) void {
        assert(self.phase == .running);
        self.phase = .deinit;
    }

    pub fn work(self: *Resource, request: Request) !void {
        assert(self.phase == .running);
        // ...
    }
};
```

### Phases with Per-State Payload

When each phase carries data the other phases do not need, replace the enum with a tagged union. The active field name is the phase, and the payload becomes addressable only after the corresponding state assert:

```zig
const State = union(enum) {
    idle,
    writing: struct { unflushed: u32 },
    checkpoint: struct { fsync_completion: Completion },
};

fn append(self: *Log, slot: Slot) void {
    assert(self.state == .writing);
    assert(self.state.writing.unflushed < slots_max);
    self.state.writing.unflushed += 1;
    // ...
}
```

The pattern avoids the alternative of carrying every phase's data as nullable fields and remembering to null them out on transition. Wrong-phase access becomes a compile-time field-not-found error rather than a forgotten reset.

---

## Allocate-then-Modify Pattern

Separate fallible allocation from infallible modification to maintain data structure invariants:

```zig
// Reserve capacity (can fail)
try list.ensureTotalCapacity(allocator, new_count);
errdefer comptime unreachable;

// Modify (cannot fail; capacity already reserved)
list.appendAssumeCapacity(value);
```

---

## Pre-allocation Strategy

For performance-critical code, allocate everything upfront:

```zig
// Allocate all needed memory at init time
const buffer = try allocator.alloc(u8, max_size);
defer allocator.free(buffer);

// Use the pre-allocated buffer without further allocation
var stack = std.ArrayList(i32).initBuffer(buffer[0..8]);
```

---

## Measure-Allocate-Fill (MAF) Pattern

Two-pass allocation: first compute the exact size needed, then allocate once, then fill. Avoids dynamic resizing and multiple allocations.

```zig
fn renderAll(allocator: Allocator, items: []const Item) ![]u8 {
    // Measure: dry run with a discarding writer to count bytes
    var counting: std.Io.Writer.Discarding = .{};
    for (items) |item| {
        try item.render(&counting.interface);
    }
    const total_bytes = counting.bytes_written;

    // Allocate: single exact allocation
    const buf = try allocator.alloc(u8, total_bytes);
    errdefer allocator.free(buf);

    // Fill: write into the pre-sized buffer
    var offset: usize = 0;
    for (items) |item| {
        offset += try item.renderInto(buf[offset..]);
    }

    return buf;
}
```

### When to Use MAF

- Output size depends on input data and cannot be known statically
- You want a **single exact allocation** instead of a growable buffer
- The measure pass is cheap relative to allocation overhead (e.g., formatting, serialization)

### Simpler Variant (Counter-Based)

When the size can be computed without a dry run:

```zig
// Measure
var size: usize = 0;
for (items) |item| {
    size += item.encodedLen();
}

// Allocate
const buf = try allocator.alloc(u8, size);
errdefer allocator.free(buf);

// Fill
var offset: usize = 0;
for (items) |item| {
    offset += item.encodeTo(buf[offset..]);
}
```

---

## Asserting Post-Conditions (Contract Programming)

Pair a pre-condition `assert` with a `defer assert` of the post-condition at the top of a block. The pre-condition documents what the block requires, the deferred post-condition documents what it promises, and both run regardless of how the block exits. The contract is then visible in two lines at the top of the code that has to satisfy it.

```zig
{
    assert(!resource.opened);
    defer assert(resource.opened);
    // ... code that should open the resource
}
```

---

## Post-Increment / Side Effects After Return

Use `defer` to perform side effects after the return value has been computed:

```zig
pub fn acquire(self: *ScanBufferPool) Error!*const ScanBuffer {
    if (self.scan_buffer_used == constants.lsm_scans_max) {
        return Error.ScansMaxExceeded;
    }
    defer self.scan_buffer_used += 1;
    return &self.scan_buffers[self.scan_buffer_used];
}
```

---

## Guard-Based Clamping

When a value comes from a source that promises an invariant (monotonicity, a lower bound, a minimum granularity) but cannot be fully trusted to deliver it, remember the last accepted value in a process-local guard field and clamp every fresh reading against it with `@max`. The guard turns a possibly-violated external invariant into a locally-enforced one without branching on the failure case.

```zig
fn now(clock: *Clock) Instant {
    const t_raw = os_time_monotonic();
    const t = @max(t_raw, clock.guard);
    assert(t >= clock.guard);
    assert(t >= t_raw);
    clock.guard = t;
    return t;
}
```

The monotonic-clock case is the canonical instance because hardware and kernel bugs do occasionally regress monotonic time, but the same shape applies to any externally-supplied value that must never decrease over the lifetime of the process.

### Strict Monotonicity

When consecutive readings must also be distinct (so values can serve as unique identifiers, not just as a non-decreasing sequence), clamp against `guard + 1` instead of `guard`. Prefer strict monotonicity whenever uniqueness is required, since the weak form will produce duplicates whenever the underlying source stalls.

```zig
const t = @max(t_raw, clock.guard + 1);
assert(t > clock.guard);
clock.guard = t;
```
