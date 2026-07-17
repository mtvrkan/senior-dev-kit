# ORM Preset — Sequelize

> Existing-project preset only. Per `rules/001-conventions.md`, prefer Prisma or Drizzle for new projects — apply this preset to maintain the current codebase, not to justify adopting Sequelize for greenfield work.

## Models / migrations

- Keep model definitions and migrations in sync.
- Prefer additive migrations: a new nullable column is safe; `NOT NULL` requires a default value or a multi-step migration with backfill.
- Do not alter DB schema for unrelated tasks — route through the db-guard agent.
- Be explicit with associations: define `belongsTo`, `hasMany`, etc. explicitly; use `include: [{ model: X }]` for eager loading, never lazy-load inside a loop.

## Queries

- Validate inputs before queries.
- Avoid raw query injection: use `Model.findAll({ where: { column: value } })`, never string interpolation; if `sequelize.literal()` is required, use it only with parameterized replacements.
- Use transactions for multi-step writes: `sequelize.transaction(async (t) => { ... })`, and pass `{ transaction: t }` to every query inside the block.
- Handle unique/validation errors clearly: catch `SequelizeUniqueConstraintError` and `SequelizeValidationError` explicitly, never swallow them.

## Anti-patterns

- Raw SQL string interpolation.
- Broad model rewrites for local features.
- Missing transaction around multi-table writes.
- Missing `{ transaction: t }` inside a transaction block.
- N+1 lazy loading in loops.
