# Worked Example — NestJS + Prisma + PostgreSQL

Complete bootstrap walkthrough for a TypeScript REST API project.

---

## Stack detection

```text
package.json contains: @nestjs/core, @nestjs/common, prisma, @prisma/client
Detected: NestJS + Prisma + PostgreSQL
```

Presets selected: `backend/nestjs` · `orm/prisma` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/nestjs/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active (architecture detection)
│   ├── 200-api.md               ← **/api/**, **/routes/**, **/controllers/**
│   ├── 300-testing.md           ← *.spec.ts
│   ├── 500-database.md          ← **/*.prisma, **/migrations/**
│   └── 700-observability.md     ← **/*.ts
├── skills/                      ← all 32 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 14 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — NestJS + Prisma + PostgreSQL

## preset: backend/nestjs

### Architecture
- Layered: `src/[module]/{module.ts, controller.ts, service.ts, dto/}`
- Controllers → Services (business logic) → Prisma (data access)
- Never DB access in controllers. Never business logic in DTOs.
- Dependency injection via NestJS `@Injectable()` — always.

### Commands
- TEST_CMD: jest [f].spec.ts --no-coverage
- LINT_CMD: eslint src/
- TYPE_CMD: tsc --noEmit
- BUILD_CMD: nest build
- PKG_MANAGER: npm (package-lock.json detected)

### Protected files (escalate before touching)
- `src/auth/` → security-guard
- `src/common/guards/` → security-guard
- `prisma/migrations/` → migration-guard
- `prisma/schema.prisma` → db-guard

## preset: orm/prisma

### Prisma patterns
- Schema changes: `prisma migrate dev` (dev) · `prisma migrate deploy` (prod)
- Never raw SQL; use Prisma typed client: `prisma.user.findMany({ where, select })`
- Eager load relations with `include` or `select` — never implicit loop access
- Transactions: `prisma.$transaction([...])` for multi-step writes

## preset: database/postgres

### PostgreSQL rules
- All migrations via Prisma Migrate — never manual ALTER TABLE
- Index every FK column: add `@@index([userId])` to Prisma schema
- Timestamp columns: use `@default(now())` with `DateTime @db.Timestamptz`
- Use `String @id @default(cuid())` or `uuid()` for PKs — never auto-increment alone
```

---

## Step 3 — Real usage flows

### Flow A: Add a new API endpoint

**User:** "Add a `PATCH /users/:id/role` endpoint that lets admins change a user's role"

**Routing:** `feature-build` skill → `senior-engineer` agent (sonnet)

**Agent behavior:**

1. Reads `src/users/users.controller.ts` (existing pattern)
2. Reads `src/users/users.service.ts` (service pattern)
3. Reads `src/common/guards/roles.guard.ts` (role check pattern)
4. Checks: ownership vs admin-only → plans `@Roles('admin')` guard upfront

**Output:**

```text
PLAN: admin role-change endpoint — 4 files
[P:A] src/users/dto/update-role.dto.ts — UpdateRoleDto { role: UserRole } with class-validator
[P:A] src/users/users.service.ts — updateRole(id, dto, actorId) with ownership + admin guard
[S]   src/users/users.controller.ts — PATCH /:id/role with @Roles('admin') + @UseGuards(RolesGuard)
[S]   src/users/users.service.spec.ts — 3 cases: success, non-admin rejected, self-demotion rejected
CONTRACT: PATCH /users/:id/role · {role: "admin"|"user"} → {id, email, role, updatedAt}
OK to proceed?
```

**After approval:**

```text
∙ src/users/dto/update-role.dto.ts — UpdateRoleDto with @IsEnum(UserRole)
∙ src/users/users.service.ts:67 — updateRole() with prisma.user.update + audit log
∙ src/users/users.controller.ts:45 — PATCH /:id/role endpoint
∙ src/users/users.service.spec.ts — 3 cases added
TEST: jest src/users/users.service.spec.ts --no-coverage ✓ 3 passed
RISK: T2 · senior-engineer · API+auth-adjacent
```

---

### Flow B: Add a new Prisma model + migration

**User:** "Add a Post model with title, body, authorId, and published flag"

**Routing:** DB schema signal → `db-guard` agent

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: new Post model — title:String, body:String, authorId:String(FK→User), published:Boolean
Risk: low — additive new table, no existing data affected
Zero-downtime: safe (new table with FK, no ALTER on existing)

MIGRATION PLAN
[S] prisma/schema.prisma — add Post model with @@index([authorId]) + @relation to User
[S] prisma migrate dev --name add_post_model
[S] src/posts/ — generate module, controller, service, DTOs (NestJS CLI pattern)
[S] src/posts/posts.service.spec.ts — happy path + empty list + not-found

Prisma schema addition:
  model Post {
    id         String   @id @default(cuid())
    title      String
    body       String
    published  Boolean  @default(false)
    authorId   String
    author     User     @relation(fields: [authorId], references: [id])
    createdAt  DateTime @default(now()) @db.Timestamptz
    updatedAt  DateTime @updatedAt @db.Timestamptz
    @@index([authorId])
  }

Approve to proceed?
```

---

### Flow C: Security scan before production deploy

**User:** `/security-scan` — audit before going live

**Routing:** `security-scan` skill → `security-scanner` agent

**Output (abbreviated):**

```text
SECURITY SCAN — NestJS + Prisma
================================

HIGH: src/users/users.controller.ts:34
  Issue: GET /users — returns all users with no pagination or auth guard
  Attack: unauthenticated enumeration of all user accounts
  Fix: add @UseGuards(JwtAuthGuard) + cursor-based pagination

MEDIUM: src/auth/auth.service.ts:18
  Issue: bcrypt rounds = 8 — below recommended minimum (12)
  Risk: brute-force on leaked hash DB is faster than necessary
  Fix: increase to 12 (acceptable latency ~250ms on login)

LOW: prisma/schema.prisma:7
  Issue: User.email has no @@unique index — login query does full scan
  Fix: add @@unique([email]) to User model + migrate

SUMMARY: Critical:0 High:1 Medium:1 Low:1
VERDICT: fix High before deploy

IMPLEMENTATION PLAN:
1. src/users/users.controller.ts:34 — add JwtAuthGuard + pagination
2. src/auth/auth.service.ts:18 — increase bcrypt rounds to 12
3. prisma/schema.prisma — add @@unique([email]) + migrate
```

---

## Step 4 — Cost estimates

| Task | Agent | Model | Typical cost |
| --- | --- | --- | --- |
| Add API endpoint (3-4 files) | senior-engineer | sonnet | ~$0.04 |
| New Prisma model + migration | db-guard | opus | ~$0.15 |
| Security scan (5-6 files) | security-scanner | sonnet | ~$0.06 |
| Bug fix (1-2 files) | bug-hunter | sonnet | ~$0.02 |
| Docs update | docs-writer | haiku | ~$0.003 |
