# Undefined Behavior Detection Methodology

## Scope

Operations whose behavior is not defined by the language specification, leading to unpredictable results, silent corruption, or security vulnerabilities. Applies primarily to Zig, C, and Rust (unsafe blocks).

## Systematic Procedure

### Step 1: Audit pointer and memory operations

For every raw pointer dereference, cast, or arithmetic:

1. Is the pointer provably non-null before dereference?
2. Is the pointer provably aligned for its target type?
3. Does the pointer point to a valid, live allocation of sufficient size?
4. Pointer arithmetic: can it go out of bounds (before start or past one-past-end)?
5. Type punning through pointer cast: does it violate aliasing rules?

### Step 2: Audit integer operations

1. Signed integer overflow: undefined in C, wrapping/checked in Zig (mode-dependent), panic in Rust debug builds.
2. Division by zero: undefined in C, safety-checked in Zig and Rust.
3. Shift by negative or >= bit width: undefined in C, safety-checked in Zig.
4. Negation of INT_MIN for signed types.

### Step 3: Audit array and slice access

1. Every index operation: is the index provably within bounds?
2. Slice creation from pointer + length: is the length correct? Does the pointer + length stay within the allocation?
3. Off-by-one: `<=` vs `<` in loop bounds and slice ranges.
4. Zero-length allocations: some operations on zero-length slices have special rules.

### Step 4: Audit aliasing and mutability rules

1. Two mutable pointers/references to the same memory at the same time (Rust: violates borrow rules, only possible in unsafe).
2. Mutable access through a const/immutable pointer (C: casting away const, Zig: @constCast).
3. Strict aliasing violations in C: accessing an object through a pointer of incompatible type (except char*).
4. Zig: @ptrCast between types with different alignment or size requirements.

### Step 5: Audit uninitialized memory

1. Reading from uninitialized memory: undefined in C, safety-checked in Zig (@as with undefined), MaybeUninit in Rust.
2. Partially initialized structs: is every field written before the struct is read?
3. Uninitialized padding bytes: passing structs with padding to memcmp, write(), or hash functions.

### Step 6: Audit language-specific UB patterns

**Zig-specific:**
- `@intCast` with out-of-range value (safety-checked in safe builds, UB in ReleaseFast).
- `@ptrCast` aliasing violations.
- `@truncate` of sentinel-terminated slices losing the sentinel.
- Reaching `unreachable` (UB in ReleaseFast, panic in Debug/ReleaseSafe).
- Returning from a function with `noreturn` return type.

**C-specific:**
- Sequence point violations (modifying a variable twice between sequence points).
- Signed integer overflow in any arithmetic.
- Accessing a union member other than the last one written (type punning via union).
- Modifying a string literal.
- Use of indeterminate values (uninitialized automatic variables).
- Violating restrict qualifier contracts.
- va_arg with wrong type.

**Rust-specific (unsafe blocks only):**
- Creating invalid references (null, dangling, unaligned).
- Breaking the aliasing rules (&T and &mut T to same data simultaneously).
- Calling functions with wrong ABI or invalid arguments.
- Producing invalid enum discriminant values.
- Unwinding across FFI boundaries (pre-Rust 1.71 UB, later defined to abort).
- Transmute to a type with stricter validity requirements.

### Step 7: Audit compiler optimization assumptions

1. Code relying on specific memory layout not guaranteed by the language (add repr/packed/aligned attributes).
2. Code relying on wrapping behavior in C (use -fwrapv or unsigned types explicitly).
3. Code relying on evaluation order not guaranteed by the language.

## Reporting

For each finding, state:
- The UB-triggering operation (file, line).
- The specific UB rule violated (cite the language spec category).
- The input or condition that triggers it.
- Observable consequences (silent corruption, wrong codegen, security hole).
- Suggested fix.

If no issues are found, state: "No undefined behavior issues found in [file]" and briefly explain why the code is correct for this concern.
