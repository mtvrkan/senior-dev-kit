# Senior Dev Kit — Codex plugin

Generated from the kit's Claude Code sources by `scripts/gen-codex.mjs`. Do not edit files here;
change the source (or `scripts/codex/overrides/`) and regenerate.

## Install

```bash
codex plugin marketplace add mtvrkan/senior-dev-kit
codex plugin add senior-dev-kit@senior-dev-kit
```

Then, in a new Codex session:

1. `/hooks` — review and trust the plugin's two hooks (session context, guard).
2. `$kit-setup` — installs what a plugin cannot carry: the custom agents (`~/.codex/agents/`), the
   command rules (`~/.codex/rules/senior-dev-kit.rules`) and the protocol block in
   `~/.codex/AGENTS.md`. Or run it yourself: `node scripts/install.mjs` from this directory.

## What maps to what

| Claude Code | Codex |
| --- | --- |
| `skills/*/SKILL.md` | `skills/*/SKILL.md` (`name` + `description`; `when_to_use` folded into the description) |
| `commands/*.md` | skills of the same name, invoked as `$name` |
| `disable-model-invocation: true` | `agents/openai.yaml` with `allow_implicit_invocation: false` |
| `agents/*.md` | `agents/*.toml`, installed to `~/.codex/agents/` by `$kit-setup` |
| `global-CLAUDE.md` | `protocol.md` — SessionStart hook, or a managed block in `~/.codex/AGENTS.md` |
| `rules/000`, `rules/001` (always loaded) | injected by the SessionStart hook |
| `rules/*.md` with `paths:` | named by the PreToolUse hook the first time a matching file is touched |
| `permissions.deny` (Bash, Read, Edit) | PreToolUse hook (`hooks/guard-data.json`) + `forbidden` prefix rules |
| `permissions.ask` | `prompt` prefix rules |
| `presets/*/CLAUDE.md` | `presets/*/AGENTS.md` |

Not carried over: the status line script (Codex's status line is configured with `/statusline`),
the per-agent model names (agents keep their reasoning effort and inherit the session's model), and
the `require-agent-model` hook (it guards a Claude Code default that Codex does not have).

Project working files stay where the Claude Code side of the kit keeps them (`.claude/TECH-DEBT.md`,
`.claude/PROJECT-MEMORY.md`, `.claude/HANDOFF.md`), so both tools share them in one project.
