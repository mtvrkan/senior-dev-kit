# Worked Example — Nuxt 3 + Drizzle + PostgreSQL

Complete bootstrap walkthrough for a Vue/Nuxt full-stack project.

---

## Stack detection

```text
package.json contains: nuxt, drizzle-orm, drizzle-kit, postgres
Detected: Nuxt 3 + Drizzle + PostgreSQL
```

Presets selected: `web/vue-nuxt` · `orm/drizzle` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/web/vue-nuxt/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active
│   ├── 100-web.md               ← *.vue, *.ts
│   ├── 200-api.md               ← server/api/**
│   ├── 300-testing.md           ← *.test.ts, *.spec.ts
│   ├── 500-database.md          ← drizzle/**
│   └── 700-observability.md     ← **/*.ts
├── skills/                      ← all 32 skills
├── agents/                      ← all 14 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Nuxt 3 + Drizzle + PostgreSQL

## preset: web/vue-nuxt

### Architecture
- Composition API only (`<script setup lang="ts">`) — never Options API
- Server routes: `server/api/[resource]/[id].get.ts` — auth check via requireSession(event)
- Data fetching: useAsyncData / useFetch — never bare $fetch in setup (breaks SSR caching)
- State: Pinia setup stores for cross-component; local ref for component-only

### Commands
- TEST_CMD: vitest run {file}
- LINT_CMD: nuxt lint
- TYPE_CMD: vue-tsc --noEmit
- BUILD_CMD: nuxt build
- PKG_MANAGER: pnpm (pnpm-lock.yaml detected)
```

---

## Usage flow 1 — New admin page (ui-fixer → senior-engineer, Tier 1-2)

**Input**

```text
Add a /admin/users page that lists all users with their email, role, and join date
```

**Auto-routing:** new page = `ui-fixer` (haiku) for UI shell + `senior-engineer` for server route

**Output (plan)**

```text
PLAN: /admin/users page — 3 files
∙ pages/admin/users.vue — Nuxt page with useAsyncData + NaiveUI NDataTable
∙ server/api/admin/users.get.ts — requireSession + admin role check + drizzle query
∙ stores/admin-users.store.ts — Pinia store if users re-used across multiple admin pages
OK to proceed?
```

**After approval**

```text
∙ pages/admin/users.vue:1 — created; useAsyncData('admin-users', ...) with all 4 states
∙ server/api/admin/users.get.ts:1 — requireSession + requireRole('admin') + select from users table
∙ pages/admin/users.vue:38 — NDataTable with columns: email, role, createdAt; skeleton on pending
TEST: vitest run tests/pages/admin-users.test.ts ✓ (3 new cases)
RISK: T2 · senior-engineer · new route + server API
```

---

## Usage flow 2 — DB schema change (db-guard, Tier 3)

**Input**

```text
Add a last_login_at column to the users table
```

**Auto-routing:** DB schema signal → `db-guard`

**Output**

```text
ESCALATE TO: db-guard — Drizzle schema change detected

DB CHANGE REVIEW
Change: users.last_login_at TIMESTAMP nullable (additive)
Risk: low — nullable column; existing rows get NULL; no backfill needed

PLAN
[S] drizzle/schema/users.ts — add lastLoginAt: timestamp('last_login_at')
[S] pnpm drizzle-kit generate — generate migration file
[S] Review generated SQL: ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP
[S] Update auth session handler to set lastLoginAt on successful login

Approve to proceed?
```

---

## Usage flow 3 — SSR security issue found in server route

**Input**

```text
Review the /api/users/[id].get.ts route — does it have proper auth?
```

**Auto-routing:** `safe-review` skill (read-only review)

**Output**

```text
SECURITY REVIEW — server/api/users/[id].get.ts

FINDING 1: CRITICAL | server/api/users/[id].get.ts:4 | No session check before DB query
  Fix: const session = await requireSession(event); at top of handler

FINDING 2: HIGH | server/api/users/[id].get.ts:9 | Returns user by ID without ownership check
  Fix: add WHERE condition: AND users.id = session.userId (or admin role check)

FINDING 3: LOW | server/api/users/[id].get.ts:14 | Response includes password hash field
  Fix: use .select({ id: users.id, email: users.email, name: users.name }) — exclude hash

SEVERITY: CRITICAL — route is publicly accessible without auth
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| Vue component bug | bug-hunter | sonnet | ~$0.02 |
| New admin page (UI only) | ui-fixer | haiku | ~$0.006 |
| New admin page + API route | senior-engineer | sonnet | ~$0.04 |
| DB schema change | db-guard → senior-engineer | opus → sonnet | ~$0.17 |
| Security review | security-guard | opus | ~$0.12 |
| Dep audit | security-scanner | sonnet | ~$0.04 |
