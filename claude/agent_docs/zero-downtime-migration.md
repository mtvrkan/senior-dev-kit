# Zero-Downtime Migration Pattern

Canonical Expand → Write-both → Backfill → Add-constraint → Contract pattern. Referenced by `db-guard` for both its schema-planning and migration-safety-review output modes — if you change this file, both modes pick it up automatically since neither duplicates the steps inline anymore.

## The five steps

```text
Step 1 — Expand: add new column/table, NULLABLE, no NOT NULL yet.
  Deploy: migration only, zero downtime, no code change required.

Step 2 — Write-both: deploy code that writes to OLD and NEW simultaneously.
  Deploy: backward compatible — old code still reads old column, new code writes both.

Step 3 — Backfill: batch-update existing rows in chunks, looping until 0 rows are affected.
  Never: UPDATE t SET new_col = X;   (unbounded — one transaction locks every row)

  PostgreSQL — UPDATE has no LIMIT clause; bound it with a subquery:
    UPDATE t SET new_col = <expr>
    WHERE id IN (SELECT id FROM t WHERE new_col IS NULL ORDER BY id LIMIT 1000);

  MySQL / MariaDB — UPDATE ... LIMIT is supported directly:
    UPDATE t SET new_col = <expr> WHERE new_col IS NULL LIMIT 1000;

  Commit between batches. A single long transaction holds its locks to the end,
  which is the thing this whole pattern exists to avoid.

Step 4 — Add constraint + switch reads: make NOT NULL / add FK / add UNIQUE, then deploy code
  that READS the new column only (it still writes both).
  Deploy: every row has a value now, but the plain forms still scan or build the whole table
  under a lock that blocks writes. On PostgreSQL use the non-blocking forms:

  NOT NULL (PG 12+ skips the scan once a validated CHECK proves it):
    ALTER TABLE t ADD CONSTRAINT t_new_col_nn CHECK (new_col IS NOT NULL) NOT VALID;
    ALTER TABLE t VALIDATE CONSTRAINT t_new_col_nn;
    ALTER TABLE t ALTER COLUMN new_col SET NOT NULL;

  FK:
    ALTER TABLE t ADD CONSTRAINT t_new_col_fk FOREIGN KEY (new_col) REFERENCES p (id) NOT VALID;
    ALTER TABLE t VALIDATE CONSTRAINT t_new_col_fk;

  UNIQUE (CONCURRENTLY cannot run inside a transaction block):
    CREATE UNIQUE INDEX CONCURRENTLY t_new_col_key ON t (new_col);
    ALTER TABLE t ADD CONSTRAINT t_new_col_key UNIQUE USING INDEX t_new_col_key;

  VALIDATE holds only SHARE UPDATE EXCLUSIVE, so writes continue while it scans. The read
  switch is a code deploy.

Step 5 — Contract: deploy code that stops writing the old column, and only after every instance
  of older code is gone, drop the old column in a separate migration.
  Confirm: grep shows zero remaining references before dropping.
```

## Why this is the default

Any migration that locks a table for more than a few milliseconds in production is a risk. This pattern keeps every step additive or non-blocking, and each step is independently safe to pause on — if step 3 fails mid-deploy, steps 1-2 are still fine to leave in place while you retry.

## Deployment order

Expand migrations (steps 1 and 4's constraint) ship BEFORE the code that depends on them — code
deployed first breaks against the old schema. The contract migration (step 5) ships AFTER the code
that stopped using the old column is fully rolled out — run first, it breaks the old code still
serving traffic. "Migration first" is right for expand and wrong for contract.

## When to deviate

A single-step migration is fine for a brand-new table or one with no production traffic — but the plan output must state the justification explicitly. Default to the five-step pattern; deviations are the exception, not the rule.
