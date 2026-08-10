# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Claude Code configuration kit that makes the assistant behave like a senior engineering team
instead of an eager junior: **7 agents, 25 skills, 11 rules, 3 commands, 28 presets**.

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
  script). Everything else — 11 rule files, 16 reference docs — loads lazily when a matching
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
| Agent | 7 | 4 are read-only guards (db, security, devops, performance) |
| Skill | 25 | Most auto-trigger on task shape; a few are slash-command only |
| Rule | 11 | `000`/`001` load every session; the other 9 load on a `paths:` glob match |
| Command | 3 | `/agents-guide`, `/skills-guide`, `/seo-check` |
| Preset | 28 | web: nextjs-saas, react-vite, nuxt, sveltekit, astro, angular · backend: node-express, nestjs, fastapi, django, laravel, rails, spring-boot, dotnet, go-api, rust-axum · mobile: flutter, react-native, swiftui · orm: prisma, drizzle · db: postgres, mongodb, supabase · infra: docker, kubernetes, terraform · generic: fallback |
| agent_docs | 16 | Deep reference pages, read on demand |

In short: 7 agents, 25 skills, 11 rules, 3 commands, 28 presets.

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

Currently: 335/335 tests passing (54 suites). `routing-eval` pins 26 realistic requests against
the routing table, `check-consistency` re-derives every hand-written number in this file, and
`check-plugin` verifies the plugin manifests still match the components on disk.

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

## License

[MIT](LICENSE) © Mehmet Türkan
