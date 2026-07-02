---
description: List all installed Senior Dev Kit agents and when to use each one.
---

# /agents-guide

List all installed Senior Dev Kit agents and when to use each one.

## Agents

| Agent | Model | When to use |
| --- | --- | --- |
| **architect** | opus | Large features, architecture decisions, migration plans, risky multi-file changes. Read-only planner. |
| **senior-engineer** | sonnet | Scoped medium feature implementation, safe refactors, multi-file work with clear scope. |
| **bug-hunter** | sonnet | Localized bugs, runtime errors, failing tests, console errors, regressions. |
| **security-guard** | opus | Auth, authorization, payment, billing, secrets, injection, session/token handling. Read-only. |
| **db-guard** | opus | DB schema, data model, ORM, relations, indexes, constraints, transactions, quotas. Read-only. |
| **migration-guard** | opus | Migration safety, destructive DB changes, rollback strategy, production data risk. Read-only. |
| **devops-guard** | opus | CI/CD, Docker, Terraform, K8s, infrastructure changes. Always plans first. Read-only. |
| **reviewer** | sonnet | Code diff review after meaningful changes — bugs, regressions, security, data loss. Read-only. |
| **test-engineer** | sonnet | Add or update tests for changed behavior, edge cases, regressions. |
| **ui-fixer** | haiku | Low-risk frontend UI: modals, buttons, layout, Tailwind/CSS. No backend or auth. |
| **performance-guard** | sonnet | Slow queries, N+1, bundle size, caching, render loops, memory leaks. Read-only. |
| **security-scanner** | sonnet | Dependency audits, secret scans, SAST, container scans, release security checks. |
| **researcher** | opus | Deep research, fact-checking, competitive analysis, technology comparisons. Multi-source cited report. |
| **strategist** | opus | Product strategy, feature roadmaps, build-vs-buy decisions, OKRs, competitive positioning. |
| **writer** | sonnet | Articles, blog posts, technical content, reports, newsletters, and long-form structured content. |
| **academic-writer** | opus | Academic papers, thesis chapters, literature reviews, grant proposals, conference abstracts. |
| **docs-writer** | haiku | README, changelog, API docs, setup notes, small documentation updates. |

## Escalation chain

ui-fixer → senior-engineer → architect (planning) → security-guard / db-guard / migration-guard / devops-guard (review)

## Guard agent flow — plan-only → then implement

Guard agents (security-guard, db-guard, migration-guard, devops-guard, architect, performance-guard) are **read-only planners**.
They produce a written plan and pause. Implementation only begins after explicit user approval.

```text
1. User request triggers a guard area (auth, DB schema, CI/CD, migration, large feature, performance)
2. Guard agent reads the codebase → produces a written plan
3. Plan is shown to user → user must explicitly approve ("looks good", "proceed", "yes")
4. After approval → senior-engineer receives the plan and implements it
5. reviewer (optional) runs code-review on the diff after implementation
```

| Guard agent | What it produces | Who implements after |
| --- | --- | --- |
| architect | PLAN: with phases, contracts, rollback | senior-engineer |
| security-guard | SECURITY REVIEW with IMPLEMENTATION PLAN | senior-engineer |
| db-guard | DB CHANGE REVIEW with ZERO-DOWNTIME PLAN | migration-guard → senior-engineer |
| migration-guard | MIGRATION SAFETY REVIEW with DEPLOYMENT ORDER | senior-engineer |
| devops-guard | INFRA CHANGE PLAN with rollback | senior-engineer (after approval) |
| performance-guard | PERFORMANCE ANALYSIS with guard escalations | senior-engineer (code-only findings) |

Never: senior-engineer touches a guard area without the guard reviewing first.
Never: guard agent edits files — it only reads and produces plans.

## Quick routing

- CSS/button/layout → **ui-fixer**
- Runtime error / failing test → **bug-hunter**
- Normal feature → **senior-engineer**
- Large feature / architecture → **architect**
- Tests → **test-engineer**
- Diff review → **reviewer**
- DB schema / model → **db-guard**
- Migration → **migration-guard**
- Auth / payment / security → **security-guard**
- Security scan → **security-scanner**
- Performance → **performance-guard**
- CI/CD / Docker / Terraform → **devops-guard**
- Research / fact-check → **researcher**
- Strategy / roadmap → **strategist**
- Article / blog post → **writer**
- Academic paper / thesis → **academic-writer**
- Docs → **docs-writer**
