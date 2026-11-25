---
name: kit-doctor
description: "Use to diagnose a senior-dev-kit installation in Codex — plugin state, hook trust, installed agents and command rules, and version drift. Read-only. Manually invoke when the kit misbehaves after an install or upgrade — verifies what is actually on disk instead of guessing."
---

# kit-doctor

> Read-only: this skill never edits or creates files.

Diagnose the installation. Read-only — propose fixes, never apply them unasked.

1. LOCATE: is the plugin installed and enabled (`codex plugin list`, `[plugins."senior-dev-kit@…"]` in `~/.codex/config.toml`)? Print the absolute KIT_ROOT the SessionStart hook reported — that is where `agent_docs/`, `rules/` and `presets/` live. No KIT_ROOT line this session → the plugin's hooks are not running: tell the user to review them in `/hooks`.
2. COUNT: under KIT_ROOT, `skills/*/SKILL.md`, `agents/*.toml`, `rules/*.md`, `agent_docs/*.md` against the counts in KIT_ROOT's `README.md`. Flag shortfalls (truncated copy) and extras (user additions, not errors).
3. SETUP: `node "KIT_ROOT/scripts/install.mjs" --check` — reports every stale agent, the command rules file and the AGENTS.md protocol block. "No install found" → `$kit-setup` was never run: custom agents and command rules are inactive.
4. HOOKS: `KIT_ROOT/hooks/hooks.json` parses as JSON and names `session-context.mjs` and `guard.mjs`; `node --version` is 18 or newer (the hooks run on the user's Node). Dry-run the guard: `echo '{"tool_name":"Bash","tool_input":{"command":"cat .env"},"cwd":"."}' | node "KIT_ROOT/scripts/guard.mjs"` must print a `deny` decision.
5. ROUTING: every agent named in the protocol's AGENT ROUTING section exists as `~/.codex/agents/<name>.toml`.

## Output

```text
COMPONENT | EXPECTED | FOUND | ✓/⚠/✗
VERDICT: healthy | degraded — [list] | broken — [list]
FIX: [exact command per ✗]
```
