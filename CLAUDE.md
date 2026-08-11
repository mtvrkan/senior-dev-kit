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
  — runs test, validate, link-check, consistency-check, docs-check, routing-eval,
  check-plugin, typecheck, lint, markdown-lint, audit
- Type-check only: `npm run typecheck` | Lint only: `npm run lint`
- Installer dry run: `node scripts/install.mjs --dry-run`
- Landing page: **not on this branch.** The page source lives on the `site-src` branch and the
  rendered output on `gh-pages`; a clone of the kit carries neither, because nobody
  installing a Claude Code configuration kit needs a website. `site/` is git-ignored here
  and is the path that branch gets checked out into — `git worktree add site site-src` to work
  on it. `.github/workflows/site.yml` checks out both branches, renders, and force-pushes
  a single orphan commit to `gh-pages`; pushing to either branch publishes.
- The split does not weaken the derivation: every number the page states is read from this
  branch's contents at build time by `scripts/gen-site.ts` (agent/skill/preset counts, deny
  rules, the always-loaded line budget, the gate's own step list). `site-check` and
  consistency check 28 therefore run in that workflow, not in `npm run check` — check 28
  says so out loud when it scans nothing, rather than passing silently.

Never mark a task done without running `npm run check` (or the narrowest subset that covers
the change) and fixing failures — don't report success on unverified changes.

## Conventions

- Every preset ships `CLAUDE.md` (full) + `compact.md` (7-15 line summary, enforced by
  `scripts/lib/presets.ts`); keep both in sync.
- Rule files under `rules/` use `paths:` frontmatter (YAML list of globs — Claude Code's
  native key; NOT Cursor's `globs:`) for lazy path-scoped loading. The two files without a
  `paths:` field (000, 001) load unconditionally every session (see
  `global-CLAUDE.md` RULES REFERENCE).
- Presets cover the mainstream languages, frameworks and data layers rather than only stacks
  this maintainer ships on — the selection criteria and the deliberate omissions (C/C++ has no
  dominant framework convention to encode) live in `presets/README.md`, which is the single
  source of truth for that policy. A new preset must be *accurate*, not merely plausible: the
  risk is staleness, not breadth. When adding or removing one, update the name lists in
  `README.md`, `README.tr.md` and `presets/README.md` — `scripts/check-consistency.ts` derives
  both the count and the names from disk and fails on drift.
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
