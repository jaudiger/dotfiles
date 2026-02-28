# Rust: Testing Patterns

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Version and framework detection

- **Language version**: read `Cargo.toml` for `rust-version` (MSRV) and `edition` fields. Check `rust-toolchain.toml` for the pinned toolchain.
- **Test framework**: Rust uses the built-in `#[test]` attribute by default. Check `Cargo.toml` `[dev-dependencies]` for:
  - `rstest`: parameterized and fixture-based tests.
  - `proptest` or `quickcheck`: property-based testing.
  - `mockall`: mock generation.
  - `wiremock`: HTTP mocking.
  - `assert_cmd` / `predicates`: CLI testing.
  - `tokio` with `#[tokio::test]`: async test runtime.
  - `test-case`: parameterized test macros.
  - `insta`: snapshot testing.
  - `pretty_assertions`: diff-friendly assertion output.
- **Version-sensitive features**: verify availability before recommending:
  - `assert_matches!` macro; check if stabilized in the detected edition.
  - `#[should_panic(expected = "...")]`: available in all editions but check usage patterns.
  - Async test support depends on the runtime crate version.
  Read actual `use` statements to confirm what is imported.

## Test file conventions

- Unit tests: `#[cfg(test)] mod tests { ... }` at the bottom of the source file.
- Integration tests: files in `tests/` directory at crate root.
- Doc tests: code blocks in `///` documentation comments.
- Test functions: `#[test] fn test_name() { ... }`.
- Async tests: `#[tokio::test]` or `#[async_std::test]`.

## Language-specific patterns

### Result and Option testing
- Tests should verify both `Ok` and `Err` variants of `Result` returns.
- Use `unwrap()` only in tests where the assertion IS that the value is `Ok`/`Some`: otherwise use pattern matching for clearer failure messages.
- For `Err` variants, assert on the error type/variant AND the error message when it is part of the contract.
- Check for `.is_ok()` / `.is_err()` assertions that discard the inner value; these are weak assertions.

### Panic testing
- `#[should_panic]` tests should include the `expected` string to avoid false passes from unrelated panics.
- For `Result`-based APIs, panics should generally not be the tested contract; test the `Err` return instead.
- Verify that `#[should_panic]` tests are not masking bugs by catching panics from the wrong location.

### Trait and generic testing
- Generic functions should be tested with multiple concrete types, especially types at the boundaries of trait constraints.
- Trait implementations on custom types should be tested directly, not just through higher-level functions.
- `Default`, `Clone`, `PartialEq`, `Debug` derived traits; verify round-trip properties when they matter.

### Ownership and lifetime patterns
- Tests should verify that functions consuming ownership actually take ownership (compile-time check, but lifetime-related bugs in unsafe code need runtime tests).
- Tests for mutable references should verify the referenced data is correctly modified.
- Tests involving `Arc`/`Rc` shared ownership should verify no unexpected clones or reference cycles.

### Async testing
- Async tests should test cancellation behavior (dropping futures mid-execution).
- Tests with `tokio::select!` should cover all arms, including the case where specific branches win.
- Timeouts in async tests should use `tokio::time::timeout()` rather than thread sleep.
- Verify tests handle `JoinError` for spawned tasks.

### Error type testing
- Custom error types (with `thiserror` or manual `impl`) should have tests for:
  - Each variant construction.
  - `Display` output.
  - `From` conversions (if implemented).
  - `source()` chain (if wrapping other errors).

### Unsafe code
- Unsafe code blocks require tests that exercise the safety invariants the developer is asserting.
- Run tests under Miri when possible; check if the CI configuration includes Miri runs.
- Tests should cover the boundary between safe and unsafe: what happens when the safe API is misused in ways the unsafe implementation relies on not happening?

### Feature-flagged code
- Code behind `#[cfg(feature = "...")]` should have tests that run with that feature enabled.
- Check `Cargo.toml` for test-specific features and verify CI runs tests with relevant feature combinations.
