# Project Preset — Drizzle ORM

## Schema is TypeScript, and it is the source of truth

```ts
// src/db/schema.ts
export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     text('email').notNull().unique(),
  orgId:     uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('users_org_idx').on(t.orgId),          // every FK you filter on needs one
])

export const usersRelations = relations(users, ({ one, many }) => ({
  org:   one(orgs, { fields: [users.orgId], references: [orgs.id] }),
  posts: many(posts),
}))

export type User    = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

Derive types with `$inferSelect` / `$inferInsert` — never hand-write an interface that mirrors a
table, because nothing keeps the two in sync.

`relations()` is only for the query API's type inference. It does **not** create a foreign key —
`references()` does. Declaring one without the other gives you a join that type-checks and a
database with no referential integrity.

## Migrations — generate, review, apply

```bash
npx drizzle-kit generate    # emits SQL into drizzle/ — READ IT
npx drizzle-kit migrate     # applies pending migrations
```

- `drizzle-kit push` skips the migration file entirely. It is for local prototyping only; using
  it against a shared or production database is how a column gets dropped with no record.
- Generated SQL is reviewed, not trusted: a rename is emitted as drop + add unless you tell it
  otherwise, which silently destroys the data.
- Migrations are Tier 3 (`rules/500-database.md`): expand → backfill → contract across deploys.

## Querying — two APIs, pick deliberately

```ts
// Relational API — nested results, no manual joins, one round trip
const rows = await db.query.users.findMany({
  where: eq(users.orgId, orgId),
  columns: { id: true, email: true },              // explicit projection
  with: { posts: { columns: { id: true, title: true }, limit: 10 } },
  limit: 20,
})

// SQL-like API — when you need the exact query
await db.select({ id: users.id, org: orgs.name })
  .from(users)
  .innerJoin(orgs, eq(users.orgId, orgs.id))
  .where(and(eq(users.orgId, orgId), isNull(users.deletedAt)))
  .limit(20)
```

Always project columns explicitly. Both APIs return everything by default, and a `text` column
you forgot about will dominate the payload.

## Safety

- Parameters are bound automatically. `sql` template literals are safe —
  ``sql`where id = ${id}` `` binds; `sql.raw()` does **not**, so never pass user input to it.
- `db.delete(t)` / `db.update(t)` **without `.where()` hits every row.** Treat a missing `where`
  as a bug, and anything bulk-destructive as Tier 4.
- Multi-statement writes go in `db.transaction(async (tx) => { ... })` — and use `tx` inside, not
  `db`, or the statement runs outside the transaction and won't roll back.

## Performance

- Index every column you filter, join or sort on; Drizzle will happily generate a sequential scan.
- `.limit()` on every list query.
- `with:` in the relational API is a join, not an N+1 — but a `.map()` that awaits a query per
  row is, and it looks harmless.

## Verification

```bash
npx drizzle-kit check     # migration folder consistency — collisions, broken ordering
npx drizzle-kit generate  # emits nothing when the schema and migrations already agree
npx tsc --noEmit          # the schema IS the type check
npx vitest run src/db/queries.test.ts
```

## Anti-patterns

- `drizzle-kit push` against anything shared.
- Applying generated SQL without reading it (silent drop + add on rename).
- Hand-written types instead of `$inferSelect`/`$inferInsert`.
- `relations()` without a matching `references()` — no FK in the database.
- `update`/`delete` with no `.where()`.
- Using `db` instead of `tx` inside a transaction callback.
- `sql.raw()` with anything derived from user input.
- Unprojected selects and unbounded list queries.
