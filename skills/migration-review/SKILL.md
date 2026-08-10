---
name: migration-review
description: Use for migration files, destructive changes, production data risk, rollback strategy, and backward compatibility. Deployment-safety phase that follows db-change once a migration file exists.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for migrations, destructive DB changes, backfills, rollback, and production data risk.
argument-hint: "[migration file or change]"
context: fork
agent: db-guard
effort: high
---

# migration-review

Run db-guard's MIGRATION SAFETY REVIEW output block (in `agents/db-guard.md`, co-loaded with
this fork) checkpoint by checkpoint — GO / NO-GO per checkpoint; the checklist lives there, not
here (round-31: it was restated near-verbatim, unlike the sibling fork-skills' pointer style).
One checkpoint that block lacks, add it: RENAME RISK — is the old name still referenced in code
or queries?

Final output: GO / NO-GO | risk summary | required steps before applying

Deep reference: `agent_docs/zero-downtime-migration.md` — expand/contract phases, batched backfills, deploy ordering.
