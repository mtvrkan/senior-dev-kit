# Worked Example — Go REST API + PostgreSQL

Complete bootstrap walkthrough for a Go API project using `net/http` (or chi) + `database/sql` / sqlc.

---

## Stack detection

```text
go.mod contains: module, go 1.23
Detected: Go REST API
```

Presets selected: `backend/go-api` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/go-api/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active (architecture detection)
│   ├── 200-api.md               ← **/api/**, **/handlers/**
│   ├── 300-testing.md           ← **/*_test.go
│   ├── 500-database.md          ← **/migrations/**, **/queries/**
│   └── 700-observability.md     ← **/*.go
├── skills/                      ← all 33 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Go REST API + PostgreSQL

## preset: backend/go-api

### Architecture
- Layered: `internal/[domain]/{handler.go, service.go, repository.go, model.go}`
- Handlers → Services (business logic) → Repositories (DB)
- Never DB access in handlers. Use `context.Context` everywhere.
- Errors: return `(T, error)` — never panic for business errors.

### Commands
- TEST_CMD: go test ./... -run TestName -v
- LINT_CMD: golangci-lint run
- BUILD_CMD: go build ./...
- TYPE_CMD: — (Go is compiled, type errors surface at build)

### Protected files (escalate before touching)
- `internal/auth/` → security-guard
- `internal/middleware/auth*.go` → security-guard
- `db/migrations/` → migration-guard

## preset: database/postgres

### PostgreSQL rules
- All migrations via migrate or goose — never manual ALTER TABLE
- Parameterized queries only: `db.QueryContext(ctx, "SELECT ... WHERE id = $1", id)`
- Never `fmt.Sprintf` in SQL — injection risk
- Index every FK column; use `EXPLAIN ANALYZE` before shipping slow queries
- Timestamps: always `TIMESTAMPTZ` (not `TIMESTAMP`)
```

---

## Step 3 — Real usage flows

### Flow A: Add a new API endpoint

**User:** "Add a `GET /users/:id/posts` endpoint that returns paginated posts for a user"

**Routing:** `feature-build` skill → `senior-engineer` agent (sonnet)

**Agent behavior:**

1. Reads `internal/users/handler.go` (existing handler pattern)
2. Reads `internal/posts/repository.go` (existing repo pattern)
3. Notes cursor-based pagination already in use → follows same pattern
4. Checks N+1: plans single JOIN query instead of per-post author fetch

**Output:**

```text
PLAN: paginated user posts endpoint — 4 files
[P:A] internal/posts/model.go — add PostListResponse{Data []Post, Cursor string, HasMore bool}
[P:A] internal/posts/repository.go — GetByUserID(ctx, userID, cursor, limit) with cursor pagination
[S]   internal/posts/service.go — GetUserPosts(ctx, userID, cursor, limit) + ownership check
[S]   internal/users/handler.go — GET /{id}/posts handler with query param parsing
CONTRACT: GET /users/{id}/posts?cursor=&limit=20 → {data:[...], cursor:string, hasMore:bool}
OK to proceed?
```

**After approval:**

```text
∙ internal/posts/model.go:34 — PostListResponse struct
∙ internal/posts/repository.go:89 — GetByUserID with $1/$2/$3 parameterized query
∙ internal/posts/service.go:45 — GetUserPosts with user ownership assertion
∙ internal/users/handler.go:112 — GET /{id}/posts with strconv.Atoi limit guard
∙ internal/posts/repository_test.go — 3 cases added (happy, empty, cursor boundary)
TEST: go test ./internal/posts/... -run TestGetByUserID -v ✓ 3 passed
RISK: T2 · senior-engineer · API+DB
```

---

### Flow B: Add a new database column + migration

**User:** "Add a `deleted_at` soft-delete column to the users table"

**Routing:** DB schema signal → `db-guard` agent

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: users.deleted_at TIMESTAMPTZ nullable (soft-delete pattern)
Risk: low — nullable column, additive, existing rows unaffected
Zero-downtime: safe

MIGRATION PLAN
[S] db/migrations/YYYYMMDD_add_users_deleted_at.up.sql
    ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
    CREATE INDEX CONCURRENTLY ix_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NULL;
[S] db/migrations/YYYYMMDD_add_users_deleted_at.down.sql
    DROP INDEX IF EXISTS ix_users_deleted_at;
    ALTER TABLE users DROP COLUMN deleted_at;
[S] internal/users/model.go — add DeletedAt *time.Time to User struct
[S] internal/users/repository.go — update all queries: WHERE deleted_at IS NULL
[S] internal/users/repository.go — add SoftDelete(ctx, id) sets deleted_at = now()

Note: partial index on WHERE deleted_at IS NULL keeps active-user queries fast (Postgres).

Approve to proceed?
```

---

### Flow C: Security scan before production deploy

**User:** `/security-scan` — audit before going live

**Routing:** `security-scan` skill → `security-scanner` agent

**Output (abbreviated):**

```text
SECURITY SCAN — Go REST API + PostgreSQL
=========================================

HIGH: internal/users/handler.go:67
  Issue: PATCH /users/{id} — no ownership check (IDOR risk)
  Attack: user A can update user B's profile via direct API call
  Fix: assert userID from JWT == path param id, return 403 if mismatch

MEDIUM: internal/auth/token.go:29
  Issue: JWT parsed with jwt.ParseWithClaims — alg not pinned
  Risk: alg=none attack if library version lacks default guard
  Fix: use jwt.NewParser(jwt.WithValidMethods([]string{"HS256"}))

LOW: internal/posts/repository.go:44
  Issue: SELECT * — returns all columns including future sensitive ones
  Fix: enumerate columns explicitly: SELECT id, title, body, created_at

SUMMARY: Critical:0 High:1 Medium:1 Low:1
VERDICT: fix High before deploy

IMPLEMENTATION PLAN:
1. internal/users/handler.go:67 — ownership assertion from JWT claims
2. internal/auth/token.go:29 — pin algorithm to HS256
3. internal/posts/repository.go:44 — explicit column selection
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
