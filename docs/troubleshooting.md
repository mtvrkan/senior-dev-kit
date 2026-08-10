# Troubleshooting

Start here: run `/kit-doctor` inside Claude Code. It reports what is actually on disk rather than
what the documentation says should be, which resolves most of the entries below in one step.

---

## Nothing changed after installing

**The plugin installed but the rules didn't.** A plugin cannot write into your settings
directory, so a plugin-only install has agents, skills and commands but no path-scoped rules and
no deny list. Run `/kit-setup` once, then restart Claude Code.

**The rules installed but nothing reloaded.** Rules are read at session start. Restart Claude
Code, or run `/reload-plugins`, then start a new session.

**You are in a project with its own `CLAUDE.md`.** Project instructions beat global ones by
design. If the project file contradicts the kit, the project wins — that is the intended
precedence, not a bug.

---

## Everything appears twice

You installed the plugin *and* ran a full `node scripts/install.mjs`. Both copies load, so every
agent, skill and command is duplicated and the protocol is charged to your context twice per
turn.

Fix: remove the `~/.claude` copy and keep the plugin.

```bash
node scripts/install.mjs --uninstall
node scripts/install.mjs --only rules,deny-rules
```

The first line removes everything the installer wrote; the second puts back only the part the
plugin genuinely cannot deliver.

---

## The installer stopped and told me to delete a line

You have an unmarked, verbatim copy of the protocol already sitting in `~/.claude/CLAUDE.md` —
usually from pasting it in by hand at some point. Appending a second copy would load the whole
protocol twice on every turn, so the installer refuses and names the line to remove.

Delete the old copy and rerun. If you genuinely want both — you almost certainly do not — the
override is `--allow-duplicate-protocol`.

---

## A guard keeps blocking work I want done

That is the design: guards are read-only by tool grant and produce a plan instead of an edit.
Approving the plan ("looks good", "proceed") hands it to an implementer.

If a request is being routed to a guard that shouldn't own it, the tie-break rules are in
[`../agents/ROUTING.md`](../agents/ROUTING.md) — the common surprise is that a guarded noun beats
the task verb, so "fix the CSS in the login form" is treated as auth work.

---

## A command I ran was denied

The kit ships roughly 400 deny rules. They are enforced by Claude Code's permission layer, so a
denial is not the model being cautious — the call never happened.

To see which of your own historical commands would be affected before or after adopting the list:

```bash
npm run deny-cost
```

It replays your real transcript history against the rules and reports what would have been
blocked, so you can tune a rule whose matches are legitimate for your workflow. On the
development machine the figure was 20 commands out of 10,753.

Individual rules live in `settings-template.json` (and, after install, in
`~/.claude/settings.json`). Removing one is a normal thing to do; [`../SECURITY.md`](../SECURITY.md)
explains what each category is protecting against so you can decide.

---

## Skills I expected to auto-trigger never do

Four skills are marked `disable-model-invocation: true` and will never start on their own:
`/deep-research`, `/env-audit`, `/kit-doctor`, `/kit-setup`. Type the command.

For the rest, auto-invocation is Claude Code's own matcher against each skill's description — if
one consistently doesn't fire for a request you think it should, that is a description-quality
issue worth reporting.

---

## `npm run check` fails on a fresh clone

```bash
npm ci        # not `npm install` — the lockfile is the source of truth
npm run check
```

`npm run check` runs every step even when an earlier one fails, so the summary at the end lists
every broken step rather than stopping at the first. Node 24+ is required for the validators
(the *installer* alone runs on Node 18+).

If only `audit` is red, you are looking at a dependency advisory rather than a repo defect; it is
last in the gate for exactly that reason.

---

## `npm run check-release` fails

It is not part of `npm run check` and it is not asserting anything about your working tree. It
checks that the **published** repository is reachable anonymously — that the install commands in
the documentation actually work for a stranger. Offline, or on a fork, it will fail through no
fault of yours.

---

## Still stuck

Open an issue with the output of `/kit-doctor` and, if the problem is install-shaped, the output
of:

```bash
node scripts/install.mjs --dry-run
```

Neither prints secrets — the dry run lists paths and counts only.
