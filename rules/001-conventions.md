---
description: "Core development conventions — architecture patterns, holistic consistency, modern tech preferences. No paths field: loads unconditionally every session."
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

**Monorepo first** — `turbo.json` / `nx.json` / `pnpm-workspace.yaml` / `lerna.json` / Cargo or Go
workspace: detect the architecture *per package*, not repo-wide, and re-run boot for the package
you're editing. A shared type lives in the shared package, not copied; a cross-package change is
Tier 2 minimum because the blast radius is every consumer.

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

## FORWARD COMPATIBILITY FLAGS — mark, never block

```text
FWD: God service >300 lines — split recommended ([service name])
FWD: DB access in controller — coupling risk, add service layer
FWD: Hardcoded string — move to config/env ([value])
FWD: Missing FK index — query perf risk ([table.column])
FWD: Sync I/O in hot path — latency risk ([location])
FWD: No error boundary — reliability risk ([component tree])
FWD: Unrelated dead code noticed — not touching it, flag only ([location])
OBS: [service] no metrics — add request count + latency
```

## MODERN TECHNOLOGY PREFERENCES

Category-by-category Prefer → Avoid table (CSS, UI kits, state, ORM, auth, etc.) and the paid-
dependency rule (never silently add a paid lib — find a free alternative or ask) live in
`agent_docs/dep-check-guide.md` (already in global-CLAUDE.md's lazy-load index) — load it before
recommending or adding any library, framework, or paid service.

### Modern patterns — always

- TypeScript first: never plain JS in new TS projects
- `async/await` over callbacks and `.then()` chains
- Server Components (Next.js) for initial data
- Composition API (Vue 3) over Options API
- Structured concurrency (Kotlin coroutines, Swift async/await, Python asyncio)

## RULE PRECEDENCE

When two rules conflict, the highest rule in this list wins:

```text
1. 000-security.md           ← always active, overrides everything (passive scan is non-negotiable)
2. Project .claude/CLAUDE.md ← project-specific decisions beat all generic rules
3. Stack preset installed into the project ← framework convention beats generic convention
4. Domain rule by specificity ← narrower glob wins:
     500-database.md (**/migrations/**) beats 001-conventions.md for migration files
     100-web.md (*.tsx) beats 001-conventions.md for React files
5. 001-conventions.md        ← general fallback when nothing more specific applies
```
