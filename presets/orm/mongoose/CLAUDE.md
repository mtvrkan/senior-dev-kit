# ORM Preset — Mongoose

## Schema

- Define validation in schemas (`required`, `enum`, `min`/`max`) and/or boundary validators.
- Use ObjectId consistently for references.
- Keep indexes aligned with query patterns — define via `index: true` / `unique: true` in the schema, and add for frequent `find()` filter fields.
- Avoid unbounded arrays in documents.

## Queries / updates

- Avoid raw user-provided filter/update objects — never `Model.find(req.body)` or `Model.updateOne({}, req.body)` directly; filter fields explicitly first (mass-assignment risk).
- Use atomic updates (`$inc`, `$set`, `$push`) for counters, quotas, and limits — never read-modify-write (race condition risk).
- Handle validation and duplicate key errors clearly: catch `MongoServerError code 11000` explicitly, never let it propagate as a raw 500.
- N+1: use `.populate('relation')` in the same query — never call `.populate()` inside a loop on each document.
- Transactions: `session.withTransaction(async () => { ... })` for multi-document atomic writes (requires a replica set).

## Anti-patterns

- Passing `req.body` directly to update operations.
- Missing indexes for common filters.
- Mixing string IDs and ObjectIds carelessly.
- Implicit lazy `.populate()` inside a loop.
- Swallowing duplicate-key errors.
