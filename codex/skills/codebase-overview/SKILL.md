---
name: codebase-overview
description: "Use to generate or refresh a codebase architecture overview — directory map, data flow, key component responsibilities — so future research reuses it instead of rediscovering the codebase. Use when starting on an unfamiliar codebase, when no overview exists yet, or after structural change since the last one was written."
---

# codebase-overview

> Codex: run this skill in the `senior-engineer` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.

1. Glob top-level dirs + read the manifest.
2. Map each top-level source directory to a one-line purpose (skip node_modules/dist/build/.git/.next).
3. Trace primary data flow: entry point → routing → key components/screens → data layer (API/store/DB).
4. Flag performance-sensitive integration points by file:line — third-party script loading, router/navigation setup, large media/asset loading, analytics init.
5. Write/update `PROJECT/.claude/codebase-overview.md` with the findings — the reusable reference other tasks read instead of re-discovering. Record the architecture explicitly (pattern, boundaries, dependency direction, which layer owns transactions/errors/authz): detected-but-unrecorded is re-detected differently next session.
6. Run `$arch-check` once the map exists — it measures the tree against the architecture just recorded; a mixed pattern or an inverted dependency belongs in the overview as a known state, not as a surprise for the next feature.
7. If root `AGENTS.md` lacks an architecture section, add ≤10 lines pointing to it (essentials inline, detail lazy-loaded from `codebase-overview.md`) — never let AGENTS.md itself balloon past its existing budget.
8. Never modify source files — documentation only.

## Output

```text
CODEBASE OVERVIEW: [project name] — written to PROJECT/.claude/codebase-overview.md
DIRECTORIES: [dir → one-line purpose]
DATA FLOW: [entry → routing → components → data layer]
KEY COMPONENTS: [component → responsibility — only non-obvious ones]
PERF-SENSITIVE: [file:line — why it matters]
AGENTS.md: [updated | already covered | needs manual review — reason]
```
