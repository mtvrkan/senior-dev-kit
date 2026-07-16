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
- Rule files under `rules/` use `paths:` frontmatter (YAML list of globs — Claude Code's
  native key; NOT Cursor's `globs:`) for lazy path-scoped loading. The two files without a
  `paths:` field (000, 001) load unconditionally every session (see
  `global-CLAUDE.md` RULES REFERENCE).

## Effort strategy

Default effort follows the account setting. For work in this repo specifically: keep effort
low for mechanical edits (typo fixes, single-line doc corrections, changelog entries); use
`/effort xhigh` for routing-table changes, hook logic (`hooks/protected-paths.mjs`), or
anything touching `scripts/lib/` that other validators depend on.

## Context budget (this dev's environment only)

This maintainer's personal Claude Code install runs with the 1M context window enabled —
don't assume that for other contributors or for the shipped `global-CLAUDE.md`/preset
templates. Locally it means `npm run check`'s full output, multi-file `Explore` passes across
`rules/`, `agents/`, `skills/`, and `presets/`, and reading several preset `CLAUDE.md` +
`compact.md` pairs side by side all fit comfortably without triggering early auto-compact.
