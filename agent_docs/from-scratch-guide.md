# From-Scratch Project Guide

Full step-by-step reference for `/from-scratch` skill. Read after reviewing the 3 laws and archetype.

---

## Step 0 — PROJECT-CONTRACTS.md (write first, always)

```markdown
# Project Contracts — [Project Name]

## Architecture
Pattern: [layered | vertical slice | clean/DDD | framework MVC] — chosen, not inherited by accident.
Boundaries: [what a feature owns · what lives in the shared kernel · what never imports what]
Dependency direction: [e.g. controller → service → repository → DB; domain imports no framework]
Seams: transactions [layer] · error boundary [layer] · authz [layer] · retries [layer]

Recorded for the same reason the design direction is: a pattern that is only ever *detected*
from folder shape gets re-derived — differently — by every later session, and the second
answer is what turns one architecture into two. `/arch-check` audits the code against this.

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

**Collect the brief, then pick the direction.** Read `agent_docs/design-directions.md`. Its BRIEF
section comes first — references, brand assets, adjectives, exclusions, hard constraints — because
a direction chosen from the product type alone is a guess about the user's taste. Then narrow to
three genuinely far-apart options and ask once, one question, each named with its consequence; when
the brief points somewhere none of the eight goes, one of the three is a bespoke direction. This is
the step that decides whether the project looks like its own thing or like every other generated
site; skipping it and filling the spec from defaults is what produced the sameness complaint in the
first place. The answer is resolved into real numbers here, and every later page reads them instead
of choosing again.

```markdown
# Design Specification — [Project Name]

## Direction: [one of the eight in agent_docs/design-directions.md, or a named bespoke one]
Chosen with the user on [date]. Later pages read this; they do not re-choose.
Bespoke → name the base it started from and what the brief moved.

## Brief — constraints and exclusions (from the user, not derivable from the code)
Fixed: [brand palette / logo / component library / density requirement / …]
Avoid: [competitor or look the user ruled out]
References: [what was pointed at, and which axes it actually bound]

## Signature moment
One sentence: what the single idea is and where it lives. Later pages support it, never compete
with it. See design-directions.md § THE SIGNATURE.

## Personality
One-sentence brand voice.

## Axis values (resolved — these are what get written into globals.css)
Type:       display [font] / body [font] / mono [font] · scale ratio [1.2|1.25|1.333|1.5|1.618]
Colour:     base [light|dark] · neutral [warm|cool|pure] · accents [n] · primary [HSL]
Geometry:   --radius-sm/md/lg [values] · border [weight, or "structure carried by shadow"]
Depth:      [flat|soft shadow|hard offset|glow|glass] — exactly one
Density:    section spacing [px] · body line-height · measure [ch]
Motion:     duration band [ms] · easing · what animates
Decoration: [gradient|grain|rules|imagery|none]
Layout:     rhythm [centred|editorial|split|modular|full-bleed|dense shell]

## Semantic Tokens (copy into globals.css)
--background  --foreground  --card  --card-foreground
--primary  --primary-foreground  --secondary  --secondary-foreground
--muted  --muted-foreground  --accent  --accent-foreground
--destructive  --destructive-foreground  --border  --input  --ring  --radius

## The token NAMES above are fixed on every project; the direction sets their VALUES.
## Component-state, accessibility and three-mandatory-state rules are fixed too and are not
## restated here — see rules/100-web.md and agent_docs/design-system.md.
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
- [ ] The chosen direction is actually visible: radius, depth model, type pairing, density and
      motion all match `DESIGN-SPEC.md`. A spec naming one direction over a page built from the
      defaults is the failure this checklist exists to catch — the file agreeing with itself is
      not evidence that the page does.
- [ ] Section composition varies within the page — not the same centred heading over a 3-column
      card grid three times (see `agent_docs/design-directions.md`, LAYOUT RHYTHM)
- [ ] The signature moment recorded in `DESIGN-SPEC.md` is built, survives 360px and
      `prefers-reduced-motion`, and is the only one on the page
- [ ] The brief's fixed constraints and exclusions are honoured
- [ ] `/design-check` run and its findings addressed — this checklist is the author marking their
      own work; the command measures the built UI against the spec independently

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
- [ ] The architecture recorded in `PROJECT-CONTRACTS.md` is what the tree implements — one
      pattern, dependency direction held, each seam (transactions, error boundary, authz) owned
      by one layer
- [ ] `/arch-check` run and its findings addressed — cheapest at project zero, when the whole
      codebase is the first feature and nothing has calcified yet

### Holistic consistency

- [ ] DB field names = DTO field names = API response field names = UI label text
- [ ] Nav labels = page titles = route paths
- [ ] Error messages are user-facing, not stack traces
