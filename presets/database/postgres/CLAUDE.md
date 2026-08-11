# Database Preset — PostgreSQL

## Modeling

- `timestamptz`, never `timestamp` — a bare `timestamp` silently stores whatever the session's
  timezone happened to be, and the bug surfaces months later in a different deployment region.
- `text` over `varchar(n)` unless the length is a real business constraint; there is no
  performance difference in Postgres, and widening a `varchar` is a migration.
- `numeric` for money. `float`/`double precision` cannot represent `0.10` and will not sum
  correctly.
- `jsonb`, never `json` (`json` is stored as text and cannot be indexed usefully). Use it for
  genuinely open-ended data; a field you filter on in every request belongs in a real column,
  because a `jsonb` path lookup needs a GIN index and still loses to a b-tree.
- Constraints live in the database: foreign keys, `UNIQUE`, `CHECK`. Application-level validation
  is a UX affordance — the constraint is what actually holds when two requests race.
- Model tenant/ownership boundaries explicitly; every multi-tenant table carries the tenant key.

## Migrations — the lock is the whole problem

Schema changes go through `db-guard` review, and never as a side effect of unrelated work
(`rules/500-database.md`). Prefer additive. Destructive changes need explicit approval.

```sql
-- Every migration session, before the DDL: never queue behind a long-running query.
SET lock_timeout = '3s';        -- fail fast instead of blocking every later query
SET statement_timeout = '60s';
```

An `ALTER TABLE` that waits for `ACCESS EXCLUSIVE` also blocks every query that arrives *behind*
it — a 30-second wait on one table is a site-wide outage, not a slow migration. Fail and retry.

```sql
-- Adding a NOT NULL column to a populated table, without a full-table rewrite lock:
ALTER TABLE users ADD COLUMN status text;                          -- 1. nullable, instant
-- 2. backfill in batches, then:
ALTER TABLE users ADD CONSTRAINT users_status_nn
  CHECK (status IS NOT NULL) NOT VALID;                            -- 3. instant, no scan
ALTER TABLE users VALIDATE CONSTRAINT users_status_nn;             -- 4. scans, but SHARE lock
ALTER TABLE users ALTER COLUMN status SET NOT NULL;                -- 5. cheap: constraint proves it

-- Indexes on a live table:
CREATE INDEX CONCURRENTLY idx_users_org ON users (org_id);
-- CONCURRENTLY cannot run inside a transaction block, and a failed build leaves an INVALID
-- index behind that must be dropped before retrying.
```

- Foreign keys added the same way: `ADD CONSTRAINT ... NOT VALID`, then `VALIDATE CONSTRAINT`.
- A rename or a drop is expand → backfill → contract across deploys, never a single migration.
- `ADD COLUMN ... DEFAULT <constant>` is instant on PG 11+; a *volatile* default (`now()`,
  `gen_random_uuid()`) still rewrites the table.

## Queries and indexes

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;   -- confirm the planner USES the index before shipping
```

- Index from real query patterns (`WHERE`, `ORDER BY`, `JOIN`), not from intuition. A compound
  index only serves queries that match its leading columns.
- **Every FK column needs its own index** — Postgres creates one for `UNIQUE`/`PRIMARY KEY`, not
  for foreign keys, and the missing one turns a parent delete into a sequential scan per row.
- Partial index (`... WHERE status = 'active'`) when queries always filter the same low-cardinality
  column: smaller index, same plan.
- Covering index (`INCLUDE (...)`) to get an index-only scan for a hot read.
- `LIMIT` on every query against a table that grows without bound. Keyset pagination
  (`WHERE id > $last`) rather than `OFFSET` — a large `OFFSET` still reads every skipped row.
- N+1: see `rules/500-database.md`; the fix is a join or a batched `WHERE id = ANY($1)`.

## Concurrency

- Default isolation is `READ COMMITTED`. A read-then-write (counters, quotas, inventory) is a lost
  update unless you take `SELECT ... FOR UPDATE`, use an atomic `UPDATE ... SET n = n + 1`, or run
  `SERIALIZABLE`.
- `SERIALIZABLE` does not remove the problem, it relocates it: the transaction fails with
  `40001 serialization_failure` and the application must retry it. No retry loop, no correctness.
- `pg_advisory_xact_lock(key)` for app-level locks that don't map to a row — the `_xact_` variant
  releases at transaction end, the session variant leaks if the handler throws.
- Always order multi-row updates consistently (e.g. by primary key) or two transactions deadlock.

## Security

- Parameterized queries or ORM-safe APIs, always. Interpolation into SQL is injection —
  identifiers (table/column names, `ORDER BY`) cannot be parameterized at all, so allowlist them.
- RLS for multi-tenant or Supabase access: every table gets a policy. Never disable RLS to "fix a
  bug" — write the correct policy. Note the table owner bypasses RLS unless you also
  `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
- The application's database role is not the owner and does not need `SUPERUSER` or `CREATEDB`.
- Never log connection strings, query results containing PII, or raw driver errors in a response.

## Verification

```sql
EXPLAIN (ANALYZE, BUFFERS) <the query the change affects>;   -- plan, before and after
SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';   -- who is blocking whom
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;  -- failed CONCURRENTLY builds
SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables ORDER BY seq_scan DESC;
```

## Anti-patterns

- Bare `CREATE INDEX` or a plain `ADD CONSTRAINT` against a live table — blocks writes.
- DDL with no `lock_timeout`.
- `DROP COLUMN` / `DROP TABLE` directly, with no backup and no contract phase.
- FK column with no index.
- Indexes added without a query to justify them — every index is a write cost.
- Unbounded query with no `LIMIT`; `OFFSET`-based pagination on a large table.
- `timestamp` instead of `timestamptz`; `float` for money.
- Read-then-write on a counter or quota with no lock, no atomic update, and no retry.
- Disabling RLS, or relying on it while connecting as the table owner.
