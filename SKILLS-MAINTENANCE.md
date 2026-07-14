# Skills Maintenance Policy

This document tracks review dates for the 32 skills in `skills/`.
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
| `api-design` | REST/GraphQL API contract design before implementation | 2026-07-01 |
| `api-versioning` | Breaking API changes, new API versions, deprecation paths | 2026-07-01 |
| `bug-fix` | Localized bugs, runtime errors, failing tests | 2026-07-02 |
| `code-audit` | Codebase-wide tech debt/quality scan — god files, dead code, duplication | 2026-07-01 |
| `code-review` | Diff review for bugs, regressions, security, missing tests | 2026-07-02 |
| `codebase-overview` | Architecture overview — directory map, data flow, perf-sensitive spots | 2026-07-15 |
| `data-modeling` | Entity/relation/document design before implementation | 2026-07-02 |
| `db-change` | Schema/model/query design phase (hands off to `migration-review`) | 2026-07-02 |
| `deep-research` | Multi-source research with cross-verified, cited synthesis | 2026-07-01 |
| `dep-check` | Dependency vulnerability, outdated-version, and license audit | 2026-07-01 |
| `docs-update` | README, setup instructions, changelog, API docs | 2026-07-01 |
| `env-audit` | Environment variable declarations, leaks, and drift audit | 2026-07-01 |
| `feature-build` | Scoped medium feature implementation | 2026-07-02 |
| `feature-plan` | Planning for large/multi-file/architecture features (no code) | 2026-07-02 |
| `from-scratch` | New project bootstrap with phase gates | 2026-07-01 |
| `kit-doctor` | Kit installation diagnosis — counts, settings, version drift | 2026-07-02 |
| `llm-integration` | LLM/AI API integration, RAG, prompt engineering, tool use | 2026-07-01 |
| `migration-review` | Migration deployment safety (follows `db-change`) | 2026-07-02 |
| `monorepo-task` | Workspace-scoped task routing for monorepos | 2026-07-01 |
| `new-page` | New admin panel page/screen from scratch (web) | 2026-07-01 |
| `new-screen` | New mobile screen/bottom sheet from scratch | 2026-07-01 |
| `performance-check` | Slow code, slow queries, bundle size, caching, latency | 2026-07-02 |
| `plan-first` | Manual plan-first gate before risky/multi-file work | 2026-07-02 |
| `refactor-safe` | Behavior-preserving refactors with strong verification | 2026-07-02 |
| `release-check` | Pre-release build/test/migration/env/changelog check | 2026-07-01 |
| `release-gate` | Manual pre-release gate (tests, build, migrations, rollback) | 2026-07-01 |
| `safe-review` | Manual diff review for bugs, regressions, security | 2026-07-01 |
| `security-review` | Auth, permissions, payment, secrets, injection review | 2026-07-01 |
| `security-scan` | Dependency, secret, SAST, and container/filesystem scans | 2026-07-01 |
| `smart-task` | Task classification and tier/risk/agent/skill routing | 2026-07-02 |
| `test-writer` | Targeted tests for changed behavior and edge cases | 2026-07-01 |
| `ui-change` | Small UI changes: modal, button, layout, styling | 2026-07-01 |

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
