# Agents Maintenance Policy

This document tracks review dates for the 17 subagent definitions in `agents/`.
Agents encode role-specific behavior and routing signals; they must be reviewed when:

- The agent's tool list, model, or `permissionMode` no longer matches its risk level
- `agents/ROUTING.md` signals for the agent drift from what the agent file actually does
- A referenced skill is renamed, removed, or changes scope
- More than **12 months** have passed since the last review

---

## Version Support Matrix

> Dates clustered around 2026-06-30/07-01 are the v1.0.0 release baseline: the entire kit was reviewed item-by-item in that pre-release hardening pass, so the shared date reflects a real review, not a bulk stamp. Later edits stagger the dates naturally.

| Agent | Role / Domain | Last Reviewed |
| --- | --- | --- |
| `academic-writer` | Academic papers, theses, literature reviews, grant proposals | 2026-07-01 |
| `architect` | Large features, architecture decisions, migration plans (read-only planning) | 2026-07-01 |
| `bug-hunter` | Localized bugs, runtime errors, failing tests, regressions | 2026-07-01 |
| `db-guard` | DB schema changes, data modeling, indexes (read-only planning) | 2026-07-01 |
| `devops-guard` | CI/CD, Docker, Terraform, Kubernetes, infrastructure changes | 2026-07-01 |
| `docs-writer` | README, setup notes, changelog, API docs | 2026-07-01 |
| `migration-guard` | Migration safety, destructive DB changes, rollback strategy (read-only planning) | 2026-07-01 |
| `performance-guard` | Slow queries, N+1, bundle size, caching, memory leaks | 2026-07-01 |
| `researcher` | Deep research, fact-checking, competitive analysis | 2026-07-01 |
| `reviewer` | Post-change diff review for bugs, regressions, security (read-only) | 2026-07-01 |
| `security-guard` | Auth, payment, secrets, injection risks, session/token handling (read-only) | 2026-07-01 |
| `security-scanner` | Security scans, dependency audits, secret scans, SAST | 2026-07-01 |
| `senior-engineer` | Scoped medium feature implementation and safe refactors | 2026-07-01 |
| `strategist` | Product strategy, roadmaps, build-vs-buy, OKRs | 2026-07-01 |
| `test-engineer` | Targeted tests for changed behavior, edge cases, regressions | 2026-07-01 |
| `ui-fixer` | Low-risk frontend-only UI changes | 2026-07-01 |
| `writer` | Articles, blog posts, technical content, reports | 2026-07-01 |

---

## Review Cadence

| Trigger | Action |
| --- | --- |
| Agent's tool list or model changes | Review within 7 days |
| A skill the agent references is renamed or removed | Review within 7 days |
| Quarterly scheduled review | Audit all agents against `ROUTING.md` |

### Quarterly review checklist

For each agent:

- [ ] Verify `skills:` frontmatter references still point to existing `skills/` directories
- [ ] Verify guard agents (`security-guard`, `db-guard`, `migration-guard`, `devops-guard`) still set `permissionMode: plan`
- [ ] Verify the agent is still mentioned in `agents/ROUTING.md` with an accurate signal
- [ ] Update `Last Reviewed` date in this table

---

## Contributing an Agent Update

1. Edit the relevant `agents/<name>.md` with the updated behavior
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `agent(name): update for [reason]`
