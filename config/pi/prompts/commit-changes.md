---
description: Stage session changes and commit with a Conventional Commit message
---

Inspect git status and the diffs. Stage only changes made in this session. For files with pre-existing edits, use `git add -p` to stage only this session's hunks, never the whole file. Leave unrelated work untouched. If pre-existing changes are already staged or session changes cannot be separated safely, do not commit and explain why.

Choose a type and optional scope following https://www.conventionalcommits.org/en/v1.0.0/. Run git add for the selected files, then create a commit with a concise Conventional Commit subject and no body or footer.

Report the commit hash and subject.
