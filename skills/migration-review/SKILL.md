---
name: migration-review
description: Use for migration files, destructive changes, production data risk, rollback strategy, and backward compatibility. Deployment-safety phase that follows db-change once a migration file exists.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for migrations, destructive DB changes, backfills, rollback, and production data risk.
argument-hint: "[migration file or change]"
---

# migration-review

Output GO / NO-GO per checkpoint:

1. DESTRUCTIVE OPS: DROP, TRUNCATE, column removal, type narrowing → NO-GO unless justified
2. RENAME RISK: is the old name still referenced in code or queries?
3. BACKWARD COMPAT: can the current deployed code run against the new schema?
4. ROLLBACK PATH: is there a working down migration?
5. ZERO DOWNTIME: does this require multi-step deploy (add column → backfill → add constraint)?
6. BACKFILL: how are existing rows handled?
7. PRODUCTION DATA RISK: what happens to live data during migration?
8. BACKUP REQUIRED: flag if a backup must be taken before running

Final output: GO / NO-GO | risk summary | required steps before applying
