# Usage

There is nothing to learn and nothing to type. You describe the task the way you always did; what
changes is what happens next.

## The one-paragraph version

Every request is classified before it is acted on. Work that touches auth, payments, database
schema, CI/CD, secrets or infrastructure goes to a **guard** — an agent with no write tools at
all, which produces a plan and stops. Everything else goes to an implementer, following a written
procedure for that task shape instead of improvising. You approve, or you don't.

## What routing looks like in practice

```text
"fix the broken link on the login page"   → bug-hunter
"add a settings page"                     → senior-engineer
"redesign the checkout flow"              → feature-plan in plan mode, then the guards review it
"add SBOM generation to the Docker CI"    → devops-guard  (plan only)
"add a column to the users table"         → db-guard      (plan only — no migration without your yes)
"why is this list slow?"                  → performance-guard (read-only)
```

The precedence rule, when two signals are present at once: a **guarded noun beats everything
else**. "Fix the CSS in the login form" is security-guard territory, not a CSS task, because the
change touches the auth surface. But a request that only *mentions* a guarded area without
changing it — writing tests against it, documenting it — routes by task type as normal.

The full tree, with the tie-breaks, is [`../agents/ROUTING.md`](../agents/ROUTING.md).

## Blast radius: the tier system

Before acting, the assistant places the work on a five-step scale, and the tier decides how much
ceremony it owes you:

| Tier | Trigger | What you see |
| --- | --- | --- |
| 0 | one file, under 10 lines | the edit, one line of summary |
| 1 | 1–2 files, UI or an isolated bug | the edit, two lines |
| 2 | 3–5 files, behavior/API/state change | a three-line plan first |
| 3 | protected area, multi-system, DB | full plan mode, no edits until you approve |
| 4 | destructive, billing, production data | risk analysis and an explicit go-ahead |

Some signals set a floor regardless of size: anything touching auth, payments or a schema
migration is Tier 3 minimum even if it is a one-line change.

## Why the guards can be trusted

A guard agent is read-only *by tool grant*, not by instruction. `db-guard`, `security-guard`,
`devops-guard` and `performance-guard` are configured with `Read, Grep, Glob, Bash` and nothing
else — there is no Edit or Write tool in their grant to reach for, so a model that decided to
ignore its instructions has no file-writing tool to reach for either.

The honest limit: `Bash` is still granted, because a guard has to be able to run `git log`, grep a
codebase and execute tests to produce a useful plan. A shell is a shell, so what stops a write
issued *through* it is the deny rules, not the tool grant — which makes a guard's write-prevention
exactly as strong as those rules, and no stronger. [`../SECURITY.md`](../SECURITY.md) documents
their coverage and the shapes they miss.

See the Access column in the [reference](reference.md) — it is derived from each agent's actual
tool list, not from a claim in prose.

## The context budget

Only three files load on every turn: `global-CLAUDE.md`, `rules/000-security.md` and
`rules/001-conventions.md`. Their combined size is capped and the cap is enforced by a script,
because that is the cost you pay on every single turn, in every project, forever.

Everything else is lazy:

- The other nine rule files load when you open a file matching their globs. Open a `.tsx` and the
  web rules activate; open a migration and the database rules do. A Flutter project never pays
  for the REST-API rules.
- The 16 reference documents under `agent_docs/` load only when a skill actually needs one.
- A skill's procedure body loads on invocation. Only its one-line trigger text is always resident.

## Things you can type

Everything so far happens without you asking. These are the exceptions — commands that exist
because they only make sense when *you* decide to run them:

| Type | Kind | For |
| --- | --- | --- |
| `/agents-guide` | command | List the installed agents and when each is used |
| `/skills-guide` | command | List the installed skills and what auto-triggers each |
| `/seo-check` | command | Audit the project for SEO, AEO and Core Web Vitals issues |
| `/design-check` | command | Audit built UI against its design direction: tells, monotony, signature |
| `/arch-check` | command | Audit structure: boundaries, dependency direction, mixed patterns, drift |
| `/a11y-check` | command | Audit against WCAG 2.2 AA: keyboard, focus, contrast, targets, reflow |
| `/deep-research` | manual-only skill | Multi-source research with cited synthesis |
| `/env-audit` | manual-only skill | Environment-variable audit across the codebase |
| `/kit-doctor` | manual-only skill | Diagnose an install that isn't behaving |
| `/kit-setup` | manual-only skill | Install the rules and deny list (once, after a plugin install) |

The three commands are slash commands and have always worked that way. The four skills below them
are ordinary skills that would otherwise auto-trigger, deliberately opted out with
`disable-model-invocation: true` in their frontmatter: Claude Code will never start one on its own
however well your request seems to match. A research sweep or a full-repo audit is expensive, and
expensive things should be a decision rather than a surprise.

## Working with it well

- **Let it escalate.** When a guard says "this is Tier 3, here is the plan," the useful reply is
  to read the plan. Overriding the guard on every change removes the only part of this that
  isn't advice.
- **Say `--now` when you mean it.** Appending `--now` to a Tier 2 request skips the plan step. It
  does not skip hard stops, Tier 3 plans, tests, or verification — those are not negotiable by
  flag.
- **One session per topic.** Context is a budget. Starting a fresh session for unrelated work
  costs nothing and keeps the useful history dense.
- **`/compact`, not `/clear`, mid-task.** Compacting summarises and continues; clearing wipes.

## What it will refuse to do quietly

The deny rules shipped with the kit block reads of `.env`, private keys, cloud credential stores
and similar, plus a set of destructive shell patterns and zero-prompt remote package runners.
These are enforced by Claude Code's permission layer, not by the model's cooperation.

They are defence in depth, not a sandbox — [`../SECURITY.md`](../SECURITY.md) documents the
coverage honestly, including the shapes it does **not** catch.
