# /perf-check

Analyze the current codebase for performance issues: $ARGUMENTS

You are running a performance analysis. Identify performance risks in the current codebase without running the app.

**Step 1 — Detect project type**

Read `package.json` / manifest to identify: web frontend, backend API, mobile, full-stack.

**Step 2 — Web bundle analysis (if web project)**

Check for:

- Large dependencies imported without tree-shaking (e.g., `import _ from 'lodash'` instead of `import { pick } from 'lodash-es'`)
- `moment.js` in any import (heavy — suggest `date-fns` or `Temporal`)
- Client-side imports of server-only packages
- Missing dynamic imports for heavy components: `next/dynamic`, `React.lazy`
- Images without `next/image` or size attributes (CLS risk)
- Missing `loading="lazy"` on below-fold images
- Google Fonts loaded via `<link>` (causes FOIT — use `next/font`)
- Unoptimized SVG icons (use sprite or icon library)

Core Web Vitals risks:

- LCP: hero image without `priority` prop or `fetchpriority="high"`
- CLS: images/embeds without explicit dimensions, dynamic content injected above fold
- INP: `useEffect` with expensive synchronous work on every render, missing `useMemo`/`useCallback` for expensive computations

**Step 3 — API/backend performance (if API/backend project)**

Check for N+1 patterns:

```text
// N+1: ORM call inside a loop
const users = await db.user.findMany()
for (const user of users) {
  user.orders = await db.order.findMany({ where: { userId: user.id } })  // ← N+1
}

// Should be: eager loading or batch query
```

Look for:

- Loops with `await` inside that could be batched
- Missing `select` on ORM queries (fetching all columns when few are needed)
- Missing pagination on list endpoints (unbounded queries)
- Missing indexes: WHERE clauses on non-indexed columns
- Sync operations inside async handlers (blocking event loop in Node.js)
- Missing database connection pooling config

**Step 4 — Mobile performance (if Flutter/RN/native)**

Check for:

- `FlatList` instead of `FlashList` for long lists (>20 items)
- Heavy computation in `build()`/`render()` without memoization
- `setState` calls triggering full tree re-render
- Missing `const` constructors in Flutter widgets
- Network calls without caching
- Large assets not compressed (PNG instead of WebP/AVIF)

**Step 5 — Memory leaks**

Common patterns to flag:

- Event listeners added without cleanup in `useEffect` return
- Subscriptions not cancelled on component unmount
- `setInterval` without `clearInterval`
- Global state accumulating without limits (unbounded caches, growing arrays)

**Output format:**

```text
PERFORMANCE ANALYSIS
====================

CRITICAL (likely visible to users):
  PERF: [location] — [issue] — [estimated impact]

HIGH (measurable degradation):
  PERF: [location] — [issue] — [fix]

MEDIUM (optimization opportunities):
  [location] — [issue] — [suggested fix]

FORWARD FLAGS:
  FWD: [location] — [pattern] — [risk if not addressed]

SUMMARY:
  LCP risks: [count]
  CLS risks: [count]
  N+1 risks: [count]
  Bundle risks: [count]
  Memory leak risks: [count]

TOP 3 PRIORITIES:
  1. [most impactful fix]
  2. [second most impactful]
  3. [third most impactful]
```
