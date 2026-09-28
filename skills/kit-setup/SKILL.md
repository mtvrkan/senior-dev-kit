---
name: kit-setup
description: Install the parts of Senior Dev Kit a plugin cannot carry — the path-scoped rules, the deny list, and the attribution setting — into the user's Claude Code settings directory.
allowed-tools: Read, Bash
when_to_use: Run once after installing the plugin, after a plugin update, or when /kit-doctor reports the rules or settings are missing.
disable-model-invocation: true
model: sonnet
effort: low
argument-hint: "[--only rules | --only deny-rules | --only settings]"
---

# kit-setup

A plugin cannot write `rules/*.md` or settings into the user's settings directory, so this is a
one-time, consented step. Never skip step 2.

1. PLAN: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --only rules,deny-rules,settings --dry-run`
   (drop `${CLAUDE_PLUGIN_ROOT}/` when running from a clone of the repo). If the user passed
   `--only <x>`, use that value instead — installing more than they asked for is not the smaller
   surprise. Show the output verbatim.
2. ASK: state plainly that this writes to the user's `~/.claude/rules/`, merges deny rules into
   `~/.claude/settings.json`, and sets `attribution` so commits and PRs carry no Claude trailer;
   that existing files are backed up, any value they already set is kept, and `--uninstall`
   reverses it. Wait for an explicit yes. Never pass `--yes` before that answer.
3. APPLY: rerun the same command with `--yes` appended, then report the target directory, the backup
   directory, how many deny rules were added and which settings were set or kept.
4. FINISH: tell the user to restart Claude Code (or run `/reload-plugins`) so the new rules load, and
   that `/kit-doctor` verifies the result.

## Output

```text
∙ rules: N installed · deny: N added · settings: attribution set|kept · backup: <path>
NEXT: restart Claude Code, then /kit-doctor
```
