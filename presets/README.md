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

Kept stacks: `web/nextjs-saas`, `web/react-vite`, `backend/node-express`,
`backend/nestjs`, `backend/fastapi`, `orm/prisma`, `database/postgres`,
`infrastructure/docker`, `generic/fallback`.

Actively-used stacks with no dedicated preset yet (add one on the first real
project, not speculatively — use `generic/fallback` until then): Unity/C#,
Vue/Vite, Flutter, React Native, Kotlin, Swift, Java, PHP, MongoDB,
Firebase/Supabase, Nginx/Coolify.

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
