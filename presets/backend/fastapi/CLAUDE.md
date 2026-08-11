# Project Preset — FastAPI

## Architecture

- Routers group related endpoints — one router per domain (`users.py`, `orders.py`).
- Keep route functions thin: validate → call service → return response schema.
- Services contain business logic. Repositories / DB calls live in a data layer.
- Dependency injection via `Depends()` — auth, db session, current user.
- Type hints on all functions. Pydantic v2 for all request/response schemas.

```python
# app/routers/users.py
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
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, ConfigDict

class CreateUserRequest(BaseModel):
    email: EmailStr
    name:  str = Field(min_length=1, max_length=100)
    role:  Literal["user", "admin"] = "user"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # ORM mode (v2)
    id:    str
    email: str
    name:  str
    # NEVER include: password_hash, internal_id, sensitive fields
```

FastAPI validates all `CreateUserRequest` bodies automatically — validation errors return 422 with field-level details.

## Authorization — ownership check

```python
# services/post_service.py
async def get_post(self, post_id: str, requesting_user_id: str) -> PostResponse:
    post = await self.repo.find_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != requesting_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return PostResponse.model_validate(post)
```

## Async — never block the event loop

```python
# WRONG — blocks event loop
@router.get("/users")
async def list_users():
    import time; time.sleep(2)          # blocks all requests!
    return requests.get(url).json()     # sync HTTP in async route

# RIGHT — async I/O only
@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()

# For CPU-heavy work — run in thread pool
from fastapi.concurrency import run_in_threadpool
result = await run_in_threadpool(heavy_cpu_function, data)
```

## Database — SQLAlchemy async + parameterized

```python
# async session (SQLAlchemy 2.0)
async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email)  # parameterized — safe
    )
    return result.scalar_one_or_none()

# WRONG — never string-format SQL
await db.execute(f"SELECT * FROM users WHERE email = '{email}'")  # SQL injection!

# Transactions for multi-step writes
async def transfer(db: AsyncSession, from_id: str, to_id: str, amount: float):
    async with db.begin():  # auto-commit or rollback
        from_acct = await db.get(Account, from_id)
        to_acct   = await db.get(Account, to_id)
        from_acct.balance -= amount
        to_acct.balance   += amount
```

## Error handling — global exception handlers

```python
# app/main.py
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    logger.error("unhandled_error", path=request.url.path, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# Domain errors — raise HTTPException with detail, not raw exceptions
raise HTTPException(status_code=409, detail="Email already registered")
```

Never let SQLAlchemy `IntegrityError` or `OperationalError` reach the client — catch and convert.

## Structured logging

```python
import structlog
logger = structlog.get_logger()

# Always include context — identifiers, never the PII behind them
logger.info("user_created", user_id=user.id, plan=user.plan)
logger.error("payment_failed", error=str(exc), user_id=user_id)

# NEVER log: passwords, tokens, session IDs, email/phone, full request body with sensitive
# fields — canonical list in rules/700-observability.md's never-log-fields marker
```

## Verification

```bash
pytest tests/test_users.py -x -q       # targeted
pytest --cov=app -q                    # with coverage
ruff check .                           # lint + format check
mypy app/                              # type check
uvicorn app.main:app --reload          # startup smoke check
```

## Anti-patterns

- Blocking I/O (`requests`, `time.sleep`, sync DB calls) in `async def` routes.
- Returning ORM objects directly — always map to Pydantic response schema.
- String-format SQL — always use SQLAlchemy ORM or parameterized `text()`.
- Business logic in route functions — belongs in service classes.
- `except Exception: pass` — always log and re-raise or return error response.
- `model_config = ConfigDict(from_attributes=True)` missing on response schemas that use ORM objects.
