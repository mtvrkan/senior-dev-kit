---
name: codebase-overview
description: Use to generate or refresh a codebase architecture overview — directory map, data flow, key component responsibilities — so future research reuses it instead of rediscovering the codebase.
allowed-tools: Read, Grep, Glob, Bash, Write
when_to_use: Use when starting on an unfamiliar codebase, when no overview exists yet, or after structural change since the last one was written.
argument-hint: "[scope: full | frontend | backend (default: full)]"
context: fork
agent: senior-engineer
effort: medium
---

# codebase-overview

1. Reuse BOOT SEQUENCE signals from this session if already known; otherwise glob top-level dirs + manifest.
2. Map each top-level source directory to a one-line purpose (skip node_modules/dist/build/.git/.next).
3. Trace primary data flow: entry point → routing → key components/screens → data layer (API/store/DB).
4. Flag performance-sensitive integration points by file:line — third-party script loading, router/navigation setup, large media/asset loading, analytics init.
5. Write/update `PROJECT/.claude/codebase-overview.md` with the findings — the reusable reference other tasks read instead of re-discovering.
6. If root `CLAUDE.md` lacks an architecture section, add ≤10 lines pointing to it (essentials inline, detail lazy-loaded from `codebase-overview.md`) — never let CLAUDE.md itself balloon past its existing budget.
7. Never modify source files — documentation only.

## Output

```text
CODEBASE OVERVIEW: [project name] — written to PROJECT/.claude/codebase-overview.md
DIRECTORIES: [dir → one-line purpose]
DATA FLOW: [entry → routing → components → data layer]
KEY COMPONENTS: [component → responsibility — only non-obvious ones]
PERF-SENSITIVE: [file:line — why it matters]
CLAUDE.md: [updated | already covered | needs manual review — reason]
```
