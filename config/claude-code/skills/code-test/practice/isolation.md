# Isolation

Analysis of test independence, side effect management, and determinism.

## Scope

Tests that depend on execution order, share mutable state, leak side effects, depend on wall-clock time, or interact with external systems without proper boundaries.

## Checklist

1. **Shared mutable state** — identify any mutable state shared between test functions:
   - Global or package-level variables modified by tests without restoration.
   - Class-level fields in test classes mutated across test methods.
   - Static singletons or registries modified during tests.
   Each test should either operate on its own copy of state or use setup/teardown to reset shared state to a known baseline.

2. **Test ordering dependencies** — check whether any test relies on another test having run first:
   - Tests that build on state left by a previous test.
   - Test suites that fail when run in random order or in isolation.
   - Tests named sequentially (test1, test2, test3) suggesting intended ordering.
   Every test must pass when run alone and in any order.

3. **Filesystem side effects** — flag tests that:
   - Create files or directories without cleaning them up.
   - Read from hardcoded absolute paths.
   - Depend on the current working directory being a specific location.
   Verify that tests use temporary directories (provided by the test framework or OS) and clean up via teardown or RAII.

4. **Network and external services** — flag tests that:
   - Make real HTTP calls, database queries, or RPC calls without mocking or a test double.
   - Depend on an external service being available.
   - Use hardcoded hostnames, ports, or URLs.
   Unit tests should not touch the network. If integration tests are intended, verify they are marked as such and can be skipped.

5. **Time dependence** — flag tests that:
   - Use the real system clock (`time.Now()`, `Date.now()`, `Instant::now()`) in the code under test without the ability to inject a fixed time.
   - Assert on timestamps with exact equality.
   - Use `sleep()` or timeouts for synchronization instead of deterministic signaling.

6. **Randomness** — if the code under test uses random number generation, verify that tests either:
   - Inject a seeded RNG for deterministic results.
   - Assert on statistical properties rather than exact values.
   - Document that the test is intentionally nondeterministic and why.

7. **Environment and configuration** — flag tests that:
   - Depend on specific environment variables being set without setting them in the test.
   - Read from configuration files on disk without controlling their content.
   - Behave differently in CI vs local development.
   Verify that tests explicitly set up their required environment.

8. **Resource cleanup** — verify that tests release resources (open files, spawned processes, database connections, goroutines/threads, listeners on ports) even when assertions fail. Check for proper use of `defer`, `finally`, `t.Cleanup()`, `addTeardownBlock`, `@AfterEach`, or equivalent.

## Reporting

For each finding, state:
- The test function and line number.
- The isolation violation: what shared state, side effect, or external dependency is involved.
- The failure mode: how this could cause flaky or order-dependent test results.
- A concrete fix: how to isolate the test (inject dependency, use temp dir, mock service, etc.).
