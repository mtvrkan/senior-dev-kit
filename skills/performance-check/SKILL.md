---
name: performance-check
description: Use for slow code, slow queries, bundle size, caching, N+1, render loops, memory, and latency issues.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for slow queries, bundle size, caching, render loops, memory, and latency issues.
argument-hint: "[file, endpoint, or area to profile]"
---

# performance-check

`code-review` flags obvious N+1/perf smells inline as one of ten checks on a diff; this skill is the deep-dive when that flag needs an actual investigation, or when the user names a slow endpoint/query directly.

Investigate in this order:

1. QUERY PATTERNS: N+1 problems, missing indexes, full table scans
2. RENDER LOOPS: unnecessary rerenders, missing memoization, derived state recalculated on every render
3. BUNDLE SIZE: heavy imports in client components, missing code splitting
4. CACHING: missing cache headers, stale data without revalidation, cache invalidation bugs
5. MEMORY: event listener leaks, large objects retained in closures, growing arrays
6. LATENCY: blocking I/O in async paths, serial awaits that could be parallel, expensive middleware

Output per finding: FILE:LINE | estimated impact (high/medium/low) | minimal fix
ESCALATE: [db-guard — if the fix requires a schema/index change | none]
Do not edit files by default — produce a prioritized fix list.
