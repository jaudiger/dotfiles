# Error Handling

Evaluate how the changeset handles failure cases.

## Checklist

### 1. New fallible operations

- Identify every new operation that can fail (I/O, parsing, network calls,
  allocation, type conversion).
- Is each error handled, propagated, or explicitly documented as intentionally
  ignored?

### 2. Swallowed errors

- Empty catch blocks, discarded Result or error returns (`_ = ...`).
- Log-and-continue: is it correct to continue, or should the operation abort?
- TODO or FIXME comments in error paths: are they acceptable for this change
  or should they be resolved now?

### 3. Error propagation

- Is error context preserved (wrapping, chaining) or lost during propagation?
- Does the error type match what callers expect?
- Could a propagated error reach a handler that misinterprets it?

### 4. Partial state on failure

- If an operation fails midway, is state rolled back or left consistent?
- Are resources acquired before the failure cleaned up (defer, finally, RAII,
  errdefer)?
- Can a caller observe an intermediate, invalid state?

### 5. User-facing errors

- Do error messages exposed to end users avoid leaking internals (stack
  traces, file paths, SQL queries)?
- Are error messages actionable — can the user understand what went wrong and
  what to do?
- Are error codes or types stable for programmatic consumers?

### 6. Panic and crash paths

- Are there unwrap, expect, assert, or panic calls on values that could
  legitimately be absent at runtime?
- In libraries: does the change panic where returning an error would be more
  appropriate?
- In error handlers: can the error handler itself fail or panic?
