# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Removed

- `academic-writer` agent + `academic-write` skill + `agent_docs/academic-writing-guide.md`, `writer` agent + `article-write` skill/command, `strategist` agent + `strategy-plan` skill/command — out of scope for a code/design dev kit (academic writing, general content marketing, and product/business strategy are not software engineering or design work). `researcher`/`deep-research` kept — technology comparison and fact-checking directly serve engineering decisions. Kit now ships 14 agents, 31 skills, 11 commands, 15 agent_docs.

### Changed

- `agents/academic-writer.md`, `agents/devops-guard.md`, `agents/architect.md` — trimmed duplicated "HARD CONSTRAINTS — mirrored" blocks and inlined reference material that already lived in `agent_docs/`; extended to `security-guard`, `db-guard`, `migration-guard`, `performance-guard` (mirrored-constraints removal only — their bodies had no agent_docs duplication).
- `agents/*.md`, `skills/*.md` `model:` frontmatter — full dated model IDs (`claude-opus-4-8`, ...) converted to generic aliases (`opus`, `sonnet`, `haiku`) so definitions track Anthropic's current snapshot per tier instead of going stale; full IDs remain valid for deliberate pinning. `CLAUDE_CODE_SUBAGENT_MODEL` in `settings.json`/docs/examples aligned to the same alias convention (was a mix of alias in `global-CLAUDE.md` prose vs full dated ID everywhere else).
- `agents/writer.md` `effort: high` → `medium` before removal (kept for the record: content production doesn't need the deep-reasoning tier).
- 15 skills whose own procedure is long/noisy (broad reads, multi-source research, log/test analysis) gained `context: fork` + `agent:` to isolate that work in the target agent's own context instead of the main conversation.
- `agents/performance-guard.md` — added a "Navigation / routing layer" checklist (route-change remounts, missing prefetch, synchronous third-party script loading) so a performance pass starts from known common causes instead of rediscovering them.
- `global-CLAUDE.md` — removed the `SECURITY — U-SHAPE END` section (fully redundant with the always-loaded `rules/000-security.md`, which covers every point in more detail) and trimmed two smaller redundant command lists (`AUTO-TEST`'s test-command list duplicated the file's own `BOOT SEQUENCE` stack table; `DEPENDENCY AUDIT`'s command list duplicated `rules/000-security.md`'s table) — cuts the always-loaded floor with zero information loss. `CONTEXT BUDGET` gained two levers: drop unused MCP servers (their tool schemas load into context regardless of use), and parallel subagents cost roughly N× tokens, not N÷.
- Cross-file redundancy trimmed where the duplicate is genuinely co-loaded with its source (not just similar-looking text that never loads together): `agent_docs/security-protocols.md` (OWASP category list restated from `rules/000-security.md`; GitHub Actions SHA-pin example and SBOM commands restated from `agent_docs/devops-security-guide.md`), `agent_docs/api-design-patterns.md` (migration-guide format and deprecation-header example restated from `agent_docs/api-versioning-guide.md`), `agent_docs/from-scratch-guide.md` (spacing/typography/motion values restated — and drifted — from `agent_docs/design-system.md`), `presets/web/nextjs-saas/CLAUDE.md` (SEO/AEO section restated from `rules/100-web.md`, which is already Next.js-specific and co-loads for every `.tsx` file), `presets/web/{react-vite,angular,vue-nuxt,sveltekit}/CLAUDE.md` ("Universal rules" loading/empty/error one-liners restated from `rules/100-web.md`'s THREE MANDATORY STATES), `commands/seo-check.md` (checklists restated from `agent_docs/seo-patterns.md`, which `COMMANDS-MAINTENANCE.md` already claimed as the canonical source but the command never referenced).
- `global-CLAUDE.md` `CONTEXT BUDGET` lever 2 (push work into subagents) — added scoping guidance: one topic per Explore/Agent call (bundling unrelated topics into one call forces "very thorough" breadth on every one of them instead of a narrow search per topic), and hand off known BOOT SEQUENCE context (test command, package manager, relevant paths) so subagents don't re-discover it from scratch at full token cost. `agents/senior-engineer.md` gained the matching "Scoped delegation" principle — it's the only named agent with `Agent` tool access, so it's the only one that can act on this. `agents/bug-hunter.md` gained an explicit Bash budget (run the command scoped to the affected file only; check the manifest's `scripts` block instead of trial-running broad commands to find the test command) and `agents/devops-guard.md`'s "Plan before apply" principle gained the read-only equivalent (scope diff/inspection commands to the resource actually changing) — both had Bash access with no scoping guardrail, unlike every other Bash-capable agent in the kit.
- `agents/performance-guard.md` — "Analysis — always first" required marching through every impact-order layer (DB → render → bundle → navigation → cache → memory → I/O) even when the report already named the symptom (e.g. "slow mobile page navigation"), burning tokens re-checking layers the report never implicated. Now jumps directly to the named layer's checklist; full impact-order scan is reserved for unscoped "app feels slow" reports.
- `hooks/protected-paths.mjs` was the kit's only harness-enforced guardrail but shipped opt-in — `install.sh`/`install.ps1` copied it without wiring it into `settings.json`, so it silently did nothing unless a user found `hooks/README.md` and merged the JSON by hand. Now wired in by default via the new `scripts/wire-hook.mjs` (idempotent merge — safe to re-run, never clobbers existing `settings.json` content); `--no-hooks`/`-NoHooks` opts back out for anyone who doesn't want the extra permission prompts. `bin/cli.mjs` forwards the new flag on Windows (`--no-hooks` → `-NoHooks`, same translation as the existing `--detect`/`--preset` flags). `SETUP.md`'s agent-driven install path gained the same step (5e) — it had no hook awareness at all before. `package.json`'s `files` allowlist gained `scripts/wire-hook.mjs`, which the registry-published `npx senior-dev-kit` path needs at install time (verified via `npm pack --dry-run`) — git-based `npx github:...` installs were unaffected since they clone the full repo. `commands/kit-doctor.md` and `global-CLAUDE.md`'s RULES REFERENCE updated to describe wired-by-default as the healthy state instead of copied-but-inactive.
- `SETUP.md` drift, found while auditing the hooks path: its overview claimed "17 subagent files (18 total)" and "34 skill directories" while every step-by-step list in the same file (2a/2b) already matched the real counts (14 agents, 32 skills) — only the summary lines and the Step 6 report template (`[17 agents, 34 skills, 13 commands, ...]`) had drifted. Step 5c's global `agent_docs` list separately still listed `academic-writing-guide.md` (deleted with the `academic-writer` agent removal) and was missing `devops-security-guide.md` (a real, current file that Step 2f's project-scoped list already had correctly) — an agent following 5c literally would have written a nonexistent file's content and skipped a real one. All four spots corrected against the actual file counts on disk.
- Full-kit audit follow-up — the same count-drift class found in SETUP.md turned out to be systemic: `TROUBLESHOOTING.md` ("agent count is not 18 (17 agents...)", "skill count is less than 33"), `PROJECT-BOOTSTRAP.md` ("17 prebuilt agents, 33 skills, or 12 commands"), `SETUP.md`'s own overview ("13 slash command files", missed in the prior pass), and all 15 `examples/*.md` walkthroughs ("all 17 agents" / "all 33 skills" in their directory-tree diagrams) all still carried pre-14/32/11 counts. Fixed every instance against disk. `scripts/check-stale.ts` gained a new check — `examples/*.md`'s "all N skills"/"all N agents" claims are now cross-referenced against disk on every `npm run check`, the same way README.md's counts already were, so this class of drift can't silently reappear in the 15 example files again.
- `hooks/protected-paths.mjs` secrets/auth pattern gaps, found by an adversarial audit of the kit's one harness-enforced guardrail: `rules/000-security.md` lists `config/credentials.json`, `config/secrets.json`, and `.secrets.baseline*` as protected, but the hook's `secrets` category had no pattern matching them — editing those files was silently allowed despite the doc's promise. Also added `session[^/]*`/`jwt[^/]*`/`oauth[^/]*` filename patterns to the `auth` category — previously only `auth*` filenames and files inside `auth/`/`authentication/`/`authorization/`/`guards/` directories were caught, so a standalone `src/session.ts` or `lib/oauth.ts` outside those directories passed through unprompted. `scripts/hooks.test.ts` gained 6 cases covering both gaps.
- `agents/bug-hunter.md`, `agents/senior-engineer.md`, `agents/reviewer.md`, `agents/ui-fixer.md` — removed leftover "HARD CONSTRAINTS — mirrored" end-of-file blocks. `AGENTS-MAINTENANCE.md` already documents this as an anti-pattern ("that U-shape repetition technique only pays off once a context is long enough to risk mid-context attention decay... which a single agent body never reaches on its own") and a prior pass removed it from `academic-writer`/`devops-guard`/`architect`/`security-guard`/`db-guard`/`migration-guard`/`performance-guard` — these 4 were missed at the time.

### Added

- `scripts/validate-skills.ts` — `AGENT_BODY_MAX_LINES` (150) cap on agent bodies, `checkEffort()` hard-rejecting `effort: xhigh`/`max` in agent or skill frontmatter (session-level `/effort` overrides, not definition defaults), and `agent:` cross-reference validation for `context: fork` skills.
- `agent_docs/devops-security-guide.md` — Dockerfile/GitHub Actions/IaC/rollback/SBOM reference material extracted from `devops-guard.md`.
- `skills/codebase-overview/SKILL.md` — generates/refreshes a project architecture overview (directory map, data flow, perf-sensitive integration points) into `PROJECT/.claude/codebase-overview.md`, lazy-loaded rather than inlined into `CLAUDE.md`; forks to `senior-engineer` (needs `Write`, unlike the read-only `architect`). Kit now ships 32 skills.
- `global-CLAUDE.md` `CORE BEHAVIORS` — `ORPHAN CLEANUP` line: remove only imports/vars/functions your own edit made unused, leave pre-existing dead code you notice incidentally alone (flag with `FWD:` instead). Closes a gap the kit's existing "no refactoring while fixing bugs" line didn't cover — surfaced by comparing against [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)'s "Surgical Changes" principle, whose other three principles (state assumptions, simplicity-first, verifiable goals) the kit already encoded via `TOKEN TIER`/`AMBIGUITY`/`AUTO-TEST + VERIFICATION`. `rules/001-conventions.md`'s `FORWARD COMPATIBILITY FLAGS` list gained the matching `FWD: Unrelated dead code noticed` example.

---

## [1.0.5] — 2026-07-07

### Fixed

- `rules/100-web.md` — `DESIGN CONTINUITY`'s "vary layout per section" line miscast intra-site variety as the goal, which fought cohesion within a single project. Corrected: within one project, every section/page stays visually unified (same tokens/hierarchy/spacing end-to-end); the "don't repeat the same template" intent is cross-project scope — don't default to the previous project's design when starting a new one.

---

## [1.0.4] — 2026-07-07

### Added

- `rules/100-web.md` — new `DESIGN CONTINUITY` section: check existing tokens/typography/spacing/component structure before any UI edit (color/warm-cool harmony included), and vary layout per section instead of repeating the same template.
- `rules/001-conventions.md` — `HOLISTIC CONSISTENCY` table gained a row requiring a terse `CHANGELOG.md` bullet (what + why) for any code change or bugfix in shipped/consumer projects.
- `global-CLAUDE.md` — `CORE BEHAVIORS` gained a `RESEARCH SCOPE` line: read only files relevant to the change, no full-tree scans, reuse prior analysis instead of re-reading.

---

## [1.0.3] — 2026-07-03

### Changed

- `rules/001-conventions.md` — trimmed the always-loaded (`alwaysApply: true`) rule to cut per-session context cost, since this file loads into **every** session regardless of what's being edited. Removed four sections that were either pure duplicates of richer path-scoped content or belonged in a narrower scope: `DATABASE PROTOCOLS` (a subset of `500-database.md`'s ORM table) and `OBSERVABILITY` (a subset of `700-observability.md`'s logging rules) were deleted outright; `STATE MANAGEMENT (2025)` moved to `100-web.md` (web rows) with mobile rows already covered by `400-mobile.md`; `API PATTERN SELECTION` + the `Result<T,E>` boundary rule moved to `200-api.md`. Each relocated concern now loads only when a matching file is edited instead of on every session. Content parity preserved (targets already held or now hold the guidance); no validator references the removed sections. `001-conventions.md`: 202 → ~150 lines.
- `global-CLAUDE.md` — expanded `SESSION DISCIPLINE` into a `CONTEXT BUDGET` block: clarified `/compact` (summarize + continue) vs `/clear` (wipe) so a full-but-unfinished session reaches for the right one, called out that read-heavy work routed to a subagent keeps its token cost out of the main thread (only the short return lands), and noted persisting durable facts to file-based memory before `/clear` so a reset isn't amnesiac.

---

## [1.0.2] — 2026-07-03

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
