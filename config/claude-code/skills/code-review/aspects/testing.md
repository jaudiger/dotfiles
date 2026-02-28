# Testing

Evaluate test coverage and quality for the changeset.

## Checklist

### 1. Coverage of changed behavior

- Is every new code path exercised by at least one test?
- Are modified behaviors covered by updated or new tests?
- Are deleted tests still needed; did they cover behavior that still exists
  elsewhere?

### 2. Edge cases and boundaries

- Are boundary values tested (empty input, zero, max, nil/null)?
- Are error paths tested (invalid input, network failure, permission denied)?
- Are concurrency scenarios tested if the change involves shared state?

### 3. Test quality

- Do assertions verify behavior and outcomes, not implementation details?
- Are test names descriptive of the scenario and expected result?
- Is each test independent and repeatable; no shared mutable state, no
  ordering dependency?

### 4. Missing test scenarios

- Based on the changed code, identify specific scenarios that lack test
  coverage.
- Prioritize by risk: what would cause the most damage if broken silently?

### 5. Test isolation

- Do new tests depend on external services, network, or filesystem without
  appropriate mocking or sandboxing?
- Are test fixtures and setup/teardown correctly scoped?
- Could new tests be flaky due to timing, ordering, or environment
  differences?

### 6. Integration and contract

- If the change affects a public API or interface: is the contract tested?
- If the change interacts with external systems: is there an integration or
  contract test?
- Are new dependencies mocked at the right boundary?
