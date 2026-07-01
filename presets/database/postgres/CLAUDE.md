# Database Preset — PostgreSQL

## Modeling

- Prefer explicit constraints for integrity: foreign keys, unique constraints, checks where appropriate.
- Use appropriate data types and avoid storing structured data as text when relational querying is needed.
- Model SaaS ownership boundaries clearly.

## Migrations

- Prefer additive migrations.
- Avoid destructive migrations without explicit approval.
- For column renames/drops, prefer multi-step migrations with backfill/compatibility plan.
- Consider rollback and deployment order.

## Queries / performance

- Add indexes based on real query patterns.
- Watch for N+1 queries.
- Use transactions for multi-step consistency.
- Consider locking/race conditions for counters, quotas, and inventory-like logic.

## Security

- Use parameterized queries or ORM-safe APIs.
- Do not log connection strings or sensitive data.

## Anti-patterns

- Adding indexes without query justification.
- Dropping columns/tables directly.
- Enforcing quotas without transaction/race consideration.
