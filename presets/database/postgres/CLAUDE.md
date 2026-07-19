# Database Preset — PostgreSQL

## Modeling

- Prefer explicit constraints for integrity: foreign keys, unique constraints, checks where appropriate.
- Use `jsonb` (never `json`) for structured/semi-structured columns that need indexing or containment queries (`@>`); use a real relational column instead when the field is queried/filtered on every request.
- Use appropriate data types and avoid storing structured data as text when relational querying is needed.
- Model SaaS ownership boundaries clearly.

## Migrations

- Schema changes go through `db-guard` review — never create a migration as a side effect of unrelated work (see `rules/500-database.md`).
- Prefer additive migrations.
- Avoid destructive migrations without explicit approval.
- For column renames/drops, prefer multi-step migrations with backfill/compatibility plan.
- `CREATE INDEX CONCURRENTLY` (never a bare `CREATE INDEX`) on any table already receiving production traffic — a plain `CREATE INDEX` holds an `ACCESS EXCLUSIVE`-adjacent lock that blocks writes for the build's duration.
- Adding a `NOT NULL` or a new FK constraint to an existing table: use `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` in a separate step — validates without holding a long table-wide lock.
- Consider rollback and deployment order.

## Queries / performance

- Add indexes based on real query patterns; use `EXPLAIN (ANALYZE, BUFFERS)` to confirm the planner actually uses the new index before considering the migration done. Every FK column needs an index — Postgres does not create one automatically for FK constraints.
- Watch for N+1 queries.
- Use transactions for multi-step consistency. Default isolation is `READ COMMITTED`; use `SELECT ... FOR UPDATE` or `SERIALIZABLE` where a read-then-write must not race.
- Consider locking/race conditions for counters, quotas, and inventory-like logic; `pg_advisory_lock`/`pg_advisory_xact_lock` for app-level locks that don't map to a single row.
- Partial indexes (`CREATE INDEX ... WHERE status = 'active'`) for queries that always filter on a low-cardinality column — smaller index, same query still uses it.
- RLS (Row Level Security): every table must have RLS policies if used with Supabase/multi-tenant access — never disable to "fix a bug," write the correct policy instead.

## Security

- Use parameterized queries or ORM-safe APIs.
- Do not log connection strings or sensitive data.

## Anti-patterns

- Adding indexes without query justification.
- Dropping columns/tables directly.
- Enforcing quotas without transaction/race consideration.
- Plain `CREATE INDEX` / `ADD CONSTRAINT` against a live production table — blocks writes; use `CONCURRENTLY` / `NOT VALID` + `VALIDATE CONSTRAINT`.
- FK column with no index — every foreign key needs a supporting index for join/lookup performance.
- Unbounded query with no `LIMIT` against a table that can grow without bound.
