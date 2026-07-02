# Database Preset — MongoDB

## Modeling

- Choose embed vs reference based on query patterns and document growth: embed for has-one/few relations read together; reference for many-to-many or unbounded/growing collections.
- Avoid unbounded arrays inside documents unless intentional.
- Keep document shape validated through Mongoose/Zod/project convention.
- Be careful with ObjectId/string mismatches — never mix string IDs and ObjectId without explicit conversion (causes silent query misses).

## Indexes / performance

- Add indexes for frequent filters, lookups, sorting, and uniqueness; compound index field order matters — match the query's filter order.
- Use `explain()` to verify an index is actually used before trusting it.
- Watch aggregation pipeline cost: put `$match` as the first stage, run `$lookup` only on indexed fields, and limit pipeline depth for expensive operations.
- Avoid unbounded collection scans.

## Consistency / security

- Use atomic updates (`$inc`, `$set`, `$push` with `$each`) for counters, quotas, limits, and inventory-like logic — never read-modify-write without atomicity.
- Never accept raw user query/filter/update objects without validation.
- Avoid NoSQL injection through `$where`, `$regex`, or filter/update operators sourced from user input — sanitize first.

## Anti-patterns

- Embedding ever-growing child arrays.
- Relying on UI-only validation.
- Passing `req.body` directly into queries/updates.
- `$where` with user input.
- Missing index on a frequently filtered field.
