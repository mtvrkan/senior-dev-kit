# ORM Preset — SQLAlchemy

## Architecture

- Keep model/session boundaries clear — use one `Session` per request (FastAPI: `Depends(get_db)`); never reuse a session across requests, and never keep a single global session in a request handler.
- Respect sync vs async SQLAlchemy patterns: sync uses `Session`, async uses `AsyncSession` — never mix the two in the same codebase.
- Keep migrations in Alembic if configured.

## Queries

- Avoid lazy-load N+1 issues: use `selectinload(Model.relation)` or `joinedload` in the query itself — never access `.relation` on a model after the session has closed.
- Use transactions for multi-step writes: `async with session.begin()` for atomic writes, with explicit rollback in exception handlers.
- Validate input before queries — use Pydantic v2; SQLAlchemy does not validate by default.
- Avoid raw SQL unless justified and parameterized: `session.execute(select(Model).where(Model.column == value))` parameterizes automatically — never `text()` with an f-string.

## Migrations

- Use Alembic when configured: `alembic revision --autogenerate -m "name"` then review the diff before `alembic upgrade head`.
- Prefer additive migrations.
- Include rollback/backfill plan for risky changes.

## Anti-patterns

- Long-lived sessions in request flows.
- Unparameterized raw SQL (`text(f"WHERE id = {id}")`).
- Accidental lazy loading in API serialization (after session close).
- Reusing a session across requests.
