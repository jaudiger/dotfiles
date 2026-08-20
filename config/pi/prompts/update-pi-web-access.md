---
description: Check a new pi-web-access release against the current configuration
argument-hint: "<release-URL>"
---

Review the pi-web-access release at $1.

Launch a researcher agent to inspect the official release notes, changelog, documentation, and relevant upstream source changes. Compare the release with the current configuration at `/Users/jaudiger/Development/git-repositories/jaudiger/dotfiles/config/pi/packages/web-search.json`.

Identify useful features and assess whether the current configuration and its consumers follow the latest documented pi-web-access idioms. Look for practical improvements to provider selection, search and fetch behavior, result handling, limits, reliability, and compatibility. Recommend changes only when they are supported by upstream evidence and improve correctness, maintainability, or future compatibility.

Verify breaking changes, renamed or removed capabilities, changed defaults, configuration changes, provider behavior changes, compatibility risks, and required migration steps. Distinguish confirmed upstream changes from assumptions. Cite relevant upstream URLs and local file paths with line ranges. Do not modify repository files.

Return a concise report organized under:

- Relevant improvements and features
- Current configuration impact
- Latest idiom opportunities
- Breaking changes and compatibility risks
- Required configuration or code changes
- Recommendation about whether and how to update
