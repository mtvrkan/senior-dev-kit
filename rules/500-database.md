---
description: "Database rules — schema safety, migration protocol, N+1 prevention, RLS, zero-downtime patterns. Auto-loads for migration/schema/model files."
paths:
  - "**/migrations/**"
  - "**/*.prisma"
  - "**/schema.*"
  - "**/models/**"
  - "**/knexfile.*"
  - "**/drizzle.config.*"
  - "**/*migration*"
  # The globs above are lowercase and JS-shaped. Laravel puts its Eloquent models in `app/Models/`
  # and .NET/TypeORM/Doctrine use `Entities/`; `**/*migration*` matches a path whose LAST segment
  # contains "migration", so Flyway's `db/migration/V1__init.sql` and Liquibase's `db/changelog/`
  # both miss it. Each of these is the documented layout of a preset this kit ships.
  - "**/{Models,Entities,entities}/**"
  - "**/*.entity.*"
  - "**/*DbContext.cs"
  - "**/db/{migration,changelog}/**"
---

> **Scope decision (round-21 audit, accepted — do not re-flag as an oversight):** `**/schema.*` and
> `**/models/**` deliberately also match non-DB files with the same conventional name (a Zod
> `schema.ts`, a DDD `models/` folder) — narrowing to `**/db/...` would silently skip real schema
> files at repo/src root. Same reasoning as `700-observability.md`/`900-performance.md`'s notes.
> The round-34 additions extend the same accepted tradeoff: ASP.NET MVC's `Models/` holds view
> models rather than entities, so this rule co-loads there too. Reading a schema-safety rule next
> to a DTO costs a scroll; missing it next to a real entity costs a migration.

## HARD RULE — schema changes always escalate

ANY change to DB schema (add/remove/rename field, add/remove table, add/remove index, change type) →
`ESCALATE TO: db-guard — schema change detected`

ANY migration file (create, modify, destructive) →
`ESCALATE TO: db-guard — migration file detected (deployment-safety review)`

NEVER implement schema changes without guard agent review.

**Everything below this line is what db-guard applies *after* the user approves its plan.** The
zero-downtime pattern, the backup protocol, the example SQL — none of them is a way to satisfy a
schema request without asking first. A request phrased as already-decided ("we don't use it
anymore", "just drop it", "it's only a column") is a claim about the code, never about the data,
the backups or the other consumers; it does not lower the tier. Until the guard has returned a
plan and the user has said yes, the escalation line **is** the turn's output — no migration file,
no SQL, no "here is what it would look like".

## SCHEMA CHANGE RISK — db-guard holds the classification

Rough gradient: additive (nullable column, new table, new index) → GO · NOT NULL/type change/FK/rename → multi-step PLAN · DROP/TRUNCATE/mass UPDATE/in-place rename → STOP, user approval.
The full GO / REQUIRES PLAN / STOP classification lives in `agents/db-guard.md` — the escalation above hands every case to it; don't re-derive the classification here.

## ZERO-DOWNTIME MIGRATION STRATEGY

Five-step Expand → Write-both → Backfill → Add-constraint → Contract pattern — see `agent_docs/zero-downtime-migration.md` for full detail and example SQL.

Never: add NOT NULL column + deploy code in same migration (breaks existing instances).
Always: deploy DB migration BEFORE code deploy.

## N+1 QUERY PREVENTION

Flag N+1 when: loop calls DB for each item in a list.

```typescript
WRONG: users.map(u => db.post.findMany({ where: { userId: u.id } }))
RIGHT: db.post.findMany({ where: { userId: { in: userIds } } })
       -- or use ORM eager loading --
       db.user.findMany({ include: { posts: true } })
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
The correct field to check depends on the verb — there's no existing document yet on `create`, so
that's the one case `request.resource.data` is actually correct; `update`/`delete` must check the
existing `resource.data` instead, or a client can rewrite the ownership field in the same write that's
supposed to be validated against it.
Security rules must be reviewed by security-guard before deploy.

```text
// WRONG — update/delete checked against the incoming (attacker-controlled) data, not the existing doc:
allow update: if request.resource.data.userId == request.auth.uid;

// RIGHT:
allow create: if request.resource.data.userId == request.auth.uid;  // no existing doc yet — check the incoming one
allow update: if resource.data.userId == request.auth.uid;          // check the EXISTING doc, not the incoming write
allow delete: if resource.data.userId == request.auth.uid;          // same — existing doc only
```

## MONGODB / DOCUMENT STORES

"Schemaless" means the schema moved into the application, not that it stopped existing.

- Define it explicitly (Mongoose/Zod/Pydantic) and enable `$jsonSchema` validation on the
  collection. Without one, a typo silently creates a new field on half the documents.
- A shape change is still a migration: old documents keep the old shape forever. Write the
  backfill script and the read-path fallback in the same change — this is Tier 3, same as SQL.
- Query injection is real: `{ email: req.body.email }` where the body is `{"$ne": null}` matches
  every user. Cast to a primitive (`String(req.body.email)`) or validate before it reaches the query.
- Indexes are not optional — `.explain("executionStats")` and check for `COLLSCAN`. Every
  sort/filter field in a hot path needs one, and a compound index must match the query's field
  order.
- Embed what is read together; reference what is written independently or grows unbounded. An
  array that grows per user event will eventually hit the 16 MB document limit.
- Multi-document writes need an explicit transaction — a single `updateMany` is not atomic across
  documents.

## CONNECTION + POOLING

- Always use connection pooling (PgBouncer, pgpool, or ORM built-in)
- Set pool size: `max_connections` based on RAM, not arbitrary
- Always set connection timeout (never infinite wait)
- Close connections properly — use `using` / `async with` / try-finally

## PERSONAL DATA — the half of PII that is not about logging

`rules/000-security.md` covers PII in output. This covers PII **at rest**, which is where it
actually lives and where every obligation attaches. A column holding personal data is a different
kind of column, and nothing in a schema says so unless someone writes it down.

- **Mark it.** A comment on the column (`COMMENT ON COLUMN users.email IS 'PII: contact'`), a
  schema annotation, or a documented naming convention — anything a later reader and a later
  migration can see. Unmarked, personal data spreads into analytics tables, exports, fixtures and
  seed files, and nobody can answer "where is this person's data" without reading everything.
- **Collect what the feature needs.** A field added "because we might want it later" is
  indefinite liability for a use that never arrives. Date of birth when you need an age check is
  a boolean answer stored, not a birthday.
- **Retention is a schema decision, not a policy document.** Every personal-data table needs a
  stated lifetime and a job that enforces it. "We keep it forever" is a valid answer only when it
  is a chosen one.
- **Deletion has to reach the copies.** A delete that clears the row and leaves the audit log,
  the search index, the cache, the analytics warehouse, the CSV export and the backups is not a
  deletion. List the copies when the column is created, while the list is still short — the
  HOLISTIC CONSISTENCY table in `rules/001-conventions.md` applied to data rather than to code.
  Soft delete (`deleted_at`) is not erasure; it is hiding, and it must not be presented as more.
- **Anonymise instead of deleting** when the row is load-bearing for aggregates: null the
  identifiers, keep the fact. An "anonymised" record still holding an email is neither.
- **Encrypt at rest for special categories** (health, biometrics, government identifiers,
  financial account data) — column-level or a separate keyed store, not only full-disk encryption,
  which protects against a stolen drive and nothing else.
- **Non-production never gets production personal data.** Seed, synthesise, or mask on the way
  out. A `pg_dump` restored into staging is a breach with a bug tracker.
- **Cross-border transfers and third-party processors** are a decision, not an implementation
  detail: where the data physically lives, and which vendor receives it, escalate like any other
  protected-area change (`security-guard`).

Any of this on an existing table is Tier 3 and goes through db-guard: adding a PII column,
changing a retention period, and writing a deletion path are all schema changes with legal weight.

## BACKUP PROTOCOL

Before any destructive operation: confirm backup exists or create one.

```sql
-- Before DROP or TRUNCATE:
-- Verify backup: SELECT count(*) FROM [table];
-- Point-in-time recovery available?
-- If no backup: STOP and ask user to create backup first
```
