---
name: kit-setup
description: Install the parts of Senior Dev Kit a plugin cannot carry — the path-scoped rules and the deny list — into the user's Claude Code settings directory.
allowed-tools: Read, Bash
when_to_use: Run once after installing the plugin, or when kit-doctor reports the rules are missing.
disable-model-invocation: true
model: sonnet
effort: low
argument-hint: "[--only rules | --only deny-rules]"
---

# kit-setup

A plugin cannot write `rules/*.md` or permission rules into the user's settings directory, so
this is a one-time, consented step. Never skip step 2.

1. PLAN: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --only rules,deny-rules --dry-run`
   (drop `${CLAUDE_PLUGIN_ROOT}/` when running from a clone of the repo). Show the output verbatim.
2. ASK: state plainly that this writes to the user's `~/.claude/rules/` and merges deny rules into
   `~/.claude/settings.json`, that existing files are backed up and their own settings keys and deny
   rules are preserved, and that `--uninstall` reverses it. Wait for an explicit yes. Never pass
   `--yes` before that answer.
3. APPLY: rerun the same command with `--yes` appended, then report the target directory, the backup
   directory, and how many deny rules were added.
4. FINISH: tell the user to restart Claude Code (or run `/reload-plugins`) so the new rules load, and
   that `/kit-doctor` verifies the result.

## Output

```text
∙ rules: N installed · deny: N added · backup: <path>
NEXT: restart Claude Code, then /kit-doctor
```
