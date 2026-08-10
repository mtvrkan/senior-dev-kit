# Architecture Patterns — Lazy Reference

## DETECT FIRST — read folder structure before designing

### Architecture by folder shape

| Folder pattern | Architecture | Guidance |
| --- | --- | --- |
| `src/controllers/` + `src/services/` + `src/repositories/` | Layered (N-tier) | Keep strict layer rules: controller → service → repo. Never skip layers. |
| `src/features/auth/` + `src/features/orders/` with controller+service+model inside | Feature-folder / Vertical Slice | Each slice is self-contained. Cross-slice: shared kernel only. |
| `src/domain/` + `src/application/` + `src/infrastructure/` | DDD / Clean Architecture | Dependency rule: outer → inner only. Domain has zero framework imports. |
| `apps/web` + `apps/api` + `packages/shared` | Monorepo (Turborepo/Nx) | Package boundary = import boundary. Never import `apps/*` from another app. |
| `cmd/` + `pkg/` + `internal/` | Go standard layout | `internal/` = private to module. `pkg/` = exported. Never put business logic in `cmd/`. |
| `app/models/` + `app/controllers/` + `app/views/` | MVC (Rails/Laravel/Django) | Convention-over-config — follow framework conventions exactly. |

### Vertical Slice vs Layered — when to choose

**Vertical Slice (feature-first):**

- CRUD domains with clear business boundaries
- Teams organized by feature (auth team, orders team)
- When features rarely share logic
- Better: isolated changes, faster onboarding per feature

**Layered:**

- Heavy cross-cutting concerns (complex auth, audit logging, caching)
- Small teams (1-3 devs) — less coordination overhead
- Legacy codebase migration path

**Hybrid (recommended for medium projects):**

```text
src/
  features/          ← vertical slices for business logic
    users/
    orders/
  shared/            ← shared kernel
    db/              ← DB connection, query helpers
    auth/            ← auth middleware (cross-cutting)
    errors/          ← error types
    utils/           ← pure functions only
```

## MODULE BOUNDARY RULES

A barrel that re-exports **everything** (`export * from …`) is the anti-pattern. Reasons:

1. Breaks tree-shaking (bundler can't eliminate unused exports)
2. Creates circular dependency risk
3. Makes refactoring harder (can't rename without updating barrel)

The rule this expands on is `rules/001-conventions.md`'s: a barrel is allowed at a **module
root** and nowhere else, and it must list the module's public API explicitly rather than
star-export its internals. Anything deeper in the tree: import from the source file directly.

```typescript
// WRONG: barrel
export * from './UserService'
export * from './UserRepository'
export * from './UserController'

// RIGHT: explicit public API
export { UserService } from './UserService'
// Other classes = private implementation detail, not exported
```

### Dependency direction rules

```text
Controller → Service → Repository → DB
                     ↘ External APIs
                ↘ Domain Events

NEVER:
Repository → Service (upward)
Domain → Framework (domain imports express/NestJS)
Shared kernel → Feature (shared imports feature)
```

### Module coupling signals (flag these)

| Pattern | Problem | Fix |
| --- | --- | --- |
| Feature A imports from Feature B's internals | Tight coupling | Extract to shared kernel |
| Service calls another service's repository | Layer skip | Route through the other service |
| Controller contains business logic | Fat controller | Move to service |
| Model contains HTTP-specific code (req/res) | Layer contamination | Move to controller |
| >300 line service class | God object | Split by responsibility |

## STATE MANAGEMENT ARCHITECTURE (2025)

### Decision matrix

| Need | Solution |
| --- | --- |
| Server state (fetch, cache, sync) | TanStack Query (React) · SWR · `useAsyncData` (Nuxt) |
| Client global state (UI, auth, preferences) | Zustand (React) · Pinia (Vue) · Signals (Angular) |
| Form state | React Hook Form · VeeValidate |
| URL state | `useSearchParams` / `useRouter` — serialize to URL |
| Component local state | `useState` / `ref` / `signal` — keep as local as possible |

**Rule: choose the smallest scope that works.**
`useState` > Zustand store > Server state > URL state (by preference, ascending complexity)

### Zustand store shape

```typescript
// GOOD: action-first, no getters that derive from state
interface AuthStore {
  user: User | null
  token: string | null
  login: (credentials: Credentials) => Promise<void>
  logout: () => void
}

// BAD: derived state in store (use selectors instead)
interface BadStore {
  user: User | null
  isLoggedIn: boolean  // ← should be selector: (state) => !!state.user
  fullName: string     // ← should be selector
}
```

## EVENT-DRIVEN PATTERNS

### When to use events

USE events when:

- Action in one domain should trigger behavior in another (order placed → send email, update inventory)
- You want to decouple producers from consumers
- The consumer can tolerate eventual consistency

DON'T use events when:

- You need immediate consistency (payment confirmation must be synchronous)
- Simple 1:1 relationship (just call the function)
- Debugging cost > decoupling benefit (events are harder to trace)

### Event naming convention

```text
past-tense.noun-verb: user.created · order.placed · payment.failed · email.sent
Never: createUser · onOrderPlace · handlePayment
```

### Event envelope pattern

```typescript
interface DomainEvent<T = unknown> {
  id: string          // UUID — idempotency key
  type: string        // 'user.created'
  occurredAt: string  // ISO 8601
  version: number     // schema version — start at 1
  payload: T
  metadata?: {
    correlationId: string   // trace across services
    causationId: string     // which event caused this
    userId?: string         // who triggered it
  }
}
```

## MONOREPO ARCHITECTURE (Turborepo / Nx)

### Package structure

```text
apps/
  web/          ← Next.js / Nuxt consumer
  api/          ← NestJS / FastAPI consumer
packages/
  ui/           ← shadcn/ui components (never import from apps/)
  config/       ← ESLint, TypeScript, Tailwind configs
  shared/       ← Types, constants, utilities
  db/           ← Prisma schema, client, migrations
```

### Import boundary rules

```typescript
// apps/web → packages/ui ✓
// apps/web → packages/shared ✓
// apps/web → apps/api ✗ (cross-app import = coupling)
// packages/shared → apps/web ✗ (package importing app = wrong direction)
// packages/ui → packages/shared ✓ (package using shared types)
```

### Turborepo tasks

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "test": { "dependsOn": [], "cache": true },
    "lint": { "dependsOn": [], "cache": true },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

The key is `tasks`, not `pipeline` — Turborepo 2.0 renamed it, and v2 refuses to run a
`turbo.json` that still uses the old name. If you are reading a repo on Turborepo 1.x, expect
`pipeline` there and leave it alone rather than "fixing" it into a broken config.

## MICROSERVICE DECISION CHECKLIST

Before extracting a service, confirm ALL of these:

- [ ] Team can own it independently (separate deploy, separate repo)
- [ ] Clear API contract exists (OpenAPI or gRPC proto)
- [ ] Failure isolation is required (one service down ≠ whole system down)
- [ ] Scale independently (this part needs different CPU/memory than the rest)
- [ ] Data isolation is possible (no direct DB joins across services)

If any is false → keep as module in monolith. Premature microservices = distributed monolith.

### Service communication patterns

```text
Sync (request-response): REST / gRPC
  → Use when: caller needs immediate response
  → Failure mode: tight coupling, cascading failures

Async (message queue): Kafka / RabbitMQ / SQS
  → Use when: fire-and-forget, eventual consistency OK
  → Failure mode: message loss, ordering, duplication (handle idempotency)

Event streaming: Kafka
  → Use when: multiple consumers, replay needed, audit trail
```

## FORWARD COMPATIBILITY FLAGS

Flag these without blocking:

```text
FWD: Direct DB in controller — service layer missing, coupling risk
FWD: Business logic in UI component — move to hook or service
FWD: Hardcoded string should be config/env var
FWD: God service [name] >300 lines — split by responsibility
FWD: No error boundary in React tree — reliability risk
FWD: Missing FK index on [table.column] — query perf risk
FWD: Barrel file at [path] — breaks tree-shaking
FWD: Circular dependency [A → B → A] — refactor to shared kernel
```
