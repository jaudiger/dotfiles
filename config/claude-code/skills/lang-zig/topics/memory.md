# Memory Management, Allocators & Collections

> **Source**: [matklad: Zig And Rust](https://matklad.github.io/2023/03/26/zig-and-rust.html)

## Allocator Pattern

Zig uses explicit allocator passing, with no global allocator and no hidden allocations:

```zig
var debug_allocator: std.heap.DebugAllocator(.{}) = .init;
defer _ = debug_allocator.deinit();
const allocator = debug_allocator.allocator();
```

For multi-threaded release builds, use `std.heap.SmpAllocator`.

In application `main`, use Juicy Main for a pre-initialized allocator:

```zig
pub fn main(init: std.process.Init) !void {
    const gpa = init.gpa;
    const arena = init.arena.allocator();
    // ...
}
```

## ArenaAllocator

`heap.ArenaAllocator` is lock-free and thread-safe. No mutex wrapper needed:

```zig
var arena_allocator: std.heap.ArenaAllocator = .init(std.heap.page_allocator);
defer arena_allocator.deinit();
const arena = arena_allocator.allocator();
```

## Allocator Composition

Every allocator implements the `std.mem.Allocator` interface, so you can stack
behaviors by wrapping one allocator with another. A common composition is a
page-backed arena fronted by a policy or instrumentation layer:

```zig
var arena_instance: std.heap.ArenaAllocator = .init(std.heap.page_allocator);
defer arena_instance.deinit();

var counter: CountingAllocator = .init(arena_instance.allocator());
const gpa = counter.allocator();
```

The wrapper sees every `alloc`, `resize`, `remap`, and `free` call before
forwarding to its parent. This is how `DebugAllocator` adds leak tracking and
how `ArenaAllocator` adds bulk reclamation, without any call site needing to
know which behaviors are stacked.

## Lifecycle-Gated Allocator

In programs with a clear startup phase, steady-state, and shutdown phase, a
small wrapper can refuse allocation after startup. Reaching steady-state with
a frozen allocator is a runtime proof that the hot path is allocation-free:

```zig
const Lifecycle = struct {
    parent: std.mem.Allocator,
    state: enum { startup, running, shutdown } = .startup,

    pub fn init(parent: std.mem.Allocator) Lifecycle {
        return .{ .parent = parent };
    }

    pub fn freeze(self: *Lifecycle) void {
        std.debug.assert(self.state == .startup);
        self.state = .running;
    }

    pub fn thaw_for_shutdown(self: *Lifecycle) void {
        std.debug.assert(self.state == .running);
        self.state = .shutdown;
    }

    pub fn allocator(self: *Lifecycle) std.mem.Allocator {
        return .{
            .ptr = self,
            .vtable = &.{ .alloc = alloc, .resize = resize, .remap = remap, .free = free },
        };
    }

    fn alloc(ctx: *anyopaque, len: usize, a: std.mem.Alignment, ra: usize) ?[*]u8 {
        const self: *Lifecycle = @ptrCast(@alignCast(ctx));
        std.debug.assert(self.state == .startup);
        return self.parent.rawAlloc(len, a, ra);
    }

    fn free(ctx: *anyopaque, buf: []u8, a: std.mem.Alignment, ra: usize) void {
        const self: *Lifecycle = @ptrCast(@alignCast(ctx));
        std.debug.assert(self.state == .startup or self.state == .shutdown);
        // Once shutdown starts, it does not revert.
        self.state = .shutdown;
        self.parent.rawFree(buf, a, ra);
    }

    // resize and remap apply the same startup-only guard as alloc.
};
```

The pattern fits databases, embedded firmware, real-time systems, and game
engines, where a steady-state allocation would be a bug.

## Instrumented Allocator

A wrapper can also passively observe traffic. Counting bytes in and bytes out
gives a live "bytes in use" gauge that works in release builds, not only in
debug:

```zig
const Counting = struct {
    parent: std.mem.Allocator,
    alloc_bytes: u64 = 0,
    free_bytes: u64 = 0,

    pub fn init(parent: std.mem.Allocator) Counting {
        return .{ .parent = parent };
    }

    pub fn live(self: *const Counting) u64 {
        return self.alloc_bytes - self.free_bytes;
    }

    pub fn allocator(self: *Counting) std.mem.Allocator {
        return .{
            .ptr = self,
            .vtable = &.{ .alloc = alloc, .resize = resize, .remap = remap, .free = free },
        };
    }

    fn alloc(ctx: *anyopaque, len: usize, a: std.mem.Alignment, ra: usize) ?[*]u8 {
        const self: *Counting = @ptrCast(@alignCast(ctx));
        const ptr = self.parent.rawAlloc(len, a, ra) orelse return null;
        self.alloc_bytes += len;
        return ptr;
    }

    fn free(ctx: *anyopaque, buf: []u8, a: std.mem.Alignment, ra: usize) void {
        const self: *Counting = @ptrCast(@alignCast(ctx));
        self.free_bytes += buf.len;
        self.parent.rawFree(buf, a, ra);
    }

    // resize and remap forward to parent and adjust counters by the size delta.
};
```

The same shell scales to peak tracking, sampling, or per-subsystem budgets.

## ArrayList

`std.ArrayList(T)` does not store an allocator internally. Pass it at each
call site, and choose between heap-backed and stack-backed initialization:

```zig
// Heap-backed: allocator passed on every mutating call.
var list: std.ArrayList(u8) = .{};
defer list.deinit(allocator);
try list.append(allocator, 42);

// Stack-backed: fixed capacity, no allocator needed.
var buffer: [8]i32 = undefined;
var bounded = std.ArrayList(i32).initBuffer(&buffer);
try bounded.appendSliceBounded(initial_data);
```

The underlying type is `std.array_list.Aligned(T, null)`.

## DoublyLinkedList

`std.DoublyLinkedList` is intrusive. Embed a `Node` in your struct and use
`@fieldParentPtr` to recover the containing data:

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

## Intrusive Queue and Stack

The same intrusive technique gives allocation-free FIFO and LIFO containers.
Embed a `next` link in your element; the container itself stores only head
and tail pointers, so ownership of nodes stays with the caller:

```zig
fn IntrusiveQueue(comptime T: type) type {
    return struct {
        head: ?*T = null,
        tail: ?*T = null,

        const Self = @This();

        pub fn push(self: *Self, node: *T) void {
            node.next = null;
            if (self.tail) |tail| tail.next = node else self.head = node;
            self.tail = node;
        }

        pub fn pop(self: *Self) ?*T {
            const node = self.head orelse return null;
            self.head = node.next;
            if (self.head == null) self.tail = null;
            node.next = null;
            return node;
        }
    };
}

const Job = struct {
    payload: u64,
    next: ?*Job = null,
};
var queue: IntrusiveQueue(Job) = .{};
```

A LIFO stack is the same pattern with a single `head` field: push prepends,
pop removes from the head. When a node must participate in several lists at
once, replace the bare `next` field with a named `Link` substruct and recover
the element with `@fieldParentPtr("link", link)`, as in `DoublyLinkedList`.

## HashMap

Unmanaged variants (allocator passed at each call site):

```zig
var map: std.array_hash_map.Auto([]const u8, u32) = .{};
defer map.deinit(allocator);
try map.put(allocator, "key", 42);
```

`array_hash_map.Auto`, `array_hash_map.String`, and `array_hash_map.Custom`
are the standard hash map types.
