# Error Handling Methodology

## Scope

Silently swallowed errors, incorrect error propagation, missing error paths, and error handling that leaves state inconsistent.

## Systematic Procedure

### Step 1 — Inventory all fallible operations

For every function call that can fail (returns error, throws, returns null/Option/Result):

1. Record the line, the call, and the possible error conditions.
2. Record how the error is handled: propagated, caught, logged, or ignored.

### Step 2 — Check silently swallowed errors

Flag every instance where an error is ignored:

1. Explicit discard: `_ = fallibleCall()`, catch block with no body, empty error handler.
2. Implicit discard: calling a function that returns an error but not capturing the return value.
3. Log-and-continue: error is logged but the function continues as if nothing happened — verify this is intentional and the subsequent code can handle the failure state.

### Step 3 — Check error propagation correctness

For every error that is propagated:

1. Is context preserved? (wrapped with additional info or just re-thrown as-is?)
2. Is the error type correct? (wrong error variant, generic "something went wrong" losing specifics)
3. Does propagation skip necessary cleanup? (resource acquired before the error, not released on propagation path)

### Step 4 — Check partial state on error

For every function that mutates state and can fail midway:

1. If the function fails after partial mutation, is the state rolled back?
2. Can callers observe the partial state? (e.g., item added to list but counter not incremented)
3. Is the object still usable after the error, or is it left in a corrupt state?

### Step 5 — Check error paths that cannot happen in practice

1. Identify "impossible" error paths handled with panic/abort/unreachable.
2. Verify the assumption is actually guaranteed (not just currently true).
3. Flag any unwrap/expect/force-unwrap on values from external input or I/O.

### Step 6 — Check catch-all and generic error handling

1. Catch-all blocks (catch all exceptions, match on `_` error variant): do they accidentally swallow specific errors that need different handling?
2. Error downcasting/matching: is the match exhaustive? Can new error variants be added upstream without a compile error here?
3. Retry logic: is there a maximum retry count? Does retry handle non-transient errors?

### Step 7 — Check error handling in cleanup/finally

1. If cleanup code can fail, is that secondary error handled?
2. Does a cleanup error mask the original error?
3. Verify finally/defer blocks do not themselves throw, suppressing the original error.

## Reporting

For each finding, state:
- The fallible call (file, line).
- How the error is mishandled (swallowed, wrong type, no cleanup, partial state).
- The consequence (silent data corruption, misleading error message, resource leak).
- Suggested fix.

If no issues are found, state: "No error handling issues found in [file]" and briefly explain why the code is correct for this concern.
