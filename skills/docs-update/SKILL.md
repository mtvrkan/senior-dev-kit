---
name: docs-update
description: Use for README, setup instructions, changelog, API docs, and short documentation updates.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically for documentation-only changes.
argument-hint: "[doc file or change to document]"
---

# docs-update

Rules:

1. Document only actual implemented behavior — never aspirational or planned features.
2. Prefer examples users can copy-paste over prose descriptions.
3. Concise: one clear sentence beats one paragraph.
4. Update docs when: behavior changes, new commands added, API surface changes, setup steps change.
5. Do not modify code.
6. Format: clear headings, code blocks for all commands and config examples.
7. Check: does the existing README/doc already cover this? Update in place, don't duplicate.
