---
name: code-security
description: >
  Audit source files for security vulnerabilities and weaknesses. Run
  /code-security to see available languages and security domains. Each domain
  applies a targeted checklist to the given targets and produces a structured
  report.
argument-hint: [lang] [domain] [targets...]
allowed-tools: Bash, Read, Grep, Glob
---

# Code Security Audit

## Interactive mode (no arguments or partial arguments)

If the user did not provide all three pieces of information (language, domain, targets), print a single prompt that lists every missing piece and ask the user to reply with their choices. Do NOT use the AskUserQuestion tool -- it truncates options. Instead, output the choices as formatted text directly in the conversation.

For each missing piece, print a numbered section:

1. **Language** (if `$0` is missing or invalid) -- list all languages from the table below with their available domains.
2. **Domain** (if `$1` is missing or invalid) -- list every valid domain for the chosen/given language.
3. **Targets** (if no targets were provided) -- explain the target syntax (see below) and use Glob to discover candidate source files matching the chosen language in the current workspace. List them as suggested `file:` targets. If there are too many candidates, ask for a glob pattern instead.

Present everything in one message so the user can answer all at once (e.g., "python, crypto, file:src/auth.py file:src/tokens.py"). Wait for their reply, then proceed to the audit steps below.

## Target syntax

All targets use a prefix to indicate the type of input:

| Prefix | Format | Description |
|--------|--------|-------------|
| `file:` | `file:PATH` or `file:PATH#L1-L2` | Single file, optional line range |
| `folder:` | `folder:PATH` | All source files for the language within the dir (recursive) |
| `symbol:` | `symbol:PATH:LINE` or `symbol:PATH:LINE#L1-L2` | Function/struct/class/method at LINE, optional focus range |
| `diff:` | `diff:local`, `diff:branch[:REF]`, `diff:pr:NUMBER_OR_URL`, `diff:commit:SHA` | Changes from a diff source |

Bare paths (no prefix) are treated as `file:PATH` for backward compatibility.

### Resolution rules

**`file:PATH[#L1-L2]`** -- Read the file. If `#L1-L2` is present, analyze only that line range but read enough surrounding context (imports, type definitions) to understand it.

**`folder:PATH`** -- Glob for files matching the language's typical extensions within PATH. Treat each discovered file as a `file:` target.

**`symbol:PATH:LINE[#L1-L2]`** -- Read the file at PATH. Identify the innermost function, method, struct, class, enum, or trait definition containing LINE. Analyze that symbol boundary (from signature to closing delimiter). If `#L1-L2` is appended, focus on that range within the symbol. When invoked standalone (not by deep-review), do NOT chase callers/implementations outside the file.

**`diff:SOURCE`** -- Resolve the diff:

| Source | Resolution |
|--------|------------|
| `diff:local` | `git diff HEAD` for tracked changes + `git ls-files --others --exclude-standard` for untracked |
| `diff:branch` | Detect default branch (`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \| sed 's@^refs/remotes/origin/@@'`, falling back to `main`), then `git diff <default>...HEAD` |
| `diff:branch:REF` | `git diff REF...HEAD` |
| `diff:pr:N` or `diff:pr:URL` | GitHub: `gh pr diff N`, GitLab: `glab mr diff N`. Parse owner/repo/number from URL if needed |
| `diff:commit:SHA` | `git show SHA --stat` for overview, then `git show SHA` for full diff. Read the commit message for intent context |

After resolving the diff, extract changed files and changed line regions (hunks). Apply analysis to the changed code regions (reading full context around hunks).

### Edge cases

- `symbol:` LINE on blank/comment/import -> scan up/down ~20 lines for nearest symbol; error if none found.
- Nested symbols (closures, inner functions) -> resolve to innermost enclosing.
- `#L1-L2` where L2 > file length -> clamp to file length; L1 > file length -> error.
- `folder:` with no matching files -> report "No `<lang>` files found."
- Mixed languages in folder -> the language argument filters which files to include.
- Empty diff -> report "No changes found" and stop.

## Audit steps

**Language:** $0
**Domain:** $1
**Targets:** all arguments after the second are targets to analyze (see Target syntax above).

1. Read [`lang/$0.md`](lang/$0.md) to confirm the domain is valid for this language and load language-specific secure patterns.
2. Read [`domain/$1.md`](domain/$1.md) to load the security domain checklist.
3. Resolve all targets into concrete code regions using the target resolution rules.
4. **Detect framework and version** -- inspect project files (`pom.xml`, `build.gradle`, `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.zig.zon`, etc.) to identify the framework and its version. Adapt API-specific checks to the actual version in use. Read the actual code and imports to verify API usage matches the detected version, rather than assuming a specific API shape.
5. Apply all of the above to every resolved code region.

## Rules

- Read EVERY line of each target region. Do not skip or skim.
- For each finding provide:
  - **File path** and **line number(s)**
  - **Severity**: critical / high / medium / low
  - **Security domain** (authn, authz, crypto, input-validation, transport, logging, config)
  - **Description** of the violation
  - **Risk**: what an attacker could achieve
  - **CWE ID** (only when clearly applicable, e.g., CWE-798 for hardcoded credentials, CWE-327 for broken crypto)
  - **Suggested fix**
- When analyzing a `symbol:` target, report the symbol name and its span in the heading for that target's findings.
- When analyzing a `diff:` target, focus on changed and added code. Flag pre-existing issues in unchanged lines only if a change makes them actively dangerous.
- If you find NO issues for a section, say so explicitly -- do not invent problems.
- Do NOT modify any files. This is analysis only.
- At the end, produce a summary table of all findings grouped by severity.

## Available languages

| Language | Domains |
|----------|---------|
| `c`      | authn, authz, crypto, input-validation, transport, logging, config |
| `go`     | authn, authz, crypto, input-validation, transport, logging, config |
| `java`   | authn, authz, crypto, input-validation, transport, logging, config |
| `python` | authn, authz, crypto, input-validation, transport, logging, config |
| `rust`   | authn, authz, crypto, input-validation, transport, logging, config |
| `ts`     | authn, authz, crypto, input-validation, transport, logging, config |
| `zig`    | crypto, input-validation, transport, logging, config |
