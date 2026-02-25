# Python -- Language-Specific Patterns

## Valid concerns

leaks, deadlocks, races, lifecycle, overflow, error-handling, async-bugs, injection, type-safety

## Allocation and resource patterns

- Unclosed files/connections without context managers: `open()`, `socket.socket()`, `sqlite3.connect()` without `with` statement. Rely on `__del__` is unreliable -- GC timing is non-deterministic.
- `tempfile.NamedTemporaryFile` and `tempfile.mkstemp`: verify cleanup on all paths, especially error paths.
- Database connection leaks: `psycopg2.connect()`, `pymysql.connect()` without context manager or explicit `.close()` in `finally`.
- Socket leaks: `socket.socket()` opened but not closed on error paths before `with` block.
- Growing dicts/lists used as caches without eviction: unbounded memory growth. Use `functools.lru_cache` with `maxsize` or explicit eviction.

## Concurrency patterns

- `threading.Lock` ordering violations: acquiring multiple locks in different order across threads -- deadlock.
- `threading.RLock` reentrant deadlocks: re-entrant lock can still deadlock if two threads each hold one and wait for the other.
- `multiprocessing.Lock`: same ordering issues as threading, but across processes.
- `queue.Queue` blocking without timeout: `queue.get()` without `timeout` blocks forever if producer dies.
- `asyncio.Lock` misuse: using `threading.Lock` in async code blocks the event loop. Use `asyncio.Lock` instead.

## Data race patterns

- GIL does not protect compound operations: check-then-act on dicts (`if key in d: d[key]`) is not atomic. Another thread can delete the key between check and access.
- `multiprocessing` shared state without locks: `multiprocessing.Value` and `multiprocessing.Array` need explicit locking for compound operations.
- `concurrent.futures` shared mutable state: closures passed to `ThreadPoolExecutor.submit()` sharing mutable objects without synchronization.

## Error handling patterns

- Bare `except:` catches `SystemExit`, `KeyboardInterrupt`, and `GeneratorExit`. Use `except Exception:` at minimum.
- `except Exception` may still be too broad -- catches unexpected errors. Prefer specific exception types.
- Exception chaining: use `raise NewError() from original` to preserve the cause chain. Bare `raise NewError()` loses context.
- Silenced exceptions in `__del__`: exceptions in `__del__` are ignored by the interpreter and printed to stderr. Critical cleanup should not rely on `__del__`.
- `contextlib.suppress` overuse: suppressing broad exception types hides real errors.
- Missing `finally` cleanup: resources opened before `try` block but not closed if an exception occurs before the `with` statement.

## Integer patterns

- Python ints have arbitrary precision (no overflow in pure Python).
- `ctypes` integer types (`c_int`, `c_uint32`, etc.) truncate/wrap silently on assignment.
- `struct.pack` with format codes (`'i'`, `'I'`, `'h'`, etc.) truncates values that exceed the format range.
- `numpy` dtypes: `numpy.int32`, `numpy.uint8`, etc. wrap/truncate silently on overflow.
- `array.array` typed values: same truncation behavior as the underlying C type.

## Lifecycle patterns

- `atexit` handlers depending on already-finalized modules: at interpreter shutdown, modules may already be set to `None`.
- `__enter__`/`__exit__` incomplete: missing exception handling in `__exit__`. If `__exit__` returns falsy, the exception propagates. If it returns truthy, the exception is suppressed -- verify this is intentional.
- Daemon threads killed without cleanup at interpreter shutdown: `daemon=True` threads are killed abruptly when the main thread exits.
- Signal handler registration: `signal.signal()` can only be called from the main thread. Signal handlers replace previous handlers -- verify chaining if needed.

## Async patterns

- Fire-and-forget `asyncio.create_task()` without holding a reference: task may be garbage collected before completion.
- `await` not used on coroutine call: `coro()` returns a coroutine object but never runs it. Must use `await coro()` or `asyncio.create_task(coro())`.
- `loop.run_in_executor` blocking the event loop if the callable itself schedules back onto the loop incorrectly.
- `async with`/`async for` cleanup on cancellation: `__aexit__` may not run if the task is cancelled during `__aenter__`.
- `asyncio.gather` with `return_exceptions=False` (the default): first exception cancels other tasks, losing their results.

## Injection patterns

- `eval()`/`exec()` with user input: arbitrary code execution. Flag always.
- `subprocess.run(shell=True)` with string interpolation: command injection. Use `shell=False` with a list of arguments.
- f-strings or `%`-formatting in SQL: `cursor.execute(f"SELECT * FROM {table}")` -- SQL injection. Use parameterized queries with `?` or `%s` placeholders.
- `pickle.loads` on untrusted data: arbitrary code execution via `__reduce__`. Flag always.
- `os.path.join` does not prevent `..` traversal: `os.path.join('/base', '../etc/passwd')` resolves outside the base. Use `os.path.realpath` then check prefix.
- `yaml.load` without `SafeLoader`: `yaml.load(data)` with the default loader allows arbitrary Python object construction. Use `yaml.safe_load` or `yaml.load(data, Loader=yaml.SafeLoader)`.
- `importlib.import_module` with user input: allows importing arbitrary modules.

## Type safety patterns

- `typing.cast()` -- no runtime effect, purely a hint. Does the actual value match the declared type?
- `# type: ignore` comments: what mypy/pyright error is suppressed? Is it a real type bug?
- `Any` in annotations: trace what flows through. Can it be narrowed to a specific type or `object`?
- `isinstance` checks: does the check cover all possible types? Union types with missing branches.
- `getattr`/`hasattr` bypassing the type system: attribute existence not guaranteed at the type level.
- `dict` access with `[]` vs `.get()`: `KeyError` vs `None` -- return type differs.
- `json.loads()` returns `Any`: must be validated before use (pydantic, marshmallow, cattrs).
- `pickle.loads` reconstructs arbitrary objects: type of deserialized object is not guaranteed.
