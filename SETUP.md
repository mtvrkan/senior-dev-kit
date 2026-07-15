# Senior Dev Kit — Setup Instructions

Read this file and apply all steps sequentially. Do not ask questions and proceed.

**Definitions:**

- **KIT** = Full path of the folder where this file (SETUP.md) is located
- **PROJECT** = Current project root where Claude Code is open (current working directory)

KIT ≠ PROJECT. KIT is this folder, PROJECT is a separate project.

---

## What this kit sets up

Sets up in PROJECT:

- 14 subagent files + `ROUTING.md` (15 files total) → `PROJECT/.claude/agents/`
- 32 skill directories → `PROJECT/.claude/skills/`
- 11 slash command files → `PROJECT/.claude/commands/`
- Security rules → `PROJECT/.claude/settings.json`
- Full stack rules → `PROJECT/.claude/stack-rules.md`
- Compact routing file → `PROJECT/CLAUDE.md`

Global setup (`~/.claude/` — once, for all projects):

- 11 path-scoped rules → `~/.claude/rules/`
- 15 lazy-load agent docs → `~/.claude/agent_docs/`
- Global CLAUDE.md → `~/.claude/CLAUDE.md`
- Protected-paths hook → `~/.claude/hooks/`, wired into `~/.claude/settings.json` (the kit's
  only harness-enforced guardrail — everything else here is prompt discipline)

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
| `bun.lockb` exists or `package.json` → `"packageManager": "bun@*"` | `runtime/bun` |
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

Create `PROJECT/.claude/agents/` directory. Read the following 14 agent files from `KIT/agents/` and write to `PROJECT/.claude/agents/`:

```text
architect.md, bug-hunter.md, db-guard.md,
devops-guard.md, docs-writer.md, migration-guard.md,
performance-guard.md, researcher.md, reviewer.md,
security-guard.md, security-scanner.md, senior-engineer.md,
test-engineer.md, ui-fixer.md
```

Also copy `KIT/agents/ROUTING.md` to `PROJECT/.claude/agents/ROUTING.md` — it is a routing reference, not an agent, so `PROJECT/.claude/agents/` ends up with 15 files total (14 agents + ROUTING.md).

### 2b — Copy skill directories

Create `PROJECT/.claude/skills/` directory. Read the following 32 subdirectories from `KIT/skills/` and write to `PROJECT/.claude/skills/` (each subdirectory contains `SKILL.md`):

```text
api-design, api-versioning, bug-fix,
code-audit, code-review, codebase-overview, data-modeling, db-change, deep-research, dep-check,
docs-update, env-audit, feature-build, feature-plan, from-scratch,
kit-doctor, llm-integration, migration-review, monorepo-task, new-page,
new-screen, performance-check, plan-first, refactor-safe, release-check,
release-gate, safe-review, security-review, security-scan, smart-task,
test-writer, ui-change
```

### 2c — Copy command files

Create `PROJECT/.claude/commands/` directory. Read the following 11 files from `KIT/commands/` and write:

```text
agents-guide.md, deep-research.md, dep-check.md,
kit-doctor.md, performance-check.md, plan-first.md, release-gate.md,
safe-review.md, security-scan.md, seo-check.md, smart-task.md
```

### 2d — Copy settings.json

Read `KIT/settings-template.json` (the canonical template — `KIT/settings.json` is the kit's own dev/CI config, not for copying into a consumer project).
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

Create `PROJECT/.claude/agent_docs/` directory. Read the following 15 files from `KIT/agent_docs/` and write:

```text
architecture.md, api-design-patterns.md, api-versioning-guide.md,
design-system.md, dep-check-guide.md, devops-security-guide.md, env-audit-guide.md,
error-handling-patterns.md, from-scratch-guide.md, new-page-guide.md,
new-screen-guide.md, security-protocols.md, seo-patterns.md,
testing-strategy.md, zero-downtime-migration.md
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
| Migration, data movement | High/Critical | migration-guard |
| Auth, payment, permissions, session | High/Critical | security-guard |
| Security scan | High | security-scanner |
| Performance issue, N+1, bundle | Medium/High | performance-guard |
| Documentation | Low | docs-writer |

## Escalation

- ui-fixer → senior-engineer (if touches DB/auth/payment)
- bug-hunter → security-guard (if finds security vulnerability)
- senior-engineer → architect (if requires architecture decision)
- db-guard / migration-guard → STOP + report (on destructive change)
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
- **If exists and contains `Global Claude Senior Protocol v3`:** Current, skip.
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

Create `~/.claude/agent_docs/` directory (if missing). Read the 15 files from `KIT/agent_docs/` and write:

```text
architecture.md, api-design-patterns.md, api-versioning-guide.md,
design-system.md, dep-check-guide.md, devops-security-guide.md, env-audit-guide.md,
error-handling-patterns.md, from-scratch-guide.md, new-page-guide.md,
new-screen-guide.md, security-protocols.md, seo-patterns.md,
testing-strategy.md, zero-downtime-migration.md
```

These files are read by agents when needed — not loaded every session.

### 5d — Global settings.json

Source file: `KIT/settings-template.json` (`KIT/settings.json` is the kit's own dev/CI config — do not copy it directly).
If `~/.claude/settings.json` does not exist: write the template as-is.
If it exists: read its content. If its `permissions.deny` list is missing or incomplete, append the template's deny entries (don't remove existing entries); leave `permissions.allow` and any other existing keys untouched.

Environment variable suggestion (add to shell profile):

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=haiku  # default for anonymous Agent() calls; named agents use their own model: field
```

### 5e — Wire the protected-paths hook (deterministic enforcement)

Create `~/.claude/hooks/` directory (if missing). Read `KIT/hooks/protected-paths.mjs` and write
it there.

This hook is the kit's only harness-enforced guardrail — edits into auth/payment/DB
migrations/secrets/CI/IaC paths get intercepted regardless of what the model decides.
Everything else in the kit (agent routing, hard stops, escalation) is prompt discipline the
model follows voluntarily. Wire the hook into `~/.claude/settings.json` under `hooks.PreToolUse`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "node \"<absolute path to home>/.claude/hooks/protected-paths.mjs\"" }
        ]
      }
    ]
  }
}
```

Use the real absolute home-directory path — do not write the literal placeholder. Before adding
this entry, check whether `hooks.PreToolUse` already has one whose `command` contains
`protected-paths.mjs`; if so, leave it as-is instead of adding a duplicate. Merge into any
existing `hooks` key rather than overwriting it — the same rule as 5d's `permissions.deny` merge.

---

## Step 6 — When done, report

Provide a brief summary containing:

- Detected stack and selected presets
- Installed file counts: `[14 agents, 32 skills, 11 commands, 11 rules, 15 agent_docs]`
- If monorepo: how many subproject CLAUDE.md created
- If security templates installed: pre-commit enable command
- Protected-paths hook: wired (or why not — missing `node`, or already present)
- First use: open project in Claude Code, converse normally — routing is prompt discipline, not
  harness-enforced (the protected-paths hook is the one exception)
- Slash command reminder: `/smart-task`, `/plan-first`, `/safe-review`, `/security-scan`, `/dep-check`, `/performance-check`, `/seo-check`
- To verify: read `KIT/VERIFY.md` and validate setup
