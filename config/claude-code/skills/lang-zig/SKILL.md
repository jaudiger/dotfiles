---
name: lang-zig
description: >
  Zig 0.15+ idiomatic best practices and patterns reference. Provides
  guidance on I/O, JSON, memory management, error handling, comptime,
  types, testing, build system, and syntax idioms. Run /lang-zig to see
  available topics.
argument-hint: [topic...]
allowed-tools: Read, Grep, Glob
---

# Zig 0.15+ Best Practices Reference

**Target version**: Zig 0.15.0+ (tested against 0.15.1 / 0.15.2)

## Interactive mode (no arguments)

If the user did not provide any topics, print the usage guide below and wait
for their reply. Do NOT use the AskUserQuestion tool -- output the guide as
formatted text directly in the conversation.

### Usage

```
/lang-zig [topic...]
```

### Available topics

| Topic | Description |
|-------|-------------|
| `build` | Build system, root module pattern, compiler & toolchain |
| `comptime` | Comptime evaluation, type constructors, inline for, type reflection |
| `errors` | Error handling patterns, defer patterns, errdefer, diagnostics |
| `io` | I/O system, Writer/Reader patterns, format strings, HTTP client & server |
| `json` | JSON parsing & serialization, parse options, streaming output |
| `memory` | Memory management, allocators, collections (ArrayList, LinkedList) |
| `patterns` | Design patterns: options struct, positional DI, guard-based clamping |
| `syntax` | Syntax & style idioms, operators, control flow, builtins |
| `testing` | Testing patterns, doctests, testing allocator, skip tests |
| `types` | Type system, generics, tagged unions, enum matching, newtype index pattern |
| `all` | Load all topics |

### Examples

```
/lang-zig errors comptime
/lang-zig io
/lang-zig json memory
/lang-zig all
```

---

## Procedure

### Step 1 -- Resolve topics

Map each user-provided topic to a file under [`topics/`](topics/):

| Topic | File |
|-------|------|
| `build` | `topics/build.md` |
| `comptime` | `topics/comptime.md` |
| `errors` | `topics/errors.md` |
| `io` | `topics/io.md` |
| `json` | `topics/json.md` |
| `memory` | `topics/memory.md` |
| `patterns` | `topics/patterns.md` |
| `syntax` | `topics/syntax.md` |
| `testing` | `topics/testing.md` |
| `types` | `topics/types.md` |
| `all` | All files above |

If a topic does not match any entry, report it and suggest the closest match.

### Step 2 -- Read topic files

Read each resolved topic file using the Read tool. Use the absolute path
derived from the skill's own directory.

### Step 3 -- Present guidance

Present the content from the topic files, adapting it to the user's context:

- If the user asked a **specific question** alongside the topic, answer it
  using the reference content.
- If the user is **writing or reviewing Zig code**, apply the patterns from
  the topic files as guidance for the current task.
- If the user just wants to **browse**, present the topic content with a brief
  summary of key patterns.

### Step 4 -- Cross-reference (optional)

When the user's question spans multiple topics, read additional topic files as
needed to provide a complete answer. For example, a question about JSON error
handling may require both `json` and `errors` topics.

## Rules

- Always present code examples using Zig 0.15+ syntax.
- Do NOT invent patterns not covered by the reference content. If unsure,
  state that the topic is not covered.
- When the user is actively coding, prefer showing concrete code examples over
  abstract descriptions.
- Reference the source documents when relevant (release notes, language
  reference, matklad blog posts).
