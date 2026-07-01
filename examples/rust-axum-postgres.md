# Worked Example — Rust Axum + PostgreSQL

Complete bootstrap walkthrough for a Rust API project using Axum 0.7+ + SQLx + PostgreSQL.

---

## Stack detection

```text
Cargo.toml contains: axum, tokio, sqlx, tower
Detected: Rust REST API
```

Presets selected: `backend/rust-api` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/rust-api/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active (architecture detection)
│   ├── 200-api.md               ← **/routes/**, **/handlers/**
│   ├── 300-testing.md           ← **/*_test.rs, tests/**
│   ├── 500-database.md          ← **/migrations/**, **/db/**
│   └── 700-observability.md     ← **/*.rs
├── skills/                      ← all 33 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Rust Axum + PostgreSQL

## preset: backend/rust-api

### Architecture
- Layered: src/{main.rs, routes/, handlers/, models/, db/, error.rs, state.rs}
- Handlers thin: extract args, call service fn, return Response
- Business logic in service modules under src/services/
- Shared state via AppState (Arc<AppState>) injected through Axum Extension
- Error handling: define AppError enum implementing IntoResponse; use ? everywhere
- Never unwrap() in production paths — propagate with ?

### Commands
- TEST_CMD: cargo test [test_name] -- --nocapture
- LINT_CMD: cargo clippy -- -D warnings
- BUILD_CMD: cargo build --release
- TYPE_CMD: cargo check (implicit in build)

### Protected files (escalate before touching)
- src/middleware/auth.rs → security-guard
- src/handlers/auth.rs → security-guard
- migrations/** → migration-guard

## preset: database/postgres

### PostgreSQL rules
- All migrations via SQLx CLI: sqlx migrate add <name> (creates migrations/<ts>_<name>.sql)
- Parameterized queries only: sqlx::query!("SELECT ... WHERE id = $1", id)
- Never string-format SQL — use sqlx macros (query!, query_as!) for compile-time check
- Index every FK column; use CONCURRENTLY for indexes on large tables
- Timestamps: always TIMESTAMPTZ; map to chrono::DateTime<Utc> in Rust
```

---

## Step 3 — Real usage flows

### Flow A: Add a new route handler

**User:** "Add a `GET /users/:id/posts` handler that returns paginated posts for a user"

**Routing:** `feature-build` skill → `senior-engineer` agent (sonnet)

**Agent behavior:**

1. Reads `src/handlers/users.rs` (existing handler pattern)
2. Reads `src/db/posts.rs` (existing query pattern)
3. Notes cursor pagination already used → follows same shape
4. Checks N+1: plans single JOIN query, not per-post lookup

**Output:**

```text
PLAN: paginated user posts handler — 4 files
[P:A] src/models/post.rs — add PostListResponse { data: Vec<Post>, cursor: Option<String>, has_more: bool }
[P:A] src/db/posts.rs — get_posts_by_user(pool, user_id, cursor, limit) → Result<Vec<Post>>
[S]   src/handlers/posts.rs — get_user_posts extractor, ownership assert, cursor parse
[S]   src/routes/mod.rs — add GET /users/:id/posts route binding
CONTRACT: GET /users/:id/posts?cursor=&limit=20 → {data:[...], cursor:string|null, has_more:bool}
OK to proceed?
```

**After approval:**

```text
∙ src/models/post.rs:18 — PostListResponse struct + Serialize derive
∙ src/db/posts.rs:42 — get_posts_by_user with sqlx::query_as! cursor WHERE clause
∙ src/handlers/posts.rs:28 — get_user_posts: Path(user_id), Extension(state), Query(params)
∙ src/routes/mod.rs:15 — .route("/users/:id/posts", get(get_user_posts))
∙ src/handlers/posts.rs:67 — #[cfg(test)] mod tests with 3 cases
TEST: cargo test handlers::posts -- --nocapture ✓ 3 passed
RISK: T2 · senior-engineer · API+DB
```

---

### Flow B: Add a migration + model update

**User:** "Add a `deleted_at` soft-delete column to the posts table"

**Routing:** DB schema signal → `db-guard` agent

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: posts.deleted_at TIMESTAMPTZ nullable (soft-delete)
Risk: low — nullable column, additive, no existing rows affected
Zero-downtime: safe

MIGRATION PLAN
[S] migrations/<timestamp>_add_posts_deleted_at.sql
    ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ;
    CREATE INDEX CONCURRENTLY ix_posts_deleted_at
      ON posts (deleted_at) WHERE deleted_at IS NULL;

[S] migrations/<timestamp>_add_posts_deleted_at.down.sql
    DROP INDEX IF EXISTS ix_posts_deleted_at;
    ALTER TABLE posts DROP COLUMN deleted_at;

[S] src/models/post.rs — add deleted_at: Option<DateTime<Utc>> to Post struct
[S] src/db/posts.rs — update all queries: WHERE deleted_at IS NULL
[S] src/db/posts.rs — add soft_delete_post(pool, id) sets deleted_at = now()

Note: partial index on WHERE deleted_at IS NULL keeps active-post queries fast.
Approve to proceed?
```

---

### Flow C: Security review — unsafe block audit

**User:** "There are a few `unsafe` blocks in the codebase — can you review them?"

**Routing:** security signal → `security-guard` agent (opus)

**Output:**

```text
SECURITY REVIEW — Rust unsafe blocks
=====================================

HIGH: src/utils/ffi.rs:14
  Issue: from_utf8_unchecked on externally-sourced bytes
  Risk: undefined behavior if external source provides non-UTF-8 data
  Fix: use from_utf8() and propagate the Utf8Error; add a test with invalid UTF-8 input

MEDIUM: src/state.rs:38
  Issue: raw pointer dereference inside unsafe block — no lifetime bound documented
  Risk: potential use-after-free if AppState is dropped before pointer consumers
  Fix: replace raw pointer with Arc<Mutex<T>>; eliminate unsafe block entirely

LOW: Cargo.toml
  Issue: chrono, serde pinned to minor version (^0.4) without lock file review
  Guidance: run `cargo audit` — no known CVEs in current ranges, but worth tracking

SUMMARY: Critical:0 High:1 Medium:1 Low:1
VERDICT: fix High before deploy

IMPLEMENTATION PLAN:
1. src/utils/ffi.rs:14 — replace unchecked with from_utf8() + ? propagation
2. src/state.rs:38 — refactor to Arc<Mutex<T>>, remove unsafe
TEST: cargo test && cargo clippy -- -D warnings
```

---

## Step 4 — Cost estimates

| Task | Agent | Model | Typical cost |
| --- | --- | --- | --- |
| Add route handler (3-4 files) | senior-engineer | sonnet | ~$0.04 |
| Migration + model update | db-guard | opus | ~$0.15 |
| Unsafe block security review | security-guard | opus | ~$0.15 |
| Bug fix (1-2 files) | bug-hunter | sonnet | ~$0.02 |
| Docs update (rustdoc) | docs-writer | haiku | ~$0.003 |
