# Agents Maintenance Policy

This document tracks review dates for the 12 subagent definitions in `agents/`.
Agents encode role-specific behavior and routing signals; they must be reviewed when:

- The agent's tool list, model, or `permissionMode` no longer matches its risk level
- `agents/ROUTING.md` signals for the agent drift from what the agent file actually does
- A referenced skill is renamed, removed, or changes scope
- The agent body grows past the 150 non-blank-line budget (enforced by `scripts/validate-skills.ts`, `AGENT_BODY_MAX_LINES`) and needs to shed detail into `agent_docs/`
- More than **12 months** have passed since the last review

## Body size budget

Every agent body loads in full on every invocation of that agent — unlike `agent_docs/`,
which loads only when the agent's own text points to it. Keep the body to HARD
CONSTRAINTS + core principles + plan/output format (~150 non-blank lines). Reference
material that's only needed for some invocations — document/config templates, command
tables, style/format tables, checklists — belongs in `agent_docs/<topic>.md`, linked from
a `## Reference docs (lazy-load when needed)` section near the top of the agent file (see
`agents/architect.md` and `agents/devops-guard.md` for the pattern). Do not restate the
same reference material in both the agent body and `agent_docs/` — that's tokens spent
twice for one fact. Do not mirror the same HARD CONSTRAINTS block at both the top and
bottom of an agent file "for emphasis" — that U-shape repetition technique only pays off
once a context is long enough to risk mid-context attention decay (tens of thousands of
tokens), which a single agent body never reaches on its own.

---

## Version Support Matrix

> Dates clustered around 2026-06-30/07-01 are the v1.0.0 release baseline: the entire kit was reviewed item-by-item in that pre-release hardening pass, so the shared date reflects a real review, not a bulk stamp. Later edits stagger the dates naturally.

| Agent | Role / Domain | Last Reviewed |
| --- | --- | --- |
| `architect` | Large features, architecture decisions, migration plans (read-only planning) | 2026-07-01 |
| `bug-hunter` | Localized bugs, runtime errors, failing tests, regressions | 2026-07-15 |
| `db-guard` | DB schema changes, data modeling, indexes, AND migration deployment safety — destructive changes, rollback strategy (read-only planning) | 2026-07-16 |
| `devops-guard` | CI/CD, Docker, Terraform, Kubernetes, infrastructure changes | 2026-07-15 |
| `docs-writer` | README, setup notes, changelog, API docs | 2026-07-01 |
| `performance-guard` | Slow queries, N+1, bundle size, caching, memory leaks | 2026-07-15 |
| `researcher` | Deep research, fact-checking, competitive analysis | 2026-07-01 |
| `reviewer` | Post-change diff review for bugs, regressions, security (read-only) | 2026-07-15 |
| `security-guard` | Auth, payment, secrets, injection risks, session/token handling, PLUS tool-driven security scans, dependency audits, SAST (read-only) | 2026-07-16 |
| `senior-engineer` | Scoped medium feature implementation and safe refactors | 2026-07-15 |
| `test-engineer` | Targeted tests for changed behavior, edge cases, regressions | 2026-07-01 |
| `ui-fixer` | Low-risk frontend-only UI changes | 2026-07-15 |

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
- [ ] Verify every `*-guard` agent (currently `security-guard`, `db-guard`, `devops-guard`, `performance-guard`) still sets `permissionMode: plan` — enforced by name pattern in `scripts/validate-skills.ts` (`isGuardAgent`), so a newly added `*-guard` agent is covered automatically
- [ ] Verify the agent is still mentioned in `agents/ROUTING.md` with an accurate signal
- [ ] Update `Last Reviewed` date in this table

---

## Contributing an Agent Update

1. Edit the relevant `agents/<name>.md` with the updated behavior
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `agent(name): update for [reason]`
