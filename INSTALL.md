# Senior Dev Kit — Installation

> **Shortcut — automated install:** `bash install.sh` / `.\install.ps1` (or `npx senior-dev-kit`), optionally with `--detect` or `--preset=NAME`, performs the whole global install into `~/.claude/` — with backups and post-copy verification. Follow the manual steps below only when installing into a single project's `.claude/` directory or when you want to hand-pick components.

## Applying to a new project

### 1. Create directories

**Mac / Linux:**

```bash
mkdir -p .claude/agents .claude/skills .claude/commands .claude/rules .claude/agent_docs
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force .claude/agents, .claude/skills, .claude/commands, .claude/rules, .claude/agent_docs
```

---

### 2. Copy agent files

**Mac / Linux:**

```bash
cp senior-dev-kit/agents/* .claude/agents/
```

**Windows (PowerShell):**

```powershell
Copy-Item senior-dev-kit\agents\* .claude\agents\
```

---

### 3. Copy skill files

**Mac / Linux:**

```bash
cp -r senior-dev-kit/skills/* .claude/skills/
```

**Windows (PowerShell):**

```powershell
Copy-Item -Recurse senior-dev-kit\skills\* .claude\skills\
```

---

### 4. Copy command files

**Mac / Linux:**

```bash
cp senior-dev-kit/commands/* .claude/commands/
```

**Windows (PowerShell):**

```powershell
Copy-Item senior-dev-kit\commands\* .claude\commands\
```

---

### 5. Copy settings file

**Mac / Linux:**

```bash
cp senior-dev-kit/settings-template.json .claude/settings.json
```

**Windows (PowerShell):**

```powershell
Copy-Item senior-dev-kit\settings-template.json .claude\settings.json
```

> The template intentionally omits one thing the kit's reference `settings.json` sets: the `env` block with `"CLAUDE_CODE_SUBAGENT_MODEL": "haiku"` (cuts subagent research cost by ~75%). Add it to your copy if you want that default — the two files' roles are explained in [UPGRADE.md](UPGRADE.md).

---

### 6. Create CLAUDE.md and stack-rules

Use the `global-CLAUDE.md` file as a base and add project-specific sections:

**Mac / Linux:**

```bash
cp senior-dev-kit/global-CLAUDE.md CLAUDE.md
```

**Windows (PowerShell):**

```powershell
Copy-Item senior-dev-kit\global-CLAUDE.md CLAUDE.md
```

Then add the following to `CLAUDE.md`:

- Project description (stack, services, repo structure)
- Essential principles (economy rules, security requirements)
- Stack presets (select from the `presets/` directory according to your stack)
- Verification commands (lint, test, build — project-specific)

Keep `CLAUDE.md` short — full stack-specific guidance goes in `.claude/stack-rules.md` (combine the selected presets' `CLAUDE.md` content there), and `CLAUDE.md` just points at it. For the exact markdown template, see [SETUP.md Step 4](SETUP.md).

---

### 7. Copy rules files

**Mac / Linux:**

```bash
cp senior-dev-kit/rules/* .claude/rules/
```

**Windows (PowerShell):**

```powershell
Copy-Item senior-dev-kit\rules\* .claude\rules\
```

---

### 8. Copy agent docs files

**Mac / Linux:**

```bash
cp senior-dev-kit/agent_docs/* .claude/agent_docs/
```

**Windows (PowerShell):**

```powershell
Copy-Item senior-dev-kit\agent_docs\* .claude\agent_docs\
```

---

### 9. Create stack rules

Combine `compact.md` files into `.claude/stack-rules.md` according to your stack. You can add multiple presets:

**Mac / Linux:**

```bash
cat senior-dev-kit/presets/backend/nestjs/compact.md >> .claude/stack-rules.md
cat senior-dev-kit/presets/web/nextjs-saas/compact.md >> .claude/stack-rules.md
cat senior-dev-kit/presets/orm/prisma/compact.md >> .claude/stack-rules.md
cat senior-dev-kit/presets/database/postgres/compact.md >> .claude/stack-rules.md
# Add as many as you want...
```

**Windows (PowerShell):**

```powershell
Get-Content senior-dev-kit\presets\backend\nestjs\compact.md | Add-Content .claude\stack-rules.md
Get-Content senior-dev-kit\presets\web\nextjs-saas\compact.md | Add-Content .claude\stack-rules.md
Get-Content senior-dev-kit\presets\orm\prisma\compact.md | Add-Content .claude\stack-rules.md
Get-Content senior-dev-kit\presets\database\postgres\compact.md | Add-Content .claude\stack-rules.md
# Add as many as you want...
```

---

## File structure (final state)

```text
.claude/
  agents/                      (15 files: 14 agents + ROUTING.md)
    architect.md
    bug-hunter.md
    db-guard.md
    devops-guard.md
    docs-writer.md
    migration-guard.md
    performance-guard.md
    researcher.md
    reviewer.md
    ROUTING.md
    security-guard.md
    security-scanner.md
    senior-engineer.md
    test-engineer.md
    ui-fixer.md
  skills/                      (32 skills)
    api-design/SKILL.md
    api-versioning/SKILL.md
    bug-fix/SKILL.md
    code-audit/SKILL.md
    code-review/SKILL.md
    codebase-overview/SKILL.md
    data-modeling/SKILL.md
    db-change/SKILL.md
    deep-research/SKILL.md
    dep-check/SKILL.md
    docs-update/SKILL.md
    env-audit/SKILL.md
    feature-build/SKILL.md
    feature-plan/SKILL.md
    from-scratch/SKILL.md
    kit-doctor/SKILL.md
    llm-integration/SKILL.md
    migration-review/SKILL.md
    monorepo-task/SKILL.md
    new-page/SKILL.md
    new-screen/SKILL.md
    performance-check/SKILL.md
    plan-first/SKILL.md
    refactor-safe/SKILL.md
    release-check/SKILL.md
    release-gate/SKILL.md
    safe-review/SKILL.md
    security-review/SKILL.md
    security-scan/SKILL.md
    smart-task/SKILL.md
    test-writer/SKILL.md
    ui-change/SKILL.md
  commands/                    (11 slash commands)
    agents-guide.md
    deep-research.md
    dep-check.md
    kit-doctor.md
    performance-check.md
    plan-first.md
    release-gate.md
    safe-review.md
    security-scan.md
    seo-check.md
    smart-task.md
  rules/                       (11 path-scoped rules)
    000-security.md
    001-conventions.md
    100-web.md
    200-api.md
    300-testing.md
    400-mobile.md
    500-database.md
    600-devops.md
    700-observability.md
    800-llm-safety.md
    900-performance.md
  agent_docs/                  (15 lazy-load references)
    api-design-patterns.md
    api-versioning-guide.md
    architecture.md
    dep-check-guide.md
    design-system.md
    devops-security-guide.md
    env-audit-guide.md
    error-handling-patterns.md
    from-scratch-guide.md
    new-page-guide.md
    new-screen-guide.md
    security-protocols.md
    seo-patterns.md
    testing-strategy.md
    zero-downtime-migration.md
  settings.json
  stack-rules.md
CLAUDE.md
```

---

## Applying to an existing project

After copying the files, if an existing `.claude/settings.json` exists, merge it manually — preserve the `deny` list.

---

## Stack preset selection

**Backend**

| Technology | Preset folder |
| --- | --- |
| NestJS | `presets/backend/nestjs/` |
| Node + Express | `presets/backend/node-express/` |
| FastAPI | `presets/backend/fastapi/` |
| Django | `presets/backend/django/` |
| Flask | `presets/backend/flask/` |
| Go API | `presets/backend/go-api/` |
| Rust API | `presets/backend/rust-api/` |
| Java Spring | `presets/backend/java-spring/` |
| .NET API | `presets/backend/dotnet-api/` |
| Laravel | `presets/backend/laravel/` |
| Rails | `presets/backend/rails/` |

**Web**

| Technology | Preset folder |
| --- | --- |
| Next.js (SaaS/Admin) | `presets/web/nextjs-saas/` |
| Remix | `presets/web/remix/` |
| Astro | `presets/web/astro/` |
| React + Vite | `presets/web/react-vite/` |
| Vue + Nuxt | `presets/web/vue-nuxt/` |
| SvelteKit | `presets/web/sveltekit/` |
| Angular | `presets/web/angular/` |

**Mobile**

| Technology | Preset folder |
| --- | --- |
| Kotlin Android | `presets/mobile/kotlin-android/` |
| Swift iOS | `presets/mobile/swift-ios/` |
| React Native | `presets/mobile/react-native/` |
| Flutter | `presets/mobile/flutter/` |

**Database**

| Technology | Preset folder |
| --- | --- |
| PostgreSQL | `presets/database/postgres/` |
| MySQL | `presets/database/mysql/` |
| SQLite | `presets/database/sqlite/` |
| MongoDB | `presets/database/mongodb/` |
| Redis | `presets/database/redis/` |
| Firebase | `presets/database/firebase/` |
| Supabase | `presets/database/supabase/` |

**ORM**

| Technology | Preset folder |
| --- | --- |
| Prisma | `presets/orm/prisma/` |
| TypeORM | `presets/orm/typeorm/` |
| Drizzle | `presets/orm/drizzle/` |
| Mongoose | `presets/orm/mongoose/` |
| Sequelize | `presets/orm/sequelize/` |
| SQLAlchemy | `presets/orm/sqlalchemy/` |

**Runtime**

| Technology | Preset folder |
| --- | --- |
| Bun | `presets/runtime/bun/` |
| Deno | `presets/runtime/deno/` |

**API Layer**

| Technology | Preset folder |
| --- | --- |
| GraphQL | `presets/api/graphql/` |
| tRPC | `presets/api/trpc/` |

**Infrastructure**

| Technology | Preset folder |
| --- | --- |
| Docker / Compose | `presets/infrastructure/docker/` |

**General**

| Technology | Preset folder |
| --- | --- |
| Monorepo | `presets/generic/monorepo/` |
| Generic (fallback) | `presets/generic/fallback/` |

Each preset folder contains two files:

- `CLAUDE.md` — complete description (paste into CLAUDE.md)
- `compact.md` — summary lines (add to `stack-rules.md`)
