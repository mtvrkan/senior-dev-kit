# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Changed

- `agents/ROUTING.md` — added a Mermaid flowchart summarizing the Step 1–4 decision tree as a reading aid alongside the authoritative tables
- `rules/700-observability.md` / `rules/900-performance.md` — cross-referenced each other with a `Related:` note; the two rules auto-load for nearly identical glob sets (logging vs. latency/bundle budgets on the same files)

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
