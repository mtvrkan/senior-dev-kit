# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### BREAKING

- `commands/perf-check.md` → `commands/performance-check.md` and `commands/write-article.md` → `commands/article-write.md` — the two commands whose names diverged from their skill counterparts now match them exactly. Migration: invoke `/performance-check` and `/article-write`; if you copied the old files into a project's `.claude/commands/`, delete `perf-check.md` / `write-article.md` and copy the renamed files in

### Added

- `hooks/` — deterministic enforcement layer: the `protected-paths.mjs` PreToolUse hook intercepts any Edit/Write/NotebookEdit into secrets, auth, payment, migration, or CI/IaC paths and downgrades it to an explicit permission prompt naming the responsible guard agent — a harness guarantee on top of the CLAUDE.md prompt-level hard stops. Fails open on unknown input, `.env.example`-style templates excluded, `SDK_ALLOW_PROTECTED=1` escape hatch, opt-in by design (installers copy it, never activate it); 22 behavior tests in `scripts/hooks.test.ts`; `hooks/hooks.json` wires it automatically in plugin installs
- `.claude-plugin/` — Claude Code plugin + marketplace manifests, so the kit installs via `/plugin marketplace add` + `/plugin install` with commands/agents/skills/hooks registering automatically
- `bin/cli.mjs` + package.json `bin`/`files` — `npx senior-dev-kit [--detect | --preset=<name>]` wrapper that picks the right installer per platform and forwards flags; installers stay the single source of truth
- `eval/golden-prompts.json` + `scripts/routing-eval.ts` — routing behavior under test: 33 realistic TR+EN prompts pinned to expected agents. Static half (agents exist, every agent covered, no duplicates) runs in `npm run check` and a new repo-ci job; live half (`RUN_ROUTING_EVAL=1`) asks the model to route each prompt via the `claude` CLI and fails below the 90% threshold — manual/weekly via `.github/workflows/routing-eval.yml`
- `skills/kit-doctor` + `commands/kit-doctor.md` — read-only installation diagnosis (component counts vs shipped, settings parse + deny-rule floor, hook wiring state, version drift, routing-table integrity) with a COMPONENT/EXPECTED/FOUND verdict table; counts across README/INSTALL/SETUP/VERIFY updated to 34 skills / 13 commands
- `examples/with-vs-without-kit.md` — the same three requests (schema change, mobile CSS fix, "fix CSS in the login form") handled with and without the kit, labeled illustrative; examples count now 15
- `README.tr.md` — full Turkish README with language switcher links in both directions
- `.github/ISSUE_TEMPLATE/` — bug report (with kit-doctor output field) and preset request forms
- `_config.yml` — zero-build GitHub Pages config (Cayman theme, tooling excluded) so the markdown docs render as a site by enabling Pages
- `install.sh` / `install.ps1` — copy `hooks/` to `~/.claude/hooks/` (explicitly announced as opt-in, not activated); installer e2e tests assert the new directory
- ESLint (flat config, typescript-eslint) for `scripts/` — new `npm run lint`, wired into `npm run check` and a new SHA-pinned `eslint` CI job; `devDependencies` gain `eslint`, `typescript-eslint`, `@eslint/js`
- `scripts/validate-skills.test.ts` — output-format contract tests pinning the machine-greppable summary-line shapes of validate-skills.ts, check-stale.ts, and check-links.ts so a reworded summary is a deliberate change, not an accident
- `*-MAINTENANCE.md` (all five) — a note above each review table explaining that the clustered 2026-06-30/07-01 dates are the v1.0–v1.0.1 release baseline (a real item-by-item review), with later edits staggering dates naturally

- `.github/workflows/repo-ci.yml` — `install-e2e` matrix job that executes the installer test suite on ubuntu-latest, macos-latest, and windows-latest; the windows leg pins tests to Windows PowerShell 5.1 via the new `INSTALL_TEST_SHELL` env override in `scripts/install.test.ts`, the macOS leg guards install.sh against bash-4-only syntax (macOS ships bash 3.2)
- `presets/README.md` — documents how presets activate (installer `--preset` / `--detect`, manual copy, SETUP.md), the `CLAUDE.md` + `compact.md` structure, and the purpose of `generic/fallback` and `generic/monorepo`
- 18 skills gained `argument-hint` frontmatter so direct `/skill-name` invocation shows what `$ARGUMENTS` expects (api-design, bug-fix, code-review, data-modeling, db-change, dep-check, docs-update, feature-build, feature-plan, migration-review, new-page, new-screen, performance-check, refactor-safe, release-check, security-review, test-writer, ui-change)
- `scripts/lib/links.ts` · `scripts/check-links.ts` — the link checker now validates anchors: same-file `#section` links and cross-file `file.md#section` links are checked against the target file's actual headings (GitHub-style slugs, duplicate `-1`/`-2` suffixes, `<a id/name>` anchors); previously `file.md#nonexistent` passed silently
- `README.md` — "Which option do I need?" decision table at the top of Quick Start: scope choice (global vs per-project) plus an explicit callout that Option A generates a lean 7-agent team rather than installing the full kit
- `PROJECT-BOOTSTRAP.md` — "How this relates to the rest of the kit" note clarifying the generated 7-agent roster is intentionally different from the kit's 17 prebuilt agents, and how to layer the full kit on top afterwards
- `CONTRIBUTING.md` — "Adding a Command" section (commands were the only tracked content type without contribution docs); documented the cosmetic `color` agent frontmatter field; noted the 20-line skill body limit is enforced as a hard error by `npm run validate`
- `SECURITY.md` — "Security CI Templates" section pointing to `security/` so the reusable user-project workflows are discoverable
- `UPGRADE.md` ↔ `TROUBLESHOOTING.md` — cross-links between the upgrade guide and the "Version mismatch problems" troubleshooting section
- `commands/*.md` — all 12 commands gained YAML frontmatter (`description`, plus `argument-hint` where the body substitutes `$ARGUMENTS`), so `/` autocomplete shows what each command does and expects; previously commands were the only content type without structured, validated frontmatter
- `scripts/validate-skills.ts` — two new validation sections: command frontmatter (missing `description` is a hard error; `$ARGUMENTS` without `argument-hint` warns) and global-CLAUDE.md routing targets (every agent name the AGENT ROUTING table or the natural-language signal block points to must exist as `agents/<name>.md`)
- `install.sh` / `install.ps1` — post-copy verification: after each component copy the installer compares the destination file count against what the kit ships and aborts on a shortfall, so a truncated or partial copy can no longer end in a misleading "Done"
- `settings.json` / `settings-template.json` — three `sudo` elevation deny rules (`sudo rm`, `sudo chmod`, `sudo chown`) for defence-in-depth alongside the existing destructive-command denials
- `settings.json` / `settings-template.json` — nine more deny variants closing bypass forms of existing rules: `chmod -R 777` / `chmod 000` / `chmod -R 000` (the rule only matched literal `chmod 777`), `rm -fr /` / `rm -fr ~` / `rm -fr .` (flag-order variant, same class as the earlier pip `--break-system-packages` ordering fix), `curl * | sh` / `wget * -O- | sh` (only `| bash` was denied), and `npx -y *` (only the long `--yes` flag was denied)
- `scripts/validate-skills.test.ts` — new unit coverage: GitHub-slug anchor extraction (duplicate `-1`/`-2` suffixes, `<a id>` anchors, code fences, HTML comments, malformed percent-encoding), malformed model IDs rejected as errors (not warnings), command frontmatter validation, and routing-target validation
- `README.md` — Windows path callout in Quick Start; `VERIFY.md` — pointer to the automated `/smart-task verify kit installation` route; `CONTRIBUTING.md` — operational explanation of what `permissionMode: plan` does, a frontmatter-based "Adding a Command" guide, and a note on which part of an agent file is authoritative (description = routing surface, body = behavior contract); `UPGRADE.md` — clarified the roles of `settings.json` (kit reference) vs `settings-template.json` (install copy) and the merge-don't-replace rule
- `agents/ROUTING.md` — one-line precedence order at the top (guard-area noun > stack trace > task-type verb) so tie-breaking is stated centrally instead of scattered across the conflict-resolution table
- `skills/bug-fix`, `skills/migration-review`, `skills/refactor-safe` — explicit "Deep reference" pointers to the `agent_docs/` files that carry their detailed patterns (error-handling, zero-downtime migration, testing-strategy/architecture)
- `settings.json` / `settings-template.json` — 17 more deny variants closing remaining bypass forms (39 → 56 rules): `pip3 install --break-system-packages` (both flag orders — only `pip` was denied), `bash <(curl …)` / `sh <(curl …)` / `bash <(wget …)` / `sh <(wget …)` process substitution (only the pipe form was denied), `chmod --recursive 777/000` (long-flag form), `rm -rf ~/` / `rm -rf ./` / `rm -rf /*` and the `-fr` equivalents (trailing-slash and glob forms of already-denied targets), and `find . -delete` / `find / -delete` / `find ~ -delete`; SECURITY.md deny-rule count updated to match
- `.gitignore` — patterns for ad-hoc review/analysis artifacts (`CODE_*_REPORT.txt`, `code_blocks_report.txt`, etc.) so scratch reports can't be committed by accident
- `skills/code-review`, `skills/feature-build` — explicit "Do not use for" boundary lines routing to the neighboring skill (`security-review`/`code-audit`/`dep-check`/`release-gate` and `bug-fix`/`ui-change`/`feature-plan`/`from-scratch` respectively)
- `skills/db-change`, `skills/data-modeling` — "Deep reference" pointers to `agent_docs/zero-downtime-migration.md` and `agent_docs/architecture.md`
- `skills/smart-task`, `skills/feature-plan` — explicit handling for empty/vague `$ARGUMENTS` (infer from conversation → ask one specific question / surface gaps in `OPEN:`) plus sharper `argument-hint` text
- `settings.json` / `settings-template.json` — 32 more deny rules (56 → 88): download-pipe-execute via `zsh` and `wget -qO-`, disk destruction (`dd of=/dev/…`, `mkfs`, `shred`), Windows recursive deletes (`rd /s`, `rmdir /s`, `Remove-Item -Recurse -Force`), git data-loss commands (`branch -D main/master`, `push --delete`, `push origin :…`, `reflog expire`), and Read rules for home-directory credential stores (`~/.aws/**`, `~/.kube/config`, `~/.npmrc`, `~/.netrc`, `~/.docker/config.json`, `~/.pgpass`, `~/.vault-token`, Gradle/Maven credentials, shell history) plus project-relative `.npmrc`/`.netrc`
- `SECURITY.md` — scope note stating plainly that deny rules are prefix/glob matchers (defence-in-depth, not a sandbox) and naming the layers above them

### Removed

- `settings.json` / `settings-template.json` — the `skillOverrides` key: it is not a documented Claude Code setting, so it was silently ignored. The behavior it promised (making `smart-task`, `plan-first`, `safe-review`, `release-gate` manual-only) is already delivered by `disable-model-invocation: true` in those skills' frontmatter — the documented mechanism. The validator's skillOverrides cross-reference check became a plain settings.json parse check; INSTALL.md / SETUP.md / UPGRADE.md merge instructions no longer tell users to preserve the dead key

### Changed

- `scripts/validate-skills.ts` — an unknown model ID that still looks like a Claude ID (`claude-...`) is now a warning instead of a hard error, so a newly released model doesn't break CI before `VALID_MODELS` is updated; malformed/non-Claude IDs remain errors (new regression test covers this)
- `.github/workflows/repo-ci.yml` — the SHA-pin check now counts scanned workflow files and fails if zero were found (previously a moved/renamed workflows directory produced a vacuous "All actions are SHA-pinned" pass); also scans `*.yaml` in addition to `*.yml` and no longer suppresses `find` errors
- `.github/workflows/release.yml` — both run steps now set `set -euo pipefail` explicitly
- `security/workflows/dependency-audit.yml` · `security/workflows/container-scan.yml` — the detect jobs' multi-line `run:` blocks now set `set -euo pipefail`, so a failed write to `$GITHUB_OUTPUT` fails the step instead of silently producing empty outputs (which would skip every downstream audit/scan job)
- `scripts/lib/links.ts` — HTML comment blocks (`<!-- -->`) are blanked out before link/anchor extraction, so commented-out headings no longer count as anchor targets and commented-out links are not checked; reported line numbers are preserved
- `scripts/validate-skills.test.ts` / `scripts/install.test.ts` — repo-root resolution now uses `fileURLToPath` instead of a hand-rolled Windows drive-letter regex on `URL.pathname`
- `scripts/check-stale.ts` — the malformed-row regex is compiled once at module scope instead of per file scan
- `scripts/validate-skills.ts` — routing-table parsing is now scoped to the "## AGENT ROUTING" section and flags malformed rows (swapped columns) as errors instead of silently skipping them; a missing default `global-CLAUDE.md` is now itself a validation error; a command that declares `argument-hint` without using `$ARGUMENTS` now warns
- `scripts/lib/links.ts` — the cross-file anchor cache is shared across the whole check run instead of rebuilt per source file
- `.github/workflows/repo-ci.yml` — new `check-links` job so broken internal links/anchors fail CI, not just the local `npm run check`
- `scripts/validate-skills.ts` — the three copies of the required-frontmatter-field loop (skills, agents, commands) are unified behind a `missingRequiredFields` helper
- `scripts/validate-skills.test.ts` / `scripts/install.test.ts` — temp directories are tracked and force-removed in an `after()` suite hook; previously the `rmSync` at the end of each test never ran when an assertion threw, leaking the directory
- `scripts/check-stale.ts` — the "README.md count claims match disk" success line is only printed when README.md was actually found and checked
- `PRESET-MAINTENANCE.md` — `supabase` and `cloudflare-workers` version columns pin concrete minimums (supabase-js 2.x · CLI 1.x+, Wrangler 3+) instead of "latest"
- `skills/article-write` — Turkish-output wording harmonized with `agents/writer.md` and `commands/article-write.md` ("If writing in Turkish: natural language, not machine-translated tone")

### Fixed

- **8 unresolvable action SHA pins** — the first real GitHub run failed with "Unable to resolve action": `ibiqlik/action-yamllint`, `actions/setup-go`, `actions/upload-artifact` (×2), `anchore/sbom-action` (+`download-syft`), `docker/build-push-action`, `docker/setup-buildx-action`, and `gitleaks/gitleaks-action` were pinned to SHAs that don't exist upstream (some were near-miss corruptions of the real SHA — hand-typed, never verified). All 8 replaced with the real commit SHAs of their claimed version tags, resolved live from the GitHub API. The `check-sha-pins` CI job gains a second step that verifies every pinned SHA actually resolves upstream (via `github.token`), so a format-valid-but-nonexistent pin can never land again
- `install.ps1` — first real CI run of the PSScriptAnalyzer job surfaced pre-existing warnings that had never executed on GitHub before: `Count-Files`/`Verify-Copy`/`Backup-DirIfExists` renamed to the approved-verb, singular-noun forms `Get-FileCount`/`Test-Copy`/`Backup-Dir`, and the installer's deliberate interactive `Write-Host` output is now suppressed with a documented justification attribute instead of tripping `PSAvoidUsingWriteHost` (14/14 e2e tests still green)
- `.github/ISSUE_TEMPLATE/preset_request.yml` — 204-character description line folded under yamllint's 200-char limit (the one hard error in the first YAML Lint CI run)
- `INSTALL.md` — the expected-files tree claimed "33 skills" but listed only 32: `code-audit/SKILL.md` was missing from the tree (added in the code-audit release, never reflected here)
- `scripts/lib/frontmatter.ts` / `scripts/lib/links.ts` / `scripts/validate-skills.ts` — a UTF-8 BOM (common when files are saved by Windows editors) no longer breaks validation: `parseFrontmatter` and `findDuplicateFrontmatterKeys` would misreport a BOM'd file as having no frontmatter, the link checker would miss a first-line heading as an anchor target, and the agent→skill cross-reference would silently skip a BOM'd agent file; all entry points now share a `stripBom` helper (regression test added)
- `agents/ROUTING.md` — the db-guard → migration-guard hand-off read as both mandatory and optional; now explicit: mandatory forward (schema-design requests always reach migration-guard), optional reverse (a pure migration review runs migration-guard standalone)
- `scripts/check-stale.ts` — a review-table row that fails the expected `| \`name\` | ... | YYYY-MM-DD |` format is now reported as malformed instead of being silently skipped and misreported as an untracked item
- `README.md` — Skills section now explains auto-invoked vs manual-only (`disable-model-invocation`) skills, so skills not referenced by any agent aren't mistaken for orphans
- `install.sh` — `--detect` reads `package.json` via `$(<...)` instead of spawning `cat`
- `SECURITY.md` — deny-rule count corrected (the list had grown past the documented 25; now 39 after the sudo, chmod-variant, and bypass-variant additions)
- `install.sh` — the confirm prompt used `${confirm,,}` (bash 4+ lowercase expansion), which fails with "bad substitution" on macOS's default bash 3.2; replaced with a POSIX `case` match
- `presets/ai/llm-integration/CLAUDE.md` — RAG example used an `openai` client that was never imported or initialized (now explicit, with a note that Anthropic has no embeddings API); `voyage-3` was mislabeled "(Anthropic)" — it is a Voyage AI model that Anthropic recommends; the model table's `opus-4-8` shorthand expanded to the full `claude-opus-4-8` ID
- `presets/api/graphql/CLAUDE.md` — the subscriptions example imported `PubSub` (unused) but not `withFilter` (used), and the `redisPublisher`/`redisSubscriber` clients appeared from nowhere; imports now match what the snippet actually uses
- `examples/flutter-supabase.md` — the cost table attributed Flow A's new-screen task to senior-engineer/sonnet while the flow itself (and ROUTING.md) routes new screens to ui-fixer/haiku; the row now matches the flow
- `examples/laravel-mysql.md` · `examples/rails-postgres.md` — the schema-change flows claimed "migration keyword → migration-guard" although the input is a schema signal that routes to db-guard, and the escalation line used migration-guard's reason text; both now say "DB schema signal → db-guard" / "schema change detected", matching ROUTING.md and rules/500-database.md
- `examples/README.md` — the post-install `.claude/rules/` tree stopped at `600-devops.md`; now lists all 11 rules including `700-observability`, `800-llm-safety`, `900-performance`
- `CHANGELOG.md` — the v1.0.0 command enumeration still showed `perf-check` / `write-article` with no hint they were renamed; annotated as historical names
- `install.ps1` — the `-Preset` lookup no longer aborts with a raw PowerShell error when `presets/` is missing from the kit copy; it warns gracefully, matching install.sh behavior

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

> Historical v1.0.0 names — `perf-check` and `write-article` were renamed to `performance-check` and `article-write` after this release (see Unreleased).

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
