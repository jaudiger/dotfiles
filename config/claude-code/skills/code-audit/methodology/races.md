# Data Race and Concurrency Bug Detection Methodology

## Scope

Data races (concurrent unsynchronized access where at least one is a write), logical races (TOCTOU, check-then-act), and atomicity violations.

## Systematic Procedure

### Step 1 — Identify shared mutable state

For every struct, class, module, or global scope:

1. List every field/variable that can be accessed from more than one thread, goroutine, or async task.
2. For each, record whether it is protected by a lock, atomic, channel, or other synchronization mechanism.
3. Flag any shared mutable state with no visible synchronization.

### Step 2 — Trace access patterns per entry point

For every public method, thread entry point, goroutine, or async task:

1. List which shared fields are read.
2. List which shared fields are written.
3. Note which lock (if any) is held during each access.

### Step 3 — Check unprotected concurrent access

For each shared field identified in Step 1:

1. Collect all read and write sites.
2. If any write exists without synchronization AND any other access (read or write) exists from a different thread without synchronization, flag as a data race.
3. Non-atomic reads of values written by another thread count as data races even for "simple" types (bool, int, pointer).

### Step 4 — Check TOCTOU (time-of-check-to-time-of-use)

For every pattern where a value is checked and then acted upon:

1. Is the check and the action performed under the same lock, atomically, or in a single operation?
2. If the lock is released between check and action, another thread can change the value. Flag as TOCTOU.
3. Common patterns: check-if-exists then insert, check-size then access, check-null then use, check-permission then act.
4. Filesystem TOCTOU: stat/access then open — another process can change the file between the two calls.

### Step 5 — Check atomicity violations

For every compound operation on shared state:

1. Read-modify-write on a non-atomic variable without a lock (e.g., `counter++`, `map[key] += 1`).
2. Multiple related fields updated non-atomically (e.g., updating `size` and `buffer` pointer separately).
3. Publishing a partially-initialized object to another thread (object visible before all fields are set).

### Step 6 — Check closure and capture races

1. Variables captured by closures passed to spawned threads/goroutines/tasks: is the variable mutated after spawn?
2. Loop variable captured by reference in concurrent spawn (classic Go pre-1.22 bug, also applies to other languages with closures).
3. Mutable references shared across async tasks without synchronization.

### Step 7 — Check lock-release-then-use

1. After releasing a lock, does subsequent code use values read while the lock was held?
2. Those values may now be stale. Flag if the stale value drives a branching decision or mutation.

## Reporting

For each finding, state:
- The shared variable/field (file, line of declaration).
- The unsynchronized access sites (file, line, read or write).
- Which threads/tasks can reach those sites concurrently.
- A concrete interleaving that triggers the bug.
- Suggested fix (add lock, use atomic, restructure to message-passing).

If no issues are found, state: "No data race issues found in [file]" and briefly explain why the code is correct for this concern.
