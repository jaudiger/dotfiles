# Error Handling & Defer Patterns

> **Source**: [matklad: Zig defer Patterns](https://matklad.github.io/2024/03/21/defer-patterns.html),
> [matklad: Error Codes for Control Flow](https://matklad.github.io/2025/11/06/error-codes-for-control-flow.html),
> [matklad: Diagnostics Factory](https://matklad.github.io/2026/02/16/diagnostics-factory.html)

## Error Unions

```zig
fn divide(a: i32, b: i32) error{DivisionByZero}!i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}
```

## `try`: Early Return on Error

```zig
const result = try divide(10, 2);
```

## `catch`: Handle or Provide Default

```zig
const value = divide(10, 0) catch |err| blk: {
    log.err("division failed: {}", .{err});
    break :blk 0;
};

// Or with a simple default:
const value = divide(10, 0) catch 0;
```

## Explicit Error Discard

Value discards and error discards use **different syntax**. This protects against functions gaining new failure paths:

```zig
_ = can_fail();           // ERROR: error union is discarded
can_fail() catch {};      // OK: explicit error discard
```

## `catch unreachable`: Contract Assertion

Use `catch unreachable` only when a prior invariant makes failure impossible at this call site. It is a static claim that the error path cannot be taken, not a way to silence an unhandled error. If the precondition does not actually rule out failure, use `catch |err| ...` or propagate with `try`.

```zig
const ts = posix.clock_gettime(posix.CLOCK.REALTIME) catch unreachable;
```

When the unreachable claim depends on validation performed elsewhere, leave a short note at the call site so it can be audited:

```zig
const decoder = MultiBatchDecoder.init(body, .{
    .element_size = operation.event_size(),
}) catch unreachable; // Already validated upstream.
```

## Error Set Merging

```zig
const FileError = error{NotFound, PermissionDenied};
const NetworkError = error{Timeout, ConnectionRefused};
const AllErrors = FileError || NetworkError;
```

## `errdefer` for Cleanup on Error Path

```zig
fn initResource(allocator: Allocator) !*Resource {
    const res = try allocator.create(Resource);
    errdefer allocator.destroy(res);  // Only runs if function returns error
    try res.setup();
    return res;
}
```

## `errdefer` with Error Capture for Logging

```zig
fn readPort(process: *Process) !u16 {
    errdefer |err| log.err("failed to read port: {}", .{err});
    var buf: [6]u8 = undefined;
    const len = try process.stdout.?.readAll(&buf);
    return try std.fmt.parseInt(u16, buf[0 .. len -| 1], 10);
}
```

## `errdefer` for Partial Initialization Rollback

When initializing a collection element by element, pair a per-iteration `errdefer` that tears down the already-initialized prefix with an outer `errdefer` that takes over once the loop completes:

```zig
fn init_all(allocator: Allocator, count: usize) ![]Node {
    const nodes = try allocator.alloc(Node, count);
    errdefer allocator.free(nodes);

    for (nodes, 0..) |*node, i| {
        errdefer for (nodes[0..i]) |*n| n.deinit(allocator);
        node.* = try Node.init(allocator);
    }
    errdefer for (nodes) |*n| n.deinit(allocator);

    return nodes;
}
```

The inner `errdefer` only sees the items constructed so far; it falls out of scope at the end of each iteration and is replaced on the next one. The outer `errdefer` only becomes relevant after the loop exits successfully. Without the inner form, a failure mid-loop would leak every prior element.

## `errdefer comptime unreachable`: Prove No Errors

Documents that subsequent code cannot fail. Compile-time assertion:

```zig
fn grow(self: *Self, allocator: Allocator, new_capacity: usize) Allocator.Error!void {
    @branchHint(.cold);
    var map: Self = .{};
    try map.allocate(allocator, new_capacity);
    errdefer comptime unreachable;
    // All code below is guaranteed to not return an error
    // If it does, compilation fails
    self.rehash(map);
}
```

---

## Diagnostic Sink Pattern

Separate **error reporting** (diagnostics for humans) from **error handling** (control flow). Functions accept an optional `Diagnostics` parameter for reporting while returning error codes for control flow:

```zig
fn parse(
    input: []const u8,
    diagnostics: ?*Diagnostics,
) error{InvalidSyntax, UnexpectedToken}!Ast {
    // Error codes drive control flow (caller can switch on them)
    // Diagnostics provide human-readable messages (caller can display them)
    if (invalid) {
        if (diagnostics) |d| d.addError("unexpected '{c}' at offset {d}", .{ ch, offset });
        return error.UnexpectedToken;
    }
    // ...
}
```

- **Caller wants to handle the error**: pass `null` diagnostics and `switch` on the error value
- **Caller wants to present the error to the user**: pass in a `Diagnostics` sink

## Diagnostics Factory Pattern

Use constructor methods (`errors.add_*()`) rather than building a large discriminated union of error variants:

```zig
const Diagnostics = struct {
    errors: std.ArrayList(Entry),

    pub fn addLongLine(self: *Diagnostics, file: SourceFile, line_index: usize) void {
        // Convert low-level info (absolute offset) to user-friendly format (line:col)
        const line = file.lineNumber(line_index);  // 0-based to 1-based
        self.errors.append(allocator, .{ .message = ... });
    }

    pub fn addBannedImport(self: *Diagnostics, file: SourceFile, offset: usize, name: []const u8) void {
        // ...
    }
};
```

### Key Advantages

- **Flexibility**: No need to define error variants upfront; add new constructors as needed
- **Data transformation**: Natural location to convert low-level data (offsets) to user-friendly format (line:column)
- **Greppability**: Find all error sites with `rg 'diagnostics.add'`
- **Polymorphism**: Same interface supports multiple backends (stderr, in-memory capture for testing) without large tagged unions
- **Accumulation**: Collect multiple errors before reporting, or fail fast -- the pattern supports both

---

## Errors vs Invariant Violations

Three mechanisms cover three situations. Recoverable failures propagate up the stack as error unions, and the caller decides what to do. Contract-level invariants that only a bug would violate are enforced inline with `assert` and `catch unreachable`. Conditions where continuing would risk corruption or break a documented invariant terminate the process via `@panic`. The deciding question is whether the caller has a meaningful response. If not, a returned error only delays the crash and obscures the cause. See the `patterns` topic for post-condition asserts using `defer assert`.

## `@panic` for Unrecoverable Conditions

Reserve `@panic` for conditions where the only safe action is to stop. The message should describe the invariant that was violated so it survives into the crash report:

```zig
if (now < self.monotonic_guard) @panic("monotonic clock regressed");
```

Bridge a failed call into a panic when its failure means the system has reached a state from which it cannot continue safely:

```zig
_ = log_fsync(prepare) catch @panic("write-ahead log fsync failed");
```

A returned error invites the caller to recover. A panic refuses that option deliberately.
