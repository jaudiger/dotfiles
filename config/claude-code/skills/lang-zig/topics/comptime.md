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

## Type Constructors (Generic Types)

```zig
fn Api(comptime T: type) type {
    return struct {
        const Self = @This();
        // Use T.resource_meta at comptime to construct URLs
        pub fn list(self: *Self) !T.resource_meta.list_kind {
            // ...
        }
    };
}
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
