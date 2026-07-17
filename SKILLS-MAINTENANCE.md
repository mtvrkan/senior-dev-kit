# Skills Maintenance Policy

This document tracks review dates for the 25 skills in `skills/`.
Skills are slash-command-style, auto-invocable playbooks; they must be reviewed when:

- The skill's `allowed-tools` no longer matches what its steps actually need
- A companion skill in its hand-off chain (e.g. `db-change` → `migration-review`) changes scope
- The skill body grows past the 20 non-blank-line budget and needs to shed detail into `agent_docs/`
- More than **12 months** have passed since the last review

---

## Version Support Matrix

> Dates clustered around 2026-06-30/07-01 are the v1.0.0 release baseline: the entire kit was reviewed item-by-item in that pre-release hardening pass, so the shared date reflects a real review, not a bulk stamp. Later edits stagger the dates naturally.

| Skill | Purpose | Last Reviewed |
| --- | --- | --- |
| `api-design` | REST/GraphQL API contract design before implementation, PLUS breaking-change/versioning/deprecation paths | 2026-07-01 |
| `bug-fix` | Localized bugs, runtime errors, failing tests | 2026-07-02 |
| `code-audit` | Codebase-wide tech debt/quality scan — god files, dead code, duplication | 2026-07-01 |
| `code-review` | Diff review for bugs, regressions, security, missing tests | 2026-07-02 |
| `codebase-overview` | Architecture overview — directory map, data flow, perf-sensitive spots | 2026-07-15 |
| `db-change` | Schema/model/query design phase, PLUS entity/relation/document modeling (hands off to `migration-review`) | 2026-07-02 |
| `deep-research` | Multi-source research with cross-verified, cited synthesis | 2026-07-01 |
| `docs-update` | README, setup instructions, changelog, API docs | 2026-07-01 |
| `env-audit` | Environment variable declarations, leaks, and drift audit | 2026-07-17 |
| `feature-build` | Scoped medium feature implementation | 2026-07-02 |
| `feature-plan` | Planning for large/multi-file/architecture features, PLUS manual plan-first gate before risky work (no code) | 2026-07-02 |
| `from-scratch` | New project bootstrap with phase gates | 2026-07-17 |
| `incident-response` | Live production incident triage — dispatch to guards, one timeline | 2026-07-17 |
| `kit-doctor` | Kit installation diagnosis — counts, settings, version drift | 2026-07-02 |
| `migration-review` | Migration deployment safety (follows `db-change`) | 2026-07-02 |
| `new-page` | New admin panel page/screen from scratch (web) | 2026-07-17 |
| `new-screen` | New mobile screen/bottom sheet from scratch | 2026-07-17 |
| `performance-check` | Slow code, slow queries, bundle size, caching, latency | 2026-07-02 |
| `project-memory` | Durable project-level facts persisted to `.claude/PROJECT-MEMORY.md` | 2026-07-17 |
| `refactor-safe` | Behavior-preserving refactors with strong verification | 2026-07-02 |
| `release-gate` | Manual pre-release gate (tests, build, migrations, rollback) | 2026-07-17 |
| `security-review` | Auth, permissions, payment, secrets, injection review | 2026-07-17 |
| `security-scan` | Dependency, secret, SAST, and container/filesystem scans, PLUS outdated-version/license/dep-hygiene audit | 2026-07-01 |
| `test-writer` | Targeted tests for changed behavior and edge cases | 2026-07-01 |
| `ui-change` | Small UI changes: modal, button, layout, styling | 2026-07-01 |

`skills:` (on an agent) and `agent:` (on a skill) are different axes, not a single ownership
link: `skills:` lists what an agent may invoke; `agent:` names the fork target a `context: fork`
skill actually runs under. `security-scan` legitimately appears in both `devops-guard`'s
`skills:` list (devops-guard invokes it before a release) and forks into `security-guard`
(its own `agent:` field) — that's the intended dual-mode design (see `agents/ROUTING.md`'s
security-guard conflict-resolution row), not a broken single-owner reference.

---

## Review Cadence

| Trigger | Action |
| --- | --- |
| A skill's hand-off partner changes scope | Review within 7 days |
| `allowed-tools` no longer matches the skill's steps | Review within 7 days |
| Quarterly scheduled review | Audit all skills against `CONTRIBUTING.md` conventions |

### Quarterly review checklist

For each skill:

- [ ] Verify frontmatter (`description`, `allowed-tools`, `when_to_use`) is accurate
- [ ] Verify body is still ≤20 non-blank lines; move detail to `agent_docs/` if not
- [ ] Verify any referenced hand-off skill (e.g. `db-change` → `migration-review`) still exists and still fits
- [ ] If Claude Code added or renamed tools this quarter, update `VALID_TOOLS` in `scripts/validate-skills.ts` so new tool names don't fail validation as typos
- [ ] Update `Last Reviewed` date in this table

---

## Contributing a Skill Update

1. Edit the relevant `skills/<name>/SKILL.md` with the updated steps
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `skill(name): update for [reason]`
