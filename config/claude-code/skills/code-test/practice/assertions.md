# Assertions

Evaluation of test structure, assertion quality, and adherence to the Arrange-Act-Assert (AAA) pattern.

## Scope

Tests that lack meaningful assertions, violate AAA structure, assert on implementation details instead of behavior, or use assertions that cannot detect faults.

## Checklist

1. **AAA structure**; verify each test follows a clear Arrange-Act-Assert sequence:
   - **Arrange**: set up inputs, dependencies, and preconditions. This section should be clearly separated from the action.
   - **Act**: perform exactly one action (call the function under test). Tests that perform multiple actions in sequence are testing a workflow, not a unit; flag if this is inside a unit test.
   - **Assert**: verify the outcome. Assertions should immediately follow the action with no further mutations in between.
   Flag tests that interleave arrangement, action, and assertion without clear separation.

2. **Assertion presence**; flag tests that have no assertions at all (relying only on "no exception = pass"). A test that only calls a function without checking its return value or side effects proves nothing.

3. **Assertion strength**; evaluate whether assertions verify the right thing:
   - `assert(result != nil)` is weaker than `assert(result == expectedValue)`. Flag assertions that only check non-null/non-error without verifying the actual value.
   - `assert(list.len() > 0)` is weaker than `assert(list == [expected_items])`. Flag overly permissive assertions that would pass for many wrong results.
   - Assertions on `.toString()` or serialized form when structured comparison is available.

4. **Behavioral vs implementation assertions**; flag tests that assert on:
   - Internal method call counts or ordering (over-specified mocking) unless the call order is the contract.
   - Private state or internal fields instead of observable behavior.
   - Exact log messages or debug output instead of return values or side effects.
   These tests break when the implementation is refactored even if behavior is preserved.

5. **Tautological assertions**; flag assertions that cannot fail:
   - `assert(true)`, `assert(1 == 1)`.
   - Asserting that a mock returns what it was configured to return.
   - Asserting the output of a function against itself (e.g., `assert(f(x) == f(x))`).

6. **Error assertions**; when testing error paths, verify the test asserts on:
   - The specific error type or error code, not just "an error occurred."
   - The error message content when it is part of the contract.
   - That the correct exception type is thrown (not a parent class catch-all).

7. **Floating point assertions**; flag exact equality comparisons on floating point results. Verify that approximate comparisons use an appropriate epsilon/tolerance.

8. **Assertion messages**; if the test framework supports custom assertion messages, check whether complex assertions include a message that explains what was expected. Not required for simple comparisons, but valuable for assertions inside loops or with computed expected values.

## Reporting

For each finding, state:
- The test function name and line number.
- The AAA violation or assertion weakness.
- Why the assertion is insufficient; what specific incorrect behavior it would fail to detect.
- A concrete improvement: what the assertion should verify instead.
