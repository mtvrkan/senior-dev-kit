---
name: kit-setup
description: "Install the parts of Senior Dev Kit a Codex plugin cannot carry — the custom agents, the command rules, and the protocol block in AGENTS.md — into the user's Codex home. Run once after installing the plugin, after a plugin update, or when $kit-doctor reports the agents or rules are missing."
---

# kit-setup

A plugin cannot write `agents/*.toml`, `rules/*.rules` or `AGENTS.md` into the user's Codex home, so
this is a one-time, consented step. Never skip step 2.

1. PLAN: run `node "KIT_ROOT/scripts/install.mjs" --dry-run` (KIT_ROOT is the absolute path the
   plugin's SessionStart hook printed; from a clone of the repo it is `codex/`). If the user passed
   `--only <x>`, add that value — installing more than they asked for is not the smaller surprise.
   Show the output verbatim.
2. ASK: state plainly that this writes the kit's custom agents to `~/.codex/agents/`, the command
   rules to `~/.codex/rules/senior-dev-kit.rules` (prompt before `git push` and `gh pr create`,
   forbid the destructive commands on the kit's deny list), and the kit protocol as a marked block
   in `~/.codex/AGENTS.md`; that existing files are backed up, anything they wrote outside the
   markers is kept, and `--uninstall` reverses it. Wait for an explicit yes. Never pass `--yes`
   before that answer.
3. APPLY: rerun the same command with `--yes` appended, then report the target directory, the backup
   directory, and how many files were written.
4. FINISH: tell the user to start a new Codex session so the agents and rules load, to review the
   plugin's hooks once with `/hooks` (the deny list and path-scoped rules run through them), and
   that `$kit-doctor` verifies the result.

## Output

```text
∙ agents: N installed · command rules: installed|kept · protocol: written|kept · backup: <path>
NEXT: new Codex session, trust the hooks in /hooks, then $kit-doctor
```
