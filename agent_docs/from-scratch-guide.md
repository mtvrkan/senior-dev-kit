# From-Scratch Project Guide

Full step-by-step reference for `/from-scratch` skill. Read after reviewing the 3 laws and archetype.

---

## Step 0 — PROJECT-CONTRACTS.md (write first, always)

```markdown
# Project Contracts — [Project Name]

## Routes / Pages
| Route | Purpose | Auth? |
|-------|---------|-------|
| /     | Landing / dashboard | no |
| /dashboard | Main overview | yes |

## Shared TypeScript Types
| Type | Fields |
|------|--------|
| User | id, email, role, createdAt |

## API Endpoints
| Method | Path | Request | Response |
|--------|------|---------|---------|
| GET | /api/[resource] | — | { data: Type[] } |
| POST | /api/[resource] | CreateDto | { data: Type } |

## Shared Components
| Component | Props | Used on |
|-----------|-------|---------|
| <PageHeader> | title, description, cta? | all pages |
| <EmptyState> | icon, title, description, action? | all lists |
| <DataTable> | columns, data, loading, empty | list pages |
| <SkeletonCard> | lines? | loading states |

## Navigation Items
| Label | Route | Icon | Auth? |
|-------|-------|------|-------|
| Dashboard | /dashboard | LayoutDashboard | yes |
```

Do not proceed to Step 1 until this file is written.

---

## Step 1 — Tech stack by archetype

**SaaS:** Next.js 16 App Router + shadcn/ui + Tailwind v4 + PostgreSQL + Prisma + Better Auth + Vitest + Playwright

**Marketing:** Astro 5 (content layer) or Next.js + Tailwind v4 + Contentlayer or Sanity + generateMetadata + JSON-LD + sitemap.ts

**API (Node):** NestJS + Prisma + Zod OR Fastify + Drizzle
**API (Python):** FastAPI + Pydantic v2 + SQLAlchemy + Alembic
**API (Go):** Chi + sqlc + pgx

**Mobile (Flutter):** Riverpod + GoRouter + flutter_secure_storage
**Mobile (iOS):** SwiftUI + async/await + Swift Observation
**Mobile (Android):** Jetpack Compose + Hilt + ViewModel + StateFlow

---

## Step 2 — DESIGN-SPEC.md (web projects only)

```markdown
# Design Specification — [Project Name]

## Archetype: [SaaS|Marketing|etc]

## Personality
One-sentence brand voice.

## Font Pairing
Display: [font] — headings only (h1–h3)
Body: [font] — all body text, labels, UI
Mono: [font] — code blocks

## Color Palette
Primary hue: [HSL base] | Neutral: slate/gray/zinc | Success/Warning/Destructive: standard

## Semantic Tokens (copy into globals.css)
--background  --foreground  --card  --card-foreground
--primary  --primary-foreground  --secondary  --secondary-foreground
--muted  --muted-foreground  --accent  --accent-foreground
--destructive  --destructive-foreground  --border  --input  --ring  --radius

## Spacing/typography/motion/component-state rules: fixed, not project-specific —
## see agent_docs/design-system.md (8px grid, Perfect Fourth scale, motion tokens)
## and rules/100-web.md (THREE MANDATORY STATES) instead of restating them here.
```

---

## Step 3 — Scaffold the project

Run the framework's own initializer **before** writing any file into the project directory.
`create-next-app` and friends refuse to run in a directory that already contains conflicting
files, so writing `globals.css` or `layout.tsx` first (as earlier revisions of this guide had
it) breaks the scaffold outright.

```bash
# Next.js + shadcn/ui — pass every option; in a non-interactive agent session an
# unanswered prompt hangs the turn.
npx create-next-app@latest [name] --typescript --tailwind --app --src-dir --eslint --import-alias "@/*"

# Astro
npm create astro@latest [name]

# FastAPI
mkdir [name] && cd [name] && python -m venv venv && pip install fastapi uvicorn pydantic

# Go
mkdir [name] && cd [name] && go mod init [module-path]
```

**Path note for every step below:** with `--src-dir` (used above), the App Router lives under
`src/app/`, so `app/globals.css` means `src/app/globals.css` and `app/layout.tsx` means
`src/app/layout.tsx`. Drop `--src-dir` and the paths are as written. Pick one and stay
consistent — mixing the two is the most common source of "module not found" on a fresh project.

---

## Step 4 — globals.css FIRST (before any component)

Next.js: `app/globals.css` | Vite+React: `src/styles/globals.css` | Nuxt: `assets/css/globals.css`

```css
@import "tailwindcss";

@theme {
  --color-background: [value];
  --color-foreground: [value];
  --color-primary: [value];
  --color-primary-foreground: [value];
  --color-secondary: [value];
  --color-secondary-foreground: [value];
  --color-muted: [value];
  --color-muted-foreground: [value];
  --color-accent: [value];
  --color-accent-foreground: [value];
  --color-destructive: [value];
  --color-border: [value];
  --color-input: [value];
  --color-ring: [value];
  --color-card: [value];
  --color-card-foreground: [value];
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
  --transition-fast: 100ms;
  --transition-base: 200ms;
  --transition-slow: 300ms;
  --ease-enter: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

**PHASE GATE 1:** `npm run lint` → 0 errors + `npx tsc --noEmit` → 0 errors. Fix before continuing.

---

## Step 5 — types/index.ts

```typescript
// TypeScript projects: src/types/index.ts or types/index.ts
export type User = { id: string; email: string; role: 'admin' | 'member'; createdAt: Date }
// Add all types from PROJECT-CONTRACTS.md § Shared TypeScript Types
// Every file imports from here — no inline type duplication
```

---

## Step 6 — Layout shell (web projects, build in order)

1. `app/layout.tsx` — root layout with ThemeProvider, font setup, global CSS import
2. `components/layout/AppShell.tsx` — sidebar + topbar + main area wrapper
3. `components/layout/Sidebar.tsx` — nav items from PROJECT-CONTRACTS.md § Navigation Items
4. `components/layout/TopBar.tsx` — if applicable
5. `components/shared/PageHeader.tsx` — title, description, optional CTA
6. `components/shared/EmptyState.tsx` — icon + headline + description + CTA (all 4 required)
7. `components/shared/SkeletonCard.tsx` — shimmer, matches card layout shape

Every route in PROJECT-CONTRACTS.md must appear in the sidebar. No orphan pages.

**PHASE GATE 2:** lint ✓ + tsc --noEmit ✓ + build ✓. Fix before continuing.

---

## Step 7 — First feature page

Build ONE complete page from PROJECT-CONTRACTS.md:

- Uses shared layout from Step 6
- Uses semantic tokens from globals.css only (no hardcoded values)
- Uses types from types/index.ts
- Has all 4 states: loading skeleton + populated + empty + error

**PHASE GATE 3:** lint ✓ + tsc ✓ + build ✓ + visual check (loading skeleton matches populated shape).

---

## Step 8 — Self-review checklist (mandatory before declaring done)

### Design consistency

- [ ] Every color: CSS variable or Tailwind semantic token — no hardcoded hex, no raw `text-gray-500`
- [ ] Every spacing: on the project's chosen scale (kit default = 8px grid, p-1/2/3/4/6/8/12/16) — no arbitrary values like `gap-[18px]`
- [ ] Every font size: typography scale — no `text-[17px]`
- [ ] Dark mode tokens tested (if in scope)

### Component completeness

- [ ] Every data-driven component: loading + empty + error state
- [ ] Loading: skeletons (never spinners for lists/cards/tables)
- [ ] Empty: icon + headline + description + CTA (all 4)
- [ ] Every form: submit disabled + loading indicator while pending
- [ ] Every form: success via toast/notification (never alert())

### Structural coherence

- [ ] Every route in PROJECT-CONTRACTS.md in sidebar/nav
- [ ] All TypeScript types from types/index.ts — no inline duplication
- [ ] All imports resolve — no "Cannot find module" errors
- [ ] No component re-invents what components/shared/ provides

### Holistic consistency

- [ ] DB field names = DTO field names = API response field names = UI label text
- [ ] Nav labels = page titles = route paths
- [ ] Error messages are user-facing, not stack traces
