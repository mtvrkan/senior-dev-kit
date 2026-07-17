# Senior Dev Kit — Extending the Kit

How to add your own agents, skills, rules, presets, and commands.

---

## Overview

The kit is fully modular. Every component is a plain Markdown file with a YAML frontmatter block. Adding a new component means:

1. Create a new `.md` file following the template
2. Place it in the correct folder
3. Run `npm run validate` to confirm it passes

No build step, no registry, no configuration file to update.

---

## Adding a new skill

Skills define the behavior Claude follows when invoked via `/skill-name` or detected by context.

### Template

Copy `skills/bug-fix/SKILL.md` and modify:

```yaml
---
description: One-sentence summary shown in /agents-guide
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: When the user asks to [do X] or says [Y / Z]  # recommended, not required — validator only warns if omitted
model: sonnet                     # optional — overrides default model for this skill's run (alias preferred; full ID for deliberate pinning)
effort: medium                    # optional — low | medium | high (xhigh/max rejected by the validator — see CONTRIBUTING.md)
argument-hint: "[task or target]" # optional — shown in autocomplete, e.g. /my-skill [task]
disable-model-invocation: true    # optional — skill only runs via explicit /my-skill, never auto-fires from context
context: fork                     # optional — isolate a long/noisy run into its own context; requires agent:
agent: my-agent                   # optional — target agents/<name>.md for context: fork; validator checks it exists
---

## Behavior

[Short description of what this skill does]

## Steps

1. [First thing to do]
2. [Second thing to do]
3. [Verify / test step]

## Output format

[What Claude should output — e.g. PLAN → approval → apply, or direct apply]
```

### Placement

```text
skills/
└── my-skill/
    └── SKILL.md
```

### Naming rules

- Folder name = kebab-case slug (e.g. `api-design`, `db-restore`)
- No spaces, no uppercase
- One `SKILL.md` per folder

### allowed-tools field

| Skill type | Tools to include |
| --- | --- |
| Read-only audit / review | `Read, Grep, Glob, Bash` |
| Analysis + writing | `Read, Grep, Glob, Bash, Edit, Write` |
| File creation | `Read, Grep, Glob, Bash, Edit, Write` |

Never include `Edit` or `Write` in review-only skills (security-review, migration-review, etc.).

### Validate

```bash
npm run validate
```

---

## Adding a new agent

Agents are specialized Claude personas that take over when a task matches their domain.

### Template

Copy any existing agent file (e.g. `agents/docs-writer.md`) and modify:

```yaml
---
name: my-agent
description: >
  Short description of what this agent does.
  When to route to it. Used for display and routing.
model: sonnet                 # haiku=fast/cheap | sonnet=default | opus=complex/guard
permissionMode: default       # use "plan" for guard agents (db-guard, security-guard, etc.)
effort: medium                # low | medium | high (xhigh/max rejected by the validator)
color: blue                   # blue | green | red | yellow | purple | orange | pink | cyan
maxTurns: 10                  # cap agentic loops; guard agents typically 5, workers 10-20
tools: Read, Grep, Glob, Bash, Edit, Write
skills:
  - feature-build
  - bug-fix
---
```

`skills:` is a hint, not a hard allowlist — it's the primary set surfaced to the router and to `/agents-guide`. The agent isn't blocked from invoking any other skill in `skills/` when the task calls for it.

```markdown
## Role

[What this agent's focus is]

## Hard constraints

- NEVER [forbidden action]
- ALWAYS [required behavior]
- Escalate to [other-agent] if [condition]

## Behavior

[How this agent approaches tasks]

## Output format

[What the output should look like — terse, plan-first, etc.]
```

### Placement

```text
agents/
└── my-agent.md
```

### Model selection

Use the generic alias — it tracks Anthropic's current snapshot for that tier instead of pinning a dated ID that goes stale. Use a full dated ID only for deliberate pinning (leave a `# pinned` comment).

| Task type | Model |
| --- | --- |
| Quick UI fixes, docs | `haiku` |
| Implementation, bug fixes | `sonnet` |
| Architecture, security, planning | `opus` |

### Guard agents (plan-only)

If your agent should present a plan and wait for approval before acting, add:

```yaml
permissionMode: plan
```

Use this for agents that touch auth, DB schema, payments, CI/CD, or any destructive operation.

### Register in ROUTING.md (optional)

If you want the agent listed in `/agents-guide`, add a row to `agents/ROUTING.md`:

```markdown
| my-agent | When user [signal] | sonnet |
```

---

## Adding a new rule

Rules are path-scoped guidelines that Claude loads automatically when editing matching files.

### Template

```markdown
## [Rule topic]

[Guidelines for this domain]

### Pattern to check

| Check | What to look for |
|---|---|
| [check name] | [what constitutes a violation] |

### Required / preferred pattern

\`\`\`language
// preferred:
[good example]

// avoid:
[bad example]
\`\`\`
```

### Placement and naming

```text
rules/
└── NNN-topic.md
```

Use the next available number:

- 000–099: Always-active (loaded for every file)
- 100–199: Web / frontend
- 200–299: API / backend
- 300–399: Testing
- 400–499: Mobile
- 500–599: Database
- 600–699: DevOps
- 700–799: Observability
- 800–899: AI/LLM safety
- 900–999: Performance

### Path scoping

Claude Code natively lazy-loads rules via the frontmatter `paths:` field (a YAML list of glob patterns). A path-scoped rule is injected only when Claude reads a file matching one of the patterns — not at session start:

```yaml
---
description: "Go service rules — what it covers, when it loads."
paths:
  - "**/*.go"
  - "**/cmd/**"
---
```

Do NOT use Cursor's `globs:` or `alwaysApply:` keys — Claude Code doesn't recognize them, and a rule without a valid `paths:` field loads unconditionally in every session. Use the 000–099 range (no `paths:` field) only for rules that genuinely must always be active.

---

## Adding a new preset

Presets are stack-specific rule sets installed into projects.

### Required files

Every preset folder needs exactly two files:

```text
presets/[category]/[stack-name]/
├── CLAUDE.md    ← Full version (complete rules for the stack)
└── compact.md   ← Summary version (≤ 15 lines, used in stack-rules.md)
```

### Category placement

| Your stack | Category folder |
| --- | --- |
| React, Vue, Angular, Next.js, Svelte, Astro | `web/` |
| NestJS, Express, FastAPI, Django, Go, Rails | `backend/` |
| Flutter, Android, iOS, React Native | `mobile/` |
| PostgreSQL, MySQL, SQLite, MongoDB, Redis | `database/` |
| Prisma, Drizzle, TypeORM, SQLAlchemy | `orm/` |
| Docker, Kubernetes, Terraform | `infrastructure/` |
| BullMQ, Kafka, RabbitMQ | `messaging/` |
| tRPC, GraphQL, WebSocket | `api/` |
| Bun, Deno | `runtime/` |
| LLM, RAG, agents | `ai/` |

> **Rule: never place `CLAUDE.md` directly inside a category folder.** Always nest it one level deeper inside a named preset subfolder (e.g. `presets/generic/fallback/CLAUDE.md`, not `presets/generic/CLAUDE.md`). The preset validator (`findPresetDirs`) stops recursing when it finds a `CLAUDE.md`, so a category-level file silently prevents any sibling presets in that category from being discovered or validated.

### CLAUDE.md structure

```markdown
# [Stack Name] — Claude Rules

## Stack context
- Framework version: [X.Y]
- Language: [TypeScript / Python / Go / etc.]
- Package manager: [npm / pip / go mod / etc.]

## Architecture
[How code is structured in this stack — folder layout, layer names]

## Commands
- TEST_CMD: [how to run tests]
- LINT_CMD: [how to lint]
- BUILD_CMD: [how to build]
- TYPE_CMD: [type checking command]

## Patterns
[Idiomatic patterns for this stack]

## Protected files
[Files that require escalation before touching]

## Anti-patterns (never generate)
[What NOT to do in this stack]
```

### compact.md structure (≤ 15 lines)

```markdown
## [Stack Name]
- [Key constraint 1]
- [Key constraint 2]
- TEST: [test command] | LINT: [lint cmd] | BUILD: [build cmd]
- Protected: [list of protected paths]
```

### Validate

The preset validator checks that `CLAUDE.md` contains non-trivial content (> 200 characters). Run after adding:

```bash
npm run validate
```

---

## Adding a new slash command

Commands are invoked by typing `/command-name` in Claude Code.

> **When to add a command vs a skill:** Add a **skill** (`skills/*/SKILL.md`) when you need model selection, effort control, tool restrictions, or automatic context-based triggering — skills use the full SKILL.md frontmatter system. Add a **command** (`commands/*.md`) for simpler, always-explicit invocations where you just need a markdown prompt injected into context with no metadata overhead. In practice: new task types → skill; new slash-command shortcuts that wrap a fixed prompt → command.

### Template

Commands are plain markdown prompt files — no YAML frontmatter (that's what distinguishes them
from skills). Start with a `# /command-name` heading, then the instructions to inject into
context when the command is invoked:

```markdown
# /my-command

One-sentence description of what this command does: $ARGUMENTS

[Steps the agent should follow, in order]

Output:
[What the final output should look like]
```

`$ARGUMENTS` is replaced with whatever the user typed after the command name.

### Placement

```text
commands/
└── my-command.md
```

The filename (without `.md`) becomes the slash command name. `my-command.md` → `/my-command`.

Add a row for your command in `COMMANDS-MAINTENANCE.md` with today's date as "Last Reviewed".

---

## Adding project-specific secret patterns

`settings-template.json`'s `permissions.deny` list (copied to `.claude/settings.json` during
setup — see [SECURITY.md](SECURITY.md)) only covers a fixed set of conventional secret
filenames (`.env`, `*.pem`, `id_rsa*`, `*serviceaccount*.json`, and similar). It does **not**
know about your project's own non-standard secret files — a custom-named credentials file
(`app-secrets.toml`, `.mycorp-token`, `credentials.yaml`), a proprietary key format, or a
config file that happens to hold real secrets under a name the kit has no way to anticipate.
Add your own `Read`/`Bash`/`PowerShell` deny entries for those, the same shape as the kit's own:

```json
"Read(./**/app-secrets.toml)",
"Bash(cat *app-secrets.toml)",
"Bash(base64 *app-secrets.toml)",
"PowerShell(Get-Content *app-secrets.toml)"
```

Add both a `Read(...)` rule (blocks the Read tool, and — per this repo's own verified
behavior, see `SECURITY.md`'s "cross-tool interception" note — also blocks the recognized
Bash file-read commands like `cat`/`head`/`tail`) and a matching `Bash(base64 ...)` +
`PowerShell(Get-Content ...)` pair (the one read verb the `Read(...)` rule doesn't reach).
Verify your additions actually fire with `npm run deny-cost` before relying on them — it
replays your own transcript history against the current deny list and reports what would
have matched, so you're checking real behavior, not the rule's shape.

---

## Keeping custom extensions upgrade-safe

When you upgrade the kit (new version released), your custom extensions in `agents/`, `skills/`, `commands/`, and `rules/` with names not in the kit will not be overwritten — the upgrade scripts only overwrite kit-managed files.

To clearly mark your custom additions:

```text
agents/
├── [kit agents...]
└── custom-my-agent.md   ← prefix with "custom-" to distinguish from kit agents
```

Or keep them in a separate folder that you merge in:

```bash
# Store your custom extensions outside the kit repo
your-extensions/
├── agents/
├── skills/
└── rules/
```

Then copy after each kit upgrade:

```bash
cp your-extensions/agents/* .claude/agents/
cp -r your-extensions/skills/* .claude/skills/
cp your-extensions/rules/* .claude/rules/
```

---

## Validating all extensions

After any addition:

```bash
npm run validate
```

This checks:

- All `SKILL.md` files have required frontmatter (`description`, `allowed-tools`)
- All agent skill references point to existing skill directories
- All preset `CLAUDE.md` files have non-trivial content

CI runs this on every push (`repo-ci.yml`).
