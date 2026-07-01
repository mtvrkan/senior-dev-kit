# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

_No unreleased changes yet._

---

## [1.0.0] — 2026-07-01

### Added (post-review hardening)

- `AGENTS-MAINTENANCE.md`, `SKILLS-MAINTENANCE.md`, `COMMANDS-MAINTENANCE.md` — the staleness/cross-reference tracking that previously only covered `presets/` and `rules/` (via `PRESET-MAINTENANCE.md` / `RULES-MAINTENANCE.md`) now also covers all 17 agents, 32 skills, and 12 commands; `scripts/check-stale.ts` validates all five tables through one shared `checkFlatMaintenance()` helper
- `scripts/check-links.ts` + `scripts/lib/links.ts` — new `npm run link-check` step scans every markdown file for relative markdown links that resolve to a non-existent file; wired into `npm run check`. Explicitly exempts external URLs/schemes, same-file anchor-only links, and GitHub's `security/advisories/new` web-UI convention link in `SECURITY.md`
- `scripts/lib/frontmatter.ts` — `findDuplicateFrontmatterKeys()` catches copy/paste mistakes (e.g. `description:` set twice) that the flat key→value parser would otherwise silently resolve last-write-wins; wired into `validate-skills.ts` for both skill and agent frontmatter as a hard error
- `scripts/check-stale.ts` — `checkFlatMaintenance()` (and the preset check) now cross-reference in both directions: disk entries missing from a maintenance table (already existed) *and* table rows with no matching file/directory on disk (new) — catches a rename/removal that leaves a stale, meaningless row behind
- 16 new unit/integration tests covering the above (50 total, up from 34)

### Fixed (post-review hardening)

- `EXTENDING.md` — the "Adding a new slash command" template showed a YAML frontmatter block (`description:`, `allowed-tools:`), but none of the 12 real `commands/*.md` files use frontmatter — commands are plain `# /name` + prompt body. Template corrected to match actual practice
- `CONTRIBUTING.md` — "Adding an Agent" / "Adding a Skill" sections now reference the new `AGENTS-MAINTENANCE.md` / `SKILLS-MAINTENANCE.md` tables; PR checklist and "Running Checks Locally" updated for `npm run link-check` and all five maintenance tables (previously only mentioned `PRESET-MAINTENANCE.md`, even though `RULES-MAINTENANCE.md` was already being checked by `check-stale.ts`)

### Changed

- Install/setup docs (`README.md`, `INSTALL.md`, `SETUP.md`, `VERIFY.md`) — clarified that `CLAUDE.md` stays short and points at `.claude/stack-rules.md`, which holds the actual preset content (previously docs conflated the two)
- `SETUP.md` — `settings.json` merge logic now preserves the project's existing `permissions.allow` entries instead of overwriting the whole file; clarified `settings.json` (kit dev/CI config) vs `settings-template.json` (canonical install template)
- `rules/001-conventions.md` — rule precedence table now includes the `700-observability`, `800-llm-safety`, and `900-performance` glob rows (previously missing)
- `rules/900-performance.md` — split the combined LCP/CLS flag into separate `PERF: CLS risk` and `PERF: LCP risk` messages
- `agents/ROUTING.md` — added `performance-guard` (read-only) to the architect escalation chain
- `security/.semgrep.yml` — added mass-assignment detection rules (`Object.assign(model, req.body)`, `Model.create/update(req.body)`)
- `agent_docs/` file count corrected from 14 to 15 across `README.md`, `VERIFY.md`, `install.sh`, `install.ps1`

### Fixed

- `global-CLAUDE.md` — protected-files line had lost its spaces (`.env.**.pem *.key*.p12`), silently merging four separate glob patterns into two malformed ones; restored to `.env.* *.pem *.key *.p12` so `.pem`/`.key`/`.p12` files are actually matched by the deny rule
- `TROUBLESHOOTING.md` — the `.env`-being-read fix instructed users to `cp senior-dev-kit/settings.json .claude/settings.json` (the kit's own dev/CI config) instead of `settings-template.json` (the consumer template); corrected to match `INSTALL.md`
- `security/.pre-commit-config.yaml` — gitleaks pin bumped from `v8.21.2` to `v8.26.0` to match the root `.pre-commit-config.yaml`, so the kit's own repo and the template consumer projects copy both scan with the same gitleaks version
- `.pre-commit-config.yaml` — header comment now points to `security/.pre-commit-config.yaml` explicitly (previously only mentioned `security/Dockerfile.template` and `rules/000-security.md`, so readers opening the file directly could miss where the consumer-facing template lives)
- `settings-template.json` no longer duplicates `settings.json`'s kit-internal `env.CLAUDE_CODE_SUBAGENT_MODEL` override (that's a shell-profile suggestion per `SETUP.md`, not a template field); `permissions.deny` and `skillOverrides` are kept since consumer projects need both
- `settings.json` / `settings-template.json` — added `Read(./*.p12)` to `permissions.deny`, matching the protected-files list in `rules/000-security.md`
- `presets/ai/llm-integration/CLAUDE.md` — model ID corrected to the full `claude-haiku-4-5-20251001` form used elsewhere
- `rules/000-security.md` — fixed missing space in the protected-files bullet list
- `README.md` — `compact.md` line-count guidance now matches `CONTRIBUTING.md` (8-15 lines, not "≤ 15")
- `security/.semgrep.yml` — verified against a real `semgrep` install (`semgrep --validate` + synthetic vulnerable-code fixtures per rule); the file was more broken than it looked from static review alone:
  - The whole file failed to *parse* (`mapping values are not allowed here`) — `dangerously-set-inner-html` and `jwt-algorithm-none` had unquoted patterns containing `key: value`-shaped text (e.g. `{{ __html: $INPUT }}`), which YAML reads as a nested mapping. All 13 rules were silently dead, not just one.
  - 5 of 13 rules (`sql-injection-string-format`, `sql-injection-template-literal`, `subprocess-shell-true`, `jwt-algorithm-none`, `go-sql-string-format`) listed their alternative patterns under `patterns:` (AND-combined) instead of `pattern-either:` (OR-combined) — e.g. `jwt-algorithm-none` required `jwt.verify(...)` *and* `jwt.sign(...)` in the same match, which no real call site satisfies. Switched all five to `pattern-either`.
  - `dangerously-set-inner-html`'s `pattern-not` re-bound `$INPUT` to a different sub-expression than the main `pattern`, so the DOMPurify-sanitized exclusion never actually excluded anything (confirmed via test fixture — it flagged the sanitized line too). Rewritten using `metavariable-pattern` to test `$INPUT` itself against `pattern-not: DOMPurify.sanitize(...)`.
  - `sql-injection-template-literal`'s per-keyword patterns (`` `SELECT ... ${...} ...` ``) never matched real code — `"..."` ellipsis only acts as a wildcard when standalone, not mixed with literal keyword text in the same segment. Rewritten as a single `` `...${$X}...` `` structural pattern plus `pattern-regex: (?i)(select|insert|update|delete)\s` on the matched text.
  - `go-sql-string-format`'s `"... %s ..."` had the same literal-text-plus-ellipsis problem; simplified to `fmt.Sprintf("...", $VAR)` (any format string, scoped by the surrounding `db.Query`/`db.Exec` call).
  - `sql-injection-string-format`'s f-string pattern (`f"... {$VAR} ..."`) needed the spaces removed (`f"...{$VAR}..."`) — same root cause, ellipsis only wildcards when adjacent to the metavariable with no literal whitespace.
  - `hardcoded-secret-assignment`'s second `metavariable-regex` referenced a non-existent `$1` capture group; removed the dead block.
  - Re-validated with `semgrep --validate` (0 config errors, 13 rules) and a full synthetic fixture pass (12/12 expected findings fired, 0 false positives on negative cases or a scan of this repo).
- `README.md` — Option D description no longer implies it has the same scope as Option B (Option B is global-only; Option D covers project + global)
- `skills/db-change/SKILL.md` — removed `Edit, Write` from `allowed-tools`; this skill only produces a design/planning analysis, consistent with its own description
- `install.sh` / `install.ps1` — `CLAUDE.md` backups are now timestamped (`CLAUDE.md.bak.<timestamp>`) instead of a fixed `.bak` name, so repeated installs no longer silently overwrite the previous backup
- `install.sh` / `install.ps1` — installed file counts (`rules/`, `skills/`, `commands/`, `agents/`, `agent_docs/`) are now computed from what was actually copied instead of hardcoded, so a partial copy is no longer reported as a full success
- `install.sh` — Python stack detection now greps only the `requirements.txt`/`pyproject.toml` files that actually exist instead of always passing both filenames to `grep`
- `.github/workflows/repo-ci.yml` — dropped `--experimental-test-coverage` from the unit test step; the flag is unstable across Node 22 patch releases and its output wasn't consumed
- `agents/db-guard.md`, `agents/security-guard.md`, `agents/migration-guard.md`, `agents/performance-guard.md` — reworded "implementation is delegated to X" to "the plan is routed to X"; guard agents don't delegate, the harness routes the approved plan per `agents/ROUTING.md`
- `CONTRIBUTING.md` / `EXTENDING.md` — documented the previously-undocumented optional skill frontmatter fields (`model`, `effort`, `argument-hint`, `disable-model-invocation`) and clarified that `disable-model-invocation` (trigger gating) and `model` (execution model) are independent settings
- `security/.semgrep.yml` — `yaml-unsafe-load` was combining a bare `pattern: yaml.load($DATA)` with two `pattern-not` clauses (`yaml.safe_load($DATA)`, `yaml.load($DATA, Loader=yaml.SafeLoader)`) that can never structurally match a single-argument `yaml.load($DATA)` call, so both were dead weight — and the rule never checked the `Loader=` keyword form at all, missing `yaml.load($DATA, Loader=yaml.UnsafeLoader)`/`Loader=yaml.FullLoader`. Rewritten as `pattern-either: [yaml.load($DATA), yaml.load($DATA, Loader=$LOADER)]` minus `pattern-not: yaml.load($DATA, Loader=yaml.SafeLoader)`; re-validated with `semgrep --validate` (0 errors) and a synthetic fixture (flags bare/`UnsafeLoader`/`FullLoader` forms, does not flag `SafeLoader`/`safe_load`)
- `security/.semgrep.yml` — `mass-assignment-object-assign` and `mass-assignment-model-create` only matched `Object.assign(model, req.body)` / `Model.create(req.body)` / `Model.update(req.body)`; the equally common spread-operator form (`{...model, ...req.body}`, `Model.create({...req.body})`, `Model.update({...req.body}, ...)`) slipped through. Added as additional `pattern-either` branches; verified against a fixture covering both raw-body and spread forms plus allowlisted (safe) variants, 0 false positives
- `presets/orm/typeorm/CLAUDE.md`, `presets/orm/sequelize/CLAUDE.md` — added a header note that these are existing-project-only presets; `rules/001-conventions.md` already lists Prisma/Drizzle as the preferred ORMs for new projects, but the presets themselves gave no signal that they're for legacy maintenance rather than new adoption

### Added (initial release)

#### Core system

- `global-CLAUDE.md` — Global Claude Senior Protocol: hard stops, TOKEN TIER (0-4), agent routing table (20 signals, including `test-engineer`, `reviewer`, `writer`, `academic-writer`), boot sequence (15+ stacks), OWASP 2025 passive scan, supply chain rules, output format discipline
- `settings.json` / `settings-template.json` — Permissions (25 deny rules), subagent cost override (`CLAUDE_CODE_SUBAGENT_MODEL=haiku`), skill invocation guards
- `PROJECT-BOOTSTRAP.md` — Autonomous project discovery and `.claude/` scaffold generator (PHASE 0 → PHASE 1)

#### Agents (17)

`architect` · `bug-hunter` · `db-guard` · `devops-guard` · `docs-writer` · `migration-guard` · `performance-guard` · `researcher` · `reviewer` · `security-guard` · `security-scanner` · `senior-engineer` · `strategist` · `test-engineer` · `ui-fixer` · `writer` · `academic-writer`

- `agents/ROUTING.md` — Step-by-step decision tree with conflict resolution and escalation chain, including explicit `db-guard → migration-guard → senior-engineer` guard sequencing for schema changes
- `agents/db-guard.md`, `agents/migration-guard.md` — share a single canonical zero-downtime migration pattern (`agent_docs/zero-downtime-migration.md`) instead of duplicating it

#### Skills (32)

`academic-write` · `api-design` · `api-versioning` · `article-write` · `bug-fix` · `code-review` · `data-modeling` · `db-change` · `deep-research` · `dep-check` · `docs-update` · `env-audit` · `feature-build` · `feature-plan` · `from-scratch` · `llm-integration` · `migration-review` · `monorepo-task` · `new-page` · `new-screen` · `performance-check` · `plan-first` · `refactor-safe` · `release-check` · `release-gate` · `safe-review` · `security-review` · `security-scan` · `smart-task` · `strategy-plan` · `test-writer` · `ui-change`

- All skill bodies enforced at ≤20 non-blank lines (hard error in `validate-skills.ts`, not just a convention)
- `plan-first` / `feature-plan` scope is disambiguated: `feature-plan` auto-fires for feature-shaped work, `plan-first` is the manual opus-level override for any risky task

#### Rules (11, path-scoped with glob auto-loading)

- `000-security.md` — OWASP 2025 (A01-A10), passive scan (11 checks), language hotspots (8 languages), supply chain rules, dep audit commands (14 runtimes)
- `001-conventions.md` — Architecture detection, state management, API patterns, modern tech preferences, holistic consistency table
- `100-web.md` — Design tokens, 8px grid, three mandatory states (loading/empty/error), motion rules, WCAG 2.2, dark mode, Next.js 15 SEO, CLS prevention
- `200-api.md` — REST conventions, RFC 7807 error format, OpenAPI 3.1, auth requirements, rate limiting, pagination, idempotency, webhook security
- `300-testing.md` — Test pyramid ratios, mock policy, AAA pattern, selector stability, minimal spec template, coverage guidance, E2E tools by platform
- `400-mobile.md` — iOS/SwiftUI, Android/Compose, Flutter/Riverpod, React Native/Expo patterns, universal security and accessibility rules
- `500-database.md` — Schema change safety checklist, zero-downtime migration strategy, N+1 prevention, query safety, ORM protocols, Supabase RLS, Firebase rules
- `600-devops.md` — Dockerfile security checklist, GitHub Actions SHA pinning, OIDC, container scanning, IaC (Terraform/K8s), SBOM generation, rollback strategy
- `700-observability.md` — Structured JSON logging, correlation IDs, metrics (counter/histogram/gauge), health endpoints, distributed tracing, error tracking, alert thresholds
- `800-llm-safety.md` — Prompt injection prevention, output validation, cost controls, model selection by use case, tool/function safety, agentic flow limits, PII rules
- `900-performance.md` — Core Web Vitals budgets (LCP/CLS/INP), bundle size limits, API latency budgets, DB query budgets, N+1 detection, render budget, resource leak patterns, concurrency

#### Presets (49, with `CLAUDE.md` + `compact.md` per preset)

Every `compact.md` carries 8-15 dense, actionable lines (stack-specific detection signals, anti-patterns, verification chains) — not a placeholder summary.

- **Web (7):** `nextjs-saas` · `react-vite` · `vue-nuxt` · `sveltekit` · `angular` · `astro` · `remix`
- **Backend (11):** `nestjs` · `node-express` · `fastapi` · `django` · `flask` · `go-api` · `rust-api` · `java-spring` · `laravel` · `rails` · `dotnet-api`
- **ORM (6):** `prisma` · `drizzle` · `typeorm` · `sequelize` · `mongoose` · `sqlalchemy`
- **Database (7):** `postgres` · `mysql` · `sqlite` · `mongodb` · `redis` · `supabase` · `firebase`
- **Mobile (4):** `flutter` · `kotlin-android` · `swift-ios` · `react-native`
- **Runtime (3):** `bun` · `deno` · `cloudflare-workers`
- **API (3):** `trpc` · `graphql` · `websocket`
- **Messaging (2):** `bullmq` · `kafka`
- **Infrastructure (3):** `docker` · `kubernetes` · `terraform`
- **AI (1):** `llm-integration`
- **Generic (2):** `monorepo` · `fallback`

#### Commands (12 slash commands)

`smart-task` · `plan-first` · `safe-review` · `security-scan` · `release-gate` · `dep-check` · `perf-check` · `seo-check` · `deep-research` · `strategy-plan` · `write-article` · `agents-guide`

#### Agent docs (15 lazy-load reference files)

`architecture.md` · `design-system.md` · `security-protocols.md` · `api-design-patterns.md` · `error-handling-patterns.md` · `testing-strategy.md` · `seo-patterns.md` · `api-versioning-guide.md` · `dep-check-guide.md` · `env-audit-guide.md` · `from-scratch-guide.md` · `new-page-guide.md` · `new-screen-guide.md` · `academic-writing-guide.md` · `zero-downtime-migration.md`

#### Examples (14 worked walkthroughs)

- `examples/nextjs-prisma-postgres.md` — Next.js + Prisma + PostgreSQL full bootstrap
- `examples/fastapi-sqlalchemy-postgres.md` — FastAPI + SQLAlchemy + PostgreSQL full bootstrap
- `examples/flutter-supabase.md` — Flutter + Supabase full bootstrap
- `examples/nestjs-prisma-postgres.md` — NestJS + Prisma + PostgreSQL full bootstrap
- `examples/django-postgres.md` — Django + PostgreSQL: DRF endpoint, migration-guard, IDOR review
- `examples/nuxt-drizzle-postgres.md` — Nuxt 3 + Drizzle + PostgreSQL: SSR admin page, DB column, auth review
- `examples/laravel-mysql.md` — Laravel + Filament + MySQL: Filament resource, migration, mass assignment review
- `examples/rails-postgres.md` — Rails 7 + PostgreSQL: controller action, migration, Pundit IDOR review
- `examples/dotnet-postgres.md` — .NET 8 API + EF Core + PostgreSQL: endpoint+DTO, migration, payment review
- `examples/go-postgres.md` — Go REST API + PostgreSQL: endpoint, soft-delete migration, security scan
- `examples/java-spring-postgres.md` — Java Spring Boot + PostgreSQL: endpoint, JPA migration, security scan
- `examples/rust-axum-postgres.md` — Rust Axum + PostgreSQL: route handler, SQLx migration, unsafe audit
- `examples/kotlin-android-firebase.md` — Kotlin Android + Firebase (Firestore + Auth): new screen, Security Rules review, crash fix
- `examples/swift-ios-supabase.md` — Swift iOS + Supabase: new screen, RLS table review, auth flash fix

#### Install

- `install.sh` — Bash installer with `--detect` (auto-detects stack from manifest files, including Expo/React Native, Cloudflare Workers, Swift iOS, Kotlin Android, .NET, Bun, Deno — checked in the correct precedence order, e.g. Expo before plain React) and `--preset=NAME`
- `install.ps1` — PowerShell equivalent for Windows, with matching stack-detection precedence
- `SETUP.md` · `INSTALL.md` · `VERIFY.md` · `EXTENDING.md` · `TROUBLESHOOTING.md` · `UPGRADE.md`
- `PRESET-MAINTENANCE.md` — Version support matrix and deprecation policy

#### Security templates

- `security/Dockerfile.template` — Multi-stage, non-root, health-checked Dockerfile pattern
- `security/dependabot.yml` — Dependabot configuration
- `security/workflows/security-gate.yml` · `container-scan.yml` · `dependency-audit.yml` — all third-party Actions and container images pinned to full commit SHA / image digest (no mutable tags)

#### Tooling

- `scripts/validate-skills.ts` — Validates skill frontmatter (required/recommended fields, model IDs), enforces the 20-line skill body budget as a hard error, checks compact.md has at least 7 non-blank lines, agent skill cross-references, ROUTING.md agent name integrity, settings.json override integrity, and preset CLAUDE.md presence
- `scripts/validate-skills.test.ts` — Unit + integration tests for validation tooling
- `scripts/check-stale.ts` — Flags presets/rules not reviewed in 365 days and cross-checks README.md's quantitative claims (skill/agent/preset/rule/example/command counts) against what's actually on disk
- `scripts/lib/frontmatter.ts` · `scripts/lib/presets.ts` — Shared parsing libraries
- `.github/workflows/repo-ci.yml` — CI: markdown-lint · yaml-lint · typecheck · validate-skills (with tests) · shellcheck · PSScriptAnalyzer · stale-check · SHA-pin verification on every push/PR
- `.github/workflows/release.yml` — Release automation
- `package.json` — `npm test` (node --test) · `npm run validate` · `npm run check`
- `.gitattributes` — normalizes line endings to LF for all text files (CRLF only for `*.ps1`)
