# Java: Language-Specific Patterns

## Valid concerns

leaks, deadlocks, races, lifecycle, overflow, error-handling, injection, type-safety

## Allocation and resource patterns

- `AutoCloseable`/`Closeable` implementations: `InputStream`, `OutputStream`, `Connection`, `Statement`, `ResultSet`, `Socket`, `Channel`. Verify try-with-resources or explicit close in finally.
- Nested resources: `new BufferedReader(new FileReader(f))`: if BufferedReader constructor throws, FileReader is leaked. Assign inner resource to a variable and close it separately on error.
- `ExecutorService`: `shutdown()` then `awaitTermination()`. Flag `ExecutorService` fields without shutdown in close/destroy.
- `Timer`, `ScheduledExecutorService`: `cancel()`/`shutdown()` in cleanup. Leaked timers keep the JVM alive.
- Listener/callback leaks: `addListener`/`addObserver` without corresponding `remove` in teardown.
- `ThreadLocal`: values persist for the thread's lifetime. In thread pools, set to null after use to avoid leaking across requests.

## Concurrency patterns

- `synchronized` blocks/methods: implicit reentrant lock on the object monitor.
- Nested `synchronized` on different monitors in different order across methods: deadlock.
- `ReentrantLock`: `lock()` then `try { ... } finally { unlock() }`. Missing finally: lock leak.
- `ReentrantReadWriteLock`: read lock does not upgrade to write lock (deadlock if attempted).
- `Condition.await()`: must be in a while loop (spurious wakeup). Must hold the associated lock.
- `CountDownLatch.await()` without timeout: blocks forever if `countDown()` is never called enough times.
- `ConcurrentHashMap`: individual operations are atomic, but compound operations (check-then-act) are not.

## Data race patterns

- Non-volatile fields read from multiple threads: visibility not guaranteed without happens-before.
- `HashMap` used from multiple threads: corruption, infinite loop on resize. Use `ConcurrentHashMap`.
- Double-checked locking without `volatile` on the field: broken on JMM.
- `volatile` provides visibility but not atomicity: `volatile int count; count++` is still a race.
- `AtomicInteger`, `AtomicReference`, `AtomicBoolean` for lock-free single-variable operations.
- `Collections.synchronizedList`: individual method calls are synchronized, but iteration is not. Must manually synchronize iteration.

## Error handling patterns

- Empty catch block: `catch (Exception e) {}`: silently swallows all errors. Flag always.
- `catch (Exception e)` / `catch (Throwable t)`: too broad. Catches unexpected exceptions. Prefer specific types.
- Checked vs unchecked: verify that RuntimeExceptions from called methods are handled or documented.
- `finally` block that throws: suppresses the original exception. Use try-with-resources instead.
- `InterruptedException`: must either re-throw or call `Thread.currentThread().interrupt()`. Swallowing it breaks cancellation.

## Integer patterns

- Integer overflow wraps silently: `int`, `long` wrap on overflow. No runtime exception.
- `Math.addExact`, `Math.multiplyExact`: throw `ArithmeticException` on overflow. Use for safety.
- `int` to `byte`/`short` cast: truncation without warning.
- Array index with `int`: max array size ~2 billion. Large data may need `long` indices and alternative structures.
- `float`/`double` precision loss when converting from `long`.

## Lifecycle patterns

- `@PreDestroy` / `destroy()` methods: verify called during shutdown.
- `Runtime.addShutdownHook`: runs on JVM shutdown. Verify hooks do not depend on resources that may already be shut down.
- Daemon threads: do not prevent JVM exit. Non-daemon threads do. Verify daemon flag is set correctly.
- `ExecutorService.shutdown()` then `awaitTermination(timeout)`: if timeout expires, tasks are still running. `shutdownNow()` as fallback.
- Spring/CDI bean lifecycle: verify scope (singleton vs request) matches the resource lifecycle.

## Injection patterns

- JDBC: use `PreparedStatement` with `?` placeholders. Flag string concatenation in SQL.
- `Runtime.exec(String)`: splits on whitespace (shell-like). Use `Runtime.exec(String[])` or `ProcessBuilder`.
- JNDI: `InitialContext.lookup(userInput)`: JNDI injection (Log4Shell class).
- XML: `DocumentBuilderFactory`: disable external entities (XXE). Set `setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)`.
- Deserialization: `ObjectInputStream.readObject()` on untrusted data; remote code execution. Use allowlists or avoid Java serialization.
- Path traversal: `new File(base, userInput)`: does not prevent `..`. Canonicalize and check prefix.

## Type safety patterns

- Raw types: `List` instead of `List<String>`: loses compile-time type checking, heap pollution.
- Unchecked casts: `(List<String>) rawList`: `ClassCastException` deferred to element access.
- `@SuppressWarnings("unchecked")`: what cast is suppressed? Is it actually safe?
- Generics erasure: `instanceof` cannot check parameterized types at runtime (`x instanceof List<String>` won't compile, but `x instanceof List` loses the parameter).
- Covariant arrays: `String[] arr = ...; Object[] obj = arr; obj[0] = 42;`: `ArrayStoreException` at runtime.
- `Class.cast()` and `Class.isInstance()`: runtime checks. Verify the Class token matches the expected type.
- `Optional.get()` without `isPresent()`: throws `NoSuchElementException`.
