# Senior Dev Kit — Setup Instructions

Read this file and apply all steps sequentially. Do not ask questions and proceed.

**Definitions:**

- **KIT** = Full path of the folder where this file (SETUP.md) is located
- **PROJECT** = Current project root where Claude Code is open (current working directory)

KIT ≠ PROJECT. KIT is this folder, PROJECT is a separate project.

---

## What this kit sets up

Sets up in PROJECT:

- 12 subagent files + `ROUTING.md` (13 files total) → `PROJECT/.claude/agents/`
- 25 skill directories → `PROJECT/.claude/skills/`
- 2 slash command files → `PROJECT/.claude/commands/`
- Security rules → `PROJECT/.claude/settings.json`
- Full stack rules → `PROJECT/.claude/stack-rules.md`
- Compact routing file → `PROJECT/CLAUDE.md`

Global setup (`~/.claude/` — once, for all projects):

- 11 path-scoped rules → `~/.claude/rules/`
- 16 lazy-load agent docs → `~/.claude/agent_docs/`
- Global CLAUDE.md → `~/.claude/CLAUDE.md`

Project security templates (optional, for projects using CI/CD):

- `KIT/security/` → `PROJECT/` (pre-commit, gitleaks, semgrep, GitHub Actions)

---

## Step 1 — Detect stack

Read these files in PROJECT root (if present): `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pubspec.yaml`, `composer.json`, `Gemfile`, `.env`, `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`

Select matching presets — check each row sequentially, multiple can match:

**Web / Frontend:**

| Condition | Preset |
| --- | --- |
| `package.json` → `"next"` | `web/nextjs-saas` |
| `package.json` → `"@angular/core"` | `web/angular` |
| `package.json` → `"react"` and no `"next"` and no `"@angular/core"` | `web/react-vite` |
| `package.json` → `"vue"` or `"nuxt"` | `web/vue-nuxt` |
| `package.json` → `"svelte"` or `"@sveltejs/kit"` | `web/sveltekit` |

**Backend:**

| Condition | Preset |
| --- | --- |
| `package.json` → `"@nestjs/core"` | `backend/nestjs` |
| `package.json` → `"express"` or `"fastify"` or `"hono"` | `backend/node-express` |
| `requirements.txt` or `pyproject.toml` → `fastapi` | `backend/fastapi` |
| `requirements.txt` or `pyproject.toml` → `django` | `backend/django` |
| `requirements.txt` or `pyproject.toml` → `flask` | `backend/flask` |
| `Cargo.toml` exists | `backend/rust-api` |
| `go.mod` exists | `backend/go-api` |
| `composer.json` → `"laravel/framework"` | `backend/laravel` |
| `Gemfile` → `rails` | `backend/rails` |
| `*.csproj` or `*.sln` exists | `backend/dotnet-api` |
| `pom.xml` exists or `build.gradle` → `spring-boot` | `backend/java-spring` |

**ORM / Data:**

| Condition | Preset |
| --- | --- |
| `*.prisma` file exists | `orm/prisma` |
| `package.json` → `"drizzle-orm"` | `orm/drizzle` |
| `package.json` → `"typeorm"` | `orm/typeorm` |
| `package.json` → `"sequelize"` | `orm/sequelize` |
| `package.json` → `"mongoose"` | `orm/mongoose` |
| `requirements.txt` or `pyproject.toml` → `sqlalchemy` | `orm/sqlalchemy` |

**Database:**

| Condition | Preset |
| --- | --- |
| `.env` → `postgresql://` or `DATABASE_URL=postgres` | `database/postgres` |
| `.env` → `mysql://` or `MYSQL_` or `DATABASE_URL=mysql` | `database/mysql` |
| `.env` → `mongodb://` or `MONGODB_URI` | `database/mongodb` |
| `.env` → `redis://` or `REDIS_URL` | `database/redis` |
| `package.json` → `"@supabase/supabase-js"` or `.env` → `SUPABASE_URL` | `database/supabase` |
| `package.json` → `"firebase"` or `"firebase-admin"` or `.env` → `FIREBASE_` | `database/firebase` |
| `package.json` → `"better-sqlite3"` or `"sqlite3"` or `"libsql"` | `database/sqlite` |

**Mobile:**

| Condition | Preset |
| --- | --- |
| `pubspec.yaml` exists | `mobile/flutter` |
| `app/build.gradle` exists or `build.gradle` → `com.android.application` | `mobile/kotlin-android` |
| `*.xcodeproj` or `Package.swift` exists | `mobile/swift-ios` |
| `package.json` → `"expo"` or `expo.json` or `app.json` → `"expo"` | `mobile/react-native` |

**Runtime:**

| Condition | Preset |
| --- | --- |
| `bun.lock` (text, Bun 1.2+) or `bun.lockb` (legacy) exists, or `package.json` → `"packageManager": "bun@*"` | `runtime/bun` |
| `deno.json` or `deno.jsonc` exists | `runtime/deno` |
| `wrangler.toml` exists or `package.json` → `"wrangler"` | `runtime/cloudflare-workers` |

**Monorepo / Generic:**

| Condition | Preset |
| --- | --- |
| `pnpm-workspace.yaml` or `turbo.json` or `lerna.json` exists | `generic/monorepo` |
| None match | `generic/fallback` |

Multiple presets can be selected. Write selected ones on one line, proceed.
If `KIT/presets/[PRESET]/` folder does not exist, skip that preset and add `generic/fallback`.

---

## Step 1b — Monorepo subproject detection (only if `generic/monorepo` selected)

Read `pnpm-workspace.yaml`, `turbo.json`, `workspaces` field in `package.json`.
List subprojects under `apps/`, `services/`, `packages/`.

For each subproject:

1. Read that subproject's `package.json` → Apply matching rule from Step 1
2. Note the detected preset

Use this list in Step 4b. Now proceed to Step 2.

---

## Step 2 — Set up .claude/ directory

### 2a — Copy agent files

Create `PROJECT/.claude/agents/` directory. Read the following 12 agent files from `KIT/agents/` and write to `PROJECT/.claude/agents/`:

```text
architect.md, bug-hunter.md, db-guard.md,
devops-guard.md, docs-writer.md,
performance-guard.md, researcher.md, reviewer.md,
security-guard.md, senior-engineer.md,
test-engineer.md, ui-fixer.md
```

Also copy `KIT/agents/ROUTING.md` to `PROJECT/.claude/agents/ROUTING.md` — it is a routing reference, not an agent, so `PROJECT/.claude/agents/` ends up with 13 files total (12 agents + ROUTING.md).

### 2b — Copy skill directories

Create `PROJECT/.claude/skills/` directory. Read the following 25 subdirectories from `KIT/skills/` and write to `PROJECT/.claude/skills/` (each subdirectory contains `SKILL.md`):

```text
api-design, bug-fix,
code-audit, code-review, codebase-overview, db-change, deep-research,
docs-update, env-audit, feature-build, feature-plan, from-scratch,
incident-response, kit-doctor, migration-review, new-page,
new-screen, performance-check, project-memory, refactor-safe,
release-gate, security-review, security-scan,
test-writer, ui-change
```

### 2c — Copy command files

Create `PROJECT/.claude/commands/` directory. Read the following 2 files from `KIT/commands/` and write:

```text
agents-guide.md, seo-check.md
```

### 2d — Copy settings.json

Read `KIT/settings-template.json` (the canonical template to copy into a consumer project — the kit's own dev config lives in `KIT/.claude/settings.json`, which is not for copying).
If `PROJECT/.claude/settings.json` does not exist: write it.
If it exists: merge field-by-field — keep the project's existing `permissions.allow` entries, but replace `permissions.deny` with the template's values (it encodes a security baseline that should not be weakened).

### 2e — Copy rules files

Create `PROJECT/.claude/rules/` directory. Read the following 11 files from `KIT/rules/` and write:

```text
000-security.md, 001-conventions.md, 100-web.md, 200-api.md,
300-testing.md, 400-mobile.md, 500-database.md, 600-devops.md,
700-observability.md, 800-llm-safety.md, 900-performance.md
```

### 2f — Copy agent docs files

Create `PROJECT/.claude/agent_docs/` directory. Read the following 16 files from `KIT/agent_docs/` and write:

```text
architecture.md, api-design-patterns.md, api-versioning-guide.md,
design-system.md, dep-check-guide.md, devops-security-guide.md, env-audit-guide.md,
error-handling-patterns.md, from-scratch-guide.md, new-page-guide.md,
new-screen-guide.md, security-protocols.md, seo-patterns.md,
stack-commands.md, testing-strategy.md, zero-downtime-migration.md
```

### 2g — Security templates (optional — if CI/CD present)

If project contains `.github/` directory or Dockerfile:

```text
KIT/security/.pre-commit-config.yaml   → PROJECT/.pre-commit-config.yaml
KIT/security/.gitleaks.toml            → PROJECT/.gitleaks.toml
KIT/security/.semgrep.yml              → PROJECT/.semgrep.yml
KIT/security/dependabot.yml            → PROJECT/.github/dependabot.yml
KIT/security/workflows/security-gate.yml     → PROJECT/.github/workflows/security-gate.yml
KIT/security/workflows/dependency-audit.yml  → PROJECT/.github/workflows/dependency-audit.yml
KIT/security/workflows/container-scan.yml    → PROJECT/.github/workflows/container-scan.yml
```

To enable pre-commit: `pip install pre-commit && pre-commit install`
To create secrets baseline: `detect-secrets scan > .secrets.baseline`

---

## Step 3 — Create .claude/stack-rules.md

For each preset selected in Step 1, read `KIT/presets/[PRESET]/CLAUDE.md`.
Combine all and write as `PROJECT/.claude/stack-rules.md`:

```text
# Stack Rules

## preset: web/nextjs-saas
[CLAUDE.md content here]

## preset: orm/prisma
[CLAUDE.md content here]
```

---

## Step 4 — Create root CLAUDE.md

Create `PROJECT/CLAUDE.md`.
If exists and contains `<!-- CLAUDE_CUSTOM_START -->...<!-- CLAUDE_CUSTOM_END -->` block: preserve it, refresh the rest.

Use the following template — fill `[...]` fields with actual values:

```markdown
# [Last part of PROJECT folder name] — Claude Instructions

Stack: [Presets selected in Step 1, comma-separated]

## Context reading order

1. This file (always)
2. `.claude/stack-rules.md` (stack rules — only when stack-specific rule needed)
3. Source files (only those directly related to task)

**Never read:** `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `.git/`, `*.lock`

## Token budget

| Risk | File read | Commands | Action |
|---|---|---|---|
| Low | max 3 | max 1 | Apply directly |
| Medium | max 8 | max 2 | Present summary, apply |
| High | Unlimited | Unlimited | Present plan, get approval |

## Done-fast rule

UI text, color, padding, single-line fix → skip routing, apply directly.

## Agent routing table

| Task | Risk | Agent |
|---|---|---|
| Modal, button, CSS, layout, responsive | Low | ui-fixer |
| Console/runtime error, test fail | Low/Medium | bug-hunter |
| Normal feature, refactor | Medium | senior-engineer |
| Large feature, architecture decision | High | architect |
| Add or update tests | Medium | test-engineer |
| Diff/PR review | Medium | reviewer |
| DB schema, model, index | High | db-guard |
| Migration, data movement | High/Critical | db-guard |
| Auth, payment, permissions, session | High/Critical | security-guard |
| Security scan | High | security-guard |
| Performance issue, N+1, bundle | Medium/High | performance-guard |
| Documentation | Low | docs-writer |

## Escalation

- ui-fixer → senior-engineer (if touches DB/auth/payment)
- bug-hunter → security-guard (if finds security vulnerability)
- senior-engineer → architect (if requires architecture decision)
- db-guard → STOP + report (on destructive change)
- Every agent: if out of scope, stop and escalate

## Stack rules (summary)

[For each selected preset, read KIT/presets/[PRESET]/compact.md and add here]
[Format:]

### [preset name]
[compact.md content — copy as-is]

Full rules: `.claude/stack-rules.md`
```

---

## Step 4b — Monorepo: subproject CLAUDE.md (only if `generic/monorepo` selected)

For each subproject detected in Step 1b:

1. Create `[PROJECT]/[subproject-path]/CLAUDE.md`:

   ```text
   # [subproject name] — Claude Instructions
   
   Stack: [that subproject's preset]
   
   Root rules: `../../CLAUDE.md` (or correct relative path to root)
   Stack rules: `../../.claude/stack-rules.md`
   
   This workspace specific: [subproject package name and purpose]
   Workspace boundary: only modify files from this workspace.
   ```

2. For helper packages under `packages/`: do not create CLAUDE.md — only for `apps/` and `services/`.

---

## Step 5 — Global setup (~/.claude/)

This step applies to all projects since it is done once.

### 5a — Global CLAUDE.md

Check `~/.claude/CLAUDE.md` (macOS/Linux) or `%USERPROFILE%\.claude\CLAUDE.md` (Windows).

- **If missing:** Read `KIT/global-CLAUDE.md` and write to that location.
- **If exists and contains `Global Claude Senior Protocol`:** Current, skip.
- **If exists but different content:** Ask user — "Should global CLAUDE.md be overwritten?"

### 5b — Path-scoped rules

Create `~/.claude/rules/` directory (if missing). Read the 11 files from `KIT/rules/` and write:

```text
000-security.md, 001-conventions.md, 100-web.md, 200-api.md,
300-testing.md, 400-mobile.md, 500-database.md, 600-devops.md,
700-observability.md, 800-llm-safety.md, 900-performance.md
```

If exist, overwrite (for current versions).

### 5c — Agent documentation (lazy-load)

Create `~/.claude/agent_docs/` directory (if missing). Read the 16 files from `KIT/agent_docs/` and write:

```text
architecture.md, api-design-patterns.md, api-versioning-guide.md,
design-system.md, dep-check-guide.md, devops-security-guide.md, env-audit-guide.md,
error-handling-patterns.md, from-scratch-guide.md, new-page-guide.md,
new-screen-guide.md, security-protocols.md, seo-patterns.md,
stack-commands.md, testing-strategy.md, zero-downtime-migration.md
```

These files are read by agents when needed — not loaded every session.

### 5d — Global settings.json

Source file: `KIT/settings-template.json` (the canonical template — the kit's own dev config in `KIT/.claude/settings.json` is not for copying).
If `~/.claude/settings.json` does not exist: write the template as-is.
If it exists: read its content. If its `permissions.deny` list is missing or incomplete, append the template's deny entries (don't remove existing entries); leave `permissions.allow` and any other existing keys untouched.

Do not set `CLAUDE_CODE_SUBAGENT_MODEL` in the shell profile. It overrides every subagent's
model — including named agents' own `model:` frontmatter, since it takes precedence over it in
Claude Code's model-resolution order. Setting it globally silently downgrades opus-tier guard
agents (architect, db-guard, security-guard, devops-guard) to whatever cheaper
model it names. For cost control on genuinely anonymous exploration calls, pass `model` explicitly
per `Agent()` call instead.

---

## Step 6 — Verify installation

Perform each check below in order. Report results as [OK] / [FAIL] before moving to Step 7.

### 6a — Required files

For each one: does it exist?

```text
PROJECT/CLAUDE.md
PROJECT/.claude/settings.json
PROJECT/.claude/agents/
PROJECT/.claude/skills/
PROJECT/.claude/commands/
PROJECT/.claude/rules/
PROJECT/.claude/stack-rules.md
```

### 6b — Component counts

Count files in each `PROJECT/.claude/` subdirectory:

| Directory | Expected count | Notes |
| --- | --- | --- |
| `agents/` | 13 | 12 agents + `ROUTING.md` (routing reference, not an agent) |
| `skills/` | 25 | `SKILL.md` files, one per subdirectory |
| `commands/` | 2 | `agents-guide.md`, `seo-check.md` |
| `rules/` | 11 | `000-security.md` through `900-performance.md` |
| `agent_docs/` (if copied) | 16 | see Step 2f list |

If any count is short, re-read the missing file(s) from `KIT/` and write them — do not guess which one is missing; diff the expected list above against what's on disk.

### 6c — CLAUDE.md quality

Read `PROJECT/CLAUDE.md`. Does it contain the sections Step 4's template actually produces:

- [ ] "Context reading order" section
- [ ] "Token budget" table
- [ ] "Agent routing table" section
- [ ] "Escalation" section
- [ ] "Stack rules (summary)" section

("TOKEN TIER" / "AGENT ROUTING" / "BOOT SEQUENCE" / "HARD STOPS" / "AUTO-TEST + VERIFICATION" are
`~/.claude/CLAUDE.md` sections from Step 5a, not `PROJECT/CLAUDE.md` — check those under 6g instead.)

### 6d — stack-rules.md content

Read `PROJECT/.claude/stack-rules.md`: not empty (at least 100 characters), contains a `## preset:` heading.

### 6e — Critical agent quality

`PROJECT/.claude/agents/security-guard.md`: `model: opus`, `permissionMode: plan`, HARD CONSTRAINTS section present.
`PROJECT/.claude/agents/devops-guard.md`: `model: opus`, `permissionMode: plan`.
`PROJECT/.claude/agents/ui-fixer.md`: `model: haiku`, HARD CONSTRAINTS section present.
`PROJECT/.claude/agents/senior-engineer.md`: `model: sonnet`.

### 6f — Skill allowed-tools correctness

Should be read-only (Edit/Write **should NOT** be included) — `allowed-tools: Read, Grep, Glob, Bash`:
`skills/security-review/SKILL.md`, `skills/migration-review/SKILL.md`, `skills/feature-plan/SKILL.md`, `skills/performance-check/SKILL.md`, `skills/release-gate/SKILL.md`.

### 6g — Global installation (if Step 5 was run)

- `~/.claude/CLAUDE.md` exists and contains "Global Claude Senior Protocol"
- `~/.claude/CLAUDE.md` contains "TOKEN TIER", "AGENT ROUTING", "BOOT SEQUENCE", "HARD STOPS", and
  "AUTO-TEST + VERIFICATION" section headings
- `~/.claude/rules/` — 11 files present
- `~/.claude/agent_docs/` — 16 files present
- `~/.claude/settings.json` — `CLAUDE_CODE_SUBAGENT_MODEL` env var **absent** (if present, it overrides every subagent's model, including named agents' own `model:` frontmatter, and should be removed)

If any global check fails: apply Step 5 again for the missing piece.

---

## Step 7 — When done, report

Provide a brief summary containing:

- Detected stack and selected presets
- Installed file counts: `[12 agents, 25 skills, 2 commands, 11 rules, 16 agent_docs]`
- Step 6 verification results — [OK] / [FAIL] per check, with fixes applied for any [FAIL]
- If monorepo: how many subproject CLAUDE.md created
- If security templates installed: pre-commit enable command
- First use: open project in Claude Code, converse normally — routing and protected-area
  escalation are prompt discipline; the deny rules in `settings.json` are the only
  harness-enforced backstop (Read-tool blocks + a narrow Bash/PowerShell read-verb list for top-tier secrets)
- Slash command reminder: `/agents-guide`, `/seo-check`, plus any skill invoked directly by name (`/security-scan`, `/performance-check`, `/feature-plan`, ...)
