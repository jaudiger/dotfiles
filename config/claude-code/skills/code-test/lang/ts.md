# TypeScript — Testing Patterns

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Version and framework detection

- **Language version**: read `tsconfig.json` for `target` and `lib` settings. Read `package.json` for `typescript` version in `devDependencies`.
- **Test framework**: check `package.json` dependencies and config files:
  - `jest` — look for `jest.config.*`, `"jest"` key in `package.json`.
  - `vitest` — look for `vitest.config.*`, `vite.config.*` with test section.
  - `mocha` — look for `.mocharc.*`.
  - `node:test` — built-in Node test runner, check import statements.
  - `ava` — look for `"ava"` key in `package.json`.
  - `playwright` / `cypress` — E2E frameworks, distinct from unit testing.
- **Assertion libraries**: check imports for:
  - `chai` — BDD-style assertions (`expect`, `should`).
  - `@testing-library/*` — DOM testing utilities.
  - `supertest` — HTTP assertion library.
  - `sinon` — spies, stubs, mocks.
  - `msw` — API mocking via service workers.
  - `nock` — HTTP request interception.
  - `fast-check` — property-based testing.
- **Version-sensitive features**: test framework APIs evolve across major versions. Read the actual test imports and matcher usage rather than assuming a specific API shape.

## Test file conventions

- Common patterns: `*.test.ts`, `*.spec.ts`, `__tests__/*.ts`.
- Co-located or in a separate `test/` / `tests/` directory.
- Test suites use `describe()` blocks with `it()` / `test()` cases.
- Lifecycle hooks: `beforeAll`, `afterAll`, `beforeEach`, `afterEach`.

## Language-specific patterns

### Type-level testing
- TypeScript types can be wrong even when runtime behavior is correct. Check for:
  - Tests that verify type narrowing works as expected (discriminated unions, type guards).
  - Use of `expectTypeOf` (vitest) or `tsd` for compile-time type assertions.
  - `as any` or `@ts-ignore` in tests that bypass type checking — these weaken the test.

### Promise and async/await
- Async tests must `await` the result or return the promise. A test that calls an async function without `await` will always pass (the assertion runs after the test completes).
- Rejected promise tests must use `rejects` matchers or try/catch with assertions in the catch block — not just `.catch()` with no assertion.
- Verify tests for race conditions in concurrent async operations.

### Null and undefined
- TypeScript distinguishes `null`, `undefined`, and absent properties. Tests should cover:
  - `null` vs `undefined` when the type allows both.
  - Optional properties omitted vs explicitly set to `undefined`.
  - `strictNullChecks` — if disabled, null-safety tests are especially critical.

### Module mocking
- Verify mocks are properly typed — `jest.mock()` and `vi.mock()` can break type safety.
- Check that mocked modules are restored between tests (`jest.restoreAllMocks()`, `vi.restoreAllMocks()`).
- Verify that manual mocks in `__mocks__/` directories match the actual module interface.
- Over-mocking: if a test mocks everything except the function under test, it is testing the mock setup, not the function.

### DOM and component testing
- Component tests should use `@testing-library` conventions: query by role/label, not by CSS class or test-id.
- Verify tests fire events and assert on DOM changes, not on component internal state.
- Check for missing `act()` wrappers around state updates.
- Snapshot tests: verify they complement (not replace) behavioral assertions. A snapshot test alone is mutation-fragile (any change breaks it) yet mutation-resistant to nothing specific.

### Error boundary testing
- Test that error boundaries catch and display errors.
- Test that thrown errors in async operations are handled.
- Verify error types: `TypeError` vs `RangeError` vs custom error classes.

### Environment and globals
- Tests that modify `process.env`, `window`, or `globalThis` must restore originals.
- Use `vi.stubEnv()` / `vi.unstubAllEnvs()` or equivalent.
- Browser API mocks (`localStorage`, `fetch`, `IntersectionObserver`) must be cleaned up.
