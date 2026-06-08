# Syntax & Style Idioms

> **Source**: [matklad: Zig's Lovely Syntax](https://matklad.github.io/2025/08/09/zigs-lovely-syntax.html)

## Integer Literals

All integer literals have type `comptime_int` and are coerced on assignment:

```zig
const x: i32 = 92;     // coercion on assignment
const y = @as(i32, 92); // explicit ascription
```

## String Literals

Raw strings use `\\` line continuations:

```zig
const raw =
    \\Roses are red
    \\  Violets are blue
    \\;
```

## Record/Struct Literals

Field syntax matches assignment, enabling mechanical search:

```zig
const p: Point = .{
    .x = 1,
    .y = 2,
};
```

## Type Prefix Notation

```zig
u32              // integer
[3]u32           // array of 3 u32
?[3]u32          // optional array
*const [3]u32    // const pointer to array
[]const u8       // slice of const bytes (string)
```

## Boolean Operators are Keywords

```zig
// Zig uses `and`/`or` (not && / ||) because they short-circuit (control flow)
while (count > 0 and std.ascii.isWhitespace(buffer[count - 1])) {
    count -= 1;
}
```

## Labeled Blocks for Values

```zig
const header = blk: {
    var oldest: ?usize = null;
    for (headers, 0..) |h, i| {
        if (oldest == null or h.timestamp < headers[oldest.?].timestamp) {
            oldest = i;
        }
    }
    break :blk &headers[oldest.?];
};
```

## Ternary via `if` Expression

```zig
const direction = if (prng.boolean()) .ascending else .descending;
```

## Loop `else` Clauses

```zig
const found = for (haystack) |item| {
    if (item == needle) break item;
} else null;
```

## No Prelude, Explicit Imports

```zig
const std = @import("std");
const json = std.json;
const mem = std.mem;
```

## Bare Comptime Blocks

A `comptime { ... }` placed at file or struct scope has no value and runs purely for compile-time side effects. Three recurring uses are build-time assertions over scope-level constants, target-shape checks via `@compileError`, and transitive-module aggregation:

```zig
comptime {
    assert(MiB == 1024 * KiB);
}

comptime {
    if (builtin.target.cpu.arch.endian() != .little) {
        @compileError("big-endian targets are unsupported");
    }
}

comptime {
    _ = @import("bit_set.zig");
    _ = @import("ring_buffer.zig");
}
```

Contrast with the value-returning form `const x = comptime blk: { ... }` documented under labeled blocks: the bare form is a declaration, not an expression.

Used at struct scope, the same shape pins binary layout. See `types.md` ("Binary Layout: extern and packed") and `comptime.md` ("Comptime Layout Assertions").

## Builtin Functions Use `@` Prefix

```zig
@as(i32, 92)              // type ascription
@intFromEnum(value)        // enum to int
@enumFromInt(42)           // int to enum
@field(obj, field_name)    // runtime field access
@fieldParentPtr("field", ptr) // container from field pointer
@FieldType(T, field_name)  // type of a field on T
@typeInfo(T)               // type introspection
@Int(sign, bits)           // construct integer type
@Tuple(&types)             // construct tuple type
@Struct(layout, ...)       // construct struct type (see comptime topic)
@Enum(TagInt, mode, ...)   // construct enum type (see comptime topic)
@compileError("message")   // compile-time error
@bitCast(value)            // reinterpret bits
@ptrCast(ptr)              // pointer cast
@sizeOf(T)                 // size in bytes
@alignOf(T)                // alignment
@tagName(enum_val)         // enum variant name as string
@errorName(err)            // error name as string
```

## Raw Identifiers for Reserved Words

```zig
// Use @"..." when a field name is a Zig keyword
const info = @typeInfo(T);
switch (info) {
    .@"struct" => |s| { ... },
    .@"enum" => |e| { ... },
    else => {},
}
```

## Wrapping/Saturating Arithmetic

```zig
const wrapped = @as(u8, 255) +% 1;     // wraps to 0
const saturated = @as(u8, 255) +| 1;   // stays at 255
```

## Destructuring

```zig
const tuple = .{ 1, 2, 3 };
var x: u32 = undefined;
x, var y: u32, const z = tuple;
```
