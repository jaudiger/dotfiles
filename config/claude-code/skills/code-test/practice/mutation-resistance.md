# Mutation Resistance

Analysis of whether tests would detect faults introduced by common code mutations, ensuring tests verify actual behavior rather than merely executing code.

## Scope

Tests that pass even when the source code is mutated; indicating they provide false confidence. A mutation-resistant test suite fails when any semantically meaningful change is made to the code it covers.

## Concept

Mutation testing conceptually applies small changes (mutants) to the source code and checks whether any test fails. If all tests still pass after a mutation, the test suite has a gap; it executes the code but does not truly verify its behavior. This practice performs manual mutation analysis without running a mutation testing tool.

## Checklist

1. **Condition negation**; for each conditional (`if`, `while`, `match` guard), consider: if the condition were negated (`!condition`), would any test fail? If not, the test is not asserting on the behavioral difference between the two branches.

2. **Operator replacement**; for each comparison or arithmetic operator, consider:
   - `<` replaced with `<=` (or vice versa); tests must cover the boundary value to detect this.
   - `+` replaced with `-`: tests must verify computed values, not just that a value was returned.
   - `==` replaced with `!=`: tests must exercise both the equal and not-equal case.
   - `&&` replaced with `||`: tests must have cases where operands differ in truth value.

3. **Return value mutation**; for each return statement, consider: if the return value were replaced with a different value of the same type (e.g., `return 0` instead of `return count`, or `return true` instead of `return isValid`), would any test fail? Flag functions where tests call the function but do not assert on its return value.

4. **Statement deletion**; for each statement with a side effect (assignment, function call, append, remove), consider: if the statement were deleted, would any test fail? This catches:
   - Assignments that are never verified (e.g., `user.active = false` with no test checking the field).
   - Function calls whose effects are not asserted (e.g., `cache.invalidate()` with no test verifying cache state).
   - Collection modifications (add/remove) with no test checking the collection's contents.

5. **Constant replacement**; for each literal constant in the source, consider: if it were changed to a different value (0 to 1, "" to "x", timeout from 30 to 0), would any test fail? Flag constants that appear in logic-critical positions but whose specific values are never tested.

6. **Exception/error removal**; for each throw/raise/return-error statement, consider: if it were removed (making the function silently continue), would any test fail? This is distinct from negative testing: here we check that error-path tests actually assert on the error, not just that error tests exist.

7. **Null/optional return**; for functions that can return null/nil/None/empty, consider: if the function always returned null (or always returned non-null), would the test suite detect the difference?

8. **Summary heuristics**; after the per-mutation analysis, identify systemic patterns:
   - Functions with tests that only check "no error" but never check the actual output.
   - Test files where assertions are predominantly `.toBeTruthy()`, `!= nil`, or `is not None` without value comparison.
   - Tests that exercise the happy path but whose assertions would pass for any non-error result.

## Reporting

For each surviving mutant, state:
- The source line and the specific mutation (e.g., "negating condition at line 34 would not be caught").
- Which test was expected to catch it and why it does not.
- The assertion or test case that is missing to kill the mutant.
- Priority: mutations in critical business logic, security checks, and data validation are more severe than mutations in logging or formatting.
