# Rust — Language-Specific Patterns

## Valid concerns

leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, async-bugs, ub, injection

## Allocation and resource patterns

- Safe Rust prevents memory leaks at the language level via RAII — focus on logical leaks.
- `Box::leak` — intentional leak. Verify it is truly intentional and bounded.
- `std::mem::forget` — skips Drop. Verify the resource does not need cleanup.
- `ManuallyDrop` — verify `.drop()` is called on all paths.
- `Rc`/`Arc` cycles: `Rc<RefCell<T>>` referencing another `Rc` — use `Weak` to break cycles.
- `File::open`, `TcpStream`, `UdpSocket` — dropped automatically, but verify explicit close where timing matters.
- Lock guards (`MutexGuard`, `RwLockReadGuard`): held until end of scope. Held across `.await` = blocks executor.

## Pointer and reference patterns (unsafe)

- `*const T`, `*mut T` dereference in unsafe: verify the pointer is non-null, aligned, and points to valid memory.
- References from raw pointers: `&*ptr` — verify lifetime and aliasing rules.
- `std::mem::transmute`: verify source and target types have same size and valid bit patterns.
- `Pin` violations: moving a pinned value is UB if it implements `!Unpin`.
- FFI pointers: verify ownership semantics across the boundary (who frees?).

## Concurrency patterns

- `std::sync::Mutex` — `lock()` returns `Result` (poisoned mutex). Check for `.unwrap()` on lock.
- `MutexGuard` held across `.await`: blocks the async executor thread. Use `tokio::sync::Mutex` in async.
- `RwLock`: writer starvation possible with many readers. Check fairness requirements.
- `Condvar`: `wait()` must be in a loop, takes a `MutexGuard`. Verify matching `notify_one`/`notify_all`.
- `Arc` without interior mutability is safe for reads. `Arc<Mutex<T>>` for shared mutable state.
- `Send`/`Sync` trait bounds: verify that types shared across threads implement them. Unsafe impls: verify correctness.
- Crossbeam scoped threads: closures can borrow stack data. Verify borrows do not create data races.

## Error handling patterns

- `unwrap()`, `expect()`: panic on `None`/`Err`. Flag in library code and production paths.
- `?` operator: propagates errors. Verify the error type is compatible (From impl exists).
- `match` on Result/Option: verify exhaustive handling.
- `.unwrap_or_default()`: verify the default is actually correct, not just convenient.
- `panic!` in library code: should be `Result` unless it indicates a programming bug.
- Error types: `anyhow` for applications, `thiserror` for libraries. Verify context is preserved.

## Integer patterns

- Debug mode: overflow panics. Release mode: overflow wraps (defined behavior, not UB, but often a bug).
- `checked_add`, `checked_mul` — return `Option`, explicit overflow handling.
- `wrapping_add`, `wrapping_mul` — explicit wrapping intent.
- `saturating_add`, `saturating_mul` — clamp to min/max.
- `as` cast for integers: truncating and silent. Prefer `try_into()` for checked conversion.
- `usize` to `u32` on 64-bit: silent truncation with `as`.

## Async patterns

- Floating futures: `async fn()` called without `.await` — the future is created but never polled.
- `tokio::spawn` without `JoinHandle`: errors are lost. Capture and check the handle.
- `select!` cancellation: the unselected branch is dropped. Verify resources in the dropped future are cleaned up.
- Blocking in async context: `std::thread::sleep`, `std::sync::Mutex::lock` in async — use async equivalents.
- `Stream` consumption: verify error handling on each item.

## Injection patterns

- `std::process::Command` — use `.arg()` (safe) not format string into shell (unsafe).
- SQL: use parameterized queries via sqlx, diesel. Flag string interpolation in queries.
- Path: `std::path::Path::join` with user input — check for `..` traversal after join.
- `format!` into HTML: no auto-escaping. Use a template engine with escaping.
