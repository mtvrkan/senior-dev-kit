# Project Preset — MongoDB (Mongoose / driver)

`rules/500-database.md` co-loads for schema/model/migration files and owns the cross-database
rules: when a shape change escalates to `db-guard`, N+1 prevention, and the document-store
section this preset expands on. Read it as the baseline; what follows is Mongo-specific detail.

## Schema — "schemaless" means the schema moved into your code

```ts
const userSchema = new Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  orgId:     { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw' })   // `strict: 'throw'` rejects unknown fields loudly
```

- `strict: 'throw'` (or `$jsonSchema` validation on the collection when using the raw driver).
  Without it a typo silently creates a new field on some documents and nowhere else.
- Old documents keep their old shape forever. A field change is a **migration**: write the
  backfill script and the read-path fallback in the same change, and treat it as Tier 3.

## Query injection is the signature MongoDB vulnerability

```ts
// WRONG — body {"email": {"$ne": null}} matches every user
await User.findOne({ email: req.body.email })

// RIGHT — cast, or validate with a schema before it reaches the query
await User.findOne({ email: String(req.body.email) })
const { email } = loginSchema.parse(req.body)
```

Also never build `$where` or `$expr` from user input — those evaluate expressions.

## Indexes — check, don't hope

```js
db.orders.find({ orgId, status: 'open' }).sort({ createdAt: -1 }).explain('executionStats')
// COLLSCAN in the winning plan = missing index
db.orders.createIndex({ orgId: 1, status: 1, createdAt: -1 })
```

A compound index is used left-to-right: `{ orgId, status, createdAt }` serves a query on `orgId`
alone, but an index on `{ status }` alone does nothing for a query that filters `orgId` first.
Add a unique index for anything you treat as unique — application-level checks race.

## Modelling

- **Embed** what is read together and bounded (an address, a few tags).
- **Reference** what is written independently or grows without limit. An array that grows per
  event will hit the 16 MB document cap and take the whole document down with it.
- `.lean()` on read-only queries — skipping Mongoose document hydration is usually the single
  biggest win on a list endpoint.
- Project explicitly (`.select('_id name email')`); returning full documents leaks fields the API
  never meant to expose.

## Atomicity

```ts
await Model.updateOne({ _id, version }, { $inc: { count: 1 } })   // atomic operator, not read-modify-write
```

A single write to one document is atomic; anything spanning documents needs a session
transaction (`session.withTransaction`) on a replica set. `updateMany` is *not* atomic across the
documents it touches.

## Aggregation

`$match` first (so an index can be used), then `$project` to shrink documents, then `$group`. A
`$lookup` is a per-document join — the aggregation equivalent of N+1 if the foreign field is not
indexed. `allowDiskUse` is a symptom to investigate, not a fix.

## Verification

```bash
npx jest src/models/user.test.ts        # targeted (mongodb-memory-server for isolation)
npx tsc --noEmit
node scripts/check-indexes.js           # assert expected indexes exist in the target env
mongosh --eval 'db.orders.getIndexes()'
```

## Anti-patterns

- Unvalidated request values placed straight into a filter (`$ne`/`$gt` injection).
- No `strict`/`$jsonSchema` — silent field drift.
- Missing index on a hot filter or sort; `COLLSCAN` accepted because "it's fast locally".
- Unbounded arrays inside a document.
- Read-modify-write instead of `$inc`/`$set`/`$push` atomic operators.
- `.find()` without `.lean()` on read-only paths, or without a projection.
- Treating a shape change as free because the database doesn't enforce one.
