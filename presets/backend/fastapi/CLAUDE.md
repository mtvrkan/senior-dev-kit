# Project Preset — FastAPI

## Architecture

- Routers group related endpoints — one router per domain (`users.py`, `orders.py`).
- Keep route functions thin: validate → call service → return response schema.
- Services contain business logic. Repositories / DB calls live in a data layer.
- Dependency injection via `Depends()` — auth, db session, current user.
- Type hints on all functions. Pydantic v2 for all request/response schemas.

`app/routers/users.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user import CreateUserRequest, UserResponse
from app.services.user_service import UserService
from app.dependencies import get_current_user, get_user_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    service: UserService = Depends(get_user_service),
):
    return await service.create(body)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    user = await service.get_by_id(user_id, requesting_user_id=current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

## Request / response schemas — Pydantic v2

```python
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class CreateUserRequest(BaseModel):
    email: EmailStr
    name:  str = Field(min_length=1, max_length=100)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:    str
    email: str
    name:  str
```

`from_attributes=True` is Pydantic v2's ORM mode. A response schema NEVER includes
`password_hash`, `internal_id` or other sensitive fields.

FastAPI validates all `CreateUserRequest` bodies automatically — validation errors return 422 with field-level details.

Never put `role`, `is_admin` or any privilege field on a create/register schema — a client-settable
role means anyone can sign up as admin. The service assigns the default role; changing a role is a
separate endpoint guarded by an admin-only dependency.

## Authorization — ownership check

`services/post_service.py`:

```python
async def get_post(self, post_id: str, requesting_user_id: str) -> PostResponse:
    post = await self.repo.find_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != requesting_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return PostResponse.model_validate(post)
```

## Async — never block the event loop

WRONG — blocks the event loop: `time.sleep` stalls every request, and `requests.get` is sync
HTTP inside an async route:

```python
@router.get("/users")
async def list_users():
    import time; time.sleep(2)
    return requests.get(url).json()
```

RIGHT — async I/O only:

```python
@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
```

Blocking I/O with no async client runs in the thread pool; CPU-bound work goes to a process pool:

```python
from fastapi.concurrency import run_in_threadpool
result = await run_in_threadpool(legacy_sync_client.fetch, data)

import asyncio
loop = asyncio.get_running_loop()
result = await loop.run_in_executor(process_pool, heavy_cpu_function, data)
```

The thread pool is for blocking I/O only: CPU-bound Python in a thread gains no parallelism under
the GIL and competes with the event loop for it. Send CPU-bound work to a process pool instead —
`process_pool` is a `concurrent.futures.ProcessPoolExecutor` created once at startup (lifespan) and
shut down on exit. Long or retryable jobs belong in a task queue (Celery, RQ, arq), not the request.

## Database — SQLAlchemy async + parameterized

Async session (SQLAlchemy 2.0) — `select(...).where(...)` is parameterized, so it is safe:

```python
async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalar_one_or_none()
```

WRONG — never string-format SQL; this is SQL injection:

```python
await db.execute(f"SELECT * FROM users WHERE email = '{email}'")
```

Multi-step writes run in one transaction — `async with db.begin()` commits on success and rolls
back on an exception:

```python
async def transfer(db: AsyncSession, from_id: str, to_id: str, amount: Decimal):
    async with db.begin():
        from_acct = await db.get(Account, from_id, with_for_update=True)
        to_acct   = await db.get(Account, to_id, with_for_update=True)
        if from_acct.balance < amount:
            raise HTTPException(status_code=409, detail="Insufficient funds")
        from_acct.balance -= amount
        to_acct.balance   += amount
```

Money is `Decimal` (column `Numeric`) or integer minor units — never `float`. The row locks
(`SELECT ... FOR UPDATE`) inside one transaction stop two concurrent transfers from both reading the
old balance; lock rows in a consistent order (e.g. by id) to avoid deadlocks.

## Error handling — global exception handlers

`app/main.py`:

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    logger.error("unhandled_error", path=request.url.path, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
```

Domain errors raise `HTTPException` with a detail, not raw exceptions:

```python
raise HTTPException(status_code=409, detail="Email already registered")
```

Never let SQLAlchemy `IntegrityError` or `OperationalError` reach the client — catch and convert.

## Structured logging

```python
import structlog
logger = structlog.get_logger()

logger.info("user_created", user_id=user.id, plan=user.plan)
logger.error("payment_failed", error=str(exc), user_id=user_id)
```

Always include context — identifiers, never the PII behind them. NEVER log passwords, tokens,
session IDs, email/phone, or a full request body with sensitive fields — the canonical list is
`rules/700-observability.md`'s Never log list.

## Verification

Targeted test, coverage run, lint, format check, type check, then a startup smoke check:

```bash
pytest tests/test_users.py -x -q
pytest --cov=app -q
ruff check .
ruff format --check .
mypy app/
uvicorn app.main:app --reload
```

## Anti-patterns

- Blocking I/O (`requests`, `time.sleep`, sync DB calls) in `async def` routes.
- Returning ORM objects directly — always map to Pydantic response schema.
- String-format SQL — always use SQLAlchemy ORM or parameterized `text()`.
- Business logic in route functions — belongs in service classes.
- `except Exception: pass` — always log and re-raise or return error response.
- `model_config = ConfigDict(from_attributes=True)` missing on response schemas that use ORM objects.
