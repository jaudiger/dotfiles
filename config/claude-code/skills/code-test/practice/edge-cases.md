# Edge Cases

Systematic identification of boundary and corner-case inputs that should be tested, derived from the function interface rather than the implementation.

## Scope

Missing tests for boundary values, degenerate inputs, type limits, encoding edge cases, and domain-specific corner cases.

## Checklist

1. **Enumerate input domains** — for each function parameter, determine its type and semantic domain. List the equivalence classes for that domain. Example: a `string` parameter representing a username has classes: empty, whitespace-only, single character, maximum length, contains special characters, contains unicode, contains null bytes.

2. **Boundary values** — for each numeric parameter or length-constrained input, check whether tests cover:
   - Zero, one, and the maximum valid value.
   - Just below and just above boundaries (off-by-one).
   - Negative values (if the type allows them).
   - Minimum and maximum values of the underlying type (`i32::MIN`, `Number.MAX_SAFE_INTEGER`, etc.).

3. **Empty and nil inputs** — verify tests exist for:
   - Empty strings, empty slices/arrays, empty maps.
   - Null / nil / None / undefined where the type permits it.
   - Optional fields absent vs. present.
   - Zero-value structs or default-constructed objects.

4. **Collection sizes** — verify tests for: empty collection, single element, two elements (smallest case exposing ordering issues), and a larger collection. For sorted/ordered operations, test already-sorted, reverse-sorted, and all-equal inputs.

5. **Unicode and encoding** — if the function processes text, check for: multi-byte characters, emoji, right-to-left text, combining characters, and normalization differences (NFC vs NFD). If it processes bytes, check for invalid UTF-8 sequences.

6. **Concurrency and timing** — if the function is called concurrently or accesses shared state, check for: simultaneous calls with the same input, interleaved operations, and calls during initialization or shutdown.

7. **Domain-specific corners** — reason about the business domain:
   - Dates: leap years, DST transitions, timezone boundaries, epoch, far-future dates.
   - Money: zero amounts, negative amounts, rounding (0.1 + 0.2), currency with different decimal places.
   - Paths: root path, relative path, path with `..`, symlinks, very long paths, paths with spaces.
   - Network: unreachable host, DNS failure, timeout, partial response, connection reset.

8. **Combinations** — if the function has multiple parameters, check whether tests cover interesting combinations of edge values across parameters (e.g., both arguments empty, one empty and one at boundary).

## Reporting

For each missing edge case, state:
- The function and parameter(s) involved.
- The equivalence class or boundary value that is untested.
- Why this gap matters — what bug class it could miss (off-by-one, nil dereference, panic, silent data corruption).
- A concrete test case: the input values and the expected behavior.
