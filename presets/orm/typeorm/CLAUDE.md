# ORM Preset — TypeORM

> Existing-project preset only. Per `rules/001-conventions.md`, prefer Prisma or Drizzle for new projects — apply this preset to maintain the current codebase, not to justify adopting TypeORM for greenfield work.

## Entities / migrations

- Do not edit entities/migrations unless DB change is requested — route through the db-guard skill.
- Keep decorators and relations intentional: `@Column`, `@OneToMany`, `@ManyToOne` must match the DB schema exactly, or drift causes runtime errors.
- Prefer explicit migration files over unsafe sync in production — `synchronize: true` is development-only and must never be enabled in production.

## Queries

- Use repositories/query builders safely: `Repository` methods or `QueryBuilder`, always parameterized (`WHERE column = :value`, never string concatenation).
- Avoid N+1 relation loading: use `leftJoinAndSelect` or the `relations` option in `find()` — never access `.relation` inside a loop without eager loading.
- Use transactions for multi-step writes: `dataSource.transaction(async (manager) => { ... })`.
- Validate input before queries: validate DTOs with class-validator before passing to the repository — TypeORM does not validate by default.
- Define indexes via `@Index()` on entity columns that match query patterns.

## Anti-patterns

- Enabling schema sync (`synchronize: true`) for production-like workflows.
- Eager-loading too much data.
- Raw SQL without parameters.
- N+1 relation access inside a loop.
- Missing transaction on multi-table writes.
