---
name: new-page
description: Use when building a brand-new admin panel page or screen from scratch in ANY web framework. Enforces design quality gates. Do NOT use for modifying existing pages — use ui-change instead.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically when the task is to create a new page, route, or screen in the admin panel from scratch.
---

# new-page

New admin page from scratch. Follow this protocol — do not skip steps. See `agent_docs/new-page-guide.md` for framework detection table, convention discovery globs, form/table patterns, and the quality gate checklist.

1. Read `PROJECT-CONTRACTS.md` + `DESIGN-SPEC.md` if present (project root — written by the `from-scratch` skill; absent on projects not bootstrapped with it, skip) — they override everything below.
2. Detect framework (next.config.*→Next.js | vite.config.*→React+Vite | nuxt.config.*→Nuxt | angular.json→Angular | svelte.config.*→SvelteKit | artisan→Laravel | manage.py→Django | Gemfile+routes.rb→Rails).
3. Find 1-2 similar pages, read one fully — extract shell/layout, data fetching, UI library, state/loading, token/spacing usage.
4. Output plan (FRAMEWORK / SIMILAR PAGE / SHELL / DATA SOURCE / STATES / FORMS). Wait for "go" if 3+ component types.
5. Build in order: shell → header → loading skeleton → data fetch → populated → empty → error → forms/dialogs. All 4 states required, semantic tokens only, no new UI libraries.

## Output

```text
· [page path — files created]
REF: [similar page] | FRAMEWORK: [detected] | UI LIB: [detected]
STATES: loading ✓ | empty ✓ | error ✓ | populated ✓
VERIFY: [lint — ✓] | RISK: low | medium
```
