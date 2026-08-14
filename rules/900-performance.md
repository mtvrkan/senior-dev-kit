---
description: "Performance budgets — CWV, bundle size, query latency, render"
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,py,go,java,kt,kts,cs,rb,php,dart,swift,rs,c,cc,cpp,cxx,h,hpp,css,scss,vue,svelte,astro,html}"
---

> Related: [`700-observability.md`](700-observability.md) co-loads on the same glob for code files — intentional, not a conflict: 700 governs what to log, 900 governs latency/bundle budgets; apply both in full. Keep tool/version recommendations in sync across both. This glob additionally covers `.css`/`.scss` (CLS/font-display guidance) and 100-web's `.vue/.svelte/.astro/.html` (so 100-web's pointer to the budgets here always resolves), which 700's logging rules don't need — intentionally not identical.
>
> **Scope decision (round-9 audit, accepted — do not re-flag as an oversight):** bare-extension glob is deliberate — same reasoning as `700-observability.md`'s scope-decision note.

## PERFORMANCE BUDGETS — hard limits

Flag `PERF:` when a change likely violates these. Do not block — flag and continue.

### Core Web Vitals (frontend changes)

| Metric | Budget | Trigger |
| --- | --- | --- |
| LCP (Largest Contentful Paint) | < 2.5s | Above-fold content or image change |
| CLS (Cumulative Layout Shift) | < 0.1 | Layout, image, font, or dynamic insertion change |
| INP (Interaction to Next Paint) | < 200ms | Event handler, form, or state update change |
| TBT (Total Blocking Time, lab proxy for INP) | < 200ms | Any JS blocking the main thread |

`PERF: CLS risk — [image/component] above fold without explicit dimensions`
`PERF: LCP risk — [image/component] above fold with deferred/lazy load`

### Bundle size (frontend)

| Scope | Budget |
| --- | --- |
| Initial JS bundle (gzip) | < 200 KB |
| Per-route extra chunk | < 100 KB |
| Single dependency added | < 30 KB gzip — if larger, justify or find alternative |
| CSS bundle (gzip) | < 50 KB |

```bash
# Size of a package before adding it — npm built-in, no extra install
npm view <package>@<version> dist.unpackedSize
# Gzipped cost in a real bundle: https://bundlephobia.com/package/<package>

# Analyze an existing bundle
ANALYZE=true next build          # Next.js: needs next.config wrapped in withBundleAnalyzer
$env:ANALYZE=1; next build       # same, PowerShell — it has no inline env-var prefix
npx vite-bundle-visualizer       # Vite
```

`PERF: bundle risk — [package] adds [N]KB gzip to initial bundle`

### API / backend latency

| Endpoint type | Budget |
| --- | --- |
| GET (no DB) | < 50ms |
| GET (with DB, simple) | < 200ms |
| GET (with DB, joins) | < 500ms |
| POST / PUT / PATCH | < 500ms |
| File upload | < 2s |
| Webhook / background job trigger | < 200ms (enqueue time) |
| Background job completion | < 30s |

`PERF: latency risk — [endpoint] — [reason: N+1, missing index, full-table scan]`

### DB query budgets

| Operation | Budget |
| --- | --- |
| Simple SELECT by PK/index | < 5ms |
| JOINed SELECT, indexed | < 50ms |
| Aggregation (COUNT, SUM) on large table | < 200ms |
| Bulk INSERT / UPDATE (batched) | < 500ms per batch of 1000 |
| Full-table scan (no WHERE index) | NEVER in hot paths |

## N+1 DETECTION — auto-trigger on loop + DB pattern

Flag when: a loop body contains a DB call, and the outer list size is unbounded. Canonical
pattern, WRONG/RIGHT code example, and per-ORM fix live in `500-database.md`'s "N+1 QUERY
PREVENTION" section (loads for any migration/schema/model file) — this rule only adds the
latency-budget framing above.

`PERF: N+1 risk — [file:line] — [N] items × 1 DB call = N queries → batch or eager load`

## RENDER BUDGET (React / Vue / Flutter)

| Signal | Action |
| --- | --- |
| Component re-renders >2× per user interaction | Needs `memo` / `useMemo` / `useCallback` |
| Derived value recomputed in render body | Move to `useMemo` / `computed` |
| List > 50 items (web/Flutter; RN > 20 — see `400-mobile.md`) without virtualization | Use `FlashList` (RN) / `FixedSizeList` (web) / `ListView.builder` (Flutter) |
| `useEffect` with no deps or wrong deps | Causes infinite render loop |

```typescript
// WRONG — expensive computation in render (runs on every render):
function Component({ items }) {
  const sorted = items.sort((a, b) => b.score - a.score) // ← recalculated every render
  return <List data={sorted} />
}

// RIGHT — memoized:
function Component({ items }) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items])
  return <List data={sorted} />
}
```

## LOAD PERFORMANCE (images + fonts)

CLS prevention — mandatory on every `<img>`:

```html
<!-- ALWAYS: explicit width + height OR aspect-ratio CSS -->
<img src="..." width="800" height="600" alt="..." />
<!-- or -->
<div style="aspect-ratio: 4/3"><img src="..." /></div>
```

Font: `font-display: swap` (acceptable flash) or `optional` (no flash, may not load).
Never: `font-display: block` for body text (invisible text = bad UX + CLS).

```css
@font-face {
  src: url('/fonts/Inter.woff2') format('woff2');
  font-display: swap; /* or optional */
}
```

## MEMORY / RESOURCE LEAKS

Signal: event listener or interval added without cleanup.

```typescript
// WRONG — leak:
useEffect(() => {
  window.addEventListener('resize', handler)
}, []) // missing cleanup

// RIGHT:
useEffect(() => {
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler) // ← cleanup
}, [])
```

Same pattern for: WebSocket connections, `setInterval`, `setTimeout` chains, Subscription observables, stream readers.

`PERF: leak risk — [file:line] — [resource] added but cleanup function missing in [useEffect/onDestroy/deinit]`

## CONCURRENCY

Serial awaits that could be parallel:

```typescript
// WRONG — sequential (total time = A + B + C):
const a = await fetchA()
const b = await fetchB()
const c = await fetchC()

// RIGHT — parallel (total time = max(A, B, C)):
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()])
// Guard: only use Promise.all when A, B, C are independent (no shared write target)
```

`PERF: serial await — [file:line] — [N] independent fetches could be Promise.all()`
