# Database Preset — MySQL / MariaDB

## Modeling

- Consider charset/collation implications: use `utf8mb4` + `utf8mb4_unicode_ci` for all new tables, never rely on the server default (it breaks emoji/multi-byte input).
- Use constraints/indexes intentionally.
- Be careful with datetime/timezone behavior — store UTC always; `TIMESTAMP` auto-converts timezone on read/write, `DATETIME` does not, so choose intentionally.
- Keep relation ownership clear.

## Migrations

- Prefer additive migrations.
- Avoid destructive changes without explicit approval.
- Consider table locks and migration cost for large tables — for ALTER on multi-million-row tables, use `pt-online-schema-change` or `gh-ost` instead of a blocking `ALTER TABLE`.
- Plan rollback for production changes. Schema changes go through the db-guard skill, never as a side effect of unrelated work.

## Queries / performance

- Add indexes based on frequent filters/joins/orderings; compound index column order should match the query's `WHERE` clause order.
- Watch for N+1 queries.
- Use transactions for multi-step writes; be aware MySQL's default isolation is `REPEATABLE READ`, which still allows phantom reads in some cases.
- Avoid unbounded queries.

## Security

- Use parameterized queries (`?` placeholders) or ORM-safe APIs — never string interpolation.
- Do not log connection strings.

## Anti-patterns

- Changing collation broadly without a plan — collation mismatches on joined columns force a full table scan.
- Destructive migrations in one step.
- Missing indexes on frequent joins or FK columns.
- Datetime stored without UTC normalization.
