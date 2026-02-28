# Go: Language-Specific Patterns

## Valid concerns

leaks, deadlocks, races, lifecycle, overflow, error-handling, async-bugs, injection, type-safety

## Allocation and resource patterns

- Goroutine leaks: goroutines that block forever on channel/select with no cancellation path. Every goroutine must have an exit condition.
- `io.Closer` implementations: `os.File`, `http.Response.Body`, `sql.Rows`, `net.Conn`, `bufio.Scanner` wrapping a closer. Verify `defer x.Close()` immediately after error check.
- `context.WithCancel`, `context.WithTimeout`: verify `defer cancel()` is called. Missing cancel leaks the context's goroutine.
- `defer` in loops: deferred calls run at function exit, not iteration end. Leak risk for files/connections opened in a loop.
- `sql.DB`: connection pool. Verify `db.Close()` in shutdown. `sql.Rows`: must be closed even if iteration completes.
- HTTP client: `resp.Body` must be read and closed even if the body is not needed (otherwise connection cannot be reused).

## Concurrency patterns

- `sync.Mutex`/`sync.RWMutex`: `Lock()`/`Unlock()`. Use `defer mu.Unlock()` immediately after Lock.
- Sending on unbuffered channel while holding a mutex when the receiver needs the same mutex: deadlock.
- `sync.WaitGroup`: `Add` must be called before `go func()`, not inside the goroutine. `Add` after `Wait` is a race.
- `sync.Once`: verify the function passed to `Do` does not block on something that also calls `Do` (deadlock).
- Map concurrent access: concurrent read + write on `map` causes runtime panic. Use `sync.Map` or protect with mutex.
- Range variable capture pre-Go 1.22: `for _, v := range items { go func() { use(v) }() }`: `v` is shared. Use `go func(v T) { use(v) }(v)` or upgrade to Go 1.22+.
- Channel close: only the sender should close. Closing a closed channel panics. Receiving from closed channel returns zero value.

## Error handling patterns

- `err` not checked: `result, err := f(); use(result)` without `if err != nil`. Flag every unchecked error return.
- `err` shadowing: `err := f()` in an inner scope shadows outer `err`, losing the original error.
- `errors.Is` / `errors.As` for wrapped errors. Comparing with `==` does not unwrap.
- Sentinel errors (`io.EOF`, `sql.ErrNoRows`): verify they are checked with `errors.Is`, not `==` (for wrapping compat).
- `defer` with error return: `defer f.Close()` discards the Close error. Use named return and check.
- `panic`/`recover`: verify `recover` is in a `defer` in the same goroutine. Panics in other goroutines crash the process.

## Integer patterns

- Integer overflow wraps silently (no panic, no UB). `int` is platform-dependent (32 or 64 bit).
- `int` to `int32` / `uint32` truncation: use explicit bounds check.
- `len()` returns `int`: on 32-bit platforms, large slices may overflow `int32`.
- `math.MaxInt`, `math.MinInt` for bounds checking.
- Unsigned subtraction: Go does not have unsigned literals by default but `uint` wraps on underflow.

## Async/goroutine patterns

- Fire-and-forget goroutines: `go func() { ... }()`: errors are silently lost unless explicitly handled inside.
- Goroutine leak detection: look for goroutines blocked on channel receive/send with no producer/consumer or no context cancellation.
- `select` with `default`: non-blocking. Without `default`: blocking. Verify intent.
- `context.Done()` not checked in long loops inside goroutines; the goroutine runs after cancellation.

## Injection patterns

- `os/exec.Command`: first argument is the binary, rest are args (safe). Piping through `sh -c` with string concatenation is command injection.
- `database/sql`: use `?` or `$1` placeholders. Flag string concatenation in query strings.
- `filepath.Join` with user input: does not prevent `..` traversal. Use `filepath.Clean` then check prefix.
- `net/http`: header values from user input; check for CRLF injection.
- `html/template` auto-escapes. `text/template` does NOT. Verify the correct package is used.

## Type safety patterns

- `interface{}`/`any` type assertions without comma-ok form: `v := x.(int)` panics vs `v, ok := x.(int)`.
- Type switch without `default`: missing variant silently does nothing.
- Nil interface vs nil concrete value: `var x error; var p *MyError; x = p; x != nil` is true even though `p` is nil.
- `unsafe.Pointer` conversions: `unsafe.Pointer` to `uintptr` and back; pointer may be moved by GC between the two operations.
- Generic constraints: `any` constraint allows types that may not support the intended operations.
- `reflect.Value` without type validation: runtime panics on wrong kind.
