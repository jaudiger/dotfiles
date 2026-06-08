---
name: code-audit
description: Audit source files for bugs and defects using static analysis.
---

# Code Audit

## Interactive mode (no arguments or partial arguments)

If the user did not provide all three pieces of information (language, concern, targets), print a single prompt that lists every missing piece and ask the user to reply with their choices. For prompts with at most 3 short enumerated options, ask the user to select from options; for open-ended choice lists (languages, targets), output the choices as formatted text directly in the conversation.

For each missing piece, print a numbered section:

1. **Language** (if `$0` is missing or invalid); list all languages from the table below with their available concerns.
2. **Concern** (if `$1` is missing or invalid); list every valid concern for the chosen/given language.
3. **Targets** (if no targets were provided); explain the target syntax (see below) and use Glob to discover candidate source files matching the chosen language in the current workspace. List them as suggested `file:` targets. If there are too many candidates, ask for a glob pattern instead.

Present everything in one message so the user can answer all at once (e.g., "rust, leaks, file:src/main.rs file:src/lib.rs"). Wait for their reply, then proceed to the audit steps below.

## Target syntax

All targets use a prefix to indicate the type of input:

| Prefix | Format | Description |
| --- | --- | --- |
| `file:` | `file:PATH` or `file:PATH#L1-L2` | Single file, optional line range |
| `folder:` | `folder:PATH` | All source files within the dir (recursive) |
| `symbol:` | `symbol:PATH:LINE` or `symbol:PATH:LINE#L1-L2` | Function/struct/class/method at LINE, optional focus range |
| `diff:` | `diff:local`, `diff:branch[:REF]`, `diff:pr:NUMBER_OR_URL`, `diff:commit:SHA` | Changes from a diff source |

Bare paths (no prefix) are shorthand for `file:PATH`.

### Resolution rules

**`file:PATH[#L1-L2]`**: Read the file. If `#L1-L2` is present, analyze only that line range but read enough surrounding context (imports, type definitions) to understand it.

**`folder:PATH`**: Glob for files matching the language's typical extensions within PATH. Treat each discovered file as a `file:` target.

**`symbol:PATH:LINE[#L1-L2]`**: Read the file at PATH. Identify the innermost function, method, struct, class, enum, or trait definition containing LINE. Analyze that symbol boundary (from signature to closing delimiter). If `#L1-L2` is appended, focus on that range within the symbol. When invoked standalone (not by deep-review), do not chase callers/implementations outside the file. When run under deep-review, callers, callees, and type definitions will already be supplied in the `## Gathered Context` section of the prompt, so rely on those rather than re-gathering.

**`diff:SOURCE`**: Resolve the diff:

| Source | Resolution |
| --- | --- |
| `diff:local` | `git diff HEAD` for tracked changes + `git ls-files --others --exclude-standard` for untracked |
| `diff:branch` | Detect default branch (`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \| sed 's@^refs/remotes/origin/@@'`, falling back to `main`), then `git diff <default>...HEAD` |
| `diff:branch:REF` | `git diff REF...HEAD` |
| `diff:pr:N` or `diff:pr:URL` | GitHub: `gh pr diff N`, GitLab: `glab mr diff N`. Parse owner/repo/number from URL if needed |
| `diff:commit:SHA` | `git show SHA --stat` for overview, then `git show SHA` for full diff. Read the commit message for intent context |

After resolving the diff, extract changed files and changed line regions (hunks). Apply analysis to the changed code regions (reading full context around hunks).

### Edge cases

- `symbol:` LINE on blank/comment/import to scan up/down ~20 lines for nearest symbol; error if none found.
- Nested symbols (closures, inner functions) to resolve to innermost enclosing.
- `#L1-L2` where L2 > file length to clamp to file length; L1 > file length to error.
- `folder:` with no matching files to report "No source files found."
- Empty diff to report "No changes found" and stop.

## Audit steps

- **Language:** $0
- **Concern:** $1
- **Targets:** all arguments after the second are targets to analyze (see Target syntax above).

1. Read [`lang/$0.md`](lang/$0.md) to confirm the concern is valid for this language and load language-specific patterns.
2. Read [`methodology/$1.md`](methodology/$1.md) to load the audit methodology and generic checklist.
3. Resolve all targets into concrete code regions using the target resolution rules.
4. Apply both to every resolved code region.

## Rules

- Read each target region in full rather than sampling it.
- For each finding provide: file path, line number(s), severity (critical/high/medium/low), bug class, a concrete triggering scenario, and a suggested fix.
- When analyzing a `symbol:` target, report the symbol name and its span in the heading for that target's findings.
- When analyzing a `diff:` target, focus on changed and added code. Flag pre-existing issues in unchanged lines only if a change makes them actively dangerous.
- If you find no issues for a section, say so explicitly; do not invent problems.
- Do not modify any files. This is analysis only.
- At the end, produce a summary table of all findings grouped by severity.

## Available languages

| Language | Concerns |
| --- | --- |
| `zig` | leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, ub, injection |
| `c` | leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, ub, injection |
| `rust` | leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, async-bugs, ub, injection, type-safety |
| `go` | leaks, deadlocks, races, lifecycle, overflow, error-handling, async-bugs, injection, type-safety |
| `java` | leaks, deadlocks, races, lifecycle, overflow, error-handling, injection, type-safety |
| `python` | leaks, deadlocks, races, lifecycle, overflow, error-handling, async-bugs, injection, type-safety |
| `ts` | leaks, lifecycle, error-handling, async-bugs, type-safety, injection |
