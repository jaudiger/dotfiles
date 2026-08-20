---
description: Check a new pi-subagents release against the current configuration and integrations
argument-hint: "<release-URL>"
---

Review the pi-subagents release at $1.

Launch a researcher agent to inspect the official release notes, changelog, documentation, and relevant upstream source changes. Compare the release with the current configuration and integrations in these absolute paths:

- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/packages/pi-subagents.json`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/profiles/ai/pi-coding-agent.nix`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/brioche-packages-bot-review/`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/brioche-packages-debug-pr-failure/`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/brioche-packages-submit-package/`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/github-dependabot-review/`

Review the pi-subagents APIs consumed by these integrations, including spawning, RPC, asynchronous completion events, missions, capability ceilings, agent and model configuration, artifacts, and lifecycle or shutdown behavior. Also assess whether the integrations follow the latest documented idioms, and identify practical opportunities to simplify or improve their configuration, lifecycle handling, cleanup, observability, and compatibility. Consider whether mission records are appropriate for temporary one-shot work and whether newer preflight or inspection APIs apply. Do not recommend replacing an async RPC integration with a foreground-only API without confirming that its lifecycle requirements still work.

Verify breaking changes, renamed or removed APIs, changed defaults, configuration changes, compatibility risks, and required migration steps. Distinguish confirmed upstream changes from assumptions. Cite relevant upstream URLs, source symbols, and local file paths with line ranges. Do not modify repository files.

Return a concise report organized under:

- Relevant improvements and features
- Current configuration impact
- Impact on each affected extension
- Latest idiom opportunities
- Breaking changes and compatibility risks
- Required configuration or code changes
- Recommendation about whether and how to update
