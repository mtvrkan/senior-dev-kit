---
name: from-scratch
description: Use when starting a new project from scratch. Establishes contracts, design system, and architecture skeleton before any feature code. Enforces phase gates to prevent incoherence and bugs.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use when user says "new project", "start from scratch", "build X from zero", or when no existing codebase is present.
argument-hint: "[project name] [archetype] [tech stack]"
context: fork
agent: senior-engineer
---

# from-scratch

Three laws: (1) contracts before components — define routes/types/APIs first, (2) tokens before components — write globals.css CSS vars first, (3) phase gates — lint + tsc must pass before advancing. See `agent_docs/from-scratch-guide.md` for templates, framework init commands, and the self-review checklist.

0. Seed the project `CLAUDE.md` from the kit's matching stack preset (`senior-dev-kit/presets/<category>/<stack>/CLAUDE.md`; multiple stacks → concatenate their `compact.md`s per `presets/README.md`; no matching preset → `generic/fallback`).
1. Write `PROJECT-CONTRACTS.md` (routes, types, API endpoints, shared components, nav items). Determine archetype: SaaS | Marketing | DevTool | Ecommerce | Mobile | API | Internal | Creative, then select stack per archetype.
2. Write `DESIGN-SPEC.md` and `globals.css` (semantic tokens). **Gate 1:** lint + tsc = 0 errors.
3. Write `types/index.ts` from contracts. Build layout shell (AppShell, Sidebar, TopBar, PageHeader, EmptyState, SkeletonCard). **Gate 2:** lint + tsc + build = 0 errors.
4. Build first feature page — all 4 states: loading skeleton + populated + empty + error. **Gate 3:** lint + tsc + build = 0 errors.
5. Self-review: design tokens, 8px spacing grid, component completeness, structural coherence, consistency.

## Output

```text
PROJECT INITIALIZED: [name] | Archetype: [type] | Stack: [list]
Contracts: ✓ | Design: ✓ | CSS tokens: ✓ | Types: ✓ | Shell: ✓ | First page: ✓
Phase gates: Gate 1: ✓ | Gate 2: ✓ | Gate 3: ✓
Next: /new-page [route] for additional pages.
```
