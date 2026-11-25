---
name: from-scratch
description: Use when starting a new project from scratch. Establishes contracts, design system, and architecture skeleton before any feature code. Enforces phase gates to prevent incoherence and bugs.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use when user says "new project", "start from scratch", "build X from zero", or when no existing codebase is present.
argument-hint: "[project name] [archetype] [tech stack]"
---

# from-scratch

Runs in the main loop: its gates need the user between phases, and a subagent cannot ask. Three laws: (1) contracts before components — define routes/types/APIs first, (2) tokens before components — write globals.css CSS vars first, (3) phase gates — lint + tsc must pass before advancing. See `${CLAUDE_PLUGIN_ROOT}/agent_docs/from-scratch-guide.md` for templates, framework init commands, and the self-review checklist.

0. Seed the project `CLAUDE.md` from the kit's matching stack preset (`${CLAUDE_PLUGIN_ROOT}/presets/<category>/<stack>/CLAUDE.md`; multiple stacks → concatenate their `compact.md`s per `${CLAUDE_PLUGIN_ROOT}/presets/README.md`; no matching preset → `generic/fallback`).
1. Write `PROJECT-CONTRACTS.md` (routes, types, API endpoints, shared components, nav items). Determine archetype: SaaS | Marketing | DevTool | Ecommerce | Mobile | API | Internal | Creative, then select stack per archetype.
2. Collect the brief, then have `design-lead` return OPTIONS/QUESTION per `${CLAUDE_PLUGIN_ROOT}/agent_docs/design-directions.md` (three far-apart options; bespoke when none of the eight fits) and put that question to the user yourself. Write `DESIGN-SPEC.md` (axes as real numbers + brief constraints + the one signature moment) + `globals.css` from those values. **Gate 1:** lint + tsc = 0 errors.
3. Write `types/index.ts` from contracts. Build layout shell (AppShell, Sidebar, TopBar, PageHeader, EmptyState, SkeletonCard). **Gate 2:** lint + tsc + build = 0 errors.
4. Build first feature page — all 4 states: loading skeleton + populated + empty + error. **Gate 3:** lint + tsc + build = 0 errors.
5. Self-review: design tokens, the spec's spacing scale, component completeness, structural coherence — then run `/design-check` for the rest (direction actually visible, tells, monotony, signature).

## Output

```text
PROJECT INITIALIZED: [name] | Archetype: [type] | Stack: [list]
Contracts: ✓ | Design: ✓ | CSS tokens: ✓ | Types: ✓ | Shell: ✓ | First page: ✓
Phase gates: Gate 1: ✓ | Gate 2: ✓ | Gate 3: ✓
Next: /new-page [route] for additional pages.
```
