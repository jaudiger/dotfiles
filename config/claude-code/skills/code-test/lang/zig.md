# Zig: Testing Patterns

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Version and framework detection

- **Language version**: read `build.zig.zon` for the Zig version or minimum version field. Check `.zigversion` if present. Inspect `build.zig` for version-specific API usage.
- **Test framework**: Zig uses the built-in `test` keyword and `std.testing` namespace. There are no mainstream third-party test frameworks. Check:
  - `std.testing.expect`: boolean assertion.
  - `std.testing.expectEqual`: equality assertion.
  - `std.testing.expectError`: error assertion.
  - `std.testing.allocator`: testing allocator that detects leaks.
  - Custom test runners: check `build.zig` for `.setTestRunner()` or custom test filter configuration.
- **Build system**: `zig build test` via `build.zig`. Check for test steps and test filters in the build file.
- **Version-sensitive features**: Zig is pre-1.0 and the stdlib API changes between versions. Read the actual `@import("std")` usage in test files rather than assuming any specific API shape. Check `build.zig.zon` for the version and adapt recommendations accordingly.

## Test file conventions

- Tests are inline: `test "description" { ... }` blocks within the source file.
- Tests can also be in separate files imported in `build.zig` test steps.
- `std.testing` provides the assertion functions.
- `std.testing.allocator` is a `GeneralPurposeAllocator` configured to detect leaks; tests using this allocator get automatic leak detection on scope exit.

## Language-specific patterns

### Allocator testing
- Zig's explicit allocator pattern is uniquely testable. Check:
  - Tests use `std.testing.allocator` (leak-detecting allocator) instead of `std.heap.page_allocator` or other allocators.
  - Every allocation path is tested: success and `OutOfMemory` failure.
  - Tests verify that all allocated memory is freed by the end of the test (the testing allocator will report this).
  - Functions accepting `Allocator` are tested with `std.testing.FailingAllocator` to simulate allocation failure at every allocation site.

### Error handling
- Zig uses error unions (`!T`); check that tests cover:
  - The success path (unwrap with `try` or `catch`).
  - Each error in the error set (use `std.testing.expectError`).
  - Error propagation: if a function propagates errors from callees, test that each callee error is correctly propagated.
- `catch unreachable` in tests should only be used when the error provably cannot occur with the given inputs. Flag `catch unreachable` on operations that could fail with different inputs.

### Comptime and generic testing
- `comptime` functions should be tested at comptime: `comptime { ... }` blocks inside tests verify compile-time evaluation.
- Generic functions (using `anytype` or compile-time parameters) should be tested with multiple concrete types.
- Verify that compile errors for invalid types are tested using `@compileError` and `std.testing.expectError` on compile-time paths (where applicable).

### Optional values
- Functions returning `?T` should be tested for both `null` and non-null returns.
- Tests should not use `.?` (force unwrap) without first establishing that the value is non-null; this hides the assertion.
- `orelse unreachable` in tests is acceptable only when the test has already ensured the value is present.

### Slice and pointer safety
- Test slice operations at boundaries: empty slice (`&.{}`), single element, slice at capacity.
- Test functions that take pointers with alignment requirements.
- Test sentinel-terminated slices (`:0`) with and without the sentinel present in the underlying data.

### Async and I/O
- If the code uses async frames or I/O, check test coverage of:
  - Cancelled operations.
  - Partial reads/writes.
  - Timeout scenarios.
- Check whether tests use `std.io.testing` utilities (e.g., `FixedBufferStream`) for I/O testing without real file system access.

### Packed structs and bit manipulation
- Packed struct field access and modification should be tested at boundaries.
- Bit shift operations: test with shift amount of `0`, `1`, type width minus 1, and (where applicable) the full width.
- Test `@bitCast` operations with values at the extremes of both types.

### Build-time configuration
- Code using `@import("build_options")` or build-time configuration should have tests exercising each configuration variant.
- Verify `build.zig` defines test steps for relevant option combinations.
