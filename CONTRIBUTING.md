# Contributing

Thanks for considering a contribution. This kit is a set of Markdown configuration files plus
Node.js validators — there is no application to build and no runtime to deploy, so the
contribution loop is short.

## Prerequisites

- **Node.js 24+** — the validators run TypeScript directly via `--experimental-strip-types`.
- `npm ci` once, to install the dev dependencies (eslint, typescript, markdownlint).

## The one gate

```bash
npm run check
```

This runs, in order: `test` → `validate` → `link-check` → `consistency-check` → `docs-check` →
`routing-eval` → `behavior-eval` → `check-plugin` → `check-install` → `typecheck` → `lint` → `markdown-lint` →
`audit`. Every step
runs even if an earlier one fails, so you get the full report in one pass. A pull request is not
ready until this is green. Only the last step needs the network.

Narrower commands while iterating:

| Command | Checks |
| --- | --- |
| `npm test` | Unit tests for the validators themselves |
| `npm run validate` | Skill/agent/command/rule frontmatter and cross-references |
| `npm run link-check` | Every internal Markdown link and anchor resolves |
| `npm run consistency-check` | Hand-written claims (counts, budgets, versions) match disk |
| `npm run gen-docs` | Regenerates `docs/reference.md` from component frontmatter |
| `npm run docs-check` | Fails if `docs/reference.md` and that frontmatter disagree |
| `npm run gen-site` | Renders the landing page into `site/dist/`. Needs the `site-src` branch checked out into `site/` — see below |
| `npm run site-check` | Same render, result discarded. Runs in the site workflow, not in `npm run check` |
| `npm run gen-og` | Regenerates the social card — one per locale — and the raster icons on the `site-src` branch. Needs Chrome; outputs are committed there |
| `npm run check-plugin` | Plugin and marketplace manifests match the components on disk |
| `npm run deny-cost` | Replays your own Claude Code transcripts against the deny list |
| `npm run check-release` | Network. Verifies the published install path resolves for a stranger — run before announcing a release, not in the gate |

### The landing page lives on its own branch

`main` holds the kit; the page source is on `site-src`; the rendered output is on `gh-pages`,
written only by CI. Everything in this repository is downloaded by anyone installing the
kit, and a website is not part of a Claude Code configuration kit — that is the whole
reason for the split. Check the `site-src` branch out into `site/`, the path the generator
expects, then render into `site/dist/`:

```bash
git worktree add site site-src
npm run gen-site
```

`site/` is git-ignored on `main`, so the worktree sits there without polluting anything.
Pushing to either branch triggers `.github/workflows/site.yml`, which checks out both,
renders, and force-pushes one orphan commit to `gh-pages`. The page's numbers are still
derived from `main` at build time; nothing about the split lets a template hard-code one,
because consistency check 28 runs inside that build.

## What the validators enforce

Most review feedback is automated. Before opening a PR, know that:

- **Skill bodies are capped at 20 lines** and agent bodies at 150. Depth goes in
  `agent_docs/`, which is read on demand rather than loaded every session.
- **Every preset ships two files**: `CLAUDE.md` (full) and `compact.md` (7–15 lines). Both are
  required and are checked for drift against each other.
- **The always-loaded files** — `global-CLAUDE.md`, `rules/000-security.md`,
  `rules/001-conventions.md` — have a hard budget of 250 lines each and 500 combined. These
  three cost every user context on every turn, in every project. Adding to them is the most
  expensive edit in the repo; prefer a path-scoped rule or an `agent_docs/` page.
- **Trigger text has a budget too**, and it is the other half of the same bill: a skill's
  `description` + `when_to_use`, an agent's `description` and a command's frontmatter are all
  injected into every session before the user types. 360 chars each and 12000 combined across
  every component. The combined cap is the one that matters — every item can sit under its own
  cap while the sum grows past anything anyone approved, which is why the always-loaded files
  have a combined cap as well.
- **Rule files use `paths:` frontmatter** (Claude Code's native key — not Cursor's `globs:`)
  so they load only when a matching file is read. Only `000` and `001` omit it.
- **Numbers in prose are derived, not typed.** `scripts/check-consistency.ts` re-reads counts,
  budgets, and version strings from disk and fails if a document disagrees. If you change a
  count, do not hand-edit the prose — run the gate and let it tell you what drifted.
- **So are commands.** Every `npm run <script>`, every `scripts/install.mjs` flag, and every
  backticked slash command (`/<name>`) in this repo's own documents is resolved against `package.json`,
  the installer's argument parser, and `skills/`+`commands/`. Rename one and the docs that still
  name it fail the gate.
- **The installer's Node floor lives in one place** — `package.json`'s
  `seniorDevKit.installerNodeFloor`, currently 18, deliberately lower than `engines.node` (24,
  what these validators need). A CI job installs on that version for real; the READMEs may only
  restate it.

## Adding a component

| Adding a… | Do this |
| --- | --- |
| Skill | Create `skills/<name>/SKILL.md`, copy an existing skill's frontmatter shape, bind it to an agent's `skills:` list if an agent should follow it |
| Agent | Create `agents/<name>.md`, add a row to `agents/ROUTING.md`, add a golden prompt to `eval/golden-prompts.json` |
| Rule | Create `rules/<NNN>-<topic>.md` with a `paths:` glob list, add it to `global-CLAUDE.md`'s RULES REFERENCE topics list, and add a prompt in `eval/behavior-prompts.json` naming it as context |
| Preset | Copy the structure of an existing preset in the same category — both `CLAUDE.md` and `compact.md` |
| Deny rule | Edit `settings-template.json`, mirror it into `.claude/settings.json`, and run `npm run deny-cost` to measure the friction it adds |

Which stacks get a preset, and which are deliberately left out, is decided in
`presets/README.md`. Read it before proposing one.

## Shipped markdown carries no comments

Everything under `rules/`, `presets/`, `agent_docs/`, `agents/`, `skills/` and `commands/` is
loaded into someone's session, and code examples there are copied verbatim. So neither HTML
comments nor comments inside fenced examples are allowed: `npm run check` fails on both. The only
exception is the `// SAFETY:` note a Rust `unsafe` block requires. Explain an example in the prose
around the fence, and label a counter-example with a line such as `WRONG:` or `RIGHT:` directly
above its fence. Check 25 reads that line.

Machine-readable facts that used to live in HTML comments are recorded in
`scripts/lib/doc-ledger.json`:

- the `reviewed` date and scope of every version claim;
- the 600-devops toolchain-pin digest;
- the never-log field list;
- the forbidden example shapes.

Move a claim or a pin and the gate names the ledger entry to update.

Rule scope decisions. A rule body is injected into the model on every matching file, so the
reasoning behind a glob lives here instead of in the rule. Do not re-flag these:

- `700-observability` and `900-performance` use bare-extension globs on purpose. Directory scoping
  (`**/api/**`, `**/services/**`) would skip repo-root sources, Go `cmd`/`internal` and .NET
  layouts. 900 also covers `.css`/`.scss`, `.vue/.svelte/.astro/.html/.erb`, which 700's logging
  rules do not need, so the two globs are deliberately not identical.
- `400-mobile`'s `**/*.{swift,kt}` also fires for server-side Kotlin (Ktor, Spring). Narrowing to
  `**/android/**` would skip every Android module outside a directory of that name, which is the
  worse failure. `.kts` is deliberately excluded: it means `build.gradle.kts`, which every JVM
  backend has, and it produced no true positives. Plain RN/Expo screen `.tsx` files share their
  extension with web React, so only the `.native.*`/`app.config`/`metro.config` variants load the
  rule. All three are pinned in `scripts/rule-globs.test.ts`.
- `500-database`'s `**/schema.*`, `**/models/**` and ASP.NET `Models/` also match non-DB files (a
  Zod `schema.ts`, view models). Narrowing to `**/db/...` would skip real schema files; reading a
  schema-safety rule next to a DTO costs less than missing it next to an entity.
- `100-web`'s RETIRED UI APIS list is the single place a retired primitive is recorded. Check 24
  harvests it and fails the gate if any preset, agent, skill or doc still recommends that API, so
  add a line there when a library moves on and the presets follow.

Accepted overlaps. Do not re-flag these as duplication:

- `agents/security-guard.md`'s authentication checklist restates part of `rules/200-api.md`. The
  rule serves main-session API edits. The checklist serves guard sessions, where 200-api may never
  auto-load, because `middleware.ts` and similar files don't match its globs.
- `agents/devops-guard.md` restates constraints from `rules/600-devops.md`. The rule only
  auto-loads when a Dockerfile, CI or IaC file is read, and the guard's plan-only sessions may never
  open one.

## Commit and PR conventions

- One logical change per PR. A doc fix and a validator change are two PRs.
- Commit messages: imperative mood, present tense (`Add fastapi preset`, not `Added…`).
- Update `CHANGELOG.md` under `## [Unreleased]` for anything a user would notice.
- A release that changes any file the plugin ships bumps `version` in both
  `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Claude Code refreshes a
  cached plugin only when that version changes, so without the bump plugin users keep the old
  files.
- Never commit secrets, `.env` files, or transcript output. `.gitignore` and the gitleaks CI
  job both guard this, but the first line of defense is you.

## Security issues

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md) for the
disclosure process.

## Scope

Reasonable contributions: bug fixes in the validators, corrections to rule content, new stack
presets you actually use, better trigger phrases in `agents/ROUTING.md`, translations.

Out of scope: broadening the kit into a general prompt library, adding paid-service
dependencies, or adding components with no validator coverage.
