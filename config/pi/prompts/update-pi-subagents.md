---
description: Check a new pi-subagents release against the current package configuration
argument-hint: "<release-URL>"
---

Review the pi-subagents release at $1.

Launch a researcher agent to inspect the official release notes, changelog, documentation, and relevant upstream source changes. Compare the release with the package configuration and version pin in these absolute paths:

- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/packages/pi-subagents.json`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/profiles/ai/pi-coding-agent.nix`

Check which configured options remain supported and whether their behavior or defaults changed. Identify relevant new configuration options, compatibility risks, and practical opportunities to simplify or improve the package configuration. Do not infer local use of pi-subagents APIs from unrelated code. Do not modify repository files.

Verify breaking changes, renamed or removed configuration options, changed defaults, compatibility risks, and required migration steps. Distinguish confirmed upstream changes from assumptions. Cite relevant upstream URLs, source symbols, and local file paths with line ranges.

Return a concise report organized under:

- Relevant release changes
- Current configuration impact
- Configuration opportunities
- Breaking changes and compatibility risks
- Required configuration changes
- Recommendation about whether and how to update
