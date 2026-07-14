**English** | [Türkçe](README.tr.md)

# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![Routing eval](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/routing-eval.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/routing-eval.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6.0-brightgreen)](package.json)

Agent, skill and rule kit that gives Claude Code senior engineering team behavior.

---

## Quick Start

### Which option do I need?

First decide the scope — **all projects on this machine** (global `~/.claude/`, Option B) or **one project** (its `.claude/`, Options A/C/D) — then pick a row:

| Your situation | Use | What you get |
| --- | --- | --- |
| Brand-new project — Claude should plan and build it | **Option A** | A lean, **generated 7-agent project team** (not the full kit — see note below) |
| Every project on this machine should get the kit | **Option B** | Full kit (14 agents, 32 skills, 11 commands, 11 rules) in global `~/.claude/` |
| One existing project, you do the copying | **Option C** | Full kit in that project's `.claude/` |
| One existing project, Claude does the copying | **Option D** | Full kit in `.claude/`, optionally global too |

> **Option A installs a different team.** `PROJECT-BOOTSTRAP.md` generates a minimal 7-agent roster (architect, security-reviewer, implementer, test-author, reviewer, debugger, researcher) tailored to a brand-new project — not the kit's 14 prebuilt agents. To use the full kit in that project afterwards, run Option B, C, or D on top.

### Option A — New project (recommended)

Copy `PROJECT-BOOTSTRAP.md` to your project root, then tell Claude Code:

```text
Read PROJECT-BOOTSTRAP.md and apply it starting from PHASE 0. Work autonomously.
```

Claude detects your stack, picks the right presets, and generates `.claude/` automatically.

### Option B — Install to global `~/.claude/` (applies to all projects)

**Auto-detect stack (recommended):**

`--detect` reads stack files (`package.json`, `requirements.txt`, `go.mod`, ...) from
your **current directory** to pick a preset, but always writes the kit to the
**global** `~/.claude/` — not the current project. `cd` into a representative
project first so detection picks the right preset for how you work day to day.

```bash
# Mac / Linux — detects stack from package.json / requirements.txt / go.mod
cd /path/to/your-project && bash /path/to/senior-dev-kit/install.sh --detect

# Windows
cd C:\path\to\your-project; .\senior-dev-kit\install.ps1 -Detect
```

**Manual preset:**

```bash
# Mac / Linux
bash install.sh --preset=nextjs-saas

# Windows
.\install.ps1 -Preset nextjs-saas
```

**One-liner alternative (Node 22.6+, no clone needed):** the npm wrapper picks the
right installer for your platform and forwards the same flags:

```bash
npx github:mtvrkan/senior-dev-kit --detect     # or --preset=nextjs-saas
```

**Plugin alternative:** the repo ships a Claude Code plugin manifest
(`.claude-plugin/`) — add it as a marketplace and install, and the commands,
agents, skills, and the [protected-path hook](hooks/README.md) register automatically:

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
```

> **Windows note:** Examples throughout the docs use forward-slash paths (`project/.claude/`). In PowerShell use backslashes (`project\.claude\`) — and quote any path containing spaces. If a copied command with mixed slashes fails, see [TROUBLESHOOTING.md — Paths with backslashes break scripts](TROUBLESHOOTING.md#paths-with-backslashes-break-scripts).

### Option C — Manual install for a single project

1. Pick your framework preset (e.g., `presets/web/react-vite/CLAUDE.md`).
2. Copy it to `.claude/stack-rules.md` in your project, then create a short root `CLAUDE.md` that references it (see [INSTALL.md Step 6](INSTALL.md#6-create-claudemd-and-stack-rules) for the template).
3. Copy `rules/` → `.claude/rules/`
4. Copy `skills/` → `.claude/skills/`
5. Copy `agent_docs/` → `.claude/agent_docs/` (optional — lazy-loaded on demand)

### Option D — Let Claude run the install (no shell script)

Broader than Option B or C alone: Option B (`install.sh`/`install.ps1`) only writes to global `~/.claude/`; Option C only sets up a single project's `.claude/`. Option D does both — project `.claude/` setup *and* optional global `~/.claude/` setup, with auto-detected stack — with Claude performing every copy/merge step itself instead of you running `install.sh`/`install.ps1`. Useful on machines without bash, or when you want project + global setup done in one pass.

```text
Read SETUP.md and apply it starting from Step 1. Work autonomously.
```

> **Picking between A and D:** Option A (`PROJECT-BOOTSTRAP.md`) is for a brand-new project — it includes planning/architecture phases beyond just installing the kit. Option D (`SETUP.md`) is purely the kit installer, for an existing project that just needs `.claude/` populated.

---

## Usage after setup

After setup, you use Claude Code **by just talking normally** — routing is automatic.

```text
User: login page "Forgot Password" link doesn't work, fix it
→ Claude: routes to bug-hunter, fixes it directly

User: add a new settings page for user profile
→ Claude: routes to senior-engineer, presents a plan

User: redesign the payment flow
→ Claude: architect presents a plan, security-guard approves, awaits approval

User: add SBOM to Docker CI pipeline
→ Claude: routes to devops-guard, presents a plan, requires approval
```

### Slash commands

**Command files** (11 — rich behavior definitions):

| Command | What it does |
| --- | --- |
| `/smart-task [task]` | Measure risk and route to correct skill |
| `/plan-first [task]` | Present plan first, get approval, then apply |
| `/safe-review` | Review diff — read-only, doesn't modify files |
| `/security-scan` | Run full passive security scan |
| `/release-gate` | Pre-release GO / NO-GO checklist |
| `/dep-check` | Dependency CVE + outdated analysis |
| `/performance-check` | Bundle, N+1, CWV performance analysis |
| `/seo-check` | SEO, AEO, Core Web Vitals audit |
| `/deep-research [topic]` | Multi-source research, fact-checking |
| `/agents-guide` | List all agents and routing rules |
| `/kit-doctor [scope]` | Diagnose the kit installation — counts, settings, drift |

**Skill shortcuts** (invoke by name — always available):
`/security-review` · `/api-design` · `/api-versioning` · `/migration-review` · `/env-audit` · `/bug-fix` · `/feature-build` · and all 32 skills

> **Commands vs Skills:** Command files (`commands/*.md`) use the older Claude Code slash-command format — plain markdown with a `$ARGUMENTS` placeholder, read into context on invocation. Skill files (`skills/*/SKILL.md`) use the newer SKILL.md system with rich frontmatter (`model`, `effort`, `allowed-tools`, `when_to_use`) that Claude Code resolves before the skill runs. Skills can also fire automatically when Claude Code detects a matching context; commands only fire when explicitly invoked.

---

## Picking a Preset

| Your stack | Preset to use |
| --- | --- |
| React + Vite | `presets/web/react-vite/CLAUDE.md` |
| Next.js SaaS | `presets/web/nextjs-saas/CLAUDE.md` |
| Vue + Nuxt | `presets/web/vue-nuxt/CLAUDE.md` |
| SvelteKit | `presets/web/sveltekit/CLAUDE.md` |
| Angular | `presets/web/angular/CLAUDE.md` |
| Astro | `presets/web/astro/CLAUDE.md` |
| Remix | `presets/web/remix/CLAUDE.md` |
| NestJS | `presets/backend/nestjs/CLAUDE.md` |
| FastAPI | `presets/backend/fastapi/CLAUDE.md` |
| Django | `presets/backend/django/CLAUDE.md` |
| Flask | `presets/backend/flask/CLAUDE.md` |
| Node + Express | `presets/backend/node-express/CLAUDE.md` |
| Go (REST API) | `presets/backend/go-api/CLAUDE.md` |
| Rust (API) | `presets/backend/rust-api/CLAUDE.md` |
| Java Spring | `presets/backend/java-spring/CLAUDE.md` |
| .NET | `presets/backend/dotnet-api/CLAUDE.md` |
| Laravel | `presets/backend/laravel/CLAUDE.md` |
| Rails | `presets/backend/rails/CLAUDE.md` |
| Flutter | `presets/mobile/flutter/CLAUDE.md` |
| Kotlin/Android | `presets/mobile/kotlin-android/CLAUDE.md` |
| Swift/iOS | `presets/mobile/swift-ios/CLAUDE.md` |
| React Native | `presets/mobile/react-native/CLAUDE.md` |
| GraphQL | `presets/api/graphql/CLAUDE.md` |
| tRPC | `presets/api/trpc/CLAUDE.md` |
| Docker | `presets/infrastructure/docker/CLAUDE.md` |
| Bun | `presets/runtime/bun/CLAUDE.md` |
| Deno | `presets/runtime/deno/CLAUDE.md` |
| Cloudflare Workers | `presets/runtime/cloudflare-workers/CLAUDE.md` |
| Monorepo | `presets/generic/monorepo/CLAUDE.md` |
| Unknown stack | `presets/generic/fallback/CLAUDE.md` |

### Common Stack Combinations

Pick the row that matches your project, copy the listed presets in order:

| Stack | Presets (in priority order) |
| --- | --- |
| **Next.js SaaS + Prisma + PostgreSQL** | `web/nextjs-saas` → `orm/prisma` → `database/postgres` |
| **Next.js + Supabase** | `web/nextjs-saas` → `database/supabase` |
| **NestJS + Prisma + PostgreSQL** | `backend/nestjs` → `orm/prisma` → `database/postgres` |
| **NestJS + MongoDB** | `backend/nestjs` → `orm/mongoose` → `database/mongodb` |
| **FastAPI + SQLAlchemy + PostgreSQL** | `backend/fastapi` → `orm/sqlalchemy` → `database/postgres` |
| **Django + PostgreSQL** | `backend/django` → `database/postgres` |
| **React + Vite (frontend only)** | `web/react-vite` |
| **Flutter + Supabase** | `mobile/flutter` → `database/supabase` |
| **Kotlin Android + Firebase** | `mobile/kotlin-android` → `database/firebase` |
| **Go API + PostgreSQL** | `backend/go-api` → `database/postgres` |
| **Monorepo (Next.js + NestJS)** | `generic/monorepo` → `web/nextjs-saas` → `backend/nestjs` → `orm/prisma` |

How to compose: write the top-priority preset's `CLAUDE.md` content into `.claude/stack-rules.md`, then append the `compact.md` of the others below it. Root `CLAUDE.md` stays short and just points at `.claude/stack-rules.md` (see [SETUP.md Step 4](SETUP.md)).

### Composing Multiple Presets

For projects spanning multiple layers (e.g., React + Prisma + PostgreSQL):

1. **UI preset** — sets component, state, routing conventions (`presets/web/*`)
2. **ORM preset** — sets data-access patterns (`presets/orm/*`)
3. **Database preset** — sets schema safety rules (`presets/database/*`)
4. **Generic preset** — fills remaining gaps (`presets/generic/fallback/CLAUDE.md`)

Put the most specific preset's content into `.claude/stack-rules.md` and inline relevant sections from the others. Keep root `CLAUDE.md` short — it just references `.claude/stack-rules.md`.

---

## What's included

### Skills (32)

Skills fire two ways: most are **auto-invoked** when their `description`
matches the task (many are also wired into agents via the agent's `skills:`
field), while some are **manual-only** — invoked as `/skill-name` and marked
`disable-model-invocation: true` (e.g. `smart-task`, `plan-first`,
`safe-review`, `release-gate`). A skill not referenced by any agent is
intentional, not orphaned: it is invoked directly.

**Application:**
`feature-build`, `feature-plan`, `bug-fix`, `refactor-safe`, `ui-change`, `new-page`, `new-screen`, `from-scratch`

**Data and API:**
`data-modeling`, `db-change`, `api-design`, `api-versioning`, `migration-review`

**Quality and Security:**
`code-review`, `safe-review`, `security-review`, `security-scan`, `test-writer`, `performance-check`, `code-audit`

**DevOps and Environment:**
`release-check`, `release-gate`, `env-audit`, `dep-check`, `monorepo-task`, `kit-doctor`

**Content and Research:**
`docs-update`, `deep-research`, `codebase-overview`

**AI/LLM:**
`llm-integration`

**Orchestration:**
`smart-task`, `plan-first`

### Rules (11) — auto-loaded

| File | Scope |
| --- | --- |
| `000-security` | Every change — passive security scan, OWASP 2025 |
| `001-conventions` | Always — architecture detection, modern tech preferences |
| `100-web` | `*.tsx, *.jsx, *.vue, *.svelte` — design tokens, 8px grid, SEO, WCAG 2.2 |
| `200-api` | `**/api/**, **/routes/**` — REST, OpenAPI 3.1, RFC 7807 |
| `300-testing` | `*.test.*, *.spec.*` — test pyramid, mock policy |
| `400-mobile` | `*.swift, *.kt, **/lib/**/*.dart` — platform patterns |
| `500-database` | `**/migrations/**, *.prisma` — schema safety, N+1, RLS |
| `600-devops` | `Dockerfile*, .github/**` — non-root, SHA-pin, SBOM, OIDC |
| `700-observability` | `**/*.ts, **/*.py, **/*.go` — logging levels, metrics, tracing |
| `800-llm-safety` | `**/ai/**, **/llm/**, **/anthropic/**` — prompt injection, cost controls |
| `900-performance` | `**/*.ts, **/*.tsx, **/*.py, **/*.go` — CWV budgets, N+1, bundle limits |

### Agent Docs (15) — lazy-load, read on demand

`architecture.md`, `design-system.md`, `testing-strategy.md`, `security-protocols.md`,
`api-design-patterns.md`, `seo-patterns.md`, `error-handling-patterns.md`,
`api-versioning-guide.md`, `dep-check-guide.md`, `env-audit-guide.md`,
`from-scratch-guide.md`, `new-page-guide.md`, `new-screen-guide.md`,
`zero-downtime-migration.md`, `devops-security-guide.md`

These docs are **not preloaded** into every session. `global-CLAUDE.md` contains a `Lazy-load docs:` directive that lists them. When a skill's body or a rule references one (e.g. "see `agent_docs/architecture.md` for full patterns"), Claude reads it from disk on demand. This keeps large reference docs out of context on tasks that don't need them.

### Examples (15 worked walkthroughs)

Concrete before/after flows showing stack detection → files copied → auto-generated `stack-rules.md` → 3 real usage flows → per-task cost estimates. Start with [`examples/with-vs-without-kit.md`](examples/with-vs-without-kit.md) — the same three requests handled with and without the kit.

| Stack | File |
| --- | --- |
| Next.js + Prisma + PostgreSQL | `examples/nextjs-prisma-postgres.md` |
| NestJS + Prisma + PostgreSQL | `examples/nestjs-prisma-postgres.md` |
| FastAPI + SQLAlchemy + PostgreSQL | `examples/fastapi-sqlalchemy-postgres.md` |
| Django + PostgreSQL | `examples/django-postgres.md` |
| Nuxt 3 + Drizzle + PostgreSQL | `examples/nuxt-drizzle-postgres.md` |
| Laravel + Filament + MySQL | `examples/laravel-mysql.md` |
| Rails 7 + PostgreSQL | `examples/rails-postgres.md` |
| .NET 8 API + EF Core + PostgreSQL | `examples/dotnet-postgres.md` |
| Go REST API + PostgreSQL | `examples/go-postgres.md` |
| Java Spring Boot + PostgreSQL | `examples/java-spring-postgres.md` |
| Rust Axum + PostgreSQL | `examples/rust-axum-postgres.md` |
| Flutter + Supabase | `examples/flutter-supabase.md` |
| Kotlin Android + Firebase | `examples/kotlin-android-firebase.md` |
| Swift iOS + Supabase | `examples/swift-ios-supabase.md` |
| With vs without the kit (any stack) | `examples/with-vs-without-kit.md` |

### Presets (49 stacks, 98 files)

Each preset ships as `CLAUDE.md` (full detail) + `compact.md` (token-optimized summary).

**Web (7):** Next.js SaaS · React + Vite · Vue / Nuxt · SvelteKit · Angular · Astro · Remix

**Backend (11):** Node.js Express · NestJS · FastAPI · Django · Flask · Go · Rust · Laravel · Rails · .NET · Java Spring

**Runtime (3):** Bun · Deno · Cloudflare Workers

**ORM (6):** Prisma · Drizzle · TypeORM · Sequelize · Mongoose · SQLAlchemy

**Database (7):** PostgreSQL · MySQL · SQLite · MongoDB · Redis · Supabase · Firebase

**Mobile (4):** Flutter · Kotlin Android · Swift iOS · React Native

**API (3):** tRPC · GraphQL (+ subscriptions) · WebSocket / SSE

**Messaging (2):** BullMQ · Kafka

**Infrastructure (3):** Docker · Kubernetes · Terraform

**AI/LLM (1):** LLM Integration (Claude/OpenAI, RAG, tool use, streaming)

**Generic (2):** Monorepo · Fallback

`security/Dockerfile.template` — multi-stage, non-root, health-check Dockerfile template (Node, Python, Go variants)

### Hooks (opt-in) — deterministic enforcement

Everything above is prompt discipline; [`hooks/`](hooks/README.md) turns the most
important rule into a harness guarantee. The `protected-paths` PreToolUse hook
intercepts any Edit/Write into secrets, auth, payment, migration, or CI/IaC paths
and downgrades it to an explicit permission prompt naming the guard agent that
should review the change first — regardless of what the model decided. The
installer copies `hooks/` but never activates it; wiring it into `settings.json`
is a deliberate user step (see [hooks/README.md](hooks/README.md)). Installed as a
plugin, the hook registers automatically.

---

## Rule Precedence

When rules conflict, this order applies (highest wins):

```text
1. 000-security.md           ← always active, cannot be overridden
2. Project CLAUDE.md / .claude/stack-rules.md ← project-specific decisions
3. Stack preset (presets/*/CLAUDE.md) ← framework conventions
4. Domain rule (100/200/300/400/500/600) ← more specific glob wins
5. 001-conventions.md        ← general fallback
```

Full details: [rules/001-conventions.md](rules/001-conventions.md)

---

## Validation

Nothing below is asserted from memory — every number is reproducible by running the command next to it.

| Check | Command | Result |
| --- | --- | --- |
| Unit + integration tests | `npm test` | **130/130 passing** (23 suites — frontmatter validation, install script behavior on both platforms, protected-path hook behavior including audit logging) |
| Skill/agent/command/preset frontmatter | `npm run validate` | 32 skills · 14 agents · 11 commands · 49 presets — 0 errors; includes hand-off chain integrity (`db-change` → `migration-review` etc.) and guard-agent `permissionMode: plan` enforcement |
| Internal doc links | `npm run link-check` | 219 markdown files, 0 broken links/anchors |
| Maintenance-table freshness | `npm run stale-check` | 0 stale or orphaned entries across all 5 maintenance tables |
| Type check / lint | `npm run typecheck` · `npm run lint` | clean |
| Routing accuracy (live) | `RUN_ROUTING_EVAL=1 npm run routing-eval` | **32/33 (97%)** — see below |
| Deny-list false-positive cost | `npm run deny-cost` | **0.52%** of real commands — see below |

Run the whole set at once with `npm run check` — it's the same sequence CI runs on every push (`.github/workflows/repo-ci.yml`).

The kit's *routing behavior* is under test too, not just its files:
[`eval/golden-prompts.json`](eval/golden-prompts.json) pins 33 realistic requests
(TR+EN mixed) to the agent that should handle them. `npm run routing-eval` runs the
free static half on every push (all expected agents exist, every agent covered);
`RUN_ROUTING_EVAL=1 npm run routing-eval` asks the model to actually route each
prompt and fails below a 90% score — triggered manually or weekly via
`.github/workflows/routing-eval.yml` when an `ANTHROPIC_API_KEY` secret is set.
Measured, not assumed: the first live run scored 28/33 (85%) and exposed real
gaps in `agents/ROUTING.md`; after closing them, two consecutive live runs
scored 32/33 (97%), the single miss differing between runs on genuinely
ambiguous prompts (see CHANGELOG for the full trace).

The deny list's usability cost is measurable rather than guessed: `npm run deny-cost`
replays every Bash command from your own machine's Claude Code transcript history
against the kit's deny rules and reports what would have been blocked — see the
"Measured cost" note in [SECURITY.md](SECURITY.md) for the numbers from the
development machine (0.52% of 3,646 real commands).

This is the kit's own dev tooling — it lints and validates this repository, not your project. To also run secret scanning, markdown lint, and shellcheck locally, install pre-commit:

```bash
pip install pre-commit
pre-commit install          # hooks fire automatically on git commit
pre-commit run --all-files  # run once on the whole repo
```

> For a pre-commit config to copy into a project that *uses* the kit, see `security/.pre-commit-config.yaml` (different hook set — see [SETUP.md](SETUP.md)).

---

## Folder structure

```text
senior-dev-kit/
├── README.md                ← This file
├── PROJECT-BOOTSTRAP.md     ← Autonomous team setup protocol
├── CHANGELOG.md             ← Version history
├── .pre-commit-config.yaml  ← Pre-commit hooks (gitleaks, markdownlint, shellcheck, validate-skills)
├── install.sh               ← Install to ~/.claude/ (macOS/Linux)
├── install.ps1              ← Install to ~/.claude/ (Windows)
├── .gitignore
├── .github/
│   └── workflows/
│       └── repo-ci.yml      ← CI: markdown lint · YAML lint · typecheck · skill validation · shellcheck · PSScriptAnalyzer · stale-check · SHA-pin verification
├── scripts/
│   ├── validate-skills.ts   ← SKILL.md/agent frontmatter validation script
│   ├── check-stale.ts       ← Cross-checks docs against files on disk
│   ├── routing-eval.ts      ← Golden-prompt routing evaluation (static + live)
│   └── deny-cost.ts         ← Replays your transcript history against the deny rules
├── bin/                     ← npx CLI wrapper around the installers
├── eval/                    ← golden-prompts.json — routing behavior test set
├── hooks/                   ← Opt-in enforcement hooks (protected-paths) + plugin wiring
├── .claude-plugin/          ← Claude Code plugin + marketplace manifests
├── agents/                  ← 14 agent definitions (architect, security-guard, bug-hunter…) + ROUTING.md (decision tree, not an agent)
├── presets/                 ← 49 stack-specific rule sets (98 files: CLAUDE.md + compact.md each)
│   ├── web/
│   ├── backend/
│   ├── database/
│   ├── orm/
│   ├── mobile/
│   ├── api/
│   ├── runtime/
│   ├── infrastructure/
│   ├── messaging/
│   ├── ai/
│   └── generic/
├── skills/                  ← 32 skill definitions (SKILL.md each)
├── commands/                ← 11 slash command definitions
├── rules/                   ← 11 path-scoped rule files
├── agent_docs/              ← 15 lazy-load deep reference docs
├── examples/                ← 15 worked walkthroughs (stack → files copied → 3 usage flows → per-task costs)
└── security/                ← .gitleaks.toml · .semgrep.yml · .pre-commit-config.yaml · dependabot.yml · workflows/
```

---

## Token cost reference

Typical cost per task type at default model routing. Unlike the [routing-eval and deny-cost numbers above](#validation), these are **illustrative estimates**, not measured — there's no script replaying real transcripts against a pricing model yet. Actual cost depends on file size, conversation length, and prompt caching.

| Task | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| UI bug (1-2 files) | bug-hunter / ui-fixer | haiku | ~$0.002 |
| CSS / copy / padding fix | ui-fixer | haiku | ~$0.001 |
| Feature build (3-4 files) | senior-engineer | sonnet | ~$0.04 |
| New page / screen | senior-engineer | sonnet | ~$0.03 |
| Security review | security-guard | opus | ~$0.15 |
| DB schema + migration plan | db-guard | opus | ~$0.15–0.20 |
| Architecture planning | architect | opus | ~$0.25 |
| Dep CVE audit | security-scanner | sonnet | ~$0.05 |
| Performance analysis | performance-guard | sonnet | ~$0.06 |
| Docs update | docs-writer | haiku | ~$0.003 |

Cost reduction: `CLAUDE_CODE_SUBAGENT_MODEL=haiku` (set in `settings.json`) routes anonymous Agent() calls to haiku, saving ~75% on research/read-only sub-tasks.

---

## Troubleshooting

If something is not working after install, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for:

- Permission errors on install scripts
- VERIFY.md check failures with specific fixes
- Agent routing not working
- Wrong model being used
- Windows-specific path issues

---

## Extending the kit

To add your own agents, skills, rules, or presets, see **[EXTENDING.md](EXTENDING.md)**:

- Adding a new skill (with template)
- Adding a new agent (with template and model selection guide)
- Adding a new rule (with glob scoping)
- Adding a new preset (CLAUDE.md + compact.md structure)
- Keeping custom extensions upgrade-safe

---

## Contributing

1. **New skill** → copy `skills/bug-fix/SKILL.md` as template, update frontmatter, keep body ≤ 20 lines.
2. **New preset** → add both `CLAUDE.md` (full) and `compact.md` (8-15 lines summary).
3. **Rule change** → update the relevant `rules/NNN-*.md` file; update `CHANGELOG.md`.
4. **Validate** → run `npm run validate` — must pass.
5. **Prune** → audit skill count monthly: > 35 skills = remove unused ones.
