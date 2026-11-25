---
name: performance-check
description: "Use for slow code, slow queries, bundle size, caching, N+1, render loops, memory, and latency issues. Use automatically on any slowness or resource-bloat complaint about existing code."
---

# performance-check

> Codex: run this skill in the `performance-guard` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.

`code-review` flags obvious N+1/perf smells inline as one of ten checks on a diff; this skill is the deep-dive when that flag needs an actual investigation, or when the user names a slow endpoint/query directly.

This skill forks into `performance-guard` (frontmatter), so the guard's body is co-loaded — its
per-layer checklists (DB → render → bundle → navigation → cache → memory → I/O), impact-order
triage for unscoped reports, PERFORMANCE ANALYSIS output format, and GUARD ESCALATIONS block
(db-guard for schema/index fixes) are the procedure; none of it is restated here.

Do not edit files — produce a prioritized fix list.
