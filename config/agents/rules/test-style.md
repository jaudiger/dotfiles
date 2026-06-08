# Testing practices

## Extend before create

Add assertions to an existing test when the setup and action match. Only create a new test for a genuinely different scenario.

## One concept per test

Each test verifies one logical behavior. Multiple assertions are fine when they all check facets of the same behavior.

## Keep tests minimal

- Only arrange what the test actually needs.
- No logic in tests: no conditionals or branching. Loops are acceptable for table-driven / parameterized tests.
- No helper abstractions for a single test. Inline the setup.
- Prefer literal values over computed ones so expected results are obvious at a glance.
