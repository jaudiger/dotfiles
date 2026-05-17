# Comptime Patterns

> **Source**: [matklad: Things Zig comptime Won't Do](https://matklad.github.io/2025/04/19/things-zig-comptime-wont-do.html),
> [matklad: Comptime Zig ORM](https://matklad.github.io/2025/03/19/comptime-zig-orm.html),
> [matklad: A Fun Zig Program](https://matklad.github.io/2025/04/21/fun-zig-program.html)

## Basic Comptime Evaluation

```zig
fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

// Computed at compile time:
const result = comptime max(i32, 5, 10);
```

## Comptime Block Expressions

```zig
const lookup_table = comptime blk: {
    var table: [256]u8 = undefined;
    for (&table, 0..) |*entry, i| {
        entry.* = @intCast(i * 2);
    }
    break :blk table;
};
```

## `@setEvalBranchQuota`

Comptime evaluation has a default branch budget. Nontrivial work hits the
limit and the compiler aborts: deep recursion, accumulating slices across
many fields, or iterating over a large generated table. Raise the quota at
the top of the function or block that needs it.

```zig
fn TableType(comptime Schema: type) type {
    @setEvalBranchQuota(32_000);
    // comptime field iteration, slice accumulation, type reification
}
```

The number is empirical: bump it until the build passes. Keep the call
narrowly scoped rather than raising it globally.

## `inline for` vs `comptime for`

- **`comptime for`**: Entire loop evaluated at compile time, body must also be comptime
- **`inline for`**: Loop structure known at compile time, body may use runtime values

```zig
// inline for: each iteration generates separate code
inline for (struct_info.fields) |field| {
    const field_value = @field(value, field.name);
    processField(field.type, field_value);  // runtime values allowed
}
```

## Type Reflection with `@typeInfo`

```zig
const info = @typeInfo(MyStruct);
switch (info) {
    .@"struct" => |s| {
        inline for (s.fields) |field| {
            // field.name, field.type, field.default_value_ptr, etc.
        }
    },
    else => @compileError("expected struct"),
}
```

The `.@"fn"` case exposes a callable's signature, which lets a generic
helper validate a user-supplied callback at comptime.

```zig
fn registerCallback(comptime callback: anytype) void {
    const info = @typeInfo(@TypeOf(callback)).@"fn";
    if (info.params.len != 1) @compileError("callback must take one argument");
    const param = info.params[0];
    if (param.is_generic) @compileError("callback parameter must be concrete");
    if (info.return_type == null) @compileError("callback must have a return type");
    // info.params[i].type, info.return_type, info.calling_convention available
}
```

## Type Construction Builtins

```zig
@Int(.unsigned, 10)                                // integer type
@Tuple(&.{ u32, [2]f64 })                         // tuple type
@Pointer(.one, .{ .@"const" = true }, u32, null)   // pointer type
@Struct(.auto, null, &names, &types, &field_attrs)  // struct type
@Union(.auto, MyEnum, &names, &types, &@splat(.{})) // union type
@Enum(u32, .exhaustive, &names, &values)            // enum type
@Fn(&param_types, &@splat(.{}), ReturnType, .{})    // function type
@EnumLiteral()                                      // enum literal type
```

Use `&@splat(.{})` for default attributes across all fields.

For types without a dedicated builtin, use literal syntax: `opaque {}`, `?T`, `E!T`, `error{ ... }`, `[len]Elem`.

When the bit count is itself a comptime expression, prefer the
standard-library helper `std.meta.Int(sign, bits)` over `@Int`. The bit
count is typically `@bitSizeOf(SomeType)` or arithmetic over several
`@bitSizeOf` values.

```zig
const Word = u64;
const Index = std.meta.Int(.unsigned, @bitSizeOf(Word) - 1);
```

## Field-Driven Struct Generation

A common comptime task is to derive one struct type from another: walk the
input type's fields, accumulate parallel name and type slices, and reify
the result with `@Struct`. The accumulators start empty and grow with `++`.

```zig
fn IndexesType(comptime Object: type) type {
    @setEvalBranchQuota(8_000);
    comptime var names: []const [:0]const u8 = &.{};
    comptime var types: []const type = &.{};
    inline for (std.meta.fields(Object)) |field| {
        if (std.mem.eql(u8, field.name, "id")) continue;
        names = names ++ &[_][:0]const u8{field.name};
        types = types ++ &[_]type{IndexTreeType(field.type)};
    }
    return @Struct(.auto, null, names, types, &@splat(.{}));
}
```

`&@splat(.{})` applies default attributes uniformly. When a field needs a
specific `alignment`, `default_value_ptr`, or `is_comptime`, build the
attribute slice explicitly instead of splatting.

## `std.meta.FieldEnum` and `@FieldType` for Field-Level Dispatch

```zig
fn IndexTableType(
    comptime Value: type,
    comptime field: std.meta.FieldEnum(Value),
) type {
    const FieldType = @FieldType(Value, @tagName(field));
    return struct { ... };
}
```

`@FieldType(T, field_name)` returns the type of the named field on type `T`.

## Comptime Layout Assertions

Wire-format types, FFI structs, and packed bitfields depend on a specific
memory layout. Pin that contract with a `comptime { ... }` block inside the
struct that asserts `@sizeOf`, `@alignOf`, `@bitSizeOf`, and `@offsetOf`
against expected values. An accidental field reorder, padding change, or
type swap then fails the build instead of corrupting data at runtime.

```zig
const Header = extern struct {
    magic: u32,
    version: u16,
    flags: u16,
    payload_len: u64,

    comptime {
        assert(@sizeOf(Header) == 16);
        assert(@alignOf(Header) == 8);
        assert(@offsetOf(Header, "payload_len") == 8);
    }
};

const Flags = packed struct(u16) {
    a: bool,
    b: bool,
    rest: u14,

    comptime {
        assert(@bitSizeOf(Flags) == 16);
        assert(@sizeOf(Flags) == 2);
    }
};
```

See the `types` topic for related discipline on `extern` and `packed`
structs.

## Comptime Limitations (By Design)

1. **No host leakage**: Comptime code behaves identically regardless of compilation host
2. **No dynamic code generation**: No `#eval` or string-to-code facilities
3. **No custom syntax / DSLs**: Comptime functions operate on values, not syntax
4. **No runtime type information (RTTI)**: Types exist only at compile time (but you can build RTTI structs at comptime that are reified at runtime)
5. **No method addition to generated types**: Use top-level functions instead
6. **No I/O at comptime**: All comptime is hermetic, reproducible, and safe

## Conditional Types in Signatures

```zig
fn f(comptime x: bool) if (x) u32 else bool {
    return if (x) 0 else false;
}
```
