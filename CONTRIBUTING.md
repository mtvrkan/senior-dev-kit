# Contributing to Senior Dev Kit

Thank you for contributing. This guide covers the four most common contribution types: presets, agents, skills, and rules.

## Before You Start

1. Read `EXTENDING.md` — it explains the full extension model.
2. Run `npm run check` to confirm the repo is green before making changes.
3. Open an issue first for large additions (new category, new agent type) so design can be agreed before code is written.

## Adding a Preset

Presets live in `presets/<category>/<name>/`. Each must contain exactly two files:

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Full preset — installed to `.claude/CLAUDE.md` in the user's project |
| `compact.md` | Token-optimized summary (8-15 lines) — appended into `stack-rules.md` when composing multiple presets |

### Steps

1. Create `presets/<category>/<name>/CLAUDE.md` following an existing preset in the same category as a template.
2. Create `presets/<category>/<name>/compact.md` — 8-15 dense lines covering key architecture rules, security patterns, verification commands, and anti-patterns. No frontmatter.
3. Add a row for your preset in `PRESET-MAINTENANCE.md` with today's date as "Last Reviewed".
4. Run `npm run validate` — it checks that both files exist and `CLAUDE.md` has non-trivial content.
5. Add the preset to the table in `README.md` (the "Presets" section) and to `CHANGELOG.md` under `[Unreleased]`.
6. If the preset has a natural auto-detect signal (e.g. a unique package name), add a detection clause in `install.sh` and `install.ps1`.

### Preset content requirements

- Reference the rules files already in the kit by path (`../rules/`) — don't duplicate rule content inline.
- Include stack-specific patterns the generic rules don't cover (framework-specific anti-patterns, idiomatic error handling, preferred libraries).
- Never include paid/commercial tool recommendations without a free alternative.

## Adding an Agent

Agents live in `agents/<name>.md` with YAML frontmatter.

### Required frontmatter fields

```yaml
---
name: my-agent
description: One sentence — when to use this agent.
tools: Read, Grep, Glob, Edit, Write, Bash
model: claude-sonnet-5
permissionMode: default        # use "plan" for guard agents
effort: medium
color: blue
---
```

Valid model IDs: `claude-haiku-4-5-20251001` · `claude-sonnet-5` · `claude-opus-4-8` · `claude-fable-5`

> **Keeping model IDs current:** When Anthropic releases a new model, add its ID to **both** the `VALID_MODELS` set in `scripts/validate-skills.ts` **and** the list above. The validator rejects any agent or skill that references an unrecognised model ID.

Guard agents (those that plan but don't implement) **must** set `permissionMode: plan`.

### After adding an agent

1. Add a routing rule in `agents/ROUTING.md` — the validator checks that every agent file is mentioned there.
2. If the agent uses skills, add a `skills:` list in the frontmatter and verify each skill name exists in `skills/`.
3. Add a row for your agent in `AGENTS-MAINTENANCE.md` with today's date as "Last Reviewed".
4. Run `npm run validate`.

## Adding a Skill

Skills live in `skills/<name>/SKILL.md` with YAML frontmatter.

### Required frontmatter fields

```yaml
---
description: One sentence — when Claude invokes this skill.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
when_to_use: Condition that triggers automatic invocation.
---
```

### Optional frontmatter fields

```yaml
---
name: my-skill                    # defaults to the folder name if omitted
model: claude-sonnet-5            # overrides the default model for this skill's run
effort: medium                    # low | medium | high | xhigh | max
argument-hint: "[task or target]" # shown in autocomplete for manual invocation, e.g. /my-skill [task]
disable-model-invocation: true    # skill never auto-fires from context; only runs via explicit /my-skill invocation
---
```

`disable-model-invocation` and `model` are independent: the former controls *whether* the skill can trigger automatically, the latter controls *which model* runs it once triggered (manually or automatically). Manual-only skills (`smart-task`, `plan-first`, `safe-review`, `release-gate`) set both together — `disable-model-invocation: true` to require explicit invocation, plus a `model:` for when that explicit invocation happens.

Keep the body under 20 non-blank lines. Longer content belongs in `agent_docs/`.

Add a row for your skill in `SKILLS-MAINTENANCE.md` with today's date as "Last Reviewed".

Run `npm run validate` after adding — it checks frontmatter and body length.

## Adding a Rule

Rules live in `rules/<NNN>-<name>.md` and are auto-loaded by Claude Code when a file matches the rule's `glob` pattern (set in the frontmatter `glob:` field, or always-on if omitted).

Follow the numbering convention:

| Range | Domain |
| --- | --- |
| 000–099 | Always-on (no glob) |
| 100–199 | Web / frontend |
| 200–299 | API / backend |
| 300–399 | Testing |
| 400–499 | Mobile |
| 500–599 | Database |
| 600–699 | DevOps / infrastructure |
| 700–799 | Observability |
| 800–899 | LLM / AI safety |
| 900–999 | Performance |

## Updating the Maintenance Tables

**Any PR that modifies a preset, rule, agent, skill, or command must update the "Last Reviewed" date** for that item in its maintenance table: `PRESET-MAINTENANCE.md`, `RULES-MAINTENANCE.md`, `AGENTS-MAINTENANCE.md`, `SKILLS-MAINTENANCE.md`, or `COMMANDS-MAINTENANCE.md`. The `npm run stale-check` script and CI will fail if an item is listed without a date, if the date is malformed, or if an item on disk isn't tracked in its table.

If you add a new item, add a new row. If you remove an item, remove its row.

## Running Checks Locally

```bash
npm test            # unit + integration tests
npm run validate    # skill frontmatter, agent cross-refs, settings.json, presets
npm run stale-check # *-MAINTENANCE.md date freshness + untracked-item detection
npm run link-check  # internal markdown links resolve to real files
npm run check       # all four in sequence
```

All checks must pass before a PR can be merged.

## Pull Request Checklist

- [ ] `npm run check` passes locally
- [ ] The relevant `*-MAINTENANCE.md` table updated for any modified preset/rule/agent/skill/command
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `README.md` updated if the PR adds a new preset, agent, skill, or command
- [ ] No hardcoded hex colours, raw Tailwind values, or paid dependency recommendations in presets
- [ ] No secrets, tokens, or PII in any committed file
