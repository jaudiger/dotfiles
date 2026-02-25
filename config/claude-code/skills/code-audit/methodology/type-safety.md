# Type Safety Methodology

## Scope

Type assertions that hide runtime errors, nullability escape hatches, type-check suppression, type erasure and untyped escapes, incomplete type narrowing, unvalidated external data, and structural/nominal typing pitfalls.

## Systematic Procedure

### Step 1 -- Audit explicit type casts/assertions

For every explicit type cast or assertion in the file:

1. Is the cast provably safe given the surrounding code?
2. Trace the value backward: what is its actual runtime type? Does it always match the asserted type?
3. Language-specific constructs:
   - **TypeScript:** `as` casts, `as any`, double-cast `as unknown as T`
   - **Go:** type assertions `x.(T)` -- does the code use the comma-ok form `v, ok := x.(T)` or the panicking form `v := x.(T)`?
   - **Java:** unchecked casts `(List<String>) rawList` -- is the cast verified at runtime or deferred to element access?
   - **Rust:** `as` numeric casts (truncating and silent, e.g., `u64 as u32`). Prefer `try_into()`. `unsafe { std::mem::transmute }` -- verify source and target have identical size and valid bit representations for all possible values
   - **Python:** `typing.cast()` -- no runtime effect, purely a hint. Does the actual value match the declared type?

### Step 2 -- Audit nullability escape hatches

For every nullability bypass:

1. Is the value guaranteed non-null/non-nil/non-None at that exact point in the code?
2. Could upstream code change and make it nullable?
3. Flag any bypass on values from external sources (API responses, user input, database queries).
4. Language-specific constructs:
   - **TypeScript:** `!` non-null assertion operator
   - **Go:** nil interface comparisons -- `var x error; var p *MyError; x = p; x != nil` is true even though `p` is nil
   - **Java:** `Optional.get()` without `isPresent()` -- throws `NoSuchElementException`
   - **Rust:** `.unwrap()` on `Option`/`Result` (cross-reference error-handling concern)
   - **Python:** `# type: ignore` on nullable warnings

### Step 3 -- Audit type-check suppression

For every suppression comment or annotation:

1. What type error is being suppressed? Check the line it applies to.
2. Is the suppressed error a real type incompatibility or a false positive?
3. Could the code be restructured to eliminate the suppression?
4. Language-specific constructs:
   - **TypeScript:** `@ts-ignore` (silently succeeds even when the error is fixed -- prefer `@ts-expect-error`), `@ts-expect-error`
   - **Go:** `//nolint` directives on type-related lints
   - **Java:** `@SuppressWarnings("unchecked")` -- what cast is suppressed? Is it actually safe?
   - **Rust:** `#[allow(clippy::unnecessary_cast)]` and similar lint suppression -- what cast is being hidden?
   - **Python:** `# type: ignore` comments -- what mypy/pyright error is suppressed? Is it a real type bug?

### Step 4 -- Audit type erasure and untyped escapes

For every use of an untyped or erased type:

1. Trace what values flow through the untyped path.
2. Could the type be narrowed to a specific type?
3. Does code downstream assume a specific shape without checking? (Runtime crash risk.)
4. Language-specific constructs:
   - **TypeScript:** `any` in annotations, parameters, return types, generic constraints. Flag in public API boundaries -- propagates unsafety to all callers
   - **Go:** `interface{}`/`any` -- trace what concrete types are used and whether all are handled
   - **Java:** raw types (`List` instead of `List<String>`) -- loses compile-time type checking, heap pollution. Generics erasure: `instanceof` cannot check parameterized types at runtime
   - **Rust:** `dyn Any` -- downcasting via `Any::downcast_ref` may fail
   - **Python:** `Any` from `typing` -- trace what flows through. Can it be narrowed to a specific type or `object`?

### Step 5 -- Audit type narrowing and discriminators

For every type narrowing operation:

1. Does the narrowing actually validate all fields/properties of the target type?
2. Are all variants/branches handled (exhaustive check)?
3. Can values pass the check but violate the narrowed type at runtime?
4. Language-specific constructs:
   - **TypeScript:** type predicates (`x is Foo`), `instanceof` checks (cross-realm issues), discriminated unions
   - **Go:** type switches without `default` -- missing variant silently does nothing
   - **Java:** `instanceof` chains -- are all subtypes handled? `Class.cast()` and `Class.isInstance()` -- verify the Class token matches the expected type
   - **Rust:** pattern matching -- `#[non_exhaustive]` types may gain new variants
   - **Python:** `isinstance` checks -- does the check cover all possible types? Union types with missing branches

### Step 6 -- Audit external data boundaries

For every point where external data enters the application (API responses, JSON parsing, form data, URL params, database queries, file reads, environment variables, deserialization):

1. Is the data validated at the boundary with a runtime validator?
2. Or is it cast/asserted without validation? Flag as critical -- runtime type may differ.
3. Language-specific constructs:
   - **TypeScript:** `JSON.parse()` returns `any`. Cast with `as MyType` without validation (zod, io-ts, ajv) is a crash risk. `process.env.X` is `string | undefined`
   - **Go:** `json.Unmarshal` into `interface{}` -- result is untyped. Verify concrete type checks after unmarshal
   - **Java:** Jackson/Gson deserialization -- verify target type matches actual JSON structure. `@JsonIgnoreProperties(ignoreUnknown = true)` can mask missing fields
   - **Rust:** `serde` with `serde_json::Value` -- untyped. Verify conversion to concrete types is checked
   - **Python:** `json.loads()` returns `Any` -- must be validated before use (pydantic, marshmallow, cattrs). `pickle.loads` reconstructs arbitrary objects: type of deserialized object is not guaranteed

### Step 7 -- Audit structural/nominal typing pitfalls

Check for language-specific type system traps:

- **TypeScript:** excess property checks only apply to object literals -- objects from variables can have extra properties. `Object.keys()` returns `string[]`, not `(keyof T)[]`. Index signatures `[key: string]: T` hide missing-key access. Numeric enums accept any number at runtime
- **Go:** struct embedding shadows -- an embedded struct's method may be unintentionally promoted, hiding the outer struct's intent. Nil interface vs nil concrete value pitfall. `unsafe.Pointer` conversions: pointer may be moved by GC between `unsafe.Pointer` to `uintptr` and back. Generic `any` constraint allows types that may not support the intended operations
- **Java:** covariant arrays: `String[] arr = ...; Object[] obj = arr; obj[0] = 42;` -- `ArrayStoreException` at runtime. Generics erasure prevents runtime type checks on parameterized types
- **Rust:** trait object safety -- not all traits can be used as `dyn Trait`. `PhantomData` misuse: wrong variance/drop semantics. `std::any::TypeId` comparisons: fragile across crate versions if types are re-exported
- **Python:** duck typing surprises -- structural compatibility does not guarantee semantic compatibility. `getattr`/`hasattr` bypassing the type system: attribute existence not guaranteed. `dict` access with `[]` vs `.get()`: `KeyError` vs `None` -- type differs

## Reporting

For each finding, state:
- The type escape hatch (file, line, construct).
- The runtime type mismatch it could cause.
- A concrete input or scenario that triggers a runtime error.
- Suggested fix (add runtime validation, narrow the type, use unknown, remove assertion).

If no issues are found, state: "No type safety issues found in [file]" and briefly explain why the code is correct for this concern.
