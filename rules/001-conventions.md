---
description: "Core development conventions — architecture patterns, holistic consistency, modern tech preferences, always active"
alwaysApply: true
---

## CONVENTION DISCOVERY — before creating any new file

1. Read 1-2 existing files of the same type in the project.
2. Extract: naming, folder structure, import style, error handling pattern, state pattern, feedback mechanism.
3. Follow extracted conventions exactly — even if a different approach is technically better.
Rule: "Project does X" beats "best practice says Y."

## ARCHITECTURE DETECTION

| Folder structure found | Architecture | Rule |
| --- | --- | --- |
| `controllers/` + `services/` + `repositories/` as siblings | Layered | Stay layered |
| `features/X/{handler,logic,data}/` or `modules/X/` | Vertical slice | Stay vertical |
| Both mixed | Mixed | Flag FWD: mixed architecture — clarify with user |

Never mix architectures. Follow what exists.

Module boundary rules:

- Barrel files (`index.ts`) ONLY at module root — never nested (breaks tree-shaking)
- Export only public API; prefix internals with `_` or mark `/* @internal */`
- Circular imports: detect with `madge --circular src/` (TS) | `pylint --enable=cyclic-import` (Python)
- God service >300 lines: flag `FWD: split recommended — [reason]`

State management (which library) → 100-web.md (web) / 400-mobile.md (mobile).
API pattern selection (tRPC/REST/GraphQL) + `Result<T,E>` boundary rule → 200-api.md.

## EVENT-DRIVEN DECISION

Use message queue (BullMQ/Kafka/Redis pub-sub) when: operation >200ms | multiple consumers | failure must not block caller
Direct call when: sync response needed | <50ms | single consumer

## HOLISTIC CONSISTENCY — never leave a layer behind

| Change | Must also update |
| --- | --- |
| DB field renamed | DTO/serializer → API response type → UI/client type |
| New endpoint added | API client/service → types → UI consumption → API docs |
| Error code changed | All places that catch or display that error |
| Feature flag added | 3 states: on / off / loading |
| Type/interface renamed | All importers |
| Route added | Navigation menu / sidebar / breadcrumbs |
| Permission added | All UI guards that should check it |
| Config key added | `.env.example` updated; docs if public |
| Dep removed | All imports referencing it |
| Any code change / bugfix | 1 terse bullet in project's `CHANGELOG.md` (what + why, no long prose) |

## FORWARD COMPATIBILITY FLAGS — mark, never block

```text
FWD: God service >300 lines — split recommended ([service name])
FWD: DB access in controller — coupling risk, add service layer
FWD: Hardcoded string — move to config/env ([value])
FWD: Missing FK index — query perf risk ([table.column])
FWD: Sync I/O in hot path — latency risk ([location])
FWD: No error boundary — reliability risk ([component tree])
OBS: [service] no metrics — add request count + latency
```

## MODERN TECHNOLOGY PREFERENCES

### Prefer → Avoid

| Category | Prefer | Avoid |
| --- | --- | --- |
| CSS | Tailwind v3/v4, CSS Modules | Bootstrap, raw CSS for new projects |
| React UI | shadcn/ui, Radix UI, Headless UI | MUI v4, Ant Design 4.x |
| Vue UI | Naive UI, Nuxt UI, shadcn-vue | Vuetify 2, Element UI |
| React state | Zustand + TanStack Query + Jotai | Redux+saga (new), MobX |
| Forms | React Hook Form + Zod | Formik, class-validator alone |
| Tables | TanStack Table v8 | Custom HTML table |
| Date | date-fns, Temporal API | moment.js |
| HTTP client | Native `fetch` with typed wrapper | jQuery.ajax, XMLHttpRequest |
| Build | Vite, Turbopack | Create React App (deprecated), Webpack (new) |
| Testing JS | Vitest + Testing Library, Playwright | Jasmine, Karma, Mocha (new) |
| ORM (TS) | Prisma, Drizzle | Sequelize, TypeORM (new) |
| Auth | Better Auth, Lucia, Auth.js | Passport.js (new) |
| Email | Resend, Nodemailer | — |
| Analytics | PostHog (self-host), Plausible | Google Analytics |
| RN lists | FlashList | FlatList (long lists) |
| RN nav | Expo Router v3 | React Navigation alone (if Expo) |
| Android UI | Material 3 (Compose) | Material 2, XML layouts (new) |
| iOS UI | SwiftUI | UIKit (new screens) |
| Flutter state | Riverpod | Provider (new) |
| Python HTTP | httpx, aiohttp | requests (async projects) |
| Python API | FastAPI | Flask (new async) |
| Python typing | Pydantic v2 | marshmallow (new) |
| Go HTTP | stdlib net/http, chi, Echo | Gorilla Mux (new) |
| Go ORM | sqlc, ent | GORM (if sqlc fits) |
| PHP | Laravel 11+, Livewire | raw PHP (new), CodeIgniter |
| Ruby | Rails 7+, Hotwire | Sinatra (large projects) |
| Animation | CSS transitions, Framer Motion (React), View Transitions API | GSAP (complex only) |
| Page transitions | View Transitions API (native, zero KB) | Framer Motion AnimatePresence |

### Paid dependency rule

If recommending a paid lib/service (Clerk, Auth0, AG Grid Enterprise, etc.):

1. STOP — do not proceed with paid option.
2. Find free alternative from table above.
3. If no free alternative: ask user — "X requires paid plan. Free alternative Y covers [features]. Use Y, or do you have X license?"
4. NEVER silently add paid dependency to package.json/Gemfile/composer.json.

### Modern patterns — always

- TypeScript first: never plain JS in new TS projects
- `async/await` over callbacks and `.then()` chains
- Server Components (Next.js) / `useAsyncData` (Nuxt) / `load` (SvelteKit) for initial data
- Composition API (Vue 3) over Options API
- Standalone components (Angular 17+) over NgModule
- Signals (Angular 17+) for local state
- Structured concurrency (Kotlin coroutines, Swift async/await, Python asyncio)

## RULE PRECEDENCE

When two rules conflict, the highest rule in this list wins:

```text
1. 000-security.md           ← always active, overrides everything (passive scan is non-negotiable)
2. Project .claude/CLAUDE.md ← project-specific decisions beat all generic rules
3. Stack preset (presets/*/CLAUDE.md) ← framework convention beats generic convention
4. Domain rule by specificity ← narrower glob wins:
     500-database.md (**/migrations/**) beats 001-conventions.md for migration files
     100-web.md (*.tsx) beats 001-conventions.md for React files
5. 001-conventions.md        ← general fallback when nothing more specific applies
```

### Conflict resolution examples

| Conflict | Resolution |
| --- | --- |
| Generic conventions say Zustand; React preset says TanStack Query for server state | Preset wins (more specific) |
| Security rule says "never raw SQL"; Django preset shows raw SQL example | Security wins (000 always wins) |
| 100-web says 8px grid; project CLAUDE.md approves 12px grid for this design system | Project CLAUDE.md wins |
| 200-api says REST; tRPC preset says tRPC | Preset wins (more specific to this stack) |

### Scope signals — which rule applies

| File being edited | Primary rule |
| --- | --- |
| `*.tsx` / `*.jsx` / `*.vue` / `*.svelte` | 100-web.md |
| `**/api/**` / `**/routes/**` / `**/controllers/**` | 200-api.md |
| `*.test.*` / `*.spec.*` | 300-testing.md |
| `*.swift` / `*.kt` / `**/lib/**/*.dart` | 400-mobile.md |
| `**/migrations/**` / `*.prisma` / `**/models/**` | 500-database.md |
| `Dockerfile*` / `.github/**` / `*.tf` | 600-devops.md |
| `**/*.ts` / `**/*.py` / `**/*.go` / `**/*.java` | 700-observability.md |
| `**/ai/**` / `**/llm/**` / `**/anthropic/**` / `**/claude/**` | 800-llm-safety.md |
| `**/*.ts` / `**/*.tsx` / `**/*.py` / `**/*.go` / `**/*.cs` | 900-performance.md |
| Everything else | 001-conventions.md |

`700-observability.md` and `900-performance.md` intentionally auto-load together for almost the same file types — this is not a precedence conflict; both apply simultaneously (700 governs what to log, 900 governs latency/bundle budgets). The "highest wins" rule above only resolves cases where two rules give contradictory instructions for the same file; these two never contradict, so apply both in full.
