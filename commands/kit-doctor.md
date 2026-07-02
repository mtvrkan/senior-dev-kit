---
description: Diagnose a senior-dev-kit installation — component counts, settings state, hook wiring, version drift. Read-only.
argument-hint: "[scope: global | project | both]"
---

# /kit-doctor

Diagnose the senior-dev-kit installation. Scope: $ARGUMENTS (default: both global `~/.claude/` and the project `.claude/`).

Checks to run (read-only — propose fixes, never apply them unasked):

1. LOCATE — which scopes are installed (`~/.claude/`, project `.claude/`).
2. COUNT — files in rules/ skills/ commands/ agents/ agent_docs/ hooks/ vs the kit README's shipped counts; flag shortfalls (truncated copy) and extras (user additions — informational, not errors).
3. SETTINGS — `settings.json` parses? `permissions.deny` present with ≥101 rules? hooks wired in, or copied-but-inactive (the expected opt-in default)?
4. VERSION — `CLAUDE.md` / `.claude/stack-rules.md` present; compare against the kit CHANGELOG's latest version.
5. ROUTING — every agent in global-CLAUDE.md's AGENT ROUTING table exists as `agents/<name>.md`.

Output format:

```text
COMPONENT | EXPECTED | FOUND | ✓/⚠/✗   (one row per component, per scope)
VERDICT: healthy | degraded — [list] | broken — [list]
FIX: [exact reinstall command or UPGRADE.md/TROUBLESHOOTING.md section per ✗]
```
