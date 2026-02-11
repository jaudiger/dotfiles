# C — Testing Patterns

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Version and framework detection

- **Language version**: read `CMakeLists.txt` (`CMAKE_C_STANDARD`, `set(CMAKE_C_STANDARD xx)`), `Makefile` (look for `-std=cxx` flags), or `compile_commands.json`.
- **Test framework**: C has no built-in test framework. Check build files and includes for:
  - Google Test / Google Mock (`gtest`, `gmock`) — C++ test framework often used for C code via `extern "C"`.
  - CMocka (`cmocka.h`) — pure C mocking and testing.
  - Unity (`unity.h`) — lightweight embedded-friendly test framework.
  - Check (`check.h`) — C unit testing framework with fork-based isolation.
  - CUnit (`CUnit.h`) — classic C unit testing.
  - Criterion (`criterion/criterion.h`) — modern C/C++ testing.
  - µnit (`munit.h`) — minimal unit testing.
  - Custom `assert`-based test harness — look for `main()` functions in test files using `assert()`.
- **Build system**: identify whether tests are compiled and run via `cmake`, `make test`, `ctest`, `meson test`, or custom scripts.
- **Sanitizers**: check for `-fsanitize=address,undefined,leak` in compiler flags — these augment test effectiveness.

## Test file conventions

- No standard convention — varies by project and framework.
- Common: `test_*.c`, `*_test.c`, files in `test/` or `tests/` directory.
- With Google Test: `*_test.cc` or `*_test.cpp` wrapping C headers.
- Test discovery depends on the framework (Google Test auto-registers, Unity/CMocka require manual listing).

## Language-specific patterns

### Memory safety testing
- Tests for functions that allocate memory should verify:
  - The returned pointer is non-NULL (allocation success).
  - The allocated memory is correctly freed (pair every alloc test with a free path test).
  - Double-free does not occur in error paths.
- Consider whether tests should be run under AddressSanitizer (ASan) and whether the CI does this.
- Tests for buffer operations should include inputs at, above, and below buffer capacity.

### Null pointer handling
- Every function that receives a pointer parameter should have a test passing `NULL`.
- Verify the function either handles `NULL` gracefully (returns error code) or documents that `NULL` is undefined behavior and the test verifies the precondition check (assert/abort).
- Output parameters: test with `NULL` output pointer if the API should handle it.

### Return code testing
- C functions typically signal errors via return codes. Every possible return value should be tested:
  - Success (usually 0 or positive).
  - Each documented error code.
  - `errno` value after failure (verify it is set correctly and not stale).
- Check that tests do not ignore return values — a common C testing gap.

### Integer types and overflow
- Test boundary values for each integer type used: `0`, `1`, `-1`, `INT_MAX`, `INT_MIN`, `UINT_MAX`, `SIZE_MAX`.
- For `size_t` parameters (sizes, lengths, counts): test `0`, `1`, and a value that would cause overflow when multiplied or added.
- Signed/unsigned conversion: test values that are positive in signed but large in unsigned representation.

### String handling
- Test with: empty string (`""`), single character, string without null terminator (buffer overread), maximum expected length, embedded null bytes.
- For functions using `strncpy`, `snprintf`, etc.: test truncation (input longer than buffer) and verify null termination.
- For `strtol`/`strtod` family: test invalid input, overflow, and leading/trailing whitespace.

### Struct initialization
- Test functions that initialize structs with partial initialization (some fields set, others left as-is).
- Verify tests pass zero-initialized structs (`memset(&s, 0, sizeof(s))`) and garbage-filled structs to detect use of uninitialized fields.

### Signal and error handling
- Functions that install signal handlers or use `setjmp`/`longjmp` need tests that trigger the signal/jump.
- Functions using `atexit()` registered handlers: verify the test exercises the cleanup path.

### Platform-specific code
- Code behind `#ifdef` guards (platform, architecture, feature) should have tests for each active variant.
- Verify the CI test matrix covers the `#ifdef` branches that the project supports.

### File and resource handling
- Test with: non-existent files, read-only files, files with no permissions, empty files, very large files.
- Verify file descriptors and `FILE*` handles are closed in all paths, including error paths.
- Test `open`/`close`, `fopen`/`fclose` pairing in both success and failure branches.
