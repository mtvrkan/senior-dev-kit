---
name: kit-doctor
description: Use to diagnose a senior-dev-kit installation — component file counts, settings merge state, and version drift. Read-only.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke when the kit misbehaves after an install or upgrade — verifies what is actually on disk instead of guessing.
disable-model-invocation: true
model: sonnet
effort: low
argument-hint: "[scope: global | project | both (default: both)]"
---

# kit-doctor

Diagnose the installation. Read-only — propose fixes, never apply them unasked.

1. LOCATE: is the kit installed as a plugin (`claude plugin list`), copied into `~/.claude/`, or both? Does the project `.claude/` exist? Report every scope found — and if the plugin is present but `~/.claude/rules/` is not, say that path-scoped rules are inactive and `/kit-setup` fixes it.
2. COUNT: files in rules/ skills/ commands/ agents/ agent_docs/ vs the shipped counts stated in the kit README — flag shortfalls (truncated copy) and extras (user additions, not errors).
3. SETTINGS: `settings.json` parses as JSON? `permissions.deny` present and ≥190 rules (see `SECURITY.md` for the exact current count — this floor is a coarse truncation check, not a substitute for it)?
4. VERSION: `CLAUDE.md` / `.claude/stack-rules.md` present? compare installed content markers against the kit's current `package.json` version.
5. ROUTING: every agent named in global-CLAUDE.md's AGENT ROUTING section (prose with `signal → agent` arrows, not a table) exists as `agents/<name>.md` on disk.

## Output

```text
COMPONENT | EXPECTED | FOUND | ✓/⚠/✗   (one row per component, per scope)
VERDICT: healthy | degraded — [list] | broken — [list]
FIX: [exact re-copy command for the missing/stale component per ✗]
```
