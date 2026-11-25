# Presets — how activation works

Nothing in this directory is loaded automatically. A preset only takes effect
when its content is copied into a location Claude Code actually reads — the
project's `CLAUDE.md` or `~/.claude/CLAUDE.md`. Keeping the kit cloned on disk
activates nothing by itself.

What *is* automatic is the offer: the BOOT SEQUENCE in `global-CLAUDE.md` already
detects the stack, so on a project with no `CLAUDE.md` it offers to seed one from
the matching preset. It offers rather than writes — a preset is a set of house
conventions, and which ones a project adopts is the project's call. The
`from-scratch` skill does the same thing at step 0 for a brand-new project.

## Structure

Each preset is a directory with exactly two files:

```text
presets/<category>/<name>/
├── CLAUDE.md    ← full rule set — copy into the project's CLAUDE.md
└── compact.md   ← 7-15 line summary — for composing multiple stacks
```

Shipped stacks: `web/nextjs-saas`, `web/react-vite`, `web/nuxt`,
`web/sveltekit`, `web/astro`, `web/angular`, `backend/node-express`,
`backend/nestjs`, `backend/fastapi`, `backend/django`, `backend/laravel`,
`backend/rails`, `backend/spring-boot`, `backend/dotnet`, `backend/go-api`,
`backend/rust-axum`, `mobile/flutter`, `mobile/react-native`,
`mobile/swiftui`, `orm/prisma`, `orm/drizzle`, `database/postgres`,
`database/mongodb`, `database/supabase`, `infrastructure/docker`,
`infrastructure/kubernetes`, `infrastructure/terraform`, `generic/fallback`.

**How this list is chosen.** The kit covers the languages, frameworks and data
layers most projects are actually written against — the JS/TS family, Python,
PHP, Ruby, the JVM, .NET, Go, Rust, both cross-platform mobile toolkits plus
native iOS, and the storage and infrastructure they sit on. A preset is a set
of house conventions, so the
risk is not breadth but staleness: a preset nobody uses drifts and then hands
Claude confidently wrong conventions. If a preset here contradicts how your
project actually works, the project's own `CLAUDE.md` wins — that precedence
is in `rules/001-conventions.md`, and correcting the preset via PR is welcome.

Stacks with no preset yet: native Android (Kotlin/Compose), C/C++, Unity,
Elixir/Phoenix, Solid/Qwik, MySQL, Redis. Native Android is the one asymmetry
worth naming, because native iOS *does* have a preset: `rules/400-mobile.md`
already treats Compose as a first-class platform (Jetpack Compose for all new
UI, Keystore, 48dp touch targets) and loads for every `.kt` file, so an Android
project gets the platform rules — it just has no house-convention preset beside
them yet. C/C++ is deliberate rather than pending: it has no dominant framework
convention to encode (CMake + Qt + Boost + embedded are four different
worlds), so the kit supports the *language* — rule loading, security
hotspots, build commands — without inventing house rules nobody follows. For
the rest, use `generic/fallback` and open a PR once you've run a real project
against one.

Categories: `web/`, `backend/`, `mobile/`, `orm/`, `database/`,
`infrastructure/`, `generic/`.

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
