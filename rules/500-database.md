---
description: "Database rules — schema safety, migration protocol, N+1 prevention, RLS, zero-downtime patterns. Auto-loads for migration/schema/model files."
globs: "**/migrations/**,**/*.prisma,**/schema.*,**/models/**,**/knexfile.*,**/drizzle.config.*,**/*migration*"
---

## HARD RULE — schema changes always escalate

ANY change to DB schema (add/remove/rename field, add/remove table, add/remove index, change type) →
`ESCALATE TO: db-guard — schema change detected`

ANY migration file (create, modify, destructive) →
`ESCALATE TO: migration-guard — migration file detected`

NEVER implement schema changes without guard agent review.

## SCHEMA CHANGE SAFETY CHECKLIST (db-guard runs this)

Additive (safer):

- [ ] New table with no FK to existing data → GO
- [ ] New nullable column → GO
- [ ] New index → GO (with concurrency consideration for large tables)
- [ ] New table → GO

Requires analysis:

- [ ] NOT NULL column on existing table → need default or backfill first
- [ ] Column type change → check existing data compatibility
- [ ] Adding FK constraint to existing data → validate orphans first
- [ ] Removing column → verify no code references it (search all codebases)
- [ ] Renaming column → BREAKING if clients read by name (use alias period)
- [ ] Changing index → DROP/CREATE can lock table (use CONCURRENTLY in Postgres)
- [ ] Removing table → verify no references, archive data if needed

Destructive (STOP, user approval required):

- [ ] DROP TABLE → backup required
- [ ] TRUNCATE → backup required
- [ ] Mass UPDATE/DELETE → preview count first, backup

## ZERO-DOWNTIME MIGRATION STRATEGY

Five-step Expand → Write-both → Backfill → Add-constraint → Contract pattern — see `agent_docs/zero-downtime-migration.md` for full detail and example SQL.

1. Expand phase: add new column/table (nullable, no constraint yet)
2. Deploy code that writes to both old + new
3. Backfill existing rows (in batches, not full UPDATE)
4. Add constraint (NOT NULL / FK / unique) now that every row has a value
5. Contract phase: remove old column (now safe)

Never: add NOT NULL column + deploy code in same migration (breaks existing instances).
Always: deploy DB migration BEFORE code deploy.

## N+1 QUERY PREVENTION

Flag N+1 when: loop calls DB for each item in a list.

```typescript
WRONG: users.map(u => db.posts.findMany({ where: { userId: u.id } }))
RIGHT: db.posts.findMany({ where: { userId: { in: userIds } } })
       -- or use ORM eager loading --
       db.users.findMany({ include: { posts: true } })
```

Prisma: use `include` / `select` — never implicit relation access inside loop
Drizzle: `leftJoin` or separate batched query
TypeORM: `QueryBuilder.leftJoinAndSelect` or `@Eager` on relation
SQLAlchemy: `selectinload` / `joinedload` options
ActiveRecord: `.includes(:relation)` or `.preload`

Flag with `FWD: N+1 risk — [location] — use eager loading or batch query`

## QUERY SAFETY — no injection

NEVER: string interpolation in queries

```text
WRONG: `SELECT * FROM users WHERE id = ${userId}`
WRONG: f"SELECT * FROM users WHERE id = {user_id}"
WRONG: "SELECT * WHERE id=" + request.params.id
```

ALWAYS: parameterized queries

```text
RIGHT (Prisma): db.user.findUnique({ where: { id } })
RIGHT (pg): pool.query('SELECT * FROM users WHERE id = $1', [userId])
RIGHT (Python): cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
RIGHT (Go): db.QueryRow("SELECT * FROM users WHERE id = $1", userID)
```

## INDEX REQUIREMENTS

Every FK column needs an index. Flag `FWD: Missing index on FK [table.column]`.
Common patterns that need indexes:

- `WHERE user_id = ?` → index on `user_id`
- `ORDER BY created_at DESC` → index on `created_at`
- `WHERE status = ? AND created_at > ?` → composite index `(status, created_at)`
- Unique constraints imply unique index (don't add duplicate)

## ORM-SPECIFIC PROTOCOLS

| ORM | Schema change | Safe query pattern |
| --- | --- | --- |
| Prisma | `prisma migrate dev` (dev) · `prisma migrate deploy` (prod) | `.findMany({ where, select })` |
| Drizzle | `drizzle-kit push` (dev) · migration files (prod) | `.select().from().where()` |
| TypeORM | migration files always | `createQueryBuilder` · `Repository` |
| SQLAlchemy | Alembic `alembic upgrade head` | `session.execute(select(...).where(...))` |
| ActiveRecord | `rails db:migrate` | `.where("column = ?", value)` |
| GORM | `AutoMigrate` dev only — migration files prod | `db.Where("column = ?", val).Find(&result)` |
| Mongoose | Schema change → db-guard | `.find({ field: sanitizedValue })` |
| Prisma+Supabase | `supabase db push` | RLS policies always present |

## SUPABASE SPECIFICS

RLS (Row Level Security): EVERY table must have RLS policies. No exceptions.

```sql
-- Required on every table:
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own posts"
  ON posts FOR SELECT USING (auth.uid() = user_id);
```

Never disable RLS to "fix a bug" — always write the correct policy.
Edge Functions auth: verify `req.headers.authorization` — never trust client-sent userId.

## FIREBASE / FIRESTORE

NEVER trust client-provided user ID in Firestore rules or Cloud Functions.
Always use `request.auth.uid` (not `request.resource.data.userId`).
Security rules must be reviewed by security-guard before deploy.

```text
// WRONG:
allow write: if request.resource.data.userId == request.auth.uid;
// RIGHT: check ownership on existing document
allow update: if resource.data.userId == request.auth.uid;
```

## CONNECTION + POOLING

- Always use connection pooling (PgBouncer, pgpool, or ORM built-in)
- Set pool size: `max_connections` based on RAM, not arbitrary
- Always set connection timeout (never infinite wait)
- Close connections properly — use `using` / `async with` / try-finally

## BACKUP PROTOCOL

Before any destructive operation: confirm backup exists or create one.

```sql
-- Before DROP or TRUNCATE:
-- Verify backup: SELECT count(*) FROM [table];
-- Point-in-time recovery available?
-- If no backup: STOP and ask user to create backup first
```
