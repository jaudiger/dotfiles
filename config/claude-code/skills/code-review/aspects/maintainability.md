# Maintainability

Evaluate whether the changeset is easy to understand, modify, and maintain.

## Checklist

### 1. Readability

- Is the control flow easy to follow? Can a reader understand the intent
  without deep surrounding context?
- Are complex expressions broken into named intermediate values?
- Is nesting depth reasonable (three levels or fewer is typical)?

### 2. Naming

- Do new variables, functions, types, and files have clear, descriptive names?
- Are names consistent with existing conventions in the codebase?
- Are abbreviations obvious, or do they require domain-specific knowledge to
  parse?

### 3. Dead code

- Does the change introduce unreachable code, unused imports, or unused
  variables?
- Are there commented-out blocks of code that should be removed?
- Are there feature flags or conditional paths that are always true or always
  false?

### 4. Documentation

- Is non-obvious logic accompanied by a comment explaining **why**, not
  restating **what**?
- Are public API changes reflected in existing documentation if any exists?
- Are magic numbers or strings explained or extracted into named constants?

### 5. Consistency

- Does the change follow the existing code style (formatting, naming
  conventions, structural patterns)?
- If it introduces a new pattern, is the deviation justified by a clear
  benefit?
- Are similar operations done the same way throughout the change?

### 6. Future maintenance risk

- Are there hardcoded values that will need updating (URLs, version strings,
  size limits)?
- Are there implicit assumptions that could break if the surrounding code
  changes?
- Is the change self-contained, or does it create obligations for follow-up
  changes?
