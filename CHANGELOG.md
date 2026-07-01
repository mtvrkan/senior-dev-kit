# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- `.github/workflows/repo-ci.yml` — `install-e2e` matrix job that executes the installer test suite on ubuntu-latest and windows-latest; the windows leg pins tests to Windows PowerShell 5.1 via the new `INSTALL_TEST_SHELL` env override in `scripts/install.test.ts`
- `presets/README.md` — documents how presets activate (installer `--preset` / `--detect`, manual copy, SETUP.md), the `CLAUDE.md` + `compact.md` structure, and the purpose of `generic/fallback` and `generic/monorepo`
- 18 skills gained `argument-hint` frontmatter so direct `/skill-name` invocation shows what `$ARGUMENTS` expects (api-design, bug-fix, code-review, data-modeling, db-change, dep-check, docs-update, feature-build, feature-plan, migration-review, new-page, new-screen, performance-check, refactor-safe, release-check, security-review, test-writer, ui-change)

### Fixed

- `agents/ROUTING.md` — the db-guard → migration-guard hand-off read as both mandatory and optional; now explicit: mandatory forward (schema-design requests always reach migration-guard), optional reverse (a pure migration review runs migration-guard standalone)
- `scripts/check-stale.ts` — a review-table row that fails the expected `| \`name\` | ... | YYYY-MM-DD |` format is now reported as malformed instead of being silently skipped and misreported as an untracked item
- `README.md` — Skills section now explains auto-invoked vs manual-only (`disable-model-invocation`) skills, so skills not referenced by any agent aren't mistaken for orphans

---

## [1.0.1] — 2026-07-01

### Fixed

- `security/workflows/dependency-audit.yml` · `security/workflows/container-scan.yml` — job-level `if: hashFiles(...)` gates always evaluated to `''` (hashFiles runs against the empty pre-checkout workspace), silently skipping every audit/scan job. Replaced with a `detect` job that checks files after a real checkout; downstream jobs now gate on its outputs
- `security/workflows/container-scan.yml` — hadolint job triggered on `**/Dockerfile*` but only linted the root `Dockerfile`; it now lints all `Dockerfile*` variants recursively. Removed the unused `workflow_dispatch` `image` input
- `install.ps1` — set `$ErrorActionPreference = 'Stop'` so a failed copy/backup aborts the install (parity with install.sh's `set -euo pipefail`) instead of continuing to a misleading "Done"; replaced `Join-String` (PowerShell 6.2+) with `-join` so `-Detect` works on stock Windows PowerShell 5.1
- `install.sh` — backup failures now abort with a clear message instead of a raw `cp` error; the preset-category glob and the not-found preset listing no longer break on a missing/empty `presets/` directory

### Added

- `scripts/install.test.ts` — 3 install.ps1 scenarios that previously only covered install.sh: decline-confirmation abort, single CLAUDE.md backup on reinstall, unknown `-Preset` warning without writing CLAUDE.md (61 → 64 tests)

---

## [1.0.0] — 2026-07-01

Initial release.

### Added

#### Core system

- `global-CLAUDE.md` — Global Claude Senior Protocol: hard stops, TOKEN TIER (0-4), agent routing table (20 signals), boot sequence (15+ stacks), OWASP 2025 passive scan, supply chain rules, output format discipline
- `settings.json` / `settings-template.json` — permissions (deny rules for protected files/destructive commands), subagent cost override (`CLAUDE_CODE_SUBAGENT_MODEL=haiku`), skill invocation guards
- `PROJECT-BOOTSTRAP.md` — autonomous project discovery and `.claude/` scaffold generator (PHASE 0 → PHASE 1)
- `SETUP.md` · `INSTALL.md` · `VERIFY.md` · `EXTENDING.md` · `TROUBLESHOOTING.md` · `CONTRIBUTING.md` · `PRESET-MAINTENANCE.md` · `RULES-MAINTENANCE.md` · `AGENTS-MAINTENANCE.md` · `SKILLS-MAINTENANCE.md` · `COMMANDS-MAINTENANCE.md`

#### Agents (17) + routing

`architect` · `bug-hunter` · `db-guard` · `devops-guard` · `docs-writer` · `migration-guard` · `performance-guard` · `researcher` · `reviewer` · `security-guard` · `security-scanner` · `senior-engineer` · `strategist` · `test-engineer` · `ui-fixer` · `writer` · `academic-writer`

- `agents/ROUTING.md` — step-by-step decision tree with conflict resolution and escalation chain, including `db-guard → migration-guard → senior-engineer` sequencing for schema changes
- Guard agents (`db-guard`, `migration-guard`, `security-guard`, `devops-guard`) run `permissionMode: plan` — read-only planning, never direct edits
- `agents/db-guard.md`, `agents/migration-guard.md` share one canonical zero-downtime migration pattern (`agent_docs/zero-downtime-migration.md`) instead of duplicating it

#### Skills (33)

`academic-write` · `api-design` · `api-versioning` · `article-write` · `bug-fix` · `code-audit` · `code-review` · `data-modeling` · `db-change` · `deep-research` · `dep-check` · `docs-update` · `env-audit` · `feature-build` · `feature-plan` · `from-scratch` · `llm-integration` · `migration-review` · `monorepo-task` · `new-page` · `new-screen` · `performance-check` · `plan-first` · `refactor-safe` · `release-check` · `release-gate` · `safe-review` · `security-review` · `security-scan` · `smart-task` · `strategy-plan` · `test-writer` · `ui-change`

- All skill bodies capped at 20 non-blank lines (hard error in `validate-skills.ts`)
- `plan-first` (manual, opus-level override for any risky task) vs. `feature-plan` (auto-fires for feature-shaped work) scope is disambiguated
- Overlapping pairs (`code-review`/`safe-review`, `security-review`/`security-scan`, `data-modeling`/`db-change`, `api-design`/`api-versioning`, `release-check`/`release-gate`) cross-reference each other so the boundary between manual and automated, or design vs. change-analysis, is explicit

#### Rules (11, path-scoped with glob auto-loading)

- `000-security.md` — OWASP 2025 (A01-A10), passive scan (11 checks), language hotspots (8 languages), supply chain rules, dependency-audit commands (14 runtimes)
- `001-conventions.md` — architecture detection, state management, API patterns, modern tech preferences, holistic consistency table
- `100-web.md` — design tokens, 8px grid, three mandatory states (loading/empty/error), motion rules, WCAG 2.2, dark mode, Next.js 15 SEO, CLS prevention
- `200-api.md` — REST conventions, RFC 7807 error format, OpenAPI 3.1, auth requirements, rate limiting, pagination, idempotency, webhook security
- `300-testing.md` — test pyramid ratios, mock policy, AAA pattern, selector stability, minimal spec template, coverage guidance, E2E tools by platform
- `400-mobile.md` — iOS/SwiftUI, Android/Compose, Flutter/Riverpod, React Native/Expo patterns, universal security and accessibility rules
- `500-database.md` — schema-change safety checklist, zero-downtime migration strategy, N+1 prevention, query safety, ORM protocols, Supabase RLS, Firebase rules
- `600-devops.md` — Dockerfile security checklist, GitHub Actions SHA pinning, OIDC, container scanning, IaC (Terraform/K8s), SBOM generation, rollback strategy
- `700-observability.md` — structured JSON logging, correlation IDs, metrics, health endpoints, distributed tracing, error tracking, alert thresholds
- `800-llm-safety.md` — prompt injection prevention, output validation, cost controls, model selection by use case, tool/function safety, agentic flow limits, PII rules
- `900-performance.md` — Core Web Vitals budgets, bundle size limits, API latency budgets, DB query budgets, N+1 detection, render budget, resource leak patterns, concurrency

#### Presets (49, `CLAUDE.md` + `compact.md` each)

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

Every `compact.md` carries 8-15 dense, actionable lines — not a placeholder summary.

#### Commands (12 slash commands)

`smart-task` · `plan-first` · `safe-review` · `security-scan` · `release-gate` · `dep-check` · `perf-check` · `seo-check` · `deep-research` · `strategy-plan` · `write-article` · `agents-guide`

#### Agent docs (15 lazy-load reference files)

`architecture.md` · `design-system.md` · `security-protocols.md` · `api-design-patterns.md` · `error-handling-patterns.md` · `testing-strategy.md` · `seo-patterns.md` · `api-versioning-guide.md` · `dep-check-guide.md` · `env-audit-guide.md` · `from-scratch-guide.md` · `new-page-guide.md` · `new-screen-guide.md` · `academic-writing-guide.md` · `zero-downtime-migration.md`

#### Examples (14 worked walkthroughs)

`nextjs-prisma-postgres` · `fastapi-sqlalchemy-postgres` · `flutter-supabase` · `nestjs-prisma-postgres` · `django-postgres` · `nuxt-drizzle-postgres` · `laravel-mysql` · `rails-postgres` · `dotnet-postgres` · `go-postgres` · `java-spring-postgres` · `rust-axum-postgres` · `kotlin-android-firebase` · `swift-ios-supabase`

#### Install

- `install.sh` — bash installer with `--detect` (auto-detects stack from manifest files: `package.json`, `requirements.txt`/`pyproject.toml`, `go.mod`, `Cargo.toml`, `pubspec.yaml`, `Package.swift`/`.xcodeproj`, `build.gradle`/`.csproj`, `pom.xml`, `Gemfile`, `composer.json`, `bun.lockb`, `deno.json`, `wrangler.toml`, checked framework-specific-before-generic) and `--preset=NAME`
- `install.ps1` — PowerShell equivalent for Windows, matching stack-detection precedence
- Both back up an existing `~/.claude/CLAUDE.md` and any existing `rules/`, `skills/`, `commands/`, `agents/`, `agent_docs/` content to a timestamped sibling before overwriting, so a repeat install never silently destroys a customization
- `scripts/install.test.ts` — end-to-end integration tests: runs each installer against a throwaway `HOME`/`USERPROFILE` and asserts on what actually lands on disk

#### Security templates

- `security/Dockerfile.template` — multi-stage, non-root, health-checked Dockerfile pattern (Node/Python/Go variants)
- `security/dependabot.yml` — distributable Dependabot template covering npm, pip, docker, gomod, cargo, composer, bundler, nuget, pub, maven/gradle, and github-actions
- `.github/dependabot.yml` — this repo's own Dependabot config (github-actions + npm, matching its actual dependencies)
- `security/.gitleaks.toml` — secret-scanning config with a narrowly-scoped placeholder allowlist (only matches obvious placeholder values, not any line merely containing a word like "example")
- `security/.semgrep.yml` — 13 custom SAST rules (SQLi, shell injection, XSS, JWT `alg: none`, mass assignment, unsafe YAML load, hardcoded secrets), validated with `semgrep --validate` and synthetic vulnerable/safe fixtures per rule
- `security/workflows/security-gate.yml` · `container-scan.yml` · `dependency-audit.yml` — secret scan, Semgrep SAST, CodeQL, SBOM generation (CycloneDX + SPDX), container scan; all third-party Actions and container images pinned to full commit SHA / image digest

#### Tooling

- `scripts/validate-skills.ts` — validates skill/agent frontmatter (required/recommended fields, model IDs, closed-set tool-name whitelist), enforces the 20-line skill-body budget and 7-line `compact.md` minimum as hard errors, checks agent↔skill cross-references, `ROUTING.md` agent-name integrity, `settings.json` override integrity, preset `CLAUDE.md` presence, and duplicate frontmatter keys
- `scripts/check-stale.ts` — flags presets/rules/agents/skills/commands not reviewed in 365 days and cross-checks README.md's quantitative claims against what's actually on disk, in both directions (disk entries missing from a maintenance table, and table rows with no matching file)
- `scripts/check-links.ts` + `scripts/lib/links.ts` — scans every markdown file for relative links that resolve to a non-existent file (`npm run link-check`), skipping fenced/inline code spans, external URLs, and anchor-only links
- `scripts/lib/frontmatter.ts` · `scripts/lib/presets.ts` — shared parsing libraries
- `.github/workflows/repo-ci.yml` — CI: markdown-lint · yaml-lint · typecheck · validate-skills (with unit + integration tests) · shellcheck · PSScriptAnalyzer · stale-check · SHA-pin verification on every push/PR
- `.github/workflows/release.yml` — tags a GitHub Release from the matching `CHANGELOG.md` entry; fails loudly if no entry exists for the tagged version
- `package.json` — `npm test` · `npm run validate` · `npm run stale-check` · `npm run link-check` · `npm run typecheck` · `npm run check`
- `.gitattributes` — normalizes line endings to LF for all text files (CRLF only for `*.ps1`, plus a UTF-8 BOM so Windows PowerShell 5.1 reads the Unicode arrows/checkmarks correctly regardless of system codepage)

### Fixed (pre-release hardening)

Issues found and closed during internal review before this first release, grouped by area:

- **Install scripts** — `install.ps1`'s file-count helper no longer returns a blank count for single-file directories; both installers now back up `rules/`/`skills/`/`commands/`/`agents/`/`agent_docs/` (not just `CLAUDE.md`) before a repeat install overwrites them; preset lookup takes the first match instead of the last; stack-detection precedence is documented inline; Python detection only greps files that actually exist.
- **Validation tooling** — `check-stale.ts` no longer silently passes on a malformed `STALE_AFTER_DAYS` value or a drifted maintenance-table format, and cross-references maintenance tables against disk in both directions; `validate-skills.ts` validates tool-name content (not just presence) and catches duplicate frontmatter keys; `check-links.ts` no longer false-positives on links shown as markdown-syntax examples inside code spans.
- **CI & security config** — GitHub Actions SHA-pin detection catches full-semver tags, not just bare majors; `security/.gitleaks.toml`'s placeholder allowlist no longer suppresses detection on any line merely containing a word like "example"; `security/.semgrep.yml`'s 13 rules were re-validated end-to-end (one YAML parse error had silently disabled all of them; five used AND-combined patterns that could never match; several had structurally-wrong wildcards) and now fire correctly against synthetic fixtures; `security/dependabot.yml` covers every ecosystem this kit ships a preset for; `.github/dependabot.yml` covers this repo's own npm dependencies; `release.yml`'s changelog-extraction is a literal substring match instead of an unescaped regex.
- **Presets & rules** — the `postgres` preset gained `CREATE INDEX CONCURRENTLY` / `NOT VALID` + `VALIDATE CONSTRAINT` / `jsonb` guidance to match sibling database presets; the `go-api` preset's error-handling example now compiles; `agents/db-guard.md` and `rules/500-database.md`'s zero-downtime step lists were corrected to match the canonical `agent_docs/zero-downtime-migration.md` sequence (Expand → Write-both → Backfill → **Add-constraint** → Contract); `typeorm`/`sequelize` presets are flagged as existing-project-only, since `001-conventions.md` prefers Prisma/Drizzle for new projects.
- **Skills & agents** — `article-write`/`deep-research`/`strategy-plan` gained the `argument-hint` field their `$ARGUMENTS`-reading siblings already had; `db-change`'s `allowed-tools` no longer includes `Edit`/`Write` (it only produces a plan); several skill pairs gained cross-reference sentences so their scope boundary is explicit; `global-CLAUDE.md`'s natural-language routing signals now cover `migration-guard`/`researcher`/`strategist`, not just 14 of the 17 agents.
- **Documentation accuracy** — agent/skill/preset/example counts in `README.md`, `SETUP.md`, `INSTALL.md`, `VERIFY.md`, `TROUBLESHOOTING.md`, and all 14 `examples/*.md` now match what's actually on disk (18 files in `agents/` including `ROUTING.md`, 15 `agent_docs/`, etc.); `CONTRIBUTING.md`/`EXTENDING.md` correctly separate required vs. optional frontmatter fields and document `model`/`effort`/`argument-hint`/`disable-model-invocation`; install docs no longer conflate `.claude/CLAUDE.md` with `.claude/stack-rules.md`.
