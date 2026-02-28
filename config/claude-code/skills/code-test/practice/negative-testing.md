# Negative Testing

Analysis of whether failure modes, error paths, and invalid inputs are adequately tested.

## Scope

Missing tests for error conditions, invalid inputs, resource failures, boundary violations, and graceful degradation under hostile or malformed data.

## Checklist

1. **Error return paths**; for each function that can return an error (via `Result`, `error`, exception, error code, or sentinel value), verify that at least one test:
   - Forces the error condition to occur.
   - Asserts on the specific error type or code returned.
   - Verifies that no partial side effects were committed (state is consistent after failure).

2. **Invalid input rejection**; for each function that accepts user-controlled or external input, identify inputs that should be rejected and verify tests exist for:
   - Values outside the valid range (negative age, future date for birth date, zero quantity).
   - Malformed formats (invalid email, non-numeric string where number expected, invalid JSON/XML).
   - Inputs that violate documented preconditions.
   Tests should verify the function rejects the input (error, exception, false return) rather than silently accepting it or panicking.

3. **Null / nil / None handling**; for each parameter that can be null, verify a test passes null and asserts on the behavior (error returned, default used, or documented panic).

4. **Resource failure simulation**; identify operations that depend on external resources (file I/O, network, database, memory allocation) and check whether tests simulate failures:
   - File not found, permission denied, disk full.
   - Connection refused, timeout, partial read/write.
   - Out of memory or allocation failure (where applicable).
   Verify the function under test handles these failures without crashing, leaking resources, or corrupting state.

5. **Concurrency error paths**; if the code uses locks, channels, or async operations, check for tests of:
   - Lock acquisition failure or timeout.
   - Channel closed unexpectedly.
   - Cancelled contexts or tokens.
   - Async operation rejection (thread pool full, backpressure).

6. **Overflow and truncation**; verify tests for:
   - Arithmetic overflow (adding two large numbers, multiplying near-max values).
   - String or buffer truncation (input longer than expected capacity).
   - Integer narrowing (casting a large value to a smaller type).

7. **Permission and authorization failures**; if the code performs access control, verify tests for:
   - Unauthenticated requests.
   - Authenticated but unauthorized requests.
   - Expired or revoked credentials.

8. **Idempotency under failure**; if the operation is supposed to be idempotent or retriable, verify tests that:
   - Call the operation twice and assert the second call is safe.
   - Simulate failure mid-operation and retry, asserting no duplication or corruption.

## Reporting

For each finding, state:
- The function and the failure mode that is untested.
- Why this matters; what happens in production when this failure occurs without test coverage (crash, data loss, security bypass, silent corruption).
- A concrete test case: how to trigger the failure and what to assert.
