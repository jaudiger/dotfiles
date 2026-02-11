# Out-of-Memory Resilience Methodology

## Scope

Unchecked allocation failures, inconsistent state after partial OOM, and unbounded memory growth from external input.

## Systematic Procedure

### Step 1 — Inventory all allocation sites

For every call that allocates heap memory (explicit allocator calls, collection growth, object construction):

1. Record the line and what is allocated.
2. Record whether the allocation can fail (returns error/null/Option) or is infallible (panics on OOM).

### Step 2 — Check error propagation on fallible allocations

For each fallible allocation:

1. Is the error checked? Flag unchecked null returns or ignored error codes.
2. Is the error propagated, handled with a fallback, or silently swallowed?
3. If swallowed: does subsequent code dereference the null/use the uninitialized value?

### Step 3 — Check partial state consistency

For every function that performs multiple allocations or mutations as a logical transaction:

1. If allocation N fails after allocations 1..N-1 succeeded, are the first N-1 allocations freed?
2. Is the data structure left in a consistent state? (e.g., a half-inserted node in a tree, a partially-filled struct with some fields initialized and others not)
3. Check that error cleanup does not itself allocate (could fail recursively).

### Step 4 — Check unbounded growth from external input

1. Identify every collection that grows based on data read from network, file, user input, or IPC.
2. Verify a maximum size cap exists before insertion.
3. Check for loops that allocate per iteration driven by external data without freeing per iteration.
4. Check for recursive data structures that can grow unboundedly from deserialization.

### Step 5 — Check infallible allocation paths

For languages/allocators where allocation panics on OOM instead of returning an error:

1. Identify critical paths where a panic is unacceptable (server request handlers, embedded systems, library code).
2. Verify whether fallible alternatives are available and should be used (try_reserve, try_new, allocator.alloc with error return).
3. Flag any allocation inside a panic handler or abort handler.

### Step 6 — Check allocation in signal/interrupt handlers

1. Signal/interrupt handlers must not allocate — verify no allocation calls exist in handlers.
2. Check that logging or error reporting in handlers does not allocate.

## Reporting

For each finding, state:
- The allocation site (file, line, call).
- Whether the failure is unchecked, partially handled, or leads to inconsistent state.
- The external input path that could trigger unbounded growth (if applicable).
- Suggested fix (add error check, add size cap, add transactional rollback).

If no issues are found, state: "No OOM resilience issues found in [file]" and briefly explain why the code is correct for this concern.
