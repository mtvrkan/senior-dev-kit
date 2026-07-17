---
name: kit-doctor
description: Use to diagnose a senior-dev-kit installation — component file counts, settings merge state, and version drift. Read-only.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke when the kit misbehaves after an install or upgrade — verifies what is actually on disk instead of guessing.
disable-model-invocation: true
model: haiku
effort: low
argument-hint: "[scope: global | project | both (default: both)]"
---

# kit-doctor

Diagnose the installation. Read-only — propose fixes, never apply them unasked.

1. LOCATE: does `~/.claude/` exist? does the project `.claude/` exist? Report which scope(s) are installed.
2. COUNT: files in rules/ skills/ commands/ agents/ agent_docs/ vs the shipped counts stated in the kit README — flag shortfalls (truncated copy) and extras (user additions, not errors).
3. SETTINGS: `settings.json` parses as JSON? `permissions.deny` present and ≥140 rules?
4. VERSION: `CLAUDE.md` / `.claude/stack-rules.md` present? compare installed content markers against the kit CHANGELOG's latest version.
5. ROUTING: every agent named in global-CLAUDE.md's AGENT ROUTING table exists as `agents/<name>.md` on disk.

## Output

```text
COMPONENT | EXPECTED | FOUND | ✓/⚠/✗   (one row per component, per scope)
VERDICT: healthy | degraded — [list] | broken — [list]
FIX: [exact reinstall command or UPGRADE.md/TROUBLESHOOTING.md section per ✗]
```
