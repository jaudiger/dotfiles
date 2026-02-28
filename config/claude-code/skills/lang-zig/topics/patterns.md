# Design Patterns

> **Source**: [matklad: Programming Aphorisms](https://matklad.github.io/2026/02/11/programming-aphorisms.html),
> [matklad: Strictly Monotonic Time](https://matklad.github.io/2026/01/23/strictly-monotonic-time.html),
> [matklad: Zig defer Patterns](https://matklad.github.io/2024/03/21/defer-patterns.html),
> [matklad: Zig And Rust](https://matklad.github.io/2023/03/26/zig-and-rust.html),
> [Zig 0.15.1 Release Notes](https://ziglang.org/download/0.15.1/release-notes.html)

## Options Struct Pattern

Separate **positional dependency arguments** (resources the function needs to do its job) from **behavioral options** (configuration that varies per call site):

```zig
pub const HistoryOptions = struct {
    file: []const u8,

    pub fn from_environment(
        environment: *const std.process.Environ.Map,
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

### Provide Shortcuts Across Layers

Add convenience constructors that bridge abstraction boundaries:

```zig
pub const HistoryOptions = struct {
    file: []const u8,

    /// Shortcut: read options from environment variables
    pub fn from_environment(
        environment: *const std.process.Environ.Map,
    ) HistoryOptions {
        // ...
    }
};
```

---

## Named/Default Arguments via Anonymous Structs

```zig
fn request(
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

Use `defer` with `assert` to verify that a block of code upholds its contract:

```zig
{
    assert(!grid.free_set.opened);
    defer assert(grid.free_set.opened);
    // ... code that should open the free set
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

## Guard-Based Clamping (Strictly Monotonic Time)

Defensive pattern to enforce invariants using in-process guards and `@max`:

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

### Strict Monotonicity (Unique Timestamps)

Strengthen to ensure strictly increasing values:

```zig
const t = @max(t_raw, clock.guard + 1);
assert(t > clock.guard);
clock.guard = t;
```

### Key Principles

- OS guarantees may fail empirically -- add in-process guards as defense
- Use `@max()` for safe clamping without branches
- Use `assert()` to document and enforce invariants at runtime
- Prefer strict monotonicity (`>`) over weak (`>=`) when timestamps must be unique
