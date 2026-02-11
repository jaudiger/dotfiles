# Zig — Language-Specific Patterns

## Valid concerns

leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, ub, injection

## Allocation and resource patterns

- Allocators: `std.mem.Allocator` — `alloc`, `create`, `dupe`, `dupeZ`, `realloc`, `free`, `destroy`.
- Collections: `ArrayList`, `ArrayHashMap`, `HashMap`, `BufMap`, `BoundedArray` — each has `.deinit()`.
- Arena: `std.heap.ArenaAllocator` — `.reset()` invalidates all pointers, `.deinit()` frees backing.
- Cleanup: `defer` (always runs), `errdefer` (runs only on error return). Verify `errdefer` is placed immediately after successful acquisition, not after intervening fallible code.
- `std.fs.File`, `std.net.Stream` — `.close()` in defer.

## Pointer and slice patterns

- `@ptrCast`, `@alignCast` — UB if alignment or type constraints violated in ReleaseFast.
- `@intCast`, `@truncate` — UB if value out of range in ReleaseFast, panic in Debug/ReleaseSafe.
- Slices into ArrayList/HashMap backing: invalidated by append/put that triggers growth.
- `getPtr()`, `getOrPut()` on HashMap: returned pointer invalidated by subsequent `put`/`remove` that rehashes.
- Sentinel-terminated slices: `@ptrCast` or `@truncate` can lose the sentinel.
- `@as(T, undefined)` — reading the value is UB.

## Concurrency patterns

- `std.Thread.Mutex` — non-recursive. `lock()`/`unlock()`, use `defer mutex.unlock()`.
- `std.Thread.RwLock` — `lockShared()`/`unlockShared()`, `lock()`/`unlock()`.
- `std.Thread.Condition` — `wait()`, `timedWait()`, `signal()`, `broadcast()`.
- `@atomicLoad`, `@atomicStore`, `@atomicRmw`, `@fence` for lock-free code.
- `std.Thread.spawn` — closures capture pointers; verify lifetime.

## Error handling patterns

- `try` propagates errors. `catch` handles them. `_ = try x` discards the error — flag.
- `catch unreachable` — asserts error cannot happen. UB in ReleaseFast if it does.
- `orelse unreachable` on optionals — same risk.
- Error union payload: accessing `.?` or `.*` without checking the error first.
- Error sets: check for unhandled error variants when switching on errors.

## Integer patterns

- Default integer operations are safety-checked in Debug and ReleaseSafe (panic on overflow).
- In ReleaseFast and ReleaseSmall: overflow is UB. Code that "works in debug" may fail silently.
- `@addWithOverflow`, `@subWithOverflow`, `@mulWithOverflow` — explicit checked arithmetic.
- Wrapping operations: `+%`, `-%`, `*%` — explicitly wrapping, use for intentional wrapping.
- `@intCast` from larger to smaller type: verify the value fits.

## Build mode awareness

- Debug / ReleaseSafe: safety checks enabled (bounds, overflow, null pointer).
- ReleaseFast / ReleaseSmall: safety checks disabled — many operations become UB instead of panicking.
- Verify that code correctness does not depend on safety checks for handling expected conditions.
