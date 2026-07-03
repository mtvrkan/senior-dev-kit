# senior-dev-kit — repo CLAUDE.md

This is the kit's own source repo (a Claude Code plugin distribution), not a consumer app.
`global-CLAUDE.md` and `presets/*/CLAUDE.md` are templates shipped *to* other projects —
don't confuse them with this file, which is scoped to developing the kit itself.

## Commands

- Test: `npm test` (targeted: `node --experimental-strip-types --test scripts/<file>.test.ts`)
- Validate frontmatter/routing: `npm run validate`
- Full gate (run before considering any change done): `npm run check`
  — runs test + validate + stale-check + link-check + routing-eval + typecheck + lint
- Type-check only: `npm run typecheck` | Lint only: `npm run lint`

Never mark a task done without running `npm run check` (or the narrowest subset that covers
the change) and fixing failures — don't report success on unverified changes.

## Conventions

- Maintenance rules per file type live in `CONTRIBUTING.md`, `AGENTS-MAINTENANCE.md`,
  `SKILLS-MAINTENANCE.md`, `RULES-MAINTENANCE.md`, `PRESET-MAINTENANCE.md`,
  `COMMANDS-MAINTENANCE.md` — read the relevant one before adding/editing an
  agent/skill/rule/preset/command rather than guessing the expected shape.
- Every preset ships `CLAUDE.md` (full) + `compact.md` (8-15 line summary); keep both in sync.
- Rule files under `rules/` use `globs:` frontmatter for path-scoped loading and `alwaysApply:
  true` for the two that always load — load each at most once per session (see
  `global-CLAUDE.md` RULES REFERENCE).

## Effort strategy

Default effort follows the account setting. For work in this repo specifically: keep effort
low for mechanical edits (typo fixes, single-line doc corrections, changelog entries); use
`/effort xhigh` for routing-table changes, hook logic (`hooks/protected-paths.mjs`), or
anything touching `scripts/lib/` that other validators depend on.
