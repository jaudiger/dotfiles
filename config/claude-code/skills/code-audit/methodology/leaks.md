# Leak Detection Methodology

## Scope

Memory leaks, resource leaks (file descriptors, sockets, database connections, handles), and logical leaks (goroutine leaks, subscription leaks, listener leaks).

## Systematic Procedure

### Step 1: Inventory allocations and resource acquisitions

Scan the file for every call that allocates memory or acquires a resource. Record each with its line number and the variable that receives ownership.

### Step 2: Trace every code path from each allocation

For each allocation identified in Step 1:

1. Trace the success path forward. Verify the resource is freed, closed, or ownership is transferred (returned, stored in an owning container).
2. Trace every error/exception path. For each early return, break, continue, throw, or error branch after the allocation, verify the resource is released before leaving scope.
3. Trace conditional paths. If the allocation is inside an if/match/switch, verify every branch that exits scope releases it.

### Step 3: Check deferred/RAII cleanup pairing

For languages with defer, errdefer, RAII, or try-with-resources:

1. Verify the cleanup is registered immediately after a successful acquisition, not after intervening code that could fail.
2. Verify the cleanup call matches the acquisition (e.g., `fclose` for `fopen`, `.deinit()` for `.init()`).
3. Verify defer-in-loop pitfalls: deferred cleanup that runs at function exit, not at iteration end.

### Step 4: Check container and cache growth

1. Identify every collection (list, map, set, queue, cache) that grows from external input or over time.
2. Verify a size cap, eviction policy, or periodic purge exists.
3. Flag unbounded append/insert in loops driven by I/O or network data.

### Step 5: Check ownership transfers

1. When a resource is stored in a data structure, verify the structure's cleanup releases it.
2. When a resource is returned to the caller, verify the caller's contract documents ownership.
3. When ownership is conditional (stored only on success), verify the failure path frees it.

### Step 6: Check concurrent/async resource lifecycle

1. Resources shared across threads/tasks: verify a clear owner responsible for cleanup.
2. Resources passed to spawned threads/goroutines/tasks: verify they outlive the thread.
3. Subscriptions, listeners, callbacks: verify matching unsubscribe/removeListener in teardown.

## Reporting

For each leak found, state:
- The allocation (file, line, call).
- The code path that leaks (which branch, which condition).
- Why the resource is not freed on that path.
- Suggested fix (add defer, add errdefer, add finally, move cleanup).

If no issues are found, state: "No leak issues found in [file]" and briefly explain why the code is correct for this concern.
