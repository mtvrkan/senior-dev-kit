# senior-dev-kit — repo CLAUDE.md

This is a **publicly distributed** Claude Code config kit (MIT, installable as a plugin —
see README.md and CONTRIBUTING.md). Every change ships to strangers: assume no shared context,
no ability to ask the maintainer, and a machine that is not this one.

`global-CLAUDE.md` and `presets/*/CLAUDE.md` are templates installed *into* `~/.claude/` or a
project's `.claude/` — don't confuse them with this file, which is scoped to editing the kit
itself.

## Commands

- Test: `npm test` (targeted: `node --experimental-strip-types --test scripts/<file>.test.ts`)
- Validate frontmatter/routing: `npm run validate`
- Full gate (run before considering any change done): `npm run check`
  — runs test, validate, link-check, consistency-check, routing-eval, check-plugin,
  typecheck, lint, markdown-lint, audit
- Type-check only: `npm run typecheck` | Lint only: `npm run lint`
- Installer dry run: `node scripts/install.mjs --dry-run`

Never mark a task done without running `npm run check` (or the narrowest subset that covers
the change) and fixing failures — don't report success on unverified changes.

## Conventions

- Every preset ships `CLAUDE.md` (full) + `compact.md` (7-15 line summary, enforced by
  `scripts/lib/presets.ts`); keep both in sync.
- Rule files under `rules/` use `paths:` frontmatter (YAML list of globs — Claude Code's
  native key; NOT Cursor's `globs:`) for lazy path-scoped loading. The two files without a
  `paths:` field (000, 001) load unconditionally every session (see
  `global-CLAUDE.md` RULES REFERENCE).
- Kept presets are limited to stacks someone actually ships on (see `presets/README.md`) —
  don't add a new preset speculatively; add one when a real project needs it.
- `README.md` (English) is canonical; `README.tr.md` is its translation. Change one and the
  other drifts — `scripts/check-consistency.ts` compares the count claims in both, but not the
  prose. Update both in the same commit.
- Anything installable has two delivery paths and both must keep working: the plugin
  (`.claude-plugin/`, resolves bundled docs via `${CLAUDE_PLUGIN_ROOT}`) and
  `scripts/install.mjs` (copies into `~/.claude/`). A path reference that only resolves under
  one of them is a bug — `npm run check-plugin` catches the common shapes.
- **Accepted tradeoff (round-18 audit, do not re-flag):** `scripts/**/*.ts` has no automated
  line-budget guard, unlike agent bodies (150 lines), skill bodies (20 lines), and the
  always-loaded files — `global-CLAUDE.md` + `rules/000-security.md` + `rules/001-conventions.md`,
  every session, everywhere this kit is installed (250 lines/file, 500 combined, enforced by
  `scripts/check-consistency.ts` check 3) — those cap context-window cost paid every session; script files
  are code, not per-session context tax, so the kit's own `>300 lines` god-file convention applies
  to them only as a soft human heuristic (see `scripts/lib/validate-skills.ts`, which exceeds it
  with an inline justification for staying one module; no exact line count stated here — hand-typed
  counts drift as the file grows). Enforcing it mechanically would
  penalize explanatory comments (`scripts/check-consistency.ts` is long largely because each check
  documents the drift it was written to catch) as much as real bloat.

## Effort strategy

Default effort follows the account setting. For work in this repo specifically: keep effort
low for mechanical edits (typo fixes, single-line doc corrections, changelog entries); use
`/effort xhigh` for routing-table changes or anything touching `scripts/lib/` that other
validators depend on.

## Context budget (this dev's environment only)

This maintainer's personal Claude Code install runs with the 1M context window enabled —
don't assume that for other contributors or for the shipped `global-CLAUDE.md`/preset
templates. Locally it means `npm run check`'s full output, multi-file `Explore` passes across
`rules/`, `agents/`, `skills/`, and `presets/`, and reading several preset `CLAUDE.md` +
`compact.md` pairs side by side all fit comfortably without triggering early auto-compact.
