# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Claude Code configuration kit that makes the assistant behave like a senior engineering team
instead of an eager junior: **7 agents, 25 skills, 11 rules, 3 commands, 9 presets**.

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

### Option 1 — plugin (recommended)

Inside Claude Code:

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
```

Then run `/kit-setup` once. That step exists because Claude Code only auto-loads path-scoped
rules and permission rules from your settings directory, and a plugin cannot write there. It
shows you exactly what it will do, waits for a yes, and backs up anything it touches.

That's it — agents, skills, and commands come from the plugin and update with
`/plugin marketplace update`.

### Option 2 — install into `~/.claude`

Requires **Node.js 18+**. No dependencies to install.

```bash
git clone https://github.com/mtvrkan/senior-dev-kit.git
cd senior-dev-kit
node scripts/install.mjs --dry-run   # see exactly what would change
node scripts/install.mjs             # then do it
```

The installer never destroys anything you already had:

| Your file | What happens |
| --- | --- |
| `~/.claude/CLAUDE.md` | The kit's protocol is added inside `<!-- BEGIN senior-dev-kit -->` markers. Everything you wrote outside them is preserved, and reinstalling replaces only the marked block. |
| `~/.claude/settings.json` | The kit's deny rules are **merged** into `permissions.deny`. Your `allow`, `ask`, and every other key are untouched. |
| Any other file it overwrites | Copied to `~/.claude/.senior-dev-kit/backups/<timestamp>/` first. |

Useful flags: `--only rules,deny-rules` (the plugin already covers the rest), `--target DIR`,
`--yes` for scripted setups, and `--uninstall` to reverse everything it wrote.

Two things worth knowing before you run it:

- **Don't do both Option 1 and a full Option 2.** You would get every agent, skill, and command
  twice — once from the plugin, once from `~/.claude`. With the plugin installed, the only part
  you still need is `--only rules,deny-rules`, which is exactly what `/kit-setup` runs.
- **Upgrading from a pre-2.2 install?** If your `~/.claude/CLAUDE.md` is a verbatim copy of an
  older `global-CLAUDE.md` (what the old instructions told you to do), the installer stops and
  names the line to delete instead of appending a second copy — otherwise every session would
  load the protocol twice.

### Option 3 — one project only

Copy `presets/<category>/<stack>/CLAUDE.md` to your project's `CLAUDE.md`. For a project
spanning several stacks, concatenate the relevant `compact.md` files instead — see
[`presets/README.md`](presets/README.md).

### Starting a brand-new project

Drop [`PROJECT-BOOTSTRAP.md`](PROJECT-BOOTSTRAP.md) into an empty repo and have Claude Code read
it. It generates a project-specific `.claude/` rather than installing the kit's own agents.

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

---

## What you get

| | Count | Notes |
| --- | --- | --- |
| Agent | 7 | 4 are read-only guards (db, security, devops, performance) |
| Skill | 25 | Most auto-trigger on task shape; a few are slash-command only |
| Rule | 11 | `000`/`001` load every session; the other 9 load on a `paths:` glob match |
| Command | 3 | `/agents-guide`, `/skills-guide`, `/seo-check` |
| Preset | 9 | web: nextjs-saas, react-vite · backend: node-express, nestjs, fastapi · orm: prisma · db: postgres · infra: docker · generic: fallback |
| agent_docs | 16 | Deep reference pages, read on demand |

In short: 7 agents, 25 skills, 11 rules, 3 commands, 9 presets.

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

Currently: 248/248 tests passing (50 suites). `routing-eval` pins 26 realistic requests against
the routing table, `check-consistency` re-derives every hand-written number in this file, and
`check-plugin` verifies the plugin manifests still match the components on disk.

---

## More

- [`SECURITY.md`](SECURITY.md) — threat model, deny-rule coverage, known gaps, disclosure process
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — the gate, the budgets, how to add a component
- [`CHANGELOG.md`](CHANGELOG.md) — what changed and when
- [`CLAUDE.md`](CLAUDE.md) — conventions for working on the kit itself
- [`presets/README.md`](presets/README.md) — preset structure and stack composition

## License

[MIT](LICENSE) © Mehmet Türkan
