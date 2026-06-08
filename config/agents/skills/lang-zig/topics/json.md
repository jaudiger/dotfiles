# JSON Parsing & Serialization

## Parsing

The owned form returns a `Parsed(T)` that owns its allocations and must be released:

```zig
const parsed = try std.json.parseFromSlice(
    MyStruct,
    allocator,
    json_bytes,
    .{ .ignore_unknown_fields = true },
);
defer parsed.deinit();
const value = parsed.value;
```

The leaky form skips that bookkeeping and lets a caller-supplied arena reclaim everything in bulk:

```zig
var arena: std.heap.ArenaAllocator = .init(gpa);
defer arena.deinit();

const value = try std.json.parseFromSliceLeaky(
    MyStruct,
    arena.allocator(),
    json_bytes,
    .{ .ignore_unknown_fields = true },
);
```

Prefer the leaky form when the result has a short, well-bounded lifetime tied to an arena that already exists, such as a request handler, a CLI command, or a test case. Prefer the owned form when the parsed value escapes that lifetime and you want explicit per-call cleanup.

## Parse options

- **`ignore_unknown_fields`**: When `true`, the parser drops fields not present in the target type instead of failing. Set this whenever the JSON is produced by something outside your control and may grow new fields.
- **`allocate`**: Use `.alloc_always` when the parsed value must outlive the input buffer, since strings are copied. Use `.alloc_if_needed` to keep parsed strings as zero-copy slices into the input buffer when its lifetime is at least as long as the parsed value.

## Serialization

Use `std.json.fmt` to format a value as JSON via the `{f}` specifier:

```zig
try writer.print("{f}", .{std.json.fmt(value, .{})});
```

For streaming output, use `std.json.Stringify`:

```zig
var write_stream: std.json.Stringify = .{
    .writer = my_writer,
    .options = .{ .whitespace = .indent_2 },
};
try write_stream.write(value);
```

## Pattern: All Fields Optional with Null Default

For API types with many optional fields, the idiomatic pattern is making all fields optional with `null` defaults:

```zig
pub const PodSpec = struct {
    containers: ?[]Container = null,
    node_name: ?[]const u8 = null,
    restart_policy: ?[]const u8 = null,
    // ... all fields optional
};
```

This aligns with JSON deserialization where missing fields default to `null`.

To make the round-trip symmetric on output, set `emit_null_optional_fields = false` so unset optionals are omitted rather than serialized as explicit `null`:

```zig
try writer.print("{f}", .{std.json.fmt(value, .{
    .emit_null_optional_fields = false,
})});
```

## Testing parsed values

Parse into an arena and compare against a directly-constructed expected value with `std.testing.expectEqualDeep`. The arena scopes every allocation to the test case:

```zig
var arena: std.heap.ArenaAllocator = .init(std.testing.allocator);
defer arena.deinit();

const parsed = try std.json.parseFromSliceLeaky(
    Message,
    arena.allocator(),
    json_text,
    .{},
);
try std.testing.expectEqualDeep(expected, parsed);
```
