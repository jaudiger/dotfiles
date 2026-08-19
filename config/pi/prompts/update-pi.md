---
description: Check a new Pi release against the current profile and extensions
argument-hint: "<release-URL>"
---

Review the Pi release at $1.

Launch a researcher agent to investigate the release using the official release notes, changelog, migration documentation, and relevant upstream source changes. Compare it with the current Pi configuration in `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/profiles/ai/pi-coding-agent.nix` and all extension source files recursively under `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/`.

Focus exclusively on Pi itself and the core Pi APIs and runtime behavior consumed by these extensions. Check extension loading and lifecycle, commands, tools, events, session behavior, messages, contexts, configuration, and other Pi APIs imported from `@earendil-works/pi-coding-agent`. Do not perform a general review of the extension implementations.

Identify new Pi features or improvements that could benefit this setup. Verify breaking changes, renamed or removed Pi APIs, changed defaults, configuration changes, extension loading or lifecycle changes, compatibility risks, and required migration steps. Distinguish confirmed upstream changes from assumptions, and cite relevant upstream URLs and local file paths with line ranges.

Return a concise report with:

- Relevant Pi improvements and features
- Impact on the current profile
- Impact on affected extensions
- Breaking changes and compatibility risks
- Required configuration or code changes, if any
- A recommendation about whether and how to update
