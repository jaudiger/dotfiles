# Correctness

Evaluate changed and added code for logical errors.

## Checklist

### 1. Logic errors

- Conditions: inverted boolean logic, wrong operator (`&&` vs `||`, `<` vs
  `<=`), missing negation.
- Off-by-one: loop bounds, slice/substring indices, fence-post errors.
- Short-circuit evaluation: side effects skipped by short-circuit, wrong
  operand order.

### 2. State consistency

- Variables modified in the diff: are all downstream consumers updated to
  match?
- Enum/union variants added or removed: are all switch/match arms updated?
- Struct/class fields added or removed: are all constructors, serializers, and
  comparators updated?

### 3. Edge cases

- Null, nil, None, undefined: can new code paths receive these values?
- Empty collections: does the code handle zero-length inputs?
- Boundary values: max/min integers, empty strings, zero, negative numbers.
- Concurrent calls: can this code be called concurrently? Is that safe?

### 4. Contract violations

- Preconditions: does the changed code assume inputs that callers may not
  guarantee?
- Postconditions: does the changed code still satisfy what callers expect?
- Invariants: does the change break any documented or implicit invariant?

### 5. Regression risk

- Changed function signatures: are all call sites updated?
- Changed return values or error types: do callers handle the new
  possibilities?
- Removed code: was the removed code load-bearing for another path?

### 6. Data handling

- Type conversions: lossy casts, truncation, precision loss.
- String encoding: UTF-8 assumptions, byte vs character length.
- Comparison semantics: reference vs value equality, locale-sensitive ordering.
