# ORM Preset — Prisma

## The schema is the source of truth, and editing it is Tier 3

Do not touch `schema.prisma` unless a DB change was actually requested — route it through the
db-guard agent (which runs the db-change skill). A schema edit made as a side effect of a UI task
is how an unreviewed migration reaches production.

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  orgId     String   @map("org_id") @db.Uuid
  org       Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([orgId])          // Postgres does NOT index a foreign key for you
  @@map("users")
}
```

- Additive is safe: a new model, or a new nullable column. A `NOT NULL` column on a populated
  table needs a default or an explicit backfill step — expand → backfill → contract, across
  deploys, per `rules/500-database.md`.
- `onDelete` is a decision, not a default. Leaving it implicit means `Restrict` on most relations
  and a delete that fails in production rather than in review.
- Every relation scalar you filter or join on needs `@@index` — Prisma emits the FK, not the index.

## Migrations — three commands, and only two of them are safe

```bash
npx prisma migrate dev --name add_user_org   # DEV ONLY: writes the migration, may reset the DB
npx prisma migrate dev --create-only         # write the SQL, review/edit it, apply separately
npx prisma migrate deploy                    # the only command that runs in CI/production
npx prisma migrate status                    # pending vs applied — read this before deploying
```

- `prisma db push` writes no migration file. It is for local prototyping; against a shared or
  production database it drops columns with no record that it happened.
- `migrate dev` uses a shadow database and can reset — running it against anything shared is data
  loss. It is a development command, and there is no flag that makes it otherwise.
- A **rename is emitted as DROP + ADD**, which silently destroys the column's data. Use
  `--create-only` and rewrite the SQL as a rename before applying.
- Generated SQL is reviewed, not trusted. Read the file in `prisma/migrations/` — that is the
  artifact that runs against production, not the schema.

## Queries

```ts
// Explicit projection — both APIs return every scalar column by default
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, org: { select: { name: true } } },
})

// Interactive transaction: use `tx`, never `prisma`, inside the callback
await prisma.$transaction(async (tx) => {
  const acct = await tx.account.update({ where: { id }, data: { balance: { decrement: 100 } } })
  if (acct.balance < 0) throw new Error('insufficient')   // throwing rolls back
  await tx.ledger.create({ data: { accountId: id, delta: -100 } })
}, { timeout: 10_000 })   // default is 5s — a slow step aborts the whole transaction
```

- `select` and `include` cannot both appear at the same level — Prisma throws at runtime.
- N+1 is `include: { posts: true }` versus a `.map()` that awaits a query per row. The second one
  looks harmless and is the one that ships.
- `prisma.$queryRaw` with a tagged template binds parameters; `$queryRawUnsafe` does not. User
  input never reaches the unsafe variant.
- Validate input *before* the Prisma call (Zod at the boundary). Prisma type-checks shapes, not
  business rules — it will happily persist a negative price.
- Handle the error codes explicitly rather than as a generic 500: `P2002` unique constraint,
  `P2025` record not found, `P2003` foreign key constraint failed.

## Connections

Serverless and per-request instantiation exhaust the connection pool: one `PrismaClient` per
process, cached across hot reloads in dev. Behind PgBouncer in transaction mode, the URL needs
`pgbouncer=true` (and `connection_limit` tuned) or prepared statements collide.

## Verification

```bash
npx prisma validate                  # schema syntax + relation integrity
npx prisma migrate status            # drift and pending migrations
npx prisma generate                  # client must be regenerated after any schema edit
npx tsc --noEmit                     # the generated client is the type check
npx vitest run src/db/user.test.ts   # targeted
```

## Anti-patterns

- `db push` in CI or against a shared database.
- `migrate dev` anywhere but a developer's own machine.
- Applying a generated migration without reading it (rename → silent DROP + ADD).
- Editing generated client files under `node_modules/.prisma` — overwritten on every `generate`.
- Schema changes for a UI-only task.
- `include`/`select` omitted, so every query ships every column.
- Relation access inside a loop.
- `$queryRawUnsafe` with anything user-derived.
- Swallowing `P2002` as a 500 instead of a 409.
- Multi-step writes with no transaction, or using `prisma` instead of `tx` inside one.
