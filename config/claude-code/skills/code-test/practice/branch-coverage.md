# Branch Coverage

Systematic analysis of whether all code branches are exercised by tests.

## Scope

Untested conditional branches, match/switch arms, early returns, loop boundaries, short-circuit evaluations, and ternary expressions.

## Checklist

1. **Map all branching points** — for each function in the source file, enumerate every `if/else`, `match`/`switch`, ternary, `guard`/`when`, early `return`, `break`, `continue`, and `goto`. Record the line number and condition for each.

2. **Trace test coverage per branch** — for each branching point, determine whether at least one test exercises the true-path AND at least one test exercises the false-path (or each arm in a multi-way branch). A branch is covered only if a test supplies inputs that force execution through that specific path AND asserts on the outcome.

3. **Short-circuit operators** — for conditions joined by `&&` or `||`, check whether tests exist that exercise both the short-circuited and fully-evaluated paths. Example: `if a && b` needs tests where `a` is false (short-circuit) and where `a` is true but `b` is false.

4. **Loop boundaries** — verify tests cover: zero iterations (empty input / condition false on entry), exactly one iteration, and multiple iterations. For bounded loops, check the boundary value (last valid index, maximum count).

5. **Early returns and guard clauses** — each early return or guard clause represents a branch. Verify a test triggers each guard and asserts on the early-return value or side effect.

6. **Default / fallthrough cases** — for `switch`/`match` statements, verify the `default`/`_`/`else` arm is tested with an input that does not match any explicit case. If no default exists, verify that an exhaustiveness check is enforced by the compiler or that a test covers an unexpected value.

7. **Exception / error branches** — every `try`/`catch`, `Result` match, or error-check `if err != nil` is a branch. Verify both the success and failure paths are tested independently. Do not count a test that only hits the success path as covering the error branch.

8. **Feature flags and configuration branches** — if code branches on feature flags, environment variables, or configuration values, verify tests exist for each significant configuration variant.

## Reporting

For each untested branch, state:
- The branching construct and line number.
- Which specific path is untested (e.g., "else branch at line 42", "Err arm of Result at line 78").
- What input would reach that path.
- What behavior the test should assert on.
