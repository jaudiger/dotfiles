# JSON Parsing & Serialization

> **Source**: [Zig 0.15.2 Language Reference](https://ziglang.org/documentation/0.15.2/),
> [Zig 0.15.1 Release Notes](https://ziglang.org/download/0.15.1/release-notes.html)

## Parsing with `std.json.parseFromSlice`

```zig
const parsed = try std.json.parseFromSlice(
    MyStruct,
    allocator,
    json_bytes,
    .{
        .ignore_unknown_fields = true,
        .allocate = .alloc_always,  // or .alloc_if_needed
    },
);
defer parsed.deinit();
const value = parsed.value;
```

## Key Parse Options

- **`ignore_unknown_fields`**: Set to `true` when parsing responses that may contain unknown fields (e.g. Kubernetes API responses)
- **`allocate`**: Controls when the parser allocates. `.alloc_always` copies all strings; `.alloc_if_needed` only allocates when necessary

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
