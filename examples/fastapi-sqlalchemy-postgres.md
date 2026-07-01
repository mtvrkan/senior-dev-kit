# Worked Example — FastAPI + SQLAlchemy + PostgreSQL

Complete bootstrap walkthrough for a Python REST API project.

---

## Stack detection

```text
requirements.txt contains: fastapi, sqlalchemy, psycopg2-binary, alembic
Detected: FastAPI + SQLAlchemy + PostgreSQL
```

Presets selected: `backend/fastapi` · `orm/sqlalchemy` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/fastapi/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active (architecture detection)
│   ├── 200-api.md               ← **/api/**, **/routes/**
│   ├── 300-testing.md           ← **/tests/**, test_*.py
│   ├── 500-database.md          ← **/migrations/**, **/models/**
│   └── 700-observability.md     ← **/*.py
├── skills/                      ← all 32 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 14 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — FastAPI + SQLAlchemy + PostgreSQL

## preset: backend/fastapi

### Architecture
- Vertical slice: `app/[domain]/{router.py, service.py, schemas.py, models.py}`
- Routers → Services (business logic) → Repositories (DB access)
- Never DB access in routers. Never business logic in models.
- Dependency injection via `Depends()` — always.

### Commands
- TEST_CMD: pytest tests/ -x -q
- LINT_CMD: ruff check .
- TYPE_CMD: mypy app/
- PKG_MANAGER: pip (requirements.txt detected)

### Protected files (escalate before touching)
- `app/core/security.py` → security-guard
- `app/core/config.py` → security-guard (env vars)
- `alembic/versions/` → migration-guard

## preset: orm/sqlalchemy

### SQLAlchemy patterns
- Use `select()` construct — never raw SQL strings
- Session management via `AsyncSession` + `async with`
- One session per request via `Depends(get_db)`
- Relationships: `selectinload()` / `joinedload()` — never lazy-load in async context

## preset: database/postgres

### PostgreSQL rules
- All migrations via Alembic — never manual ALTER TABLE
- Index every FK column: `Index('ix_orders_user_id', Order.user_id)`
- Timestamp columns: always `TIMESTAMPTZ` (not `TIMESTAMP`)
- Use `SERIAL` or `UUID` for PKs — never application-generated int sequences
```

---

## Step 3 — Real usage flows

### Flow A: Add a new API endpoint

**User:** "Add a `GET /users/{id}/orders` endpoint that returns paginated order history"

**Routing:** `feature-build` skill → `senior-engineer` agent (sonnet)

**Agent behavior:**

1. Reads `app/users/router.py` (existing pattern)
2. Reads `app/orders/service.py` (order domain)
3. Reads `app/orders/schemas.py` (existing response shapes)
4. Checks for N+1: plans `selectinload(Order.items)` upfront

**Output:**

```text
PLAN: paginated order history endpoint — 4 files
[P:A] app/orders/schemas.py — add OrderListResponse(data, total, page, per_page)
[P:A] app/orders/repository.py — get_user_orders(user_id, page, per_page) with selectinload
[S]   app/orders/service.py — get_user_order_history(user_id, page, per_page) calling repo
[S]   app/users/router.py — GET /users/{id}/orders endpoint with Depends(get_current_user)
CONTRACT: GET /users/{id}/orders?page=1&per_page=20 → {data:[...], total:int, page:int, per_page:int}
OK to proceed?
```

**After approval:**

```text
∙ app/orders/schemas.py:45 — OrderListResponse + OrderItem schemas
∙ app/orders/repository.py:67 — get_user_orders with cursor pagination + selectinload
∙ app/orders/service.py:34 — get_user_order_history delegates to repository
∙ app/users/router.py:89 — GET /{id}/orders with ownership check (403 if not owner)
∙ tests/test_orders.py — 4 cases: happy path, empty list, unauthorized, page bounds
TEST: pytest tests/test_orders.py -x -q ✓ 4 passed
RISK: T2 · senior-engineer · API+DB
```

---

### Flow B: Add a new database column

**User:** "Add a `last_login_at` column to the User model"

**Routing:** DB schema signal → `db-guard` agent

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: User.last_login_at TIMESTAMPTZ nullable
Risk: low — additive, nullable, no existing data affected
Zero-downtime: safe (additive column, no constraint on existing rows)

MIGRATION PLAN
[S] app/users/models.py — add last_login_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMPTZ, nullable=True)
[S] alembic/versions/YYYYMMDD_add_user_last_login_at.py — auto-generated via alembic revision --autogenerate
[S] app/users/service.py:auth_login() — write last_login_at = datetime.utcnow() on successful auth
[S] app/users/schemas.py — add last_login_at: Optional[datetime] to UserResponse
[S] tests/test_users.py — verify last_login_at is updated on login

Commands:
  alembic revision --autogenerate -m "add_user_last_login_at"
  alembic upgrade head

Rollback: alembic downgrade -1 (removes column — data lost if code already wrote to it)
Approve to proceed?
```

---

### Flow C: Security audit before production deploy

**User:** `/security-scan` — audit before going live

**Routing:** `security-scan` skill → `security-scanner` agent

**Agent reads:**

- `app/core/security.py`
- `app/api/dependencies.py`
- `app/users/router.py`
- `alembic/versions/*.py`

**Output (abbreviated):**

```text
SECURITY SCAN — FastAPI + SQLAlchemy
=====================================

HIGH: app/users/router.py:23
  Issue: PATCH /users/{id} — no ownership check (IDOR risk)
  Attack: user A can update user B's profile via direct API call
  Fix: add `if current_user.id != user_id: raise HTTPException(403)`

MEDIUM: app/core/security.py:41
  Issue: JWT secret read from environment but no minimum-length validation
  Risk: weak secret passes silently — use > 32 chars in prod
  Fix: add `if len(SECRET_KEY) < 32: raise RuntimeError("JWT secret too short")`

LOW: alembic/versions/20260101_initial.py:15
  Issue: No index on User.email used in login query
  Fix: add `Index('ix_users_email', User.email, unique=True)`

SUMMARY: Critical:0 High:1 Medium:1 Low:1
VERDICT: fix High before deploy

IMPLEMENTATION PLAN:
1. app/users/router.py:23 — ownership assertion before update
2. app/core/security.py:41 — secret length validation at startup
3. alembic/versions — add email index migration
```

---

## Step 4 — Cost estimates

| Task | Agent | Model | Typical cost |
| --- | --- | --- | --- |
| Add API endpoint (3-4 files) | senior-engineer | sonnet | ~$0.04 |
| DB column + migration plan | db-guard | opus | ~$0.15 |
| Security scan (5-6 files) | security-scanner | sonnet | ~$0.06 |
| Bug fix (1-2 files) | bug-hunter | sonnet | ~$0.02 |
| Docs update | docs-writer | haiku | ~$0.003 |
