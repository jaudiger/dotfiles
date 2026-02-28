# Type System, Generics, Tagged Unions & Newtype Index Pattern

> **Source**: [matklad: Types and the Zig Programming Language](https://matklad.github.io/2023/08/09/types-and-zig.html),
> [matklad: Zig's Lovely Syntax](https://matklad.github.io/2025/08/09/zigs-lovely-syntax.html),
> [matklad: Partially Matching Zig Enums](https://matklad.github.io/2025/08/08/partially-matching-zig-enums.html),
> [matklad: Newtype Index Pattern In Zig](https://matklad.github.io/2025/12/23/zig-newtype-index-pattern.html),
> [Zig 0.15.1 Release Notes](https://ziglang.org/download/0.15.1/release-notes.html),
> [Zig 0.15.2 Language Reference](https://ziglang.org/documentation/0.15.2/)

## Nominal Types Without Names

Two structs with identical structures are **different types** unless they share the same declaration:

```zig
fn f() struct { val: i32 } { return .{ .val = 92 }; }
fn g(s: struct { val: i32 }) void { _ = s; }

pub fn main() void {
    g(f()); // ERROR: type mismatch, different anonymous struct types
}
```

**Exception**: Anonymous struct **literals** (`.{ .x = 1 }`) are structural and coerce to compatible named types.

## Explicit Function Signatures

Function signatures must be complete. No `auto` return types, no inference from body:

```zig
// Return type must be explicit
fn process(comptime T: type, data: []const T) ProcessResult(T) {
    // ...
}
```

## Generic Type Pattern (Comptime Closures)

```zig
pub fn Api(comptime T: type) type {
    return struct {
        client: *Client,

        pub fn list(self: @This()) !T.resource_meta.list_kind {
            // T is captured from enclosing scope
        }
    };
}

// Usage: type parameter explicit at construction
var api = Api(CoreV1Pod){ .client = &client };
const pods = try api.list();
```

## `anytype` for Duck Typing

```zig
fn serialize(writer: anytype, value: anytype) !void {
    // writer must have a `print` method
    try writer.print("{}", .{value});
}
```

## Tagged Unions & Enum Matching

### Basic Tagged Union

```zig
const Result = union(enum) {
    success: i32,
    failure: []const u8,
};

switch (result) {
    .success => |value| handleSuccess(value),
    .failure => |msg| handleFailure(msg),
}
```

### Non-Exhaustive Enum Switch

Mixing explicit tags with `_` prong and combining `else` with `_`:

```zig
switch (enum_val) {
    .special_case_1 => foo(),
    _, .special_case_2 => bar(),  // _ and explicit combined
}
```

### Partial Enum Matching with `inline` and `comptime unreachable`

When you need to handle a subset of variants with shared code, then specialize:

```zig
const U = union(enum) { a: i32, b: i32, c };

fn handle(u: U) void {
    switch (u) {
        inline .a, .b => |_, ab| {
            handle_ab();  // shared code
            switch (ab) {
                .a => handle_a(),     // specialization
                .b => handle_b(),     // specialization
                else => comptime unreachable,  // compile-time proof of exhaustiveness
            }
        },
        .c => handle_c(),
    }
}
```

The `comptime unreachable` is key: because `ab` is known at comptime, the compiler verifies that `else` is truly unreachable.

### Inline Switch for Code Generation

```zig
switch (result) {
    inline .success, .failure => |val| {
        // Generates separate code for each variant
        processGeneric(val);
    },
}
```

---

## Newtype Index Pattern

Use non-exhaustive enums to create strongly-typed indexes:

```zig
const PodIndex = enum(u32) { _ };
const DeploymentIndex = enum(u32) { _ };
```

This prevents accidental mixing of different index types despite identical underlying representation.

### With Named Constants

```zig
pub const Node = enum(u32) {
    root = 0,
    invalid = std.math.maxInt(u32),
    _,

    pub const Data = struct {
        parent: Node,
        children_start: u32,
        children_count: u32,
    };
};
```

### Conversion

```zig
const index: u32 = @intFromEnum(node);
const node: Node = @enumFromInt(index);
```

### Best Practices for Newtype Indexes

- **Omit "Index" suffix**: Use `Node` not `NodeIndex`
- **Nest associated data**: `Node.Data` groups the node's payload
- **Add symbolic constants**: `.root`, `.invalid` improve readability
- **Add compile-time size assertions**: `comptime assert(@sizeOf(Node.Data) == 12)`
- **Prefer container methods**: `tree.parent(node)` over `node.parent(tree)`
