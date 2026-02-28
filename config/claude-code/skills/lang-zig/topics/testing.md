# Testing Patterns

> **Source**: [Zig 0.15.2 Language Reference](https://ziglang.org/documentation/0.15.2/)

## Basic Test

```zig
test "pod list parsing" {
    // Arrange
    const allocator = std.testing.allocator;
    const json_data = @embedFile("fixtures/pod_list.json");

    // Act
    const parsed = try std.json.parseFromSlice(PodList, allocator, json_data, .{
        .ignore_unknown_fields = true,
    });
    defer parsed.deinit();

    // Assert
    try std.testing.expectEqual(@as(usize, 3), parsed.value.items.?.len);
}
```

## Doctests (Named After Declarations)

```zig
/// Constructs the API URL for the given resource type.
fn buildUrl(comptime T: type) []const u8 { ... }

test buildUrl {
    try std.testing.expectEqualStrings("/api/v1/pods", buildUrl(CoreV1Pod));
}
```

## Testing Functions

- `std.testing.expect(condition)`: assert truthy
- `std.testing.expectEqual(expected, actual)`: assert equality
- `std.testing.expectEqualStrings(expected, actual)`: string comparison
- `std.testing.expectError(expected_error, result)`: assert specific error
- `std.testing.allocator`: leak-detecting allocator

## Skip Tests Programmatically

```zig
test "requires network" {
    if (!network_available) return error.SkipZigTest;
    // ...
}
```

## Compile-Time Tests

```zig
test "CoreV1Pod has resource_meta" {
    // Act / Assert
    const meta = CoreV1Pod.resource_meta;
    try std.testing.expectEqualStrings("pods", meta.resource);
    try std.testing.expect(meta.namespaced);
}
```
