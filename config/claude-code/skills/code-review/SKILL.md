---
name: code-review
description: >
  Review code from local modifications, branches, commits, pull requests, or
  direct file/symbol targets. Run /code-review to see available modes. All
  review aspects are applied by default; append aspect names after -- to narrow
  the focus.
argument-hint: [targets...] [-- aspect...]
allowed-tools: Bash, Read, Grep, Glob
---

# Code Review

## Interactive mode (no arguments)

If the user did not provide any targets, print the usage guide below and wait
for their reply. Do NOT use the AskUserQuestion tool — output the guide as
formatted text directly in the conversation.

### Usage

```
/code-review [targets...] [-- aspect...]
```

### Target syntax

All targets use a prefix to indicate the type of input:

| Prefix | Format | Description |
|--------|--------|-------------|
| `file:` | `file:PATH` or `file:PATH#L1-L2` | Single file, optional line range |
| `folder:` | `folder:PATH` | All source files within the dir (recursive) |
| `symbol:` | `symbol:PATH:LINE` or `symbol:PATH:LINE#L1-L2` | Function/struct/class/method at LINE, optional focus range |
| `diff:` | `diff:local`, `diff:branch[:REF]`, `diff:pr:NUMBER_OR_URL`, `diff:commit:SHA` | Changes from a diff source |

Bare paths (no prefix) are treated as `file:PATH` for backward compatibility.

#### Resolution rules

**`file:PATH[#L1-L2]`** — Read the file. If `#L1-L2` is present, review only that line range but read enough surrounding context (imports, type definitions) to understand it.

**`folder:PATH`** — Glob for source files within PATH. Treat each discovered file as a `file:` target.

**`symbol:PATH:LINE[#L1-L2]`** — Read the file at PATH. Identify the innermost function, method, struct, class, enum, or trait definition containing LINE. Review that symbol boundary (from signature to closing delimiter). If `#L1-L2` is appended, focus on that range within the symbol.

**`diff:SOURCE`** — Resolve the diff:

| Source | Resolution |
|--------|------------|
| `diff:local` | `git diff HEAD` for tracked changes + `git ls-files --others --exclude-standard` for untracked |
| `diff:branch` | Detect default branch (`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'`, falling back to `main`), then `git diff <default>...HEAD` and `git log --oneline <default>..HEAD` for commit context |
| `diff:branch:REF` | `git diff REF...HEAD` |
| `diff:pr:N` or `diff:pr:URL` | GitHub: `gh pr diff N [--repo owner/repo]` and `gh pr view N [--repo owner/repo]` for title, description, and labels. GitLab: `glab mr diff N` and `glab mr view N`. Parse owner/repo/number from URL if needed |
| `diff:commit:SHA` | `git show SHA --stat` for overview, then `git show SHA` for full diff. Read the commit message for intent context |

#### Edge cases

- `symbol:` LINE on blank/comment/import → scan up/down ~20 lines for nearest symbol; error if none found.
- Nested symbols (closures, inner functions) → resolve to innermost enclosing.
- `#L1-L2` where L2 > file length → clamp to file length; L1 > file length → error.
- `folder:` with no matching files → report "No source files found."
- Empty diff → report "No changes found" and stop.

### Aspects (optional filter — all applied by default)

`correctness` · `design` · `security` · `performance` · `error-handling` · `testing` · `maintainability`

### Examples

```
/code-review diff:local
/code-review diff:branch:main
/code-review diff:pr:42
/code-review diff:pr:https://github.com/org/repo/pull/42
/code-review diff:pr:42 -- security performance
/code-review diff:commit:abc123
/code-review file:src/auth.rs
/code-review symbol:src/auth.rs:42 -- correctness design
```

## Review procedure

### Step 1 — Resolve targets

Resolve all targets into code regions using the target resolution rules above.

- For `diff:` targets: obtain the raw diff and extract changed files and changed line regions (hunks).
- For `file:`/`folder:`/`symbol:` targets: there is no diff — the code region itself is the review subject. Review it as a general code quality review (applying aspects to the code directly rather than to a changeset).

If there are no code regions to review (empty diff, no files found), report it and stop.

### Step 2 — Gather context

1. For `diff:` targets: extract the list of changed files from the diff. Read each changed file in full using the Read tool. Skip deleted files. If a file exceeds 2 000 lines, read only the regions surrounding changed hunks (200 lines of context around each hunk).
2. For `file:`/`folder:`/`symbol:` targets: read the target files/regions. For `symbol:` targets, read the full file to understand context around the symbol.
3. Identify functions, methods, and types **called or referenced** in the
   reviewed code but **defined outside it**. Use Grep and Read to locate
   and read their implementations. This is essential for understanding the
   intended workflow and judging whether the code uses those functions
   correctly (argument semantics, error contracts, side effects, ordering
   requirements). Prioritize:
   - Functions called in new or modified lines (for diffs) or in the reviewed region (for file/symbol targets).
   - Types constructed, returned, or pattern-matched.
   - Trait/interface implementations when the code interacts with a
     polymorphic boundary.
   Stop expanding once you have enough context to evaluate correctness; do not
   chase the entire call graph.
4. For PRs (`diff:pr:`), use the PR title and description to understand the
   author's stated intent. Evaluate the changes against that intent.

### Step 3 — Detect languages

Determine the language(s) from file extensions in the changeset or target files. Use this to
inform language-aware feedback (idiomatic patterns, common pitfalls) but do
not load external files.

### Step 4 — Apply aspects

For each selected aspect (all seven by default, or only those listed after
`--`), read the corresponding [`aspects/<aspect>.md`](aspects/) checklist and
evaluate the code against it.

For `diff:` targets: focus on **changed and added code**. Do not flag pre-existing issues in
unchanged lines unless a change makes them actively dangerous or the context
is necessary to understand a new bug.

For `file:`/`folder:`/`symbol:` targets: review the code region directly, applying each aspect as a general code quality evaluation.

### Step 5 — Produce findings

For each finding, provide:

- **File** and **line range** in the current version of the file.
- **Aspect** (`correctness`, `design`, `security`, …).
- **Severity**:
  - `blocker` — must fix before merge; functional bug, security issue, or data loss risk.
  - `warning` — should fix; correctness risk, poor design, or maintainability concern.
  - `nit` — optional; style, naming, minor simplification.
- **Description** — what is wrong and why it matters.
- **Suggestion** — a concrete fix, alternative approach, or question for the author.

### Step 6 — Summary

1. A table of all findings grouped by severity.
2. A one-paragraph overall assessment: is this code ready to merge as-is (for diffs),
   or what are the key areas for improvement (for file/symbol reviews)?

## Rules

- For `diff:` targets: review the **diff**, not the entire file. Flag issues in changed and added lines. Only flag unchanged code if a change makes a pre-existing issue actively dangerous.
- For `file:`/`folder:`/`symbol:` targets: review the **code region** directly. Apply aspects as a general code quality evaluation.
- Be specific. Every finding must reference exact file paths and lines, and
  explain the concrete problem.
- Do NOT modify any files. This is analysis only.
- Do NOT invent problems. If an aspect has no findings, say so explicitly.
- Respect the author's intent. Read the PR description or commit message. Do
  not suggest redesigns that contradict the stated goal unless the approach is
  fundamentally flawed.
- Keep nits separate from blockers. Do not bury critical issues among style
  suggestions.
- For large changesets (50+ files), warn the user and suggest narrowing scope
  to specific directories or aspects rather than producing a shallow review.
