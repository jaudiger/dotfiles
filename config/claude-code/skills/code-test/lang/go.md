# Go: Testing Patterns

Target version: Go 1.24+.

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Test frameworks

- Go uses the `testing` stdlib package by default. Check imports for third-party frameworks:
  - `github.com/stretchr/testify`: assertion and mock helpers.
  - `github.com/onsi/ginkgo` / `github.com/onsi/gomega`: BDD-style.
  - `github.com/google/go-cmp`: structural comparison.
  - `pgregory.net/rapid` or `github.com/leanovate/gopter`: property-based testing.

## Test file conventions

- Test files are co-located and named `*_test.go`.
- Test functions are `func TestXxx(t *testing.T)`.
- Subtests via `t.Run("name", func(t *testing.T) { ... })`.
- Table-driven tests are the dominant Go idiom: `tests := []struct{ ... }{ ... }`.
- Example tests: `func ExampleXxx()` with `// Output:` comments.
- Benchmarks: `func BenchmarkXxx(b *testing.B)`.
- Fuzz tests: `func FuzzXxx(f *testing.F)`.

## Language-specific patterns

### Table-driven tests

Go convention favors table-driven tests. When reviewing, check:

- Each table entry has a descriptive `name` field used in `t.Run()`.
- The table covers all equivalence classes, not just the happy path.
- Error cases are included in the table with an `wantErr` or `errContains` field.
- The table is not a single entry (that is just a regular test with extra ceremony).

### Error checking

Go has no exceptions; errors are values. Check:

- Tests verify `err != nil` AND the specific error (via `errors.Is`, `errors.As`, or string matching).
- Tests do not only check `err == nil` without verifying the return value.
- Sentinel errors and custom error types are tested specifically.

### Interface satisfaction

- Functions accepting interfaces can be tested with test doubles. Verify mocks implement the full interface, not just the methods called by one code path.
- Check that interface assertions (`var _ Interface = (*Impl)(nil)`) exist where appropriate.

### Goroutine and concurrency

- Tests using `t.Parallel()` must not close over loop variables captured by reference.
- Tests spawning goroutines should use `t.Cleanup()` or synchronization to avoid goroutine leaks.
- Race conditions in tests can be detected with `-race` flag; but this is runtime, not structural. Check for shared state in parallel tests.

### Context handling

- Functions accepting `context.Context` should be tested with cancelled and timed-out contexts.
- Tests should pass `context.Background()` or `context.TODO()` explicitly, not `nil`.

### HTTP handler testing

- Use `httptest.NewRecorder()` and `httptest.NewRequest()` for handler unit tests.
- Use `httptest.NewServer()` for integration-level tests.
- Verify response status code, headers, AND body content.

### Cleanup and temporary resources

- Use `t.TempDir()` for temporary directories (auto-cleaned).
- Use `t.Cleanup()` for deferred cleanup that runs even on test failure.
- Use `t.Setenv()` for environment variable manipulation with automatic restoration.
