# Use-After-Free Detection Methodology

## Scope

Use of pointers, slices, references, or iterators that refer to memory that has been freed, reallocated, or invalidated. Includes double-free.

## Systematic Procedure

### Step 1 — Inventory pointer/reference origins

For every pointer, slice, reference, or iterator in the file:

1. Record where the underlying memory is allocated.
2. Record every alias (other variables pointing to the same memory).
3. Record where the memory is freed or could be invalidated.

### Step 2 — Check explicit free then use

For every free/dealloc/destroy/drop call:

1. Scan all code reachable after the free within the same scope.
2. Verify no alias of the freed pointer is read, written, or passed to a function.
3. Check that the pointer is not freed again (double-free).
4. If the free is conditional, verify all branches are consistent.

### Step 3 — Check container mutation invalidation

For every operation that can reallocate a container's backing storage (append, insert, put, push, resize, rehash):

1. Identify all pointers, slices, references, or iterators obtained from the container before the mutation.
2. Verify none of them are used after the mutating operation.
3. Pay special attention to loops that both iterate and mutate the same container.

### Step 4 — Check arena/pool/region invalidation

For every arena reset, pool return, or region dealloc:

1. Identify all pointers allocated from that arena/pool before the reset.
2. Verify none are used after the reset/deinit.
3. Check that deinit order does not cause one component to use memory from an already-deinited arena.

### Step 5 — Check lifetime escapes

1. Returning a pointer/reference to a stack-local variable.
2. Storing a pointer to a temporary value that will be destroyed at statement end.
3. Closures capturing references to locals that go out of scope when the closure is called.
4. Pointers obtained before a condition variable wait (mutex released temporarily) used after the wait.

### Step 6 — Check double-free and move-after-free

1. Verify every free has exactly one matching allocation.
2. Verify moved/transferred values are not used after the move.
3. Check error-handling paths for duplicate free calls.

## Reporting

For each finding, state:
- The pointer/reference and where it was obtained (file, line).
- The invalidating operation (free, realloc, arena reset, container mutation) and its line.
- The use-after-invalidation and its line.
- A triggering scenario (what input or timing causes the path).
- Suggested fix.

If no issues are found, state: "No use-after-free issues found in [file]" and briefly explain why the code is correct for this concern.
