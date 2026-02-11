# Lifecycle (Init/Deinit/Shutdown) Methodology

## Scope

Initialization and teardown correctness, partial initialization cleanup, shutdown ordering, and idempotency.

## Systematic Procedure

### Step 1 — Map the lifecycle contract

For every struct, class, or module with a lifecycle:

1. Identify the init/constructor/open/start entry point.
2. Identify the deinit/destructor/close/stop/shutdown exit point.
3. List every resource acquired during init (memory, files, sockets, threads, locks, timers).
4. Verify each resource acquired in init has a corresponding release in deinit.

### Step 2 — Check partial initialization cleanup

For every init function:

1. If the Nth acquisition fails, are acquisitions 1..N-1 released?
2. Verify cleanup mechanism: errdefer, goto-cleanup, try-with-resources, or explicit rollback.
3. Check that the partially-initialized object is not observable by other code (not stored in a global or returned to caller before init completes).

### Step 3 — Check teardown ordering

For every deinit/shutdown:

1. List the order in which resources are released.
2. Verify no released resource is used after its release by a subsequent cleanup step.
3. Verify threads/tasks are joined/stopped BEFORE the resources they use are freed.
4. Verify locks are not held when joining threads (deadlock risk).

### Step 4 — Check shutdown vs deinit separation

If the type has separate shutdown and deinit phases:

1. Can deinit be called without shutdown? What happens — crash, leak, or graceful handling?
2. Is shutdown idempotent? Calling it twice should not crash or corrupt state.
3. After shutdown, do all background threads/goroutines/tasks terminate?
4. Resources allocated between shutdown and deinit — are they cleaned up by deinit?

### Step 5 — Check reinitialization

1. Can init be called on an already-initialized instance? Does it leak the first set of resources?
2. Is there a reset method? Does it correctly release old resources before acquiring new ones?
3. Check for static/global init-once patterns: are they thread-safe?

### Step 6 — Check destructor/drop ordering

For languages with automatic cleanup:

1. Fields are dropped in declaration order — verify this order is safe.
2. Verify no field's drop implementation accesses another field that may already be dropped.
3. Async cleanup: if the language does not support async Drop, verify manual async cleanup is called before the synchronous drop.

### Step 7 — Check signal and panic handling during lifecycle

1. If a signal (SIGTERM, SIGINT) arrives during init, is partial state cleaned up?
2. If a panic/exception occurs during deinit, are remaining resources leaked?
3. Verify shutdown hooks are registered and execute in a safe order.

## Reporting

For each finding, state:
- The lifecycle phase affected (init, deinit, shutdown).
- The resource that is leaked, double-freed, or used-after-free during lifecycle transition.
- The triggering condition (partial init failure, out-of-order shutdown, signal during teardown).
- Suggested fix.

If no issues are found, state: "No lifecycle issues found in [file]" and briefly explain why the code is correct for this concern.
