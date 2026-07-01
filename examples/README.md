# Examples

Concrete before/after flows showing how the kit changes Claude's behavior.
Each example shows: user input → auto-routing → output format.

## Worked bootstraps

Full setup walkthroughs showing stack detection, generated `stack-rules.md`, and real usage flows:

| Example | Stack | Flows covered |
| --- | --- | --- |
| [nextjs-prisma-postgres.md](nextjs-prisma-postgres.md) | Next.js SaaS + Prisma + PostgreSQL | New page, DB column, security review |
| [nestjs-prisma-postgres.md](nestjs-prisma-postgres.md) | NestJS + Prisma + PostgreSQL | New endpoint, Prisma model + migration, security scan |
| [fastapi-sqlalchemy-postgres.md](fastapi-sqlalchemy-postgres.md) | FastAPI + SQLAlchemy + PostgreSQL | New endpoint, DB column, security scan |
| [django-postgres.md](django-postgres.md) | Django + PostgreSQL | New DRF endpoint, DB column, IDOR review |
| [nuxt-drizzle-postgres.md](nuxt-drizzle-postgres.md) | Nuxt 3 + Drizzle + PostgreSQL | New admin page, DB column, SSR auth review |
| [laravel-mysql.md](laravel-mysql.md) | Laravel + Filament + MySQL | New Filament resource, migration, mass assignment review |
| [rails-postgres.md](rails-postgres.md) | Rails 7 + PostgreSQL | New controller action, migration, IDOR review |
| [dotnet-postgres.md](dotnet-postgres.md) | .NET 8 API + EF Core + PostgreSQL | New endpoint + DTO, EF migration, payment security review |
| [go-postgres.md](go-postgres.md) | Go REST API + PostgreSQL | New endpoint, soft-delete migration, security scan |
| [java-spring-postgres.md](java-spring-postgres.md) | Java Spring Boot + PostgreSQL | New endpoint, JPA entity + Flyway migration, security scan |
| [rust-axum-postgres.md](rust-axum-postgres.md) | Rust Axum + PostgreSQL | New route handler, SQLx migration, unsafe block audit |
| [flutter-supabase.md](flutter-supabase.md) | Flutter + Supabase | New screen, DB table + RLS, performance review |
| [kotlin-android-firebase.md](kotlin-android-firebase.md) | Kotlin Android + Firebase (Firestore + Auth) | New screen, Security Rules review, crash fix |
| [swift-ios-supabase.md](swift-ios-supabase.md) | Swift iOS + Supabase | New screen, RLS table review, auth flash fix |

Each example includes: detected presets → files copied → auto-generated `stack-rules.md` → 3 real usage flows → per-task cost estimates.

---

## Example 1 — Bug fix

**Input**

```text
TypeError: Cannot read properties of undefined (reading 'userId')
  at getUserOrders (src/services/order.service.ts:47)
  at OrderController.list (src/controllers/order.controller.ts:23)
```

**Auto-routing:** `bug-hunter` (stack trace present → no clarification needed)

**Output**

```text
ROOT: order.service.ts:47 — getUserOrders called before session guard hydrates req.user
FIX:  src/services/order.service.ts:47 — add null guard: if (!user) throw new UnauthorizedException()
TEST: vitest run src/services/order.service.test.ts ✓ 4 passed
RISK: low
```

---

## Example 2 — Feature build (Tier 2)

**Input**

```text
Add a "mark all as read" button to the notifications page
```

**Auto-routing:** `senior-engineer` (feature + UI + API change = Tier 2)

**Output (3-line plan, awaits OK)**

```text
PLAN: bulk-mark notifications read — 3 files
∙ PATCH /notifications/read-all — NestJS controller + service method
∙ NotificationService.markAllRead(userId) — single UPDATE WHERE userId AND read=false
∙ NotificationsPage — add Button, call mutation, invalidate query on success
OK to proceed?
```

**After approval**

```text
∙ src/notifications/notifications.controller.ts:34 — PATCH /read-all endpoint
∙ src/notifications/notifications.service.ts:89 — markAllRead() with Prisma updateMany
∙ src/notifications/notifications.service.test.ts — 3 cases added
∙ src/app/notifications/page.tsx:61 — MarkAllReadButton component
TEST: vitest run src/notifications/notifications.service.test.ts ✓ 3 passed
RISK: T2 · senior-engineer · API+UI
```

---

## Example 3 — Security escalation (Tier 3)

**Input**

```text
The JWT refresh token logic seems broken — users get logged out after 15 minutes
```

**Auto-routing:** Starts as `bug-hunter` → auth signal detected → escalates immediately

**Output**

```text
ESCALATE TO: security-guard — JWT/session logic touched

[security-guard reads auth middleware, token service, session config]

SECURITY REVIEW — JWT refresh flow
Issue: refreshToken() does not rotate the token on use (re-use attack vector)
Issue: exp set to 900s (15min) — likely intentional but undocumented

IMPLEMENTATION PLAN
[P:A] src/auth/token.service.ts — rotate refresh token on each use (invalidate old)
[S]   src/auth/token.service.test.ts — add replay-attack regression test
CONTRACT: POST /auth/refresh · {refreshToken} → {accessToken, refreshToken}

Approve plan to proceed?
```

---

## Example 4 — DB schema guard (Tier 3, requires explicit approval)

**Input**

```text
Add a "last_active_at" column to the users table
```

**Auto-routing:** `db-guard` (DB schema change signal)

**Output**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: users.last_active_at TIMESTAMPTZ nullable
Risk: low — new nullable column, no existing data affected
Migration: zero-downtime safe (additive)

ZERO-DOWNTIME PLAN
[S] Add nullable column (no default needed — existing rows get NULL)
[S] Deploy code that writes last_active_at on login
[S] Backfill: UPDATE users SET last_active_at = updated_at WHERE last_active_at IS NULL (batch 1000)
[S] Add index CONCURRENTLY on last_active_at (non-blocking on Postgres)

Approve to proceed?
```

---

## Installed project structure

After running `bash install.sh` or `.\install.ps1` in a project:

```text
your-project/
└── .claude/
    ├── CLAUDE.md          ← copied from presets/web/nextjs-saas/CLAUDE.md (or your stack)
    ├── settings.json      ← deny list + CLAUDE_CODE_SUBAGENT_MODEL=haiku
    ├── rules/
    │   ├── 000-security.md
    │   ├── 001-conventions.md
    │   ├── 100-web.md
    │   ├── 200-api.md
    │   ├── 300-testing.md
    │   ├── 400-mobile.md
    │   ├── 500-database.md
    │   └── 600-devops.md
    ├── skills/
    │   ├── bug-fix/SKILL.md
    │   ├── feature-build/SKILL.md
    │   └── ... (33 skills)
    └── agent_docs/
        ├── architecture.md
        └── ... (15 docs, lazy-loaded)
```

Claude Code loads `.claude/CLAUDE.md` automatically on every session.
Rules are loaded per file-match glob. Skills are invoked by name (`/bug-fix`, `/feature-build`).
