# Rules Maintenance Policy

This document tracks review dates for the 11 path-scoped rules in this kit.
Rules carry engineering standards loaded into every session; they must be reviewed when:

- OWASP rankings, security standards, or tool recommendations change
- A framework/platform major version shifts the conventions a rule encodes
- More than **12 months** have passed since the last review

---

## Version Support Matrix

> Dates clustered around 2026-06-30/07-01 are the v1.0.0 release baseline: the entire kit was reviewed item-by-item in that pre-release hardening pass, so the shared date reflects a real review, not a bulk stamp. Later edits stagger the dates naturally.

| Rule File | Scope / Domain | Last Reviewed |
| --- | --- | --- |
| `000-security` | Security scan, OWASP 2025, supply chain | 2026-06-30 |
| `001-conventions` | Architecture detection, modern tech preferences | 2026-07-03 |
| `100-web` | Design tokens, 8px grid, SEO, WCAG 2.2, state mgmt | 2026-07-03 |
| `200-api` | REST, OpenAPI 3.1, RFC 7807, pattern selection | 2026-07-03 |
| `300-testing` | Test pyramid, mock policy, coverage targets | 2026-06-30 |
| `400-mobile` | iOS/Android/Flutter/RN platform patterns | 2026-06-30 |
| `500-database` | Schema safety, N+1 prevention, RLS | 2026-06-30 |
| `600-devops` | Dockerfile, GitHub Actions, IaC security | 2026-06-30 |
| `700-observability` | Logging levels, metrics, tracing | 2026-07-02 |
| `800-llm-safety` | Prompt injection, cost controls, AI safety | 2026-06-30 |
| `900-performance` | CWV budgets, N+1, bundle limits | 2026-07-02 |

---

## Review Cadence

| Trigger | Action |
| --- | --- |
| OWASP Top 10 updated | Review `000-security` within 30 days |
| Framework major version release | Review the relevant domain rule within 30 days |
| Security advisory for a pattern the rule encodes | Review within 7 days |
| Quarterly scheduled review | Audit all rules against current standards |

### Quarterly review checklist

For each rule:

- [ ] Verify security recommendations reflect current CVEs and published standards
- [ ] Check that referenced tool versions, CLI commands, or config keys are still current
- [ ] Verify framework/library API references are still valid
- [ ] Update `Last Reviewed` date in this table

---

## Contributing a Rule Update

1. Edit the relevant `rules/NNN-name.md` with the updated guidance
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `rules(name): update for [reason]`
