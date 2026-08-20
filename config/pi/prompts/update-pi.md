---
description: Check a new Pi release against the current profile and extensions
argument-hint: "<release-URL>"
---

Review the Pi release at $1.

Launch a researcher agent to inspect the official release notes, changelog, migration documentation, and relevant upstream source changes. Compare the release with the current Pi configuration at `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/profiles/ai/pi-coding-agent.nix` and all extension source files recursively under `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/`.

Focus exclusively on Pi itself and the core Pi APIs and runtime behavior consumed by these extensions. Check extension loading and lifecycle, commands, tools, events, session behavior, messages, contexts, configuration, and other Pi APIs imported from `@earendil-works/pi-coding-agent`. Do not perform a general review of the extension implementations.

Identify new Pi features and practical opportunities to adopt the latest supported Pi idioms in the profile or extension integrations. Recommend changes only when they improve correctness, maintainability, observability, or future compatibility. Verify breaking changes, renamed or removed APIs, changed defaults, configuration changes, extension loading or lifecycle changes, compatibility risks, and required migration steps. Distinguish confirmed upstream changes from assumptions. Cite relevant upstream URLs and local file paths with line ranges. Do not modify repository files.

Return a concise report organized under:

- Relevant Pi improvements and features
- Current profile impact
- Impact on affected extensions
- Latest idiom opportunities
- Breaking changes and compatibility risks
- Required configuration or code changes
- Recommendation about whether and how to update
