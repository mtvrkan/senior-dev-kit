# Zero-Downtime Migration Pattern

Canonical Expand → Write-both → Backfill → Add-constraint → Contract pattern. Referenced by `db-guard` (schema planning) and `migration-guard` (migration safety review) — if you change this file, both agents pick it up automatically since neither duplicates the steps inline anymore.

## The five steps

```text
Step 1 — Expand: add new column/table, NULLABLE, no NOT NULL yet.
  Deploy: migration only, zero downtime, no code change required.

Step 2 — Write-both: deploy code that writes to OLD and NEW simultaneously.
  Deploy: backward compatible — old code still reads old column, new code writes both.

Step 3 — Backfill: batch-update existing rows in chunks.
  Run:   UPDATE table SET new_col = derived_value WHERE new_col IS NULL LIMIT 1000;
  Never: UPDATE table SET new_col = X  (no LIMIT — locks the entire table)

Step 4 — Add constraint: make NOT NULL / add FK / add UNIQUE.
  Deploy: safe now that every row has a value.

Step 5 — Contract: remove the old column in a separate deploy.
  Confirm: grep shows zero remaining references before dropping.
```

## Why this is the default

Any migration that locks a table for more than a few milliseconds in production is a risk. This pattern keeps every step additive or non-blocking, and each step is independently safe to pause on — if step 3 fails mid-deploy, steps 1-2 are still fine to leave in place while you retry.

## Deployment order

DB migration always ships before the code deploy that depends on it. Never deploy code before the migration it depends on — it will break against the old schema.

## When to deviate

A single-step migration is fine for a brand-new table or one with no production traffic — but the plan output must state the justification explicitly. Default to the five-step pattern; deviations are the exception, not the rule.
