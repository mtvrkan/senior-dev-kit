# Database Preset — SQLite

## Usage

- Good for local, embedded, mobile (Flutter/iOS/Android), desktop, tests, and small single-user apps.
- Be careful with concurrency/write contention — SQLite has a single writer by default; enable `PRAGMA journal_mode=WAL` for concurrent readers.
- Use migrations if the project has a migration tool; track schema version and never let it drift silently.

## Modeling

- Keep schema simple and explicit.
- Use indexes for frequent lookups; verify with `EXPLAIN QUERY PLAN`.
- Consider foreign key enforcement if relevant — it's off by default; enable per connection with `PRAGMA foreign_keys=ON`.

## Data safety

- Avoid destructive schema changes without backup/plan.
- Be careful with file paths and environment-specific DB files — never interpolate user input into a DB file path.
- Do not treat local dev DB behavior as production behavior.
- Always parameterized queries — never string interpolation; SQLite is as vulnerable to injection as any SQL database.

## Anti-patterns

- Assuming SQLite concurrency matches PostgreSQL/MySQL.
- Large production multi-user workloads without justification.
- Silent schema drift without migrations.
- Concurrent write workloads without WAL mode enabled.
