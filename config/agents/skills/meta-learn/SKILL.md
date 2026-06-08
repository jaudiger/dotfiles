---
name: meta-learn
description: Review the current session for skill/project-config gaps and stale patterns, then update the relevant files.
---

# Self-Improve

Review what was accomplished in this session. Identify any patterns, methodologies, or language-specific knowledge that were used but are not currently captured in:

**Global skills** live under `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/agents/skills/`. Glob that directory to enumerate the currently installed skills, then read each `SKILL.md` to understand its scope before identifying gaps.

**Project-level files** in the current working repository that AI agents may load.

## Phase 1: Gap detection

For each gap found:

1. State which file should be updated and why
2. Show the proposed addition
3. Apply the edit after confirmation

When adding a new concern/aspect/domain to a skill, update both the SKILL.md coverage matrix and create the corresponding sub-file.

## Phase 2: Staleness detection

Read through all skill files and project files that were relevant to this session. Flag any content that is out of date:

- Deprecated API patterns, removed functions, renamed tools
- Language version assumptions that no longer hold
- References to files, modules, or dependencies absent from the repo
- Checklist items now redundant with modern compiler/linter defaults

For each stale item:

1. Quote the outdated content
2. Explain why it is stale
3. Propose the updated replacement
4. Apply the edit after confirmation

If any out-of-date content is detected, suggest concrete modifications to update it, even if the current task did not require that knowledge. Do not silently ignore stale guidance.

If no gaps or stale content are found, say so explicitly.
