# Worked Example — Next.js SaaS + Prisma + PostgreSQL

Complete bootstrap walkthrough: what files get copied, what gets generated, and what the result looks like.

---

## Stack detection

```text
package.json contains: next, prisma, @prisma/client
Detected: Next.js SaaS + Prisma + PostgreSQL
```

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                   ← presets/web/nextjs-saas/CLAUDE.md
├── settings.json               ← deny list + subagent model
├── rules/
│   ├── 000-security.md         ← always active
│   ├── 001-conventions.md      ← always active
│   ├── 100-web.md              ← *.tsx, *.jsx
│   ├── 200-api.md              ← **/api/**, **/actions/**
│   ├── 300-testing.md          ← *.test.ts, *.spec.ts
│   ├── 500-database.md         ← **/*.prisma, **/migrations/**
│   └── 700-observability.md    ← **/*.ts
├── skills/
│   ├── bug-fix/SKILL.md
│   ├── feature-build/SKILL.md
│   ├── new-page/SKILL.md
│   ├── db-change/SKILL.md
│   ├── security-review/SKILL.md
│   └── ... (all 23 skills)
├── agents/
│   ├── senior-engineer.md
│   ├── bug-hunter.md
│   ├── security-guard.md
│   ├── db-guard.md
│   ├── architect.md
│   └── ... (all 12 agents)
└── agent_docs/
    ├── architecture.md
    ├── testing-strategy.md
    └── ... (all 16 docs)
```

**settings.json:**

```json
{
  "permissions": {
    "deny": [".env", ".env.*", "*.pem", "*.key", "secrets/"]
  }
}
```

Don't add `CLAUDE_CODE_SUBAGENT_MODEL` here — it overrides every subagent's model, including named
agents' own `model:` frontmatter (see Step 4 below).

---

## Step 2 — Auto-generated `stack-rules.md`

Composite file merging preset + DB rules:

```markdown
# Stack Rules — Next.js + Prisma + PostgreSQL

## Architecture
- App Router (app/) — Server Components by default
- Client Components only for: browser state, effects, event handlers, DOM APIs
- Server actions for mutations (app/actions/) — thin, delegate to services
- Services in lib/services/ — business logic, no HTTP-specific code
- Prisma client singleton in lib/db.ts — never import PrismaClient directly

## Commands
- TEST_CMD: vitest run [file]
- LINT_CMD: next lint
- BUILD_CMD: next build
- TYPE_CMD: tsc --noEmit
- DB_CMD: prisma migrate dev (dev) | prisma migrate deploy (prod)
- PKG_MANAGER: npm (package-lock.json detected)

## Protected files (escalate before touching)
- middleware.ts → security-guard
- app/api/auth/** → security-guard
- prisma/schema.prisma → db-guard
- prisma/migrations/** → db-guard
```

---

## Step 3 — Real usage flows

### Flow A: Add a new page

**User:** "Add a usage dashboard page at /dashboard/usage"

**Routing:** `new-page` skill → `ui-fixer` agent (haiku)

**Agent behavior:**

1. Reads `app/dashboard/page.tsx` (nearest similar page)
2. Reads `app/dashboard/layout.tsx` (layout shell)
3. Detects: shadcn/ui + TanStack Query
4. Plans 4 states: loading (skeleton) / empty (icon + CTA) / error (retry) / populated

**Output:**

```text
PLAN: usage dashboard — 2 files
[P:A] app/dashboard/usage/page.tsx — new Server Component, uses UsageChart + UsageTable
[P:A] components/usage/usage-chart.tsx — Client Component, TanStack Query, 4 states
OK to proceed?
```

---

### Flow B: Add a database column

**User:** "Add a `plan_expires_at` column to the User model"

**Routing:** DB schema signal → `db-guard` agent

**Agent behavior:**

1. Reads `prisma/schema.prisma`
2. Checks migration history
3. Plans zero-downtime migration

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: User.plan_expires_at DateTime? (nullable)
Risk: low — additive, nullable, no existing data affected
Zero-downtime: safe

MIGRATION PLAN
[S] prisma/schema.prisma — add plan_expires_at DateTime?
[S] prisma/migrations/YYYYMMDD_add_plan_expires_at.sql — auto-generated
[S] lib/services/subscription.service.ts — update isSubscriptionActive() to check new field
[S] app/api/webhooks/stripe/route.ts — write plan_expires_at on subscription.updated event
[S] lib/services/subscription.service.test.ts — add expiry test cases

Rollback: remove column (data loss only if code already wrote to it — deploy code before writing)
Approve to proceed?
```

---

### Flow C: Security review before deploy

**User:** "Review the auth flow before we go live"

**Routing:** security signal → `security-guard` agent

**Agent reads:**

- `middleware.ts` (route protection)
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts`
- `app/actions/user.actions.ts`

**Output (abbreviated):**

```text
SECURITY REVIEW — Next.js auth flow
========================

HIGH: middleware.ts:12
  Missing: /api/webhooks/* routes not excluded from auth middleware
  Attack: Stripe webhooks blocked → subscription events silently dropped
  Fix: add matcher exclusion: { matcher: ['/((?!api/webhooks).*)'] }

MEDIUM: app/actions/user.actions.ts:34
  Missing: ownership check before updateProfile()
  Risk: IDOR — user A can update user B's profile via direct action call
  Fix: add `if (session.user.id !== userId) throw new UnauthorizedError()`

SUMMARY: Critical:0 High:1 Medium:1 Low:0
VERDICT: fix critical first

IMPLEMENTATION PLAN:
1. middleware.ts:12 — add webhook path exclusion to matcher
2. user.actions.ts:34 — add ownership assertion before profile update
```

---

## Step 4 — Cost optimization in this stack

- `docs-writer` → haiku (set in agent frontmatter); `researcher` → opus (set in agent frontmatter — deep research needs it)
- Do not set `CLAUDE_CODE_SUBAGENT_MODEL` globally — it overrides every subagent's model, named agents included, taking precedence over their own `model:` frontmatter. For cost control on genuinely anonymous exploration calls, pass `model` explicitly per `Agent()` call instead.
- Implementation agents (senior-engineer, bug-hunter) → sonnet (set in agent frontmatter)
- Guard agents (security-guard, db-guard, architect) → opus (set in agent frontmatter, rare use)

Typical session cost breakdown:

- UI bug fix (haiku): ~$0.002
- Feature build, 3 files (sonnet): ~$0.04
- Security review (opus): ~$0.15
- Full DB schema + migration plan (opus): ~$0.20
