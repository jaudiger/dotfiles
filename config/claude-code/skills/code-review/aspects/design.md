# Design

Evaluate the structural quality and design decisions in the changeset.

## Checklist

### 1. Abstraction level

- Is the new code at the right level of abstraction for its location in the
  project?
- Are implementation details leaking across module boundaries?
- Is there premature abstraction; generalized code used in only one place?

### 2. Responsibility and cohesion

- Does each changed function, class, or module have a single clear
  responsibility?
- Are unrelated concerns mixed in the same change (e.g., business logic and
  presentation formatting)?
- Should any added code live in a different module based on existing project
  structure?

### 3. API design

- New public functions or methods: are names clear, parameter lists minimal,
  return types appropriate?
- Are new APIs consistent with existing conventions in the codebase?
- Can the API be misused easily? Are there obvious pit-of-failure patterns?

### 4. Duplication

- Does the change introduce code that duplicates existing functionality
  elsewhere in the codebase?
- If similar code exists, should a shared utility be extracted; or is the
  duplication acceptable at this stage?

### 5. Coupling

- Does the change introduce new dependencies between modules or packages?
- Are new imports reaching across architectural boundaries?
- Could the coupling be reduced without over-engineering?

### 6. Consistency

- Does the change follow existing patterns in the codebase (naming
  conventions, project structure, error handling style)?
- If it intentionally deviates, is the deviation justified?
- Are new files placed in the correct directory per project conventions?

### 7. Simplicity

- Could the same result be achieved with less code or a simpler approach?
- Are there unnecessary layers of indirection?
- Is the control flow easy to follow without extensive mental bookkeeping?
