# Async Bugs Methodology

## Scope

Floating promises, unhandled async errors, shared mutable state across await points, concurrent task lifecycle issues, and callback/event-driven bugs.

## Systematic Procedure

### Step 1: Check for floating promises and unhandled futures

For every async function call, promise creation, or future spawn:

1. Is the result awaited, returned, stored, or explicitly discarded with a documented reason?
2. A floating promise/future means: errors are silently lost, completion is not tracked, and backpressure is not applied.
3. Flag any async function call whose return value is not captured.
4. Flag `.then()` chains without a terminal `.catch()` or error handler.

### Step 2: Check error handling across async boundaries

For every try/catch around async code:

1. Does the catch handle the actual errors the async operation can produce?
2. Are cleanup operations in a finally block?
3. Is the catch re-throwing, logging, or silently swallowing?
4. For promise combinators (all, race, allSettled): if one promise rejects, are the others cleaned up (cancelled, aborted)?
5. `Promise.all` partial failure: are successfully-resolved resources released if one promise fails?

### Step 3: Check shared mutable state across await points

For every mutable variable accessed both before and after an await/yield:

1. Can another concurrent task modify this variable during the await?
2. Is there a read-then-write pattern across an await? (async TOCTOU)
3. Are multiple async tasks writing to the same variable without coordination?
4. Flag any check-then-act pattern where the check and act are separated by an await.

### Step 4: Check concurrent task lifecycle

1. Spawned tasks: are they tracked? Can the parent cancel or wait for them?
2. Fire-and-forget tasks: are errors handled inside the task?
3. Task cancellation: does the task check for cancellation and clean up resources?
4. Goroutine/task leak: can a spawned unit block forever with no cancellation path?

### Step 5: Check callback and event-driven patterns

1. Event listeners added without corresponding removal in teardown.
2. Callbacks that reference state (`this`, closed-over variables) that may be stale or disposed when the callback fires.
3. Timer callbacks (setTimeout, setInterval) not cleared on cleanup.
4. Stream/iterator consumption without error event handling.
5. Callbacks that fire after the owning component is destroyed.

### Step 6: Check async function correctness

1. Async function with no await inside: likely a bug; the function is async for no reason, or an await is missing.
2. Await inside a loop with no concurrency control: should it use batching or a concurrency limiter?
3. Sequential awaits that could be parallel: not a bug, but flag for review if performance-sensitive.

## Reporting

For each finding, state:
- The async operation (file, line).
- The bug class (floating promise, async TOCTOU, callback leak, unhandled rejection).
- A concrete interleaving or scenario that triggers the bug.
- Suggested fix.

If no issues are found, state: "No async bug issues found in [file]" and briefly explain why the code is correct for this concern.
