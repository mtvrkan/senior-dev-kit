# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Claude Code configuration kit that makes the assistant behave like a senior engineering team
instead of an eager junior: **8 agents, 25 skills, 12 rules, 6 commands, 28 presets**.

🇹🇷 [Türkçe README](README.tr.md)

---

## The problem it solves

Out of the box, Claude Code will happily rewrite your auth middleware, drop a column, and
refactor three unrelated files on the way to fixing a CSS bug. It has no sense of blast radius,
no house style, and no memory of what it decided yesterday.

This kit adds the three things a senior teammate has and a fresh model does not:

- **Blast-radius awareness.** Work that touches auth, payments, database schema, CI/CD, or
  secrets is routed to a read-only *guard agent* first. The guard writes a plan and stops. No
  code is written until you approve it.
- **A procedure per task shape.** "Fix this bug," "add a page," "review this migration" each
  have a written discipline the model follows instead of improvising. 25 of them.
- **A context budget.** Only three files load on every turn (capped at 500 lines, enforced by a
  script). Everything else — 12 rule files, 17 reference docs — loads lazily when a matching
  file is read or a skill actually needs it.

Everything the kit claims about itself is verified by `npm run check`, not by hand.

---

## Install

Three lines, all typed inside Claude Code:

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
/kit-setup
```

The third line is a one-time step, and it exists for a structural reason: Claude Code loads
path-scoped rules and permission rules only from your settings directory, and a plugin is not
allowed to write there. `/kit-setup` shows you exactly what it will do, waits for a yes, and
backs up anything it touches. Then restart Claude Code and run `/kit-doctor` to confirm.

That's the whole install. Updates come from `/plugin marketplace update`.

Prefer the files in your own settings directory, or want to edit them? Requires **Node.js 18+**,
no dependencies:

```bash
git clone https://github.com/mtvrkan/senior-dev-kit.git
cd senior-dev-kit
node scripts/install.mjs --dry-run   # see exactly what would change
node scripts/install.mjs             # then do it
```

Nothing you already had is destroyed: your `~/.claude/CLAUDE.md` gets the protocol inside
markers, your `settings.json` gets the deny rules merged in, and anything overwritten is backed
up first. **Don't do both** — [`docs/install.md`](docs/install.md) covers that, the flags,
per-project installs, and uninstalling.

---

## Usage

Nothing to remember after install. You describe the task; routing is automatic:

```text
"fix the broken link on the login page"   → bug-hunter
"add a settings page"                     → senior-engineer
"redesign the checkout flow"              → feature-plan (plan mode) + security-guard
"add SBOM generation to the Docker CI"    → devops-guard
"add a column to the users table"         → db-guard — writes a plan, no migration without approval
```

The full decision tree, including the tie-breaks between competing signals, is
[`agents/ROUTING.md`](agents/ROUTING.md). From inside a session, `/agents-guide` and
`/skills-guide` list what is installed, and `/kit-doctor` diagnoses a broken install.

What actually changes about a working day — blast-radius tiers, why the guards can be trusted,
what you can type — is [`docs/usage.md`](docs/usage.md).

---

## What you get

| | Count | Notes |
| --- | --- | --- |
| Agent | 8 | 4 are read-only guards (db, security, devops, performance) |
| Skill | 25 | Most auto-trigger on task shape; a few are slash-command only |
| Rule | 12 | `000`/`001` load every session; the other 10 load on a `paths:` glob match |
| Command | 6 | `/agents-guide`, `/skills-guide`, `/seo-check`, `/design-check`, `/arch-check`, `/a11y-check` |
| Preset | 28 | web: nextjs-saas, react-vite, nuxt, sveltekit, astro, angular · backend: node-express, nestjs, fastapi, django, laravel, rails, spring-boot, dotnet, go-api, rust-axum · mobile: flutter, react-native, swiftui · orm: prisma, drizzle · db: postgres, mongodb, supabase · infra: docker, kubernetes, terraform · generic: fallback |
| agent_docs | 17 | Deep reference pages, read on demand |

In short: 8 agents, 25 skills, 12 rules, 6 commands, 28 presets.

Plus a guardrail layer: ~400 deny rules in `settings-template.json` that block reads of secret
files, destructive shell commands, and zero-prompt remote package runners. Coverage and its
known gaps are documented honestly in [`SECURITY.md`](SECURITY.md) — including what it does
**not** block.

---

## How it works

1. **Every session** loads only `global-CLAUDE.md`, `rules/000-security.md`, and
   `rules/001-conventions.md`. Their combined line count is capped and script-enforced, because
   this is the cost you pay on every single turn, in every project, forever.
2. **As files are read**, the rules matching their type activate — open a `.tsx` and `100-web`
   loads; open a migration and `500-database` loads.
3. **When a task shape matches**, the corresponding skill fires. If the request touches a
   guarded area, it escalates to a guard agent, which is read-only by tool grant, not by
   convention.

---

## Verifying it

Every number in this README, every cross-file reference, and every count claim is re-derived
from disk by the test suite. One command:

```bash
npm run check
```

Currently: 393/393 tests passing (61 suites). `routing-eval` pins 31 realistic requests against
the routing table, `check-consistency` re-derives every hand-written number in this file, and
`check-plugin` verifies the plugin manifests still match the components on disk.

**What that does and does not prove.** Be clear-eyed about it: those 393 tests are *internal
consistency* tests. They prove the documentation matches the files on disk — that no count is
stale, no path is dead, no rule is claimed in one place and missing in another. **They do not
measure whether the kit improves the model's output.** Nothing that ships green in CI does.

Two steps measure behavior instead, and both are opt-in because they cost API credits:

```bash
RUN_ROUTING_EVAL=1 npm run routing-eval          # bash
$env:RUN_ROUTING_EVAL=1; npm run routing-eval    # PowerShell — no inline prefix form
```

It runs an A/B over the golden prompts — two CLI calls each: a **control** arm
with only the agent frontmatter descriptions (what Claude Code has without this kit's routing
doc) and a **treatment** arm with `agents/ROUTING.md` added, then reports the accuracy
difference between them. Three ways it fails: the treatment arm below the absolute threshold;
`ROUTING.md` fixing less than half of the routes the descriptions alone get wrong (it is loaded
into context every session, so it has to earn that); or any prompt that plain descriptions route
correctly and `ROUTING.md` breaks — checked separately, since an aggregate would let breakage
cancel against improvement.

Four of the prompts expect `none` — handle it directly, delegate to nobody. They exist because
without them the suite could not fail the way a routing document actually fails. Every prompt
used to expect *some* agent, which means a `ROUTING.md` that delegated absolutely everything
would have scored 100%: the eval could see the wrong agent and the missing one, and was blind to
the unnecessary one. That is the expensive failure — a subagent is a fresh context window that
re-reads the project to change one word — and it is the failure a document arguing for
delegation is most likely to cause.

**The measured result, 2026-08-14:** control 25/31 (81%), treatment 31/31 (100%) — all six routes
the descriptions get wrong, fixed, and none that they get right, broken. Adding the negative cases
is what widened the gap: plain agent descriptions have nothing to say about when *not* to delegate,
so `src/pages/About.tsx'te 'Kurumsal' başlığını 'Hakkımızda' yap` goes to `ui-fixer` on the strength
of the word "copy", while the treatment arm reaches `ROUTING.md`'s Step 3.5 and answers `none`.
The other routes it moves are the ones where a sentence's noun has to outrank its verb in both
directions (`fix CSS in the login form` → `security-guard`, not `ui-fixer`; but tests *for* payment
code → `senior-engineer`, not the guard). The treatment arm has scored 100% in every recorded run
and the control arm is the part that samples, which is why the bar is error reduction rather than
points of lift. Those integers live in `eval/golden-prompts.json`, and `check-consistency` fails if
this paragraph states a score that file does not — or if the recorded run stops describing the
suite on disk, which is how a previous number went stale: it was measured before a prompt was
added, and the re-run that caught up found two routes the updated table had broken. One run on one
model version; re-run it yourself if you want it fresh.

The second measurement covers the rules themselves. `behavior-eval` puts twenty decisions in
forced-choice form — escalate or edit a JWT lifetime, log the email or an opaque id, ask for a
design direction or ship the default, delete the failing test or fix the code — and runs the same
A/B: **control** with no kit context, **treatment** with the rule files that are supposed to
produce the right answer. Every rule file must be named by at least one prompt, and the gate fails
if one is not: four of them shipped unmeasured for two rounds while the suite reported a clean
score, because "the prompts that exist all pass" and "the rules that ship are all measured" are
different claims and only the first had a check.

```bash
RUN_BEHAVIOR_EVAL=1 npm run behavior-eval          # bash
$env:RUN_BEHAVIOR_EVAL=1; npm run behavior-eval    # PowerShell
```

**The measured result, 2026-08-20:** control 20/20 (100%), treatment 20/20 (100%) — no lift, and no
regression. Read that as what it is: this suite is a regression detector, not evidence that the
rules help. When the answer space is two tokens and one of them names a discipline, the base model
picks it unaided; eight further candidate prompts were piloted and control got all eight right
before they were written. Both suites are therefore gated on the share of the base model's *errors*
the kit fixes rather than on absolute points of lift — a difference between two sampled arms shrinks
toward zero as base models improve, which turns a points bar into one nothing can clear while the
kit is still working. Here control makes no errors at all, so that bar is vacuous and says so.

What this suite *can* prove it has now proved twice, and the second time is the more useful one.
`global-CLAUDE.md` and `rules/500-database.md` each produce the correct escalation alone; loaded
together they told the model to write a `DROP COLUMN` migration it refuses with no kit context at
all. That was found once and patched in the always-loaded protocol — and it came back, 3 of 3
samples, because the fix was in the wrong file. When both are in context the *procedural* one is
the more specific, and `500-database.md` shipped a zero-downtime pattern, a backup protocol and
example DROP SQL with nothing scoping them to after the approval. A model reading "escalate" in one
file and "here is how the migration is written" in the other follows the one that answers the
request. The qualifier now sits beside the procedures, in that file and in `600-devops.md`, which
had the same shape and had never been measured for it; `check-consistency` derives the obligation
from `ESCALATE TO:` appearing in a rule file at all. The recording above is a later re-run still, forced when the always-loaded protocol gained a rule this suite reads.

Both recordings carry a `context_digest` — a fingerprint of exactly what the treatment arm read,
`ROUTING.md` and the agent descriptions for one suite, the prompts and their rule files for the
other. Change any of it and `check-consistency` fails until the A/B is re-run, because a score
measured against a document that has since been rewritten is not a weaker number, it is a wrong
one. Both suites also run live on a weekly schedule
([`.github/workflows/live-evals.yml`](.github/workflows/live-evals.yml)), so a regression surfaces
without anyone remembering to look for it.

Still no A/B behind the skills or the presets, and no before/after on code quality. If you are
deciding whether to adopt this kit, weigh it accordingly.

---

## Documentation

- [`docs/install.md`](docs/install.md) — every install path, all the flags, uninstalling
- [`docs/usage.md`](docs/usage.md) — routing, tiers, the context budget, what you can type
- [`docs/reference.md`](docs/reference.md) — every agent, skill, rule and command, generated from disk
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — it installed but isn't behaving

## More

- [`SECURITY.md`](SECURITY.md) — threat model, deny-rule coverage, known gaps, disclosure process
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — the gate, the budgets, how to add a component
- [`CHANGELOG.md`](CHANGELOG.md) — what changed and when
- [`CLAUDE.md`](CLAUDE.md) — conventions for working on the kit itself
- [`presets/README.md`](presets/README.md) — preset structure and stack composition
- [`PROJECT-BOOTSTRAP.md`](PROJECT-BOOTSTRAP.md) — a separate, standalone template: hand it to Claude
  Code in an empty repo and it generates a project-specific `.claude/` setup with its own lean agent
  roster. It installs none of this kit and this kit does not install it; the two coexist if you want
  both. Not covered by the gate's executable-claim check, because the commands in it describe the
  project it generates rather than this repo.

## License

[MIT](LICENSE) © Mehmet Türkan
