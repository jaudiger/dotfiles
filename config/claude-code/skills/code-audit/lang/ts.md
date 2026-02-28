# TypeScript: Language-Specific Patterns

## Valid concerns

leaks, lifecycle, error-handling, async-bugs, type-safety, injection

## Allocation and resource patterns

- Event listeners: `addEventListener` / `on` without corresponding `removeEventListener` / `off` in cleanup.
- Timers: `setInterval`, `setTimeout` without `clearInterval` / `clearTimeout` in cleanup.
- Subscriptions: RxJS `.subscribe()` without `.unsubscribe()` or `takeUntil`. EventEmitter `.on` without `.off`.
- Streams: Node.js `ReadableStream`, `WritableStream`: verify `.destroy()` or pipeline error handling.
- Database connections: pool.connect() to release/end. Verify connection returned to pool on error paths.
- WebSocket: verify `.close()` in cleanup. Reconnection logic: verify old socket is closed before creating new one.
- Closures capturing large scopes: verify closures in long-lived callbacks do not prevent GC of large objects.
- Growing Maps/Sets/arrays used as caches without eviction: unbounded memory growth.
- AbortController: verify `.abort()` is called in cleanup paths.

## Error handling patterns

- Floating promises: async function called without `await`: errors silently lost. Flag every unhandled async call.
- `.then()` chain without `.catch()`: unhandled rejection.
- `Promise` constructor with `reject` never called: error path missing.
- `try/catch` around async: verify the catch is around the `await`, not just the function call.
- Empty catch: `catch (e) {}`: silently swallows. Flag always.
- `catch (e)` with `e` typed as `unknown` (TS 4.4+): verify narrowing before use. With `any`: loses type info.
- `for await...of` on stream without try/catch: unhandled error crashes the loop.
- `process.on('unhandledRejection')`: global fallback, not a substitute for proper error handling.

## Async patterns

- Async function with no `await` inside: suspicious; likely missing an await or not actually async.
- `Promise.all`: if one rejects, other promises keep running. Resources allocated by successful promises are not cleaned up.
- `Promise.race`: losing promises keep running. Side effects in losing promises still execute.
- Shared mutable state across `await` points: no mutex in JS. Concurrent modifications via interleaved microtasks. Use a queue or lock library for critical sections.
- `setTimeout`/`setInterval` callbacks referencing `this` or closed-over variables that may be stale when the callback fires.
- Event handlers that reference disposed component state (React: state update after unmount, Node: callback after stream destroy).

## Type safety patterns

- `as` casts: `as any`, `as unknown as T`: escape hatches that disable type checking.
- `!` (non-null assertion): verify the value is guaranteed non-null. Flag on external data.
- `@ts-ignore` / `@ts-expect-error`: what error is suppressed? Is it a real type bug?
- `any` in annotations: trace what flows through it. Can it be `unknown` or a specific type?
- `JSON.parse()`: returns `any`. Must be validated before use (zod, io-ts, ajv).
- External API responses: cast with `as MyType` without runtime validation is a crash risk.
- `Object.keys()` returns `string[]`, not `(keyof T)[]`. Code assuming keyof is wrong.
- Index signatures `[key: string]: T`: access returns `T` but runtime may be `undefined`.
- Numeric enums: accept any number at runtime. Validate enum input.
- Type predicates (`x is Foo`): verify the guard actually validates all fields of Foo.

## Lifecycle patterns (frameworks)

- React: `useEffect` cleanup function must cancel async operations, remove listeners, clear timers.
- React: state update after unmount; use AbortController or isMounted flag.
- Node.js: `process.on('SIGTERM')`, `process.on('SIGINT')`: graceful shutdown handlers.
- Express/Fastify: `server.close()` with connection draining before `process.exit()`.
- Database pools: `pool.end()` in shutdown handler.
- Worker threads: `worker.terminate()` in cleanup.

## Injection patterns

- Template literals in SQL: `\`SELECT * FROM ${table}\``: SQL injection. Use parameterized queries.
- `child_process.exec(userInput)`: command injection. Use `execFile` with argument array.
- `eval()`, `new Function(userInput)`: code injection. Flag always.
- `innerHTML`, `dangerouslySetInnerHTML` with user input; XSS. Use textContent or sanitize.
- Path: `path.join(base, userInput)` does not prevent `..` traversal. Resolve and check prefix.
- RegExp from user input: `new RegExp(userInput)`: ReDoS. Use a safe regex library or escape input.
- URL construction: `new URL(userInput)` for SSRF; validate scheme and host allowlist.
