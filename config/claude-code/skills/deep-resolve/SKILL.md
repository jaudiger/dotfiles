---
name: deep-resolve
description: >
  Resolve bug reports and issues by deeply understanding the codebase before
  making changes. Reworks code at the root cause rather than applying
  incremental patches. Input is an issue source (GitHub/GitLab issue URL or
  shorthand, or a file containing a report) — NOT source code targets. For
  read-only code analysis, use deep-review instead.
argument-hint: <source...>
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Task, WebFetch
---

# Deep Resolve

## Skills directory (resolved at load time)

```
!`ls -1d ~/.claude/skills/code-audit ~/.claude/skills/code-review ~/.claude/skills/code-security ~/.claude/skills/code-test 2>/dev/null`
```

Use these resolved paths when reading sub-skill files in Phase 5.
All `Read` calls for skill files MUST use the absolute paths listed above.

## Interactive mode (no arguments)

If the user did not provide any source, print the usage guide below and wait
for their reply. Do NOT use the AskUserQuestion tool — output the guide as
formatted text directly in the conversation.

### Usage

```
/deep-resolve <source...>
```

### Source syntax

| Format | Description |
|--------|-------------|
| `gh:OWNER/REPO#NUMBER` | GitHub issue (fetched via `gh issue view`) |
| `gl:PROJECT#NUMBER` | GitLab issue (fetched via `glab issue view`) |
| `https://github.com/...` | GitHub issue or PR URL (auto-detected) |
| `https://gitlab.com/...` | GitLab issue or MR URL (auto-detected) |
| `file:PATH` | Local file containing the report |
| *(bare text)* | Inline report pasted directly as arguments |

Multiple sources can be combined to provide additional context.

### Examples

```
/deep-resolve gh:owner/repo#42
/deep-resolve https://github.com/owner/repo/issues/42
/deep-resolve file:reports/crash-analysis.md
/deep-resolve gl:group/project#15
/deep-resolve The parser fails on nested brackets when input contains unicode
```

---

## Phase 1 — Ingest report

Fetch and normalize the report from whatever source was provided:

| Source type | Resolution |
|-------------|------------|
| `gh:OWNER/REPO#N` | `gh issue view N --repo OWNER/REPO --json title,body,comments,labels` |
| `gl:PROJECT#N` | `glab issue view N --repo PROJECT` |
| GitHub URL | Parse owner/repo/number, then `gh issue view` or `gh pr view` as appropriate |
| GitLab URL | Parse project/number, then `glab issue view` or `glab mr view` |
| `file:PATH` | Read the file |
| Bare text | Use the text directly |

Extract from the report:
1. **Problem statement** — what is broken or missing
2. **Reproduction steps** — if provided
3. **Error output** — stack traces, logs, error messages
4. **Affected areas** — file paths, function names, modules, endpoints mentioned
5. **Labels/tags** — issue labels that hint at category (bug, security, performance, etc.)

## Phase 2 — Validate report

### 2a — Assess relevance

Before exploring the codebase, determine whether the report is actionable:

1. Does the report describe a concrete problem or a vague complaint?
2. Can the affected area be located in *this* repository?
3. Is the report about this project or was it misfiled?

If the report is **not relevant** to the current repository:
- State why it does not apply
- Stop here — do not explore or modify anything

If the report is **ambiguous**:
- List what is unclear
- Ask the user for clarification before proceeding

If the report is **relevant**: proceed to 2b.

### 2b — Factual verification

Cross-reference every concrete claim in the report against the actual codebase.
This is a lightweight, read-only check — do NOT run the code.

1. **Paths and symbols** — Do the files, modules, functions, types, or endpoints
   mentioned in the report actually exist? Use Glob and Grep to verify.
2. **Code structure** — Does the code at the referenced locations match what the
   report describes (e.g., function signatures, control flow, data types)?
   Read the relevant source to confirm.
3. **Described behavior** — Does the code logic support the behavior the report
   claims? Trace the relevant code paths by reading to see whether the described
   scenario is plausible given the current source.
4. **Versions and dependencies** — If the report references specific library
   versions, APIs, or features, confirm they match what the project actually uses.

For each claim, record one of:
- **Confirmed** — the codebase matches the report's claim.
- **Incorrect** — the codebase contradicts the claim (note what actually exists).
- **Unverifiable** — the claim cannot be confirmed or denied from source alone.

**Outcome:**
- If critical claims are **incorrect** (e.g., the described function does not
  exist, the code path works differently than stated): inform the user with
  specifics, ask whether to proceed or stop.
- If most claims are **unverifiable** but none are contradicted: note the
  uncertainty and proceed with caution to Phase 3.
- If claims are **confirmed**: proceed to Phase 3.

## Phase 3 — Deep codebase exploration

This is a critical phase. Do NOT skip or abbreviate it.

### 3a — Detect language, framework, version

1. **Language** — determine from file extensions in affected paths and source
   files discovered during exploration:
   - `.rs` → rust, `.go` → go, `.ts`/`.tsx` → ts, `.java` → java, `.c`/`.h` → c, `.zig` → zig, `.py` → python
2. **Framework and version** — inspect project config files:
   - `Cargo.toml`, `package.json`, `go.mod`, `pom.xml`, `build.gradle`, `pyproject.toml`, `build.zig.zon`, `requirements.txt`, `tsconfig.json`, etc.
3. Record findings — these are needed in Phase 5 to load the correct
   `lang/$LANG.md` files for sub-skills.

### 3b — Map the architecture

Before touching any code, build a mental model of the codebase:

1. **Project structure** — read the top-level directory layout, build system
   files, and module organization.
2. **Entry points** — identify how the application starts, how requests flow,
   where the public API surface is.
3. **Module boundaries** — understand which modules own which responsibilities
   and how they communicate (imports, trait implementations, interfaces, event
   buses, etc.).

### 3c — Trace the affected area

Using the problem statement and any file/function hints from the report:

1. **Locate the symptom** — find the exact code location where the reported
   behavior manifests (the crash site, the wrong output, the missing handling).
2. **Trace upstream** — follow the data/control flow backward from the symptom
   toward the origin of the data or decision that causes the defect.
3. **Read related modules** — read adjacent modules, shared utilities, type
   definitions, and configuration that interact with the affected area.
4. **Read tests** — find and read existing tests for the affected area. Note
   what is covered and what is not.

## Phase 4 — Root cause & impact

### 4a — Root cause identification

With the full exploration context from Phase 3, determine:

1. **What is actually wrong** — the defect, not just the symptom.
2. **Why it exists** — what design assumption or oversight led to this state.
3. **What the correct design should be** — how this area should work given the
   overall architecture, not just how to suppress the symptom.

### 4b — Impact analysis

Consolidate the full blast radius of the defect and the planned fix:

1. **Downstream consumers** — identify all callers and consumers of the affected
   code. Trace how the defect propagates through each consumer.
2. **Sibling patterns** — use Grep to find other code locations that use the
   same flawed pattern. Record each match with file path and line number.
3. **Related fragile code** — identify adjacent code that shares assumptions
   with the defect (e.g., relies on the same invalid invariant).
4. **Test gap assessment** — cross-reference the affected code paths against
   existing test coverage. Record which paths have tests, which lack coverage,
   and which tests are likely to break from the fix.

## Phase 5 — Selective analysis via sub-skills

Based on the root cause identified in Phase 4, invoke relevant sub-skills for
deeper targeted analysis. This is optional — only invoke sub-skills when their
specialized methodology adds value beyond what Phases 3–4 already uncovered.

### Skill selection criteria

| Issue signals | Sub-skill |
|---------------|-----------|
| Crash, panic, undefined behavior, data corruption | code-audit |
| Vulnerability, CVE, auth bypass, injection, data leak | code-security |
| Test failure, missing coverage, flaky test | code-test |
| Design flaw visible in a diff or changeset | code-review |

### Concern auto-selection

Scan the affected code for patterns and select ALL matching concerns:

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

### Preparing each Task prompt

For each skill invocation, use the absolute paths from the "Skills directory"
section above:

1. Read `<skill-path>/SKILL.md` (e.g., `~/.claude/skills/code-audit/SKILL.md`).
2. Read `<skill-path>/lang/$LANG.md` for the detected language (e.g., `~/.claude/skills/code-audit/lang/rust.md`).
3. Read `<skill-path>/methodology/$CONCERN.md`, `<skill-path>/domain/$DOMAIN.md`, or `<skill-path>/practice/$PRACTICE.md` for the selected concerns.
4. Construct a Task prompt (`subagent_type: general-purpose`) that includes all
   of the above plus the gathered context.

### Context injection format

```
## Gathered Context

Target: `<symbol_or_file>` at <file>:<start_line>-<end_line>
Language: <language>
Framework: <framework> <version>

### Root cause analysis
<Summary of the root cause identified in Phase 4>

### Source
<affected file content or symbol definitions>

### Called functions
- `<function_name>()` at <file>:<line> — <return type summary>
  <function body>

### Type definitions
- `<type_name>` at <file>:<line>
  <type definition>

### Callers
- <caller_name> (<file>:<line>)

### Related tests
- <test_file>:<line> — <test function name>
  <test body>

## Skill Instructions
[contents of SKILL.md]

## Language Patterns
[contents of lang/$LANG.md]

## Methodology
[contents of methodology/concern.md or domain/domain.md or practice/practice.md]

## Task
Analyze the following code regions using the skill instructions and methodology
above. Use the gathered context to inform your analysis. Focus on findings
relevant to the root cause described above.
Targets: <affected code regions>
```

### Invocation order

1. Launch all selected sub-skill Task agents in **parallel** — one Task per
   selected concern/domain/practice.
2. For multi-language codebases: invoke per-language with the appropriate files
   and the matching `lang/$LANG.md`.
3. Wait for all Task agents to complete and collect results.

## Phase 6 — Resolve

Incorporate findings from Phase 5 sub-skills (if invoked) into the root cause
analysis from Phase 4. Sub-skill findings may reveal additional defect instances,
deeper security implications, or test gaps not visible during manual exploration.

Apply changes that fix the root cause and prevent recurrence. This is where the
skill diverges from analysis-only tools — it modifies the codebase.

### Resolution principles

1. **Consolidate then extend tests.** Before adding new tests, consolidate
   existing tests for the affected area — remove redundant cases, merge
   overlapping tests, and simplify shared setup where possible. Then ensure
   the test suite includes:
   - Reproduction of the original failure (regression test)
   - Coverage of the new behavior
   - Edge cases discovered during exploration
   - Test gaps identified in Phase 4b impact analysis

2. **Update documentation if behavior changes.** If the fix changes public API
   behavior, update relevant documentation.

3. **Clean up and leave no debt.** If reworking a module leaves dead code,
   unused imports, or orphaned helpers — remove them completely. Do not leave
   TODO comments, feature flags for old behavior, or backwards-compatibility
   shims. No `// removed` comments or renamed `_unused` variables.

### Comment rules

- Comments in the code describe **what the code does**.
- Never write comments explaining why a fix was made — the commit history and
  the original report capture that context.
- Do not add `// Fix for #42` or `// Resolved issue: ...` style annotations.
- If existing comments become stale due to the rework, update or remove them.

### Change strategy

1. **Plan the changes** — before editing, list every file that needs to change
   and what the change will be. Verify that the changes are consistent with
   each other and with the overall architecture.
2. **Apply changes** — edit files using the smallest set of precise
   modifications that achieve the goal. Prefer targeted edits over full file
   rewrites unless a full rewrite is genuinely cleaner.
3. **Verify consistency** — after applying all changes, re-read the modified
   files to confirm correctness. Check that imports, type signatures, and
   cross-module references are consistent.
4. **Run checks** — if the project has a build command, linter, or test suite,
   run them. Fix any failures introduced by the changes.

## Phase 7 — Summary

After all changes are applied and verified, output a summary:

```
# Resolution Summary

## Problem
<1-2 sentence description of the reported issue>

## Root Cause
<What was actually wrong and why, traced to the architectural level>

## Changes Made

### Reworked
- `path/to/file.rs` — <what was reworked and the new design>

### Fixed
- `path/to/file.rs:42` — <what was fixed>

### Added
- `path/to/new_test.rs` — <what test coverage was added>

### Removed
- `path/to/dead_code.rs` — <what was cleaned up and why it was dead>

## Remaining Risks
<Any areas that could not be fully addressed, or related fragility
that warrants future attention. "None" if the fix is complete.>
```

## Rules

- **Explore before acting.** Never propose or apply changes to code you have not
  read and understood in context. Phase 3 is not optional.
- **Break callers if needed.** The goal is the best possible codebase. Do not
  compromise the fix to avoid breaking callers — fix the callers too.
- **No hallucinated fixes.** If the root cause cannot be determined with
  confidence, say so and ask for more information rather than guessing.
- **Comments describe what, not why.** The report and commit history are the
  "why". Code comments explain "what" for future readers.
