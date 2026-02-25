---
name: deep-review
description: >
  Comprehensive read-only multi-dimensional code analysis. Orchestrates
  code-review, code-audit, code-security, and code-test with centralized
  context gathering. Input is source code targets (file, folder, symbol, or
  diff) -- NOT issue reports. For resolving bug reports and issues, use
  deep-resolve instead.
argument-hint: [targets...]
allowed-tools: Bash, Read, Grep, Glob, Task, WebFetch
---

# Deep Review

## Skills directory (resolved at load time)

```
!`ls -1d ~/.claude/skills/code-audit ~/.claude/skills/code-review ~/.claude/skills/code-security ~/.claude/skills/code-test 2>/dev/null`
```

Use these resolved paths when reading sub-skill files in Phase 5.
All `Read` calls for skill files MUST use the absolute paths listed above.

## Interactive mode (no arguments)

If the user did not provide any targets, print the usage guide below and wait
for their reply. Do NOT use the AskUserQuestion tool -- output the guide as
formatted text directly in the conversation.

### Usage

```
/deep-review [targets...]
```

### Target syntax

| Prefix | Format | Description |
|--------|--------|-------------|
| `file:` | `file:PATH` or `file:PATH#L1-L2` | Single file, optional line range |
| `folder:` | `folder:PATH` | All source files within the dir (recursive) |
| `symbol:` | `symbol:PATH:LINE` or `symbol:PATH:LINE#L1-L2` | Function/struct/class/method at LINE, optional focus range |
| `diff:` | `diff:local`, `diff:branch[:REF]`, `diff:pr:NUMBER_OR_URL`, `diff:commit:SHA` | Changes from a diff source |

Bare paths (no prefix) are treated as `file:PATH` for backward compatibility.

### Examples

```
/deep-review diff:local
/deep-review diff:branch:main
/deep-review diff:pr:42
/deep-review symbol:src/auth.rs:42
/deep-review file:src/auth.rs
/deep-review folder:src/handlers
/deep-review file:src/auth.rs symbol:src/db.rs:100
```

---

## Phase 1 -- Parse and validate input

### 1a -- Syntax validation

Classify each target by prefix and validate syntax:

- `file:PATH[#L1-L2]` -- validate PATH exists
- `folder:PATH` -- validate PATH is a directory
- `symbol:PATH:LINE[#L1-L2]` -- validate PATH exists and LINE is a positive integer
- `diff:SOURCE` -- validate source format (local, branch[:REF], pr:N/URL, commit:SHA)

**Constraint:** Do not allow mixing `diff:` targets with `file:`/`folder:`/`symbol:` targets in one invocation. If the user mixes them, report the error and ask them to separate into two invocations.

### 1b -- Semantic validation

- **Empty file check** -- for `file:` targets, verify the file is non-empty. If
  every `file:` target is empty, report "All target files are empty" and stop.
- **Folder source-file check** -- for `folder:` targets, defer validation until
  after Phase 2 language detection (the folder must contain files matching the
  detected language).
- **Symbol resolution confirmation** -- for `symbol:` targets, emit a
  confirmation of the resolved symbol (name, kind, location) after Phase 3
  symbol resolution completes.

## Phase 2 -- Detect language, framework, version

1. **Language** -- determine from file extensions in target paths or diff changeset:
   - `.rs` -> rust, `.go` -> go, `.ts`/`.tsx` -> ts, `.java` -> java, `.c`/`.h` -> c, `.zig` -> zig, `.py` -> python
2. **Framework and version** -- inspect project config files:
   - `Cargo.toml`, `package.json`, `go.mod`, `pom.xml`, `build.gradle`, `pyproject.toml`, `build.zig.zon`, `requirements.txt`, `tsconfig.json`, etc.
3. Record findings for inclusion in context passed to sub-skills.

**Deferred folder validation:** For any `folder:` targets from Phase 1b, verify
the folder contains source files matching the detected language. If not, report
"No <language> source files found in <folder>" and exclude that target.

## Phase 3 -- Gather context

Context depth varies by input type:

| Input type | Depth | What to gather |
|------------|-------|----------------|
| `symbol:` | DEEP | Full symbol definition + implementations of called methods + type definitions for params/returns + trait/interface definitions + related tests + up to 5 callers. Use Grep/Read, optionally Task(Explore) for complex call graphs |
| `file:` | SHALLOW | Read the file (or line range). Project config only |
| `folder:` | SHALLOW | Glob + read discovered files. Project config only |
| `diff:` | MODERATE | Resolve diff, read changed files in full. For each function containing changed lines: find implementations of called functions in changed lines, type definitions, test files |

### Diff resolution

| Source | Resolution |
|--------|------------|
| `diff:local` | `git diff HEAD` for tracked changes + `git ls-files --others --exclude-standard` for untracked |
| `diff:branch` | Detect default branch (`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \| sed 's@^refs/remotes/origin/@@'`, falling back to `main`), then `git diff <default>...HEAD` |
| `diff:branch:REF` | `git diff REF...HEAD` |
| `diff:pr:N` or `diff:pr:URL` | GitHub: `gh pr diff N`, GitLab: `glab mr diff N`. Parse owner/repo/number from URL if needed |
| `diff:commit:SHA` | `git show SHA --stat` for overview, then `git show SHA` for full diff. Read the commit message for intent context |

If the diff is empty, report "No changes found" and stop.

### Symbol context (DEEP)

For each `symbol:` target:
1. Read the file at PATH. Identify the innermost function, method, struct, class, enum, or trait definition containing LINE.
2. If LINE lands on blank/comment/import, scan up/down ~20 lines for nearest symbol; error if none found.
3. Nested symbols -> resolve to innermost enclosing.
4. Read the full symbol definition (signature to closing delimiter).
5. For each function/method called within the symbol: use Grep to find its definition, then Read it. Collect up to the first-level callees.
6. For parameter types and return types: find their definitions (struct/class/enum/trait/interface).
7. Find related tests: look for test files using project conventions, search for tests that reference the symbol name.
8. Find up to 5 callers of this symbol using Grep.
9. For complex call graphs, use Task(Explore) to assist.

## Phase 4 -- Select skills and concerns

### Skill selection

- **Always:** code-audit, code-security
- **`diff:` targets:** also code-review (invoked first)
- **Test files found OR source code that should have test coverage:** also code-test

### Concern auto-selection

Scan the gathered code for patterns and select ALL matching concerns (no artificial cap):

| Pattern observed | Skills + concerns |
|------------------|-------------------|
| `unsafe`, raw pointers, FFI | code-audit: `uaf`, `leaks`, `ub` |
| Mutex, RwLock, channels, goroutines, threads | code-audit: `races`, `deadlocks` |
| `.await`, async/spawn, futures, promises | code-audit: `async-bugs` |
| `unwrap`, `expect`, panic, try/catch, error returns | code-audit: `error-handling` |
| Allocations, collections, buffers growing from input | code-audit: `leaks`, `oom` |
| Integer arithmetic, casts, index operations | code-audit: `overflow` |
| Command execution, SQL, HTML, path construction | code-audit: `injection` |
| Object/resource lifecycle: open/close, init/deinit | code-audit: `lifecycle` |
| Type casts, any/interface{}, generics | code-audit: `type-safety` |
| Login, session, token, JWT, OAuth, password | code-security: `authn` |
| Permission, role, access control, policy | code-security: `authz` |
| Encrypt, decrypt, hash, sign, key, secret, HMAC | code-security: `crypto` |
| User input, parse, deserialize, request body, query params | code-security: `input-validation` |
| HTTP, TLS, CORS, headers, certificate | code-security: `transport` |
| Log, logger, print, debug, trace | code-security: `logging` |
| Config, env, settings, defaults, feature flags | code-security: `config` |
| Complex branching (if/else, match, switch) | code-test: `branch-coverage` |
| Functions with many parameter types/domains | code-test: `edge-cases` |
| Tests with weak assertions | code-test: `assertions`, `mutation-resistance` |
| Tests using global state, shared fixtures | code-test: `isolation` |
| Error handling paths in source | code-test: `negative-testing` |
| No clear pattern match | Safe defaults: code-audit `error-handling`+`lifecycle`, code-security `input-validation`+`config` |

Filter out concerns not available for the detected language (check each skill's
Available languages table).

## Phase 5 -- Invoke skills via Task agents

### 5a -- Task dispatch

Dispatch each skill as a **Task agent** (`subagent_type: general-purpose`). This
is necessary because skills with `context: fork` don't see conversation history,
so context must be injected explicitly. Task agents also allow parallel execution.

#### Preparing each Task prompt

For each skill invocation, use the absolute paths from the "Skills directory"
section above:

1. Read `<skill-path>/SKILL.md` (e.g., `~/.claude/skills/code-audit/SKILL.md`).
2. Read `<skill-path>/lang/$LANG.md` for the detected language (e.g., `~/.claude/skills/code-audit/lang/rust.md`).
3. Read `<skill-path>/methodology/$CONCERN.md`, `<skill-path>/domain/$DOMAIN.md`, or `<skill-path>/practice/$PRACTICE.md` for the selected concerns.
4. Construct a Task prompt (`subagent_type: general-purpose`) that includes all
   of the above plus the gathered context.

#### Context injection format

```
## Gathered Context

Target: `<symbol_name>` at <file>:<start_line>-<end_line>
Language: <language>
Framework: <framework> <version>

### Source
<file content or symbol definition>

### Called functions
- `<function_name>()` at <file>:<line> -- <return type summary>
  <function body>

### Type definitions
- `<type_name>` at <file>:<line>
  <type definition>

### Callers
- <caller_name> (<file>:<line>)

### Related tests
- <test_file>:<line> -- <test function name>
  <test body>

## Skill Instructions
[contents of SKILL.md]

## Language Patterns
[contents of lang/$LANG.md]

## Methodology
[contents of methodology/concern.md or domain/domain.md or practice/practice.md]

## Task
Analyze the following targets using the skill instructions and methodology above.
Use the gathered context to inform your analysis.
Targets: <target specification>
```

#### Invocation order

1. If `diff:` target: launch code-review Task agent **first**, wait for results.
2. Then launch remaining skills (code-audit, code-security, code-test) as
   **parallel Task agents** -- one Task per selected concern/domain/practice.
3. For multi-language changesets: invoke per-language with the appropriate files.
4. Wait for all Task agents to complete and collect results.

### 5b -- Pattern-scope analysis

After all Task agents complete, assess how widely each Critical and High finding
applies across the codebase:

1. For each Critical or High finding, extract the **code pattern** that
   constitutes the defect (e.g., a function call without error check, an unsafe
   cast, a missing validation).
2. Use **Grep** to search the full codebase for sibling occurrences of the same
   pattern.
3. **Classify** each match:
   - **Same defect** -- the match exhibits the identical problem.
   - **Similar but safe** -- the pattern appears but is handled correctly.
   - **False positive** -- syntactic match but semantically unrelated.
4. **Record scope** for each finding: count of "same defect" matches plus a
   `file:line` list of each occurrence.

## Phase 6 -- Synthesize report

Combine all skill results into a unified report:

```
# Deep Review Report

## Overview
- **Input:** <targets>
- **Languages:** <detected languages>
- **Framework:** <detected framework and version>
- **Skills invoked:** <list of skills and their concerns/domains/practices>

## Executive Summary
<2-3 sentences summarizing the overall state of the code>

## Critical and High Findings
<deduplicated findings from all skills, attributed to originating skill>
<For each finding, append scope annotation:>
<  Scope: Also found at N other locations (file1:line, file2:line, ...)>
<  -- or: Scope: Unique to reviewed code>

## Medium Findings
<deduplicated medium-severity findings>

## Low Findings and Nits
<deduplicated low-severity findings>

## Cross-Cutting Observations
<patterns that span multiple skills -- e.g., error handling issues found by both
code-audit and code-review, or security concerns that also affect test coverage>

## Systemic Patterns
<patterns from Phase 5b that appear across multiple locations in the codebase,
grouped by pattern type with total occurrence count and representative examples>

## Recommendations
### Must fix
<critical and high items, prioritized>

### Should fix
<medium items>

### Consider
<low items and suggestions>
```

### Deduplication

When the same file+line+issue appears across multiple skills, merge into a single finding. Prefer the more specific finding (CWE-attributed over generic, concrete bug class over general observation).

## Rules

- Read-only analysis. Do not modify any files.
- Do not skip context gathering -- the centralized context is the value over running individual skills separately.
- Let sub-skills run their full procedure. Do not truncate or summarize their instructions.
- If a skill finds no issues, note it in the report rather than omitting it.
- For large changesets (50+ files), warn the user and suggest narrowing scope.
- If a language is unsupported by a particular skill, skip that skill for those files and note it in the report.
