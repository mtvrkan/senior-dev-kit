# Presets — how activation works

Nothing in this directory is loaded automatically. A preset only takes effect
when its content is **copied into a location Claude Code actually reads** —
the project's `CLAUDE.md`, `.claude/stack-rules.md`, or `~/.claude/CLAUDE.md`.
Keeping the kit cloned on disk activates nothing by itself.

## Structure

Each preset is a directory with exactly two files:

```text
presets/<category>/<name>/
├── CLAUDE.md    ← full rule set — becomes the project CLAUDE.md for single-stack projects
└── compact.md   ← ≤ 15-line summary — appended to .claude/stack-rules.md when composing multiple stacks
```

Categories group by domain (`web/`, `backend/`, `database/`, `mobile/`,
`infrastructure/`, ...). `SETUP.md` Step 1's detection table searches every
category, so preset names must be unique across the whole tree.

## Two activation routes

1. **Manual copy** — copy one preset's `CLAUDE.md` into the project root, or
   compose several stacks by concatenating their `compact.md` files into
   `.claude/stack-rules.md` (see [README.md Option C](../README.md#option-c--manual-install-for-a-single-project)
   and the composition guidance in [README.md](../README.md#picking-a-preset)).
2. **Autonomous setup** — ask Claude Code to follow [SETUP.md](../SETUP.md)
   (Step 1 onward); it reads your manifest files, matches presets from the
   detection table, and writes the files for you.

## The `generic/` category

- `generic/fallback` — minimal per-project overlay for stacks with no
  dedicated preset. `SETUP.md` Step 1 selects it automatically when no other
  row in the detection table matches.
- `generic/monorepo` — workspace-boundary rules layered on top of a stack
  preset in monorepos; it complements, not replaces, the per-app preset.

## Adding or updating a preset

Follow the `CLAUDE.md` + `compact.md` structure in
[EXTENDING.md](../EXTENDING.md), then add a row with today's date to
[PRESET-MAINTENANCE.md](../PRESET-MAINTENANCE.md) — `npm run check` fails on
untracked presets, stale review dates, and README count drift.
