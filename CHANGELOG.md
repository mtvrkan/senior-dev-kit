# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Fixed

- `global-CLAUDE.md` — three session-token-bloat bugs that let context grow far past the kit's own "SESSION DISCIPLINE" target before Claude Code's automatic compaction ever kicked in: (1) BOOT SEQUENCE ran unconditionally every session with no tier gate, so even a Tier 0 one-line fix paid for 6+ silent file reads; (2) path-scoped rules under RULES REFERENCE (e.g. `700-observability.md` and `900-performance.md`, whose globs both match nearly every `.ts`/`.py`/`.go`/`.java`/`.cs` file) had no "load once per session" instruction, so touching N files of the same type could re-load the same full rule file N times; (3) "`/compact at 250k tokens`" read as something the model executes, but `/compact` is a user-facing slash command with no model-callable equivalent and the model has no tool to introspect its own token usage, so the instruction was a structural no-op. Gated BOOT SEQUENCE by tier, added an explicit once-per-session cache rule for all path-scoped rules, and reworded SESSION DISCIPLINE into an actionable nudge (tell the user to `/compact` or start fresh) instead of a phantom self-command.
- `settings.json` / `settings-template.json` — 8 of the `curl|wget <(...)` process-substitution deny rules (`Bash(bash <(curl *)`, and the `/bin/bash`, `sh`, `/bin/sh` × `curl`/`wget` variants) were missing their closing parenthesis, e.g. `"Bash(bash <(curl *)"` instead of `"Bash(bash <(curl *))"`. Claude Code's own settings schema validator rejects a settings.json containing these malformed rules outright (caught while wiring the deny list into a live install); a plain file copy doesn't validate at write time, so the break was silent until the rules were actually loaded. Deny rule count unchanged at 119 (syntax fix only, no rules added or removed).

---

## [1.0.1] — 2026-07-02

### Fixed

- `hooks/protected-paths.mjs` — the hook matched only the literal `tool_input.file_path` string, so a symlink whose name didn't look protected (e.g. `config.json` pointing at `.env`) could reach a protected file without tripping the prompt. Now resolves the path with `realpathSync` (falling back to the literal path when the target doesn't exist yet, e.g. a new `Write`) and matches both; `scripts/hooks.test.ts` adds a symlink-alias regression case (123 → 124 tests, skipped gracefully on machines without symlink privileges).
- `scripts/validate-skills.ts` — the skill-body line-count check found the end of the frontmatter block with a manual `indexOf('\n---', ...)` scan instead of reusing the file's already-correct `parseFrontmatter` regex, so a literal `\n---` inside a skill's body (e.g. a YAML code sample) could throw off the line count. Extracted the shared boundary logic into `getBodyAfterFrontmatter()` in `scripts/lib/frontmatter.ts` and switched both call sites to it.
- `rules/000-security.md` — clarified "(enforcement active Aug 2025)" to "(enforced since Aug 2025)" for the GitHub Actions SHA-pinning rule; the old phrasing read ambiguously long after that date passed.
- `settings.json` / `settings-template.json` — the `curl|wget | bash/sh/zsh`, process-substitution, and `-c` inline-interpreter deny rules matched only the bare interpreter name; added `/bin/`- and `/usr/bin/`-qualified path variants (e.g. `curl * | /bin/bash`) so the literal-string matcher can't be bypassed by spelling out the interpreter's full path. Deny rule count: 101 → 119. `SECURITY.md` updated to match.
- `hooks/protected-paths.mjs` — the DB schema/migration category only matched a `migrations?/` directory, missing Rails' `db/migrate/` (singular), Drizzle's default `drizzle/` output dir, Alembic's `alembic/versions/`, and timestamped/numbered migration filenames living outside any of those conventions. Added patterns for all four; added matching cases to `scripts/hooks.test.ts` (119 → 123 tests).
- `skills/code-review/SKILL.md` — resolved a scope contradiction: the skill said "do not use for security-focused audits" while its own checklist included an auth-gap check. Clarified that code-review's auth/injection items are an inline sanity check on the diff, not a substitute for `security-review`; same fix for the performance item vs. `performance-check`.
- `presets/backend/django/compact.md` — the frontend-detection line named "plain Blade templates" as Django's no-frontend-framework fallback; Blade is Laravel's templating engine, not Django's (a copy/paste leftover from the Laravel preset). `presets/backend/django/CLAUDE.md` already correctly says "Plain Django templates" — compact.md now matches.

### Changed

- `agents/ROUTING.md` — added a Mermaid flowchart summarizing the Step 1–4 decision tree as a reading aid alongside the authoritative tables
- `rules/700-observability.md` / `rules/900-performance.md` — cross-referenced each other with a `Related:` note; the two rules auto-load for nearly identical glob sets (logging vs. latency/bundle budgets on the same files). Made explicit in both files and in `rules/001-conventions.md`'s scope-signals table that this is intentional co-loading, not an unresolved precedence conflict — the two rules never give contradictory instructions.
- `skills/feature-plan/SKILL.md` / `skills/plan-first/SKILL.md` — sharpened the auto-fire vs. manual-override distinction with a concrete rule ("names a thing to build" vs. refactor/config/ambiguous work) instead of just "features vs. non-features."
- `skills/performance-check/SKILL.md` — added a one-line cross-reference clarifying its relationship to `code-review`'s inline perf flag.

---

## [1.0.0] — 2026-07-02

Initial public release.

### Agents (17)

Routed agent roster covering implementation, review, and hard-stop guards: `architect`, `bug-hunter`, `db-guard`, `devops-guard`, `docs-writer`, `migration-guard`, `performance-guard`, `researcher`, `reviewer`, `security-guard`, `security-scanner`, `senior-engineer`, `strategist`, `test-engineer`, `ui-fixer`, `writer`, `academic-writer`. Guard agents (`security-guard`, `db-guard`, `migration-guard`, `devops-guard`) run with `permissionMode: plan` — they produce a written plan and pause for explicit approval before any implementation, enforced by CI (a guard agent missing `permissionMode: plan` fails `npm run validate`). `agents/ROUTING.md` documents the full decision tree: hard-stop check → stack-trace signal → guarded-domain signal → task-type signal → ambiguity resolution, plus a conflict-resolution table for when two signals match.

### Skills (34)

Auto-invoked, description-matched playbooks across application work, data/API design, quality/security, DevOps/environment, content/research, and orchestration. Hand-off chains between design-phase and deployment-phase skills (`db-change` → `migration-review`, `data-modeling` → `db-change`, `api-design` → `api-versioning`) are checked by `npm run validate`, which flags a hand-off pointing at a renamed or removed skill. Every skill body stays ≤20 non-blank lines by the same check; longer detail lives in `agent_docs/` and is lazy-loaded on demand.

### Rules (11)

Path-scoped engineering standards auto-loaded by glob match: `000-security` (always active, OWASP 2025 passive scan), `001-conventions`, `100-web`, `200-api`, `300-testing`, `400-mobile`, `500-database`, `600-devops`, `700-observability`, `800-llm-safety`, `900-performance`. `600-devops` pins IaC scanner recommendations (Checkov, Trivy) to specific released versions rather than `latest`, matching the SHA-pinning discipline the rule requires of GitHub Actions.

### Commands (13) and Presets (49)

13 rich slash commands (`/smart-task`, `/plan-first`, `/safe-review`, `/security-scan`, `/release-gate`, `/dep-check`, `/performance-check`, `/seo-check`, `/deep-research`, `/strategy-plan`, `/article-write`, `/agents-guide`, `/kit-doctor`) plus all 34 skills invocable by name. 49 stack-specific presets (98 files: `CLAUDE.md` + `compact.md` each) across web, backend, ORM, database, mobile, API, runtime, infrastructure, messaging, AI, and generic categories — see `PRESET-MAINTENANCE.md` for the version-support matrix and deprecation lifecycle.

### Enforcement layer

- `hooks/protected-paths.mjs` — deterministic `PreToolUse` hook: any Edit/Write/NotebookEdit into secrets, auth, payment, DB migration, or CI/IaC paths is downgraded to an explicit permission prompt naming the guard agent responsible, regardless of what the model decided. Fails open on unrecognized input. An `SDK_ALLOW_PROTECTED=1` escape hatch skips the prompt for an approved session and logs a structured `hook.protected_path.bypassed` audit line to stderr, so a skipped prompt stays visible instead of disappearing silently. Opt-in — installers copy it but never wire it into `settings.json` automatically; the Claude Code plugin registers it automatically.
- `settings.json` / `settings-template.json` — a Read/Bash deny list covering secret-file reads, destructive deletes, disk-destroying commands, git history rewrites, download-pipe-execute patterns, and permission-bypass installs. Cost is measured, not guessed: `npm run deny-cost` replays your own transcript history against the list (see `SECURITY.md` for the documented false-positive trade-offs, e.g. `rm -rf /*` denying all absolute-path deletes under Git Bash on Windows).

### Distribution

- `install.sh` / `install.ps1` — idempotent installers with collision-safe timestamped backups, post-copy file-count verification, and `--detect`/`-Detect` stack auto-detection across 17 framework/language signals.
- `bin/cli.mjs` — `npx senior-dev-kit [--detect | --preset=<name>]` wrapper, no clone required (Node 22.6+).
- `.claude-plugin/` — Claude Code plugin + marketplace manifest; `/plugin marketplace add` + `/plugin install` registers commands, agents, skills, and the protected-path hook automatically.
- `PROJECT-BOOTSTRAP.md` (new-project autonomous setup) and `SETUP.md` (existing-project setup, Claude-driven) as alternatives to running the shell installers directly.

### CI and verification

- `.github/workflows/repo-ci.yml` — markdown lint, YAML lint, typecheck, eslint, skill/agent/preset frontmatter validation, shellcheck, PSScriptAnalyzer, install end-to-end tests across ubuntu/macOS/windows, internal link check, staleness check, and a meta job that resolves every pinned GitHub Actions SHA against the upstream API. All Actions across all workflows are pinned to full commit SHAs, including in the workflows that check the pins.
- `eval/golden-prompts.json` + `scripts/routing-eval.ts` — 33 realistic TR+EN routing prompts pinned to the agent that should handle them. The static half (agents exist, every agent covered, no duplicates) runs on every push; the live half asks the model to actually route each prompt via the `claude` CLI and fails below a 90% pass threshold. Measured, not assumed: the first live run scored 28/33 (85%) and exposed real gaps in `ROUTING.md`; after closing them, two consecutive live runs scored 32/33 (97%).
- 119 unit/integration tests (`scripts/*.test.ts`) covering skill/agent/command frontmatter validation, hand-off chain integrity, install script behavior on both platforms, and hook behavior (protected-path matching, case-insensitive filesystem handling, audit logging on bypass).

### Security

- `SECURITY.md` documents the reporting process, response timeline, and the five defence-in-depth layers: the deny list, guard-agent plan gates, the OWASP 2025 passive scan, SHA-pinned Actions, and secret-file read protection.
- `security/` ships reusable CI templates for **user projects**: dependency audit, container scan, and security-gate GitHub Actions workflows, a hardened multi-stage `Dockerfile.template`, `.gitleaks.toml`, `.semgrep.yml`, and a Dependabot config — separate from this repo's own CI.
