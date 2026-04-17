# Zig: Language-Specific Patterns

Target version: Zig 0.16+.

## Valid concerns

leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, ub, injection

Cancelation is not a standalone concern: swallowed or misrouted `error.Canceled` falls under `error-handling`, and cancelation racing with shared-state mutation falls under `races`. The cancelation-specific patterns in this file apply when those concerns are selected.

## Allocation and resource patterns

- Allocators: `std.mem.Allocator`: `alloc`, `create`, `dupe`, `dupeZ`, `realloc`, `free`, `destroy`.
- Collections: `ArrayList`, `array_hash_map.Auto`/`String`/`Custom`, `HashMap`, `BufMap`, `BoundedArray`. Each has `.deinit()`. The array hash map variants are unmanaged; the allocator is passed at each call site.
- `PriorityQueue` and `PriorityDequeue` are unmanaged: initialize with `.empty` and pass the allocator to `push`/`pop`.
- Arena: `std.heap.ArenaAllocator` is thread-safe and lock-free. `.reset()` invalidates all pointers, `.deinit()` frees the backing.
- Cleanup: `defer` (always runs), `errdefer` (runs only on error return). Verify `errdefer` is placed immediately after successful acquisition, not after intervening fallible code.
- File and directory handles live in `std.Io`. Close with `file.close(io)` and `dir.close(io)` in `defer`. Network streams from `std.Io.net` close the same way.

## Pointer and slice patterns

- `@ptrCast`, `@alignCast`: UB if alignment or type constraints are violated in ReleaseFast. Explicitly-aligned pointers are a distinct type from naturally-aligned pointers; mismatches are compile errors.
- `@intCast`, `@truncate`: UB if value out of range in ReleaseFast, panic in Debug/ReleaseSafe.
- Float to integer conversion: use `@trunc`, `@floor`, `@ceil`, or `@round` (all produce integers when the result type is an integer).
- Slices into `ArrayList`/`HashMap` backing: invalidated by append/put that triggers growth.
- `getPtr()`, `getOrPut()` on a hash map: the returned pointer is invalidated by a subsequent `put`/`remove` that rehashes.
- Sentinel-terminated slices: `@ptrCast` or `@truncate` can lose the sentinel.
- `@as(T, undefined)`: reading the value is UB.
- Returning the address of an expired local is a compile error; flag any pattern that smuggles such a pointer through a cast or struct field.
- Runtime indexing into a vector is rejected; coerce to an array first.

## Concurrency patterns

- Synchronization primitives live under `std.Io`: `std.Io.Mutex`, `std.Io.RwLock`, `std.Io.Condition`, `std.Io.Semaphore`, `std.Io.Event`, `std.Io.Group`, `std.Io.Futex`. Task management goes through `io.async` plus `std.Io.Group`.
- `std.Io.Mutex`: non-recursive. `lock()`/`unlock()`, use `defer mutex.unlock()`.
- `std.Io.RwLock`: `lockShared()`/`unlockShared()`, `lock()`/`unlock()`.
- `std.Io.Condition`: `wait()`, `timedWait()`, `signal()`, `broadcast()`.
- `@atomicLoad`, `@atomicStore`, `@atomicRmw` for lock-free code; these do not require an `Io`.
- Task spawning: `io.async(fn, args)` returns a `Future(T)`. `future.await(io)` joins, `future.cancel(io)` requests cancelation. Canceled operations surface `error.Canceled`; verify the error is handled on every cancelation-aware call site.
- Capturing by pointer in an async task: the capture must outlive the task, and cancelation must be awaited before the captured storage is released.

## Error handling patterns

- `try` propagates errors. `catch` handles them. `_ = try x` discards the error; flag.
- `catch unreachable`: asserts error cannot happen. UB in ReleaseFast if it does.
- `orelse unreachable` on optionals; same risk.
- Error union payload: accessing `.?` or `.*` without checking the error first.
- Error sets: flag unhandled variants when switching on errors. Standard-library variants include `CrossDevice`, `FileBusy`, and `EnvironmentVariableMissing`.
- `error.Canceled` is a pervasive variant on `Io`-taking calls. Flag cancelation-aware code that swallows it or treats it as a generic failure.

## Integer patterns

- Default integer operations are safety-checked in Debug and ReleaseSafe (panic on overflow).
- In ReleaseFast and ReleaseSmall: overflow is UB. Code that works in debug may fail silently.
- `@addWithOverflow`, `@subWithOverflow`, `@mulWithOverflow`: explicit checked arithmetic.
- Wrapping operations `+%`, `-%`, `*%`: explicitly wrapping, use for intentional wrapping.
- `@intCast` from larger to smaller type: verify the value fits.
- Reified integer types use `@Int(signedness, bits)`.

## Packed types

- Pointers in `packed struct` or `packed union` fields are rejected by the compiler. Flag encodings that stash a pointer as a raw integer; require `usize` with `@ptrFromInt`/`@intFromPtr` and justify the provenance.
- `packed union` requires an explicit backing integer, and every field's `@bitSizeOf` must equal it.
- Enums and packed types with implicit backing types cannot be `extern` or `export`. Flag FFI surfaces that rely on implicit backing.

## Build mode awareness

- Debug / ReleaseSafe: safety checks enabled (bounds, overflow, null pointer).
- ReleaseFast / ReleaseSmall: safety checks disabled; many operations become UB instead of panicking.
- Verify that code correctness does not depend on safety checks for handling expected conditions.
