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

1. LOCATE: is the kit installed as a plugin (`claude plugin list`), copied into `~/.claude/`, or both? Does the project `.claude/` exist? Report every scope found, and print the absolute plugin root (`${CLAUDE_PLUGIN_ROOT}`) when installed that way — that is where `presets/` lives for plugin users. If the plugin is present but `~/.claude/rules/` is not, say that path-scoped rules are inactive and `/kit-setup` fixes it.
2. COUNT: every directory component the installer copies — `agents/ skills/ commands/ rules/ agent_docs/ presets/`, i.e. the directory-shaped entries of `COMPONENTS` in `scripts/lib/install-core.mjs` — against the shipped counts in the kit README. Flag shortfalls (truncated copy) and extras (user additions, not errors).
3. SETTINGS: `settings.json` parses as JSON? Is `permissions.deny` present, with at least as many rules as `SECURITY.md` states? Read that number from `SECURITY.md` at run time — it is pinned to `settings-template.json` by `check-consistency.ts`, so it is always the live count. Never hardcode a floor here.
4. VERSION: `CLAUDE.md` / `.claude/stack-rules.md` present? compare installed content markers against the kit's current `package.json` version.
5. ROUTING: every agent named in global-CLAUDE.md's AGENT ROUTING section (prose with `signal → agent` arrows, not a table) exists as `agents/<name>.md` on disk.

## Output

```text
COMPONENT | EXPECTED | FOUND | ✓/⚠/✗   (one row per component, per scope)
VERDICT: healthy | degraded — [list] | broken — [list]
FIX: [exact re-copy command for the missing/stale component per ✗]
```
