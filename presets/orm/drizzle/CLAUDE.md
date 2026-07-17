# ORM Preset — Drizzle

## Schema

- Keep schema definitions explicit and typed.
- Do not change schema/migrations unless DB change is requested — route through the db-guard agent.
- Prefer additive changes: a new nullable column is safe; `NOT NULL` on existing rows requires a migration step with backfill.
- `drizzle-kit push` for dev only — use migration files for production, never push directly to prod.

## Queries

- Use typed query builders: `.select().from().where()` — never raw string SQL for queries that have a typed equivalent.
- All `.where()` values are parameterized automatically by Drizzle — never string-interpolate into a query.
- Validate input before query construction.
- Use transactions for multi-step writes: `db.transaction(async (tx) => { ... })`.
- Add indexes based on query patterns, defined in schema: `index('idx_name').on(table.column)`.
- Handle unique-constraint conflicts explicitly with `.onConflictDoNothing()` or `.onConflictDoUpdate()` — never let them swallow silently.

## Anti-patterns

- Raw SQL for simple typed queries.
- Changing schema during UI tasks.
- Missing conflict handling on unique constraints.
- `drizzle-kit push` in production.
