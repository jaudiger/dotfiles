---
description: Check a new pi-subagents release against the current configuration and integrations
argument-hint: "<release-URL>"
---

Review the pi-subagents release at $1.

Launch a researcher agent to investigate the release using its release notes, changelog, documentation, and relevant upstream source changes. Compare the release with the current configuration and integrations in these absolute paths:

- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/packages/pi-subagents.json`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/profiles/ai/pi-coding-agent.nix`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/brioche-packages-bot-review/`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/brioche-packages-debug-pr-failure/`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/brioche-packages-submit-package/`
- `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/extensions/github-dependabot-review/`

Pay particular attention to the pi-subagents APIs used by these extensions, including subagent spawning, RPC calls, asynchronous completion events, missions, capability ceilings, agent and model configuration, artifacts, and lifecycle or shutdown behavior. Identify new features or improvements that could improve the current setup. Verify breaking changes, renamed or removed APIs, changed defaults, configuration changes, compatibility risks, and required migration steps. Distinguish confirmed upstream changes from assumptions, and cite relevant upstream URLs and local file paths.

Return a concise report with:

- Relevant improvements and features
- Impact on the current configuration
- Impact on each affected extension
- Breaking changes and compatibility risks
- Required configuration or code changes, if any
- A recommendation about whether and how to update
