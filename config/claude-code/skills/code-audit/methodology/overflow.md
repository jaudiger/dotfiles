# Integer Overflow/Underflow Detection Methodology

## Scope

Signed and unsigned integer overflow, underflow, truncation, and widening conversion bugs that lead to incorrect logic, buffer overflows, or undefined behavior.

## Systematic Procedure

### Step 1 — Inventory arithmetic on integers from external input

For every integer value derived from external input (network, file, user input, deserialization):

1. Record the type and bit width of the variable.
2. Trace every arithmetic operation performed on it (add, subtract, multiply, shift, negate).
3. Verify bounds checking or saturation before/after each operation.

### Step 2 — Check addition and multiplication overflow

For every `a + b`, `a * b`, or `a += b` on integer types:

1. Can the result exceed the maximum value of the type? Under what input?
2. Is the operation checked (returns error on overflow) or wrapping (silently wraps)?
3. If wrapping: does subsequent code assume the result is >= both operands?
4. Flag any use of the result as a buffer size, array index, or allocation size.

### Step 3 — Check subtraction underflow

For every `a - b` on unsigned integers:

1. Can b > a? Under what input?
2. If unsigned: the result wraps to a very large number. Flag if used as a size or index.
3. Check loop termination: `for (unsigned i = n; i >= 0; i--)` never terminates.

### Step 4 — Check narrowing conversions and casts

For every cast from a wider type to a narrower type (e.g., u64 to u32, i64 to i32, int to short):

1. Is the value range-checked before the cast?
2. Can truncation cause the cast value to be wildly different from the original?
3. Flag any unchecked cast of external input or computed values used for sizes, indices, or offsets.

### Step 5 — Check signed/unsigned conversion

For every conversion between signed and unsigned:

1. Can a negative signed value be interpreted as a large unsigned value?
2. Can a large unsigned value be interpreted as a negative signed value?
3. Flag comparisons between signed and unsigned (implicit promotion rules differ by language).

### Step 6 — Check shift operations

1. Shifting by >= bit width of the type is undefined behavior in C/C++ and produces zero or wraps in other languages. Verify the shift amount is bounds-checked.
2. Left shift of a signed negative value: undefined in C, varies in other languages.
3. Right shift of a signed negative: arithmetic vs logical shift varies by language/platform.

### Step 7 — Check size_t/usize/len calculations

1. Array length calculations: `end - start` when end < start.
2. Buffer size calculations: `header_size + payload_size` when payload_size is attacker-controlled.
3. Allocation size: `count * element_size` overflow leading to small allocation + large write.

## Reporting

For each finding, state:
- The arithmetic operation or cast (file, line).
- The input range that triggers overflow/underflow/truncation.
- The consequence (wrong buffer size, incorrect branch, UB, wrap-around).
- Suggested fix (use checked arithmetic, add bounds check, widen the type, use saturating ops).

If no issues are found, state: "No overflow issues found in [file]" and briefly explain why the code is correct for this concern.
