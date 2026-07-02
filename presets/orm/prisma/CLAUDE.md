# ORM Preset — Prisma

## Schema

- Do not edit `schema.prisma` unless DB change is requested — route through the db-guard skill.
- Prefer additive schema changes: a new nullable column or new model is safe; a `NOT NULL` column on an existing table requires a default or a backfill migration step.
- Keep relation names and cascading behavior intentional.
- Watch optional vs required field changes.

## Migrations

- Use the migration workflow when schema changes: `prisma migrate dev` in development, `prisma migrate deploy` in production — never `db push` in production or CI.
- Avoid destructive migrations without explicit approval.
- Consider data backfill and deployment order.

## Queries

- Validate data before Prisma calls — Prisma trusts whatever it's given.
- Use `select`/`include` to fetch only needed fields — never an implicit full-object load.
- Watch for N+1 and relation loading: use `include: { relation: true }` or a separate batched query, never `.relation` access inside a loop.
- Use transactions (`prisma.$transaction([...])`) for multi-step writes.
- Handle unique constraint conflicts gracefully: catch `P2002` (unique constraint) and `P2025` (record not found) explicitly.

## Anti-patterns

- Editing generated Prisma client files (`node_modules/.prisma`) — they're overwritten on every `generate`.
- Changing schema for UI-only tasks.
- Enforcing quotas without transactions.
- `db push` in CI/production.
- Ignoring unique-constraint errors.
