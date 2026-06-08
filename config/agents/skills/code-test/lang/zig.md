# Zig: Testing Patterns

Target version: Zig 0.16+.

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

Cancelation is not a standalone practice: `error.Canceled` path coverage falls under `negative-testing`, and cancelation-timing boundaries (cancel before/during/after await) fall under `edge-cases`. The cancelation-specific guidance in this file applies when those practices are selected.

## Test framework

- Zig uses the built-in `test` keyword and `std.testing` namespace. There are no mainstream third-party test frameworks. Check:
  - `std.testing.expect`: boolean assertion.
  - `std.testing.expectEqual`: equality assertion.
  - `std.testing.expectError`: error assertion.
  - `std.testing.allocator`: leak-detecting allocator.
  - `std.testing.io`: the `Io` instance for tests that exercise `std.Io`-taking APIs.
  - Custom test runners: check `build.zig` for `.setTestRunner()` or custom test filter configuration.

## Test file conventions

- Tests are inline: `test "description" { ... }` blocks within the source file.
- Tests can also live in separate files imported by `build.zig` test steps.
- `std.testing` provides the assertion functions.
- `std.testing.allocator` is a leak-detecting allocator; tests using it get automatic leak detection on scope exit.

## Language-specific patterns

### Allocator testing

- Zig's explicit allocator pattern is uniquely testable. Check:
  - Tests use `std.testing.allocator` instead of `std.heap.page_allocator` or other allocators.
  - Every allocation path is tested: success and `OutOfMemory` failure.
  - Tests verify that all allocated memory is freed by the end of the test (the testing allocator reports leaks).
  - Functions accepting `Allocator` are tested with `std.testing.FailingAllocator` to simulate allocation failure at every allocation site.
  - Arena-based code resets the arena between scenarios rather than relying on process exit.

### Error handling

- Zig uses error unions (`!T`); check that tests cover:
  - The success path (unwrap with `try` or `catch`).
  - Each error in the error set (use `std.testing.expectError`).
  - Error propagation: if a function propagates errors from callees, test that each callee error is correctly propagated.
  - `error.Canceled` for any `Io`-taking operation that advertises cancelation.
- `catch unreachable` in tests should only be used when the error provably cannot occur with the given inputs. Flag `catch unreachable` on operations that could fail with different inputs.

### Io and async testing

- Tests that exercise `std.Io`-taking APIs should use `std.testing.io` rather than constructing a production `Io`. Where a test needs an isolated single-threaded `Io`, build one with `std.Io.Threaded.init_single_threaded` and pass `.io()`.
- For async code built on `io.async(...)`, verify coverage of:
  - Normal completion via `future.await(io)`.
  - Cancelation via `future.cancel(io)` and the resulting `error.Canceled` on the task.
  - `std.Io.Group` join behavior when one task fails while others are still running.
- For Reader/Writer logic, test with in-memory streams: `std.Io.Reader.fixed(data)` and `std.Io.Writer.fixed(buffer)`.

### Comptime and generic testing

- `comptime` functions should be tested at comptime: `comptime { ... }` blocks inside tests verify compile-time evaluation.
- Generic functions (using `anytype` or compile-time parameters) should be tested with multiple concrete types.
- Verify that compile errors for invalid types are tested using `@compileError` and `std.testing.expectError` on compile-time paths where applicable.
- Type-reification builtins (`@Int`, `@Struct`, `@Union`, `@Enum`, `@Tuple`, `@Pointer`, `@Fn`) used in generic code should be exercised across representative parameter shapes.

### Optional values

- Functions returning `?T` should be tested for both `null` and non-null returns.
- Tests should not use `.?` (force unwrap) without first establishing that the value is non-null; this hides the assertion.
- `orelse unreachable` in tests is acceptable only when the test has already ensured the value is present.

### Slice and pointer safety

- Test slice operations at boundaries: empty slice (`&.{}`), single element, slice at capacity.
- Test functions that take pointers with alignment requirements, including explicitly-aligned pointer parameters.
- Test sentinel-terminated slices (`:0`) with and without the sentinel present in the underlying data.
- Float-to-integer conversions (`@trunc`, `@floor`, `@ceil`, `@round`) should be tested at representable limits, non-finite inputs, and values at the boundary of the target integer type.

### Packed structs and bit manipulation

- Packed struct field access and modification should be tested at boundaries.
- `packed union` tests should cover every field with values that span the explicit backing integer, since each field's `@bitSizeOf` must equal the backing width.
- Bit shift operations: test with shift amount of `0`, `1`, type width minus 1, and (where applicable) the full width.
- Test `@bitCast` operations with values at the extremes of both types.

### Build-time configuration

- Code using `@import("build_options")` or build-time configuration should have tests exercising each configuration variant.
- Verify `build.zig` defines test steps for relevant option combinations.
