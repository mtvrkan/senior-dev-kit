---
name: migration-review
description: "Use for migration files, destructive changes, production data risk, rollback strategy, and backward compatibility. Deployment-safety phase that follows db-change once a migration file exists. Use automatically for migrations, destructive DB changes, backfills, rollback, and production data risk."
---

# migration-review

> Codex: run this skill in the `db-guard` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.

Run db-guard's MIGRATION SAFETY REVIEW output block (in `agents/db-guard.md`, co-loaded with
this fork) checkpoint by checkpoint — GO / NO-GO per checkpoint; the checklist lives there, not
here (round-31: it was restated near-verbatim, unlike the sibling fork-skills' pointer style).
One checkpoint that block lacks, add it: RENAME RISK — is the old name still referenced in code
or queries?

Final output: GO / NO-GO | risk summary | required steps before applying

Deep reference: `KIT_ROOT/agent_docs/zero-downtime-migration.md` — expand/contract phases, batched backfills, deploy ordering.
