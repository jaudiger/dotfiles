# Type System, Generics, Tagged Unions & Newtype Index Pattern

> **Source**: [matklad: Types and the Zig Programming Language](https://matklad.github.io/2023/08/09/types-and-zig.html),
> [matklad: Zig's Lovely Syntax](https://matklad.github.io/2025/08/09/zigs-lovely-syntax.html),
> [matklad: Partially Matching Zig Enums](https://matklad.github.io/2025/08/08/partially-matching-zig-enums.html),
> [matklad: Newtype Index Pattern In Zig](https://matklad.github.io/2025/12/23/zig-newtype-index-pattern.html)

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

Function signatures must be complete; there is no return-type inference.

```zig
fn process(comptime T: type, data: []const T) ProcessResult(T) {
    return ProcessResult(T).from(data);
}
```

## Generic Type Pattern (Comptime Closures)

A function that takes a `comptime T: type` and returns an anonymous `struct` body acts as a generic type constructor. `T` is captured by the inner struct and is available to every declaration inside it.

```zig
pub fn RingBuffer(comptime T: type) type {
    return struct {
        items: []T,
        head: usize = 0,
        tail: usize = 0,

        pub fn push(self: *@This(), value: T) void {
            self.items[self.tail] = value;
            self.tail = (self.tail + 1) % self.items.len;
        }
    };
}

var buf: RingBuffer(u32) = .{ .items = backing[0..] };
buf.push(42);
```

### Concrete Generics vs `anytype`

Both forms accept a flexible parameter; they differ in where the contract is
checked and how the generated code reads.

```zig
// Concrete generic: monomorphized per T, contract checked at the definition
fn Buffer(comptime T: type) type {
    return struct {
        items: []T,
        pub fn push(self: *@This(), value: T) void { /* ... */ }
    };
}

// anytype: structural, contract checked at every call site
fn serialize(writer: anytype, value: anytype) !void {
    try writer.print("{}", .{value});
}
```

Prefer `fn Type(comptime T: type) type` for hot paths and library cores: the
monomorphization site is explicit, the type is grep-able, and the compiler
verifies the contract once at the definition rather than at every call site.
Reach for `anytype` in adapter-like helpers (formatters, generic writers,
comptime config-struct passers) where the parameter is genuinely structural
and naming a concrete type would just push boilerplate onto callers.

### `void` as a Structural Placeholder

When a generic accepts an optional component, accepting `void` and degenerating
the dependent sub-types is cleaner than threading an optional through. A `void`
field is zero-sized, so the runtime layout collapses for the absent case.

```zig
pub fn KeyType(comptime Prefix: type) type {
    const Pad = switch (Prefix) {
        void => u0,
        u64 => u0,
        u128 => u64,
        else => @compileError("invalid Prefix: " ++ @typeName(Prefix)),
    };

    return extern struct {
        prefix: Prefix,
        timestamp: u64,
        padding: Pad = 0,

        pub fn prefix_of(self: @This()) Prefix {
            return if (Prefix == void) {} else self.prefix;
        }
    };
}
```

The `if (Prefix == void) {} else ...` form is comptime-evaluated, so the dead
branch contributes no runtime code.

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

For a non-exhaustive enum (declared with a trailing `_`), handle the explicit
tags and use a standalone `_` prong for unnamed values:

```zig
switch (enum_val) {
    .special_case_1 => foo(),
    .special_case_2 => bar(),
    _ => unknown(),
}
```

### Comptime Exhaustiveness Assertion

`@typeInfo(E).@"enum".is_exhaustive` is `true` at compile time when `E` has
no trailing `_`. Useful as a contract check in generics that take an enum
type as a comptime parameter:

```zig
fn Dispatcher(comptime E: type) type {
    comptime assert(@typeInfo(E).@"enum".is_exhaustive);
    return struct { /* ... */ };
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

### `inline for` Over a Tuple of Types

When the same comptime logic must run over several related types (multiple
enums that share a tag space, several struct types that share a method name),
iterate over a tuple of types:

```zig
inline for (.{ OperationA, OperationB }) |Enum| {
    inline for (@typeInfo(Enum).@"enum".fields) |field| {
        // Generates a distinct branch per Enum and field combination
        if (@intFromEnum(value) == @field(Enum, field.name).int()) {
            return field.name;
        }
    }
}
```

See `comptime.md` for the broader `inline for` semantics.

### Comptime-Generated Tagged Unions from an Enum

When each variant of an enum should carry a distinct payload type derived from the variant itself, build the union by reflection rather than writing the cases by hand. Take the enum and a `fn(comptime variant: E) type` mapping each tag to its payload:

```zig
pub fn EnumUnion(
    comptime E: type,
    comptime PayloadFor: fn (comptime variant: E) type,
) type {
    const fields = @typeInfo(E).@"enum".fields;
    var names: [fields.len][:0]const u8 = undefined;
    var types: [fields.len]type = undefined;
    for (fields, 0..) |field, i| {
        names[i] = field.name;
        types[i] = PayloadFor(@field(E, field.name));
    }
    return @Union(.auto, E, &names, &types, &@splat(.{}));
}
```

The result is `union(E)` where every tag's payload type comes from `PayloadFor`. Pair it with `inline else` to dispatch generically across all variants from a single switch:

```zig
switch (any) {
    inline else => |payload, tag| handle(tag, payload),
}
```

Reach for this when several parallel concrete types share a discriminator and you want one switch site to cover them all. The hand-written alternative duplicates the tag list and drifts out of sync when variants are added.

---

## Binary Layout: extern and packed

For wire protocols, on-disk records, and FFI, the layout has to be predictable. Zig offers two qualifiers that pin it: `extern struct` for C ABI layout with natural alignment, and `packed struct` for bit-packed fields with no padding. The choice depends on what the format demands.

### `extern struct` for Wire and FFI Formats

`extern struct` lays fields out in source order at their natural alignment, padding as needed to satisfy each field's `@alignOf`. Fields are addressable as ordinary values, and the type round-trips cleanly through `@ptrCast` and disk or network I/O.

Pin the layout with a `comptime` block next to the definition:

```zig
const Record = extern struct {
    id: u128,
    timestamp: u64,
    flags: u32,
    code: u16,
    reserved: [10]u8 = @splat(0),

    comptime {
        assert(@sizeOf(Record) == 48);
        assert(@alignOf(Record) == 16);
        assert(@offsetOf(Record, "id") == 0);
        assert(@offsetOf(Record, "timestamp") == 16);
        assert(@offsetOf(Record, "flags") == 24);
        assert(@offsetOf(Record, "code") == 28);
        assert(@offsetOf(Record, "reserved") == 30);
    }
};
```

The `@offsetOf` assertions catch silent layout drift when a field is added, reordered, or its type changes width. A trailing `reserved` array leaves room for forward-compatible fields without breaking the existing encoding.

### `packed struct` for Bit-Packed Fields

`packed struct(BackingInt)` lays fields out contiguously in the bits of `BackingInt`, with no padding between them. Use it for flag words, sub-byte fields, and any record that must fit a fixed integer width. Pin the size invariant the same way as `extern struct`:

```zig
const AccountFlags = packed struct(u16) {
    linked: bool = false,
    closed: bool = false,
    history: bool = false,
    padding: u13 = 0,

    comptime {
        assert(@sizeOf(AccountFlags) == @sizeOf(u16));
        assert(@bitSizeOf(AccountFlags) == 16);
    }
};
```

The explicit backing integer and the explicit `padding` field serve the same goal: every bit accounted for, nothing implicit. The sum of field `@bitSizeOf` must equal the backing integer's bit width, which is what `padding` is for.

`packed struct` and `packed union` cannot contain pointer fields directly; store a `usize` and convert with `@ptrFromInt` and `@intFromPtr` at the use site.

### Enums and Packed Types in Extern Position

Enums and packed structs used as fields of an `extern struct`, or exported across an FFI boundary, must specify an explicit backing integer:

```zig
const Code = enum(u8) { a, b, c, d };
const Flags = packed struct(u8) { read: bool, write: bool, _pad: u6 = 0 };

const Header = extern struct {
    code: Code,
    flags: Flags,
};
```

### Packed Unions

Packed unions require an explicit backing integer. Every field must have the same `@bitSizeOf` as the backing integer:

```zig
const Split16 = packed union(u16) {
    raw: MaybeSigned16,
    split: packed struct { low: u8, high: u8 },
};
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
