# Presets — how activation works

Nothing in this directory is loaded automatically. A preset only takes effect
when its content is copied into a location Claude Code actually reads — the
project's `CLAUDE.md` or `~/.claude/CLAUDE.md`. Keeping the kit cloned on disk
activates nothing by itself.

## Structure

Each preset is a directory with exactly two files:

```text
presets/<category>/<name>/
├── CLAUDE.md    ← full rule set — copy into the project's CLAUDE.md
└── compact.md   ← 7-15 line summary — for composing multiple stacks
```

Shipped stacks: `web/nextjs-saas`, `web/react-vite`, `backend/node-express`,
`backend/nestjs`, `backend/fastapi`, `orm/prisma`, `database/postgres`,
`infrastructure/docker`, `generic/fallback`.

**Why the list is short.** A preset is only worth shipping once someone has run
a real project against it — an unverified preset is a file that drifts and
gives Claude confidently wrong conventions. If your stack isn't listed, use
`generic/fallback`, and open a PR with a preset once you've used it in anger.
Stacks contributors have asked about but that have no verified preset yet:
Vue/Vite, Flutter, React Native, Kotlin, Swift, Java, PHP, Unity/C#, MongoDB,
Firebase/Supabase, Django, Go.

## The `generic/` category

`generic/fallback` — minimal per-project overlay for stacks with no
dedicated preset above.

## Composing multiple stacks

`compact.md` files are plain bullet lists (no frontmatter, no HARD STOPS section — those live
only in `global-CLAUDE.md`), so combining stacks is literal concatenation: paste each relevant
preset's `compact.md` body, one after another, into the project's `CLAUDE.md` under its own
heading (e.g. `## React + Vite`, `## Postgres`). Order doesn't matter — the bullets don't
reference each other.

## Adding or updating a preset

Copy the `CLAUDE.md` + `compact.md` structure of an existing preset in the
same category. `npm run validate` catches malformed frontmatter and
`npm run check` catches broken links.
