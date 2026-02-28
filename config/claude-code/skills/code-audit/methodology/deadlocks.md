# Deadlock Detection Methodology

## Scope

Deadlocks, lock ordering violations, self-deadlocks on non-recursive mutexes, starvation from blocking calls under locks, and condition variable misuse.

## Systematic Procedure

### Step 1: Inventory all synchronization primitives

List every mutex, rwlock, semaphore, condition variable, and channel in the file/module. For each, record:

1. Where it is declared.
2. Whether it is recursive or non-recursive.
3. Which struct/class/module owns it.
4. What data it protects (identify the invariant).

### Step 2: Map lock acquisition sites

For every lock/acquire/enter call:

1. Record the line and which lock is acquired.
2. Identify the matching unlock (defer, RAII guard drop, finally, explicit call).
3. If no matching unlock exists on any code path, flag as a held-forever bug.

### Step 3: Check self-deadlock

For every lock held at a given point:

1. List every function called while that lock is held.
2. For each called function, recursively check: does it acquire the same lock?
3. If yes and the lock is non-recursive, flag as self-deadlock.

### Step 4: Check lock ordering

1. For every site that holds lock A and acquires lock B, record the pair (A, B).
2. Search the entire file/module for any site that holds B and acquires A.
3. If both orderings exist, flag as a potential deadlock cycle.
4. Extend to chains of 3+ locks: verify a consistent total ordering.

### Step 5: Check condition variable usage

For every condition variable wait:

1. Verify the wait is inside a while loop checking a predicate (spurious wakeup safety).
2. Verify a corresponding signal/notify/broadcast exists and is called under the same lock.
3. Verify shutdown/cancellation can break the wait (timeout, flag, or broadcast on shutdown).

### Step 6: Check blocking operations under locks

For every lock-held region, flag any:

1. I/O operations (file, network, database).
2. Sleep/delay calls.
3. Channel send/receive (especially unbuffered channels).
4. HTTP requests or RPC calls.
5. Waiting on another thread/task completion.

These are starvation risks and potential deadlocks if the blocked operation needs the same lock.

### Step 7: Check async-specific deadlock patterns

1. Mutex guards held across await points (blocks the executor thread).
2. Synchronous lock acquisition inside async context (blocks the runtime).
3. Bounded channel full + sender holding a lock the consumer needs.

## Reporting

For each finding, state:
- The locks involved and their locations.
- The code path that leads to deadlock (which thread/task acquires what, in what order).
- A concrete triggering scenario.
- Suggested fix (reorder locks, use try_lock, split critical section, use async-aware mutex).

If no issues are found, state: "No deadlock issues found in [file]" and briefly explain why the code is correct for this concern.
