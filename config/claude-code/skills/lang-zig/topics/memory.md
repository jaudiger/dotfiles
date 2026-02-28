# Memory Management, Allocators & Collections

> **Source**: [Zig 0.15.2 Language Reference](https://ziglang.org/documentation/0.15.2/),
> [Zig 0.15.1 Release Notes](https://ziglang.org/download/0.15.1/release-notes.html),
> [matklad: Zig And Rust](https://matklad.github.io/2023/03/26/zig-and-rust.html)

## Allocator Pattern

Zig uses explicit allocator passing, with no global allocator and no hidden allocations:

```zig
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
defer _ = gpa.deinit();
const allocator = gpa.allocator();
```

## Testing Allocator

Detects memory leaks automatically in tests:

```zig
test "no leaks" {
    const allocator = std.testing.allocator;
    const ptr = try allocator.alloc(u8, 100);
    defer allocator.free(ptr);
    // If defer is removed, test fails with leak report
}
```

## Collections Pass Allocator at Call Site

`std.ArrayList` does not store an allocator internally. Pass the allocator at each call site:

```zig
var list: std.ArrayList(u8) = .{};
defer list.deinit(allocator);
try list.append(allocator, 42);
```

## ArrayList

`std.ArrayList(T)` does not store an allocator internally; pass it at each call site:

```zig
// Stack-allocated buffer (no allocator needed)
var buffer: [8]i32 = undefined;
var stack = std.ArrayList(i32).initBuffer(&buffer);
try stack.appendSliceBounded(initial_data);

// Heap-allocated
var list: std.ArrayList(u8) = .{};
defer list.deinit(allocator);
try list.append(allocator, 42);
```

The underlying type is `std.array_list.Aligned(T, null)`.

## DoublyLinkedList

`std.DoublyLinkedList` is an intrusive linked list. Embed a `Node` in your struct and use `@fieldParentPtr` to access the containing data:

```zig
const MyNode = struct {
    node: std.DoublyLinkedList.Node = .{},
    data: MyData,
};

var list: std.DoublyLinkedList = .{};

fn getData(node: *std.DoublyLinkedList.Node) *MyNode {
    return @fieldParentPtr("node", node);
}
```

## Stack-Bounded Arrays

For fixed-capacity arrays backed by a stack buffer, use `ArrayList` with `initBuffer`:

```zig
var buffer: [8]i32 = undefined;
var stack = std.ArrayList(i32).initBuffer(&buffer);
try stack.appendSliceBounded(data);
```
