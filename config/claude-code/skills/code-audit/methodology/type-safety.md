# Type Safety Methodology

## Scope

Type assertions that hide runtime errors, non-null assertions on nullable values, type escape hatches (any, ts-ignore), unsafe type guards, and unvalidated external data.

## Systematic Procedure

### Step 1 — Audit type assertions (as casts)

For every `as` cast in the file:

1. Is the cast provably safe given the surrounding code?
2. Flag `as any` — this disables all type checking. What type is being escaped?
3. Flag double-cast `as unknown as T` — this bypasses type compatibility checks entirely. What incompatible types are being forced together?
4. For each cast, trace the value backward: what is its actual runtime type? Does it always match the asserted type?

### Step 2 — Audit non-null assertions (!)

For every `!` (non-null assertion operator):

1. Is the value guaranteed non-null at that exact point in the code?
2. Could upstream code change and make it nullable? (e.g., an API response field that was required but could become optional)
3. Is the assertion inside a code path that already null-checked? (If so, it is redundant but safe.)
4. Flag any `!` on values from external sources (API responses, user input, database queries).

### Step 3 — Audit suppression comments

For every `@ts-ignore` and `@ts-expect-error`:

1. What TypeScript error is being suppressed? (Check the line below the comment.)
2. Is the suppressed error a real type incompatibility or a false positive?
3. Could the code be restructured to eliminate the suppression?
4. Flag `@ts-ignore` specifically — it silently succeeds even when the error is fixed (unlike `@ts-expect-error`).

### Step 4 — Audit any usage

For every `any` in type annotations, parameters, return types, and generic constraints:

1. Trace what values flow through the `any`-typed path.
2. Could the `any` be narrowed to a specific type, `unknown`, or a generic?
3. Does code downstream of the `any` assume a specific shape without checking? (Runtime crash risk.)
4. Flag `any` in public API boundaries (exported functions, class methods) — it propagates unsafety to all callers.

### Step 5 — Audit type guards and narrowing

For every type guard (type predicates, instanceof, discriminated union checks):

1. Does the guard actually validate all fields of the narrowed type?
2. Can values pass the guard but violate the narrowed type at runtime?
3. For `instanceof` checks: does it work across realms/iframes/module boundaries?
4. For discriminated unions: is every variant handled (exhaustive check)?

### Step 6 — Audit external data boundaries

For every point where external data enters the application (JSON.parse, API responses, form data, URL params, database queries, file reads, environment variables):

1. Is the data validated at the boundary with a runtime validator (zod, io-ts, ajv, etc.)?
2. Or is it cast with `as MyType` without validation? Flag as critical — runtime type may differ.
3. For JSON.parse: the result is `any`. Is it immediately validated or cast?
4. For environment variables: `process.env.X` is `string | undefined`. Is the undefined case handled?

### Step 7 — Check structural typing pitfalls

1. Object.keys() / Object.entries() return `string`, not `keyof T`. Is a narrower key type assumed?
2. Index signatures (`[key: string]: T`) hide missing-key access — actual runtime type is `T | undefined`.
3. Numeric enums accept any number at runtime. Is enum input validated?
4. Excess property checks only apply to object literals — objects from variables can have extra properties.

## Reporting

For each finding, state:
- The type escape hatch (file, line, construct).
- The runtime type mismatch it could cause.
- A concrete input or scenario that triggers a runtime error.
- Suggested fix (add runtime validation, narrow the type, use unknown, remove assertion).

If no issues are found, state: "No type safety issues found in [file]" and briefly explain why the code is correct for this concern.
