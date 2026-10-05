# Install

Two supported ways in. Pick one — **not both** (see [Don't mix the two](#dont-mix-the-two)).

| | Plugin | `~/.claude` |
| --- | --- | --- |
| Steps | 3 lines, all inside Claude Code | clone + one command |
| Updates | `/plugin marketplace update`, then `/kit-setup` again | `git pull` + rerun |
| Needs a terminal | no | yes |
| Needs Node | yes, 18+ on `PATH` — the plugin's hooks run `node` | yes, 18+ |
| Best for | almost everyone | you want the files in your own settings dir, or you want to edit them |

---

## Option 1 — plugin (recommended)

Inside Claude Code, type:

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
/kit-setup
```

That's the whole install. The first two lines bring in the agents, skills and commands. The third
is a one-time step that exists for a structural reason, not a packaging oversight: Claude Code
loads path-scoped rules and permission rules **only** from your settings directory, and a plugin
is not allowed to write there.

`/kit-setup` will:

1. Run the installer in dry-run mode and show you the output verbatim.
2. State exactly what it is about to write, and wait for you to say yes. It never proceeds on
   silence.
3. Copy `rules/*.md` into `~/.claude/rules/`, merge the deny rules into
   `~/.claude/settings.json`, and set `attribution` so commits and PRs carry no Claude trailer —
   merge, not replace: your own `allow`, `ask`, any `attribution` you already set, and every other
   key are left alone.
4. Tell you the backup directory it wrote to.

Then restart Claude Code (or `/reload-plugins`) so the new rules load, and run `/kit-doctor` to
confirm.

The plugin also needs **Node.js 18 or newer** on your `PATH`: it registers a `SessionStart` hook
that loads the kit's protocol into every session and a `PreToolUse` hook that runs on every
`Agent`/`Task` call, and both are `node` scripts.

After a plugin update, run `/kit-setup` again: the rules and settings it copied into your settings
directory do not update with the plugin.

### Verify it worked

```text
/kit-doctor
```

It reports what is actually on disk rather than what should be. `/agents-guide` and
`/skills-guide` list the components now available to you.

---

## Option 2 — install into `~/.claude`

Requires **Node.js 18 or newer**. There are no dependencies to install. The `--dry-run` line
prints every file it would touch and writes nothing; the last line is the same run, for real:

```bash
git clone https://github.com/mtvrkan/senior-dev-kit.git
cd senior-dev-kit
node scripts/install.mjs --dry-run
node scripts/install.mjs
```

The dry run is not decoration — read it. It prints the target directory, the file count, and how
many deny rules would be added, before anything is written.

### What it will and won't do to your existing setup

| Your file | What happens |
| --- | --- |
| `~/.claude/CLAUDE.md` | The kit's protocol is inserted between `<!-- BEGIN senior-dev-kit -->` markers. Anything you wrote outside those markers is preserved, and reinstalling replaces only the marked block. |
| `~/.claude/settings.json` | The deny rules are merged into `permissions.deny`; `attribution` is set to hide the Claude commit/PR trailer; a PreToolUse hook that makes every subagent call name its `model` is added next to your own hooks. A key you already set is never overwritten — the dry run says "yours wins". Your `allow`, `ask`, env vars and every other key are untouched, and `--uninstall` removes only the entries the kit added. |
| Any other file it overwrites | Copied into `~/.claude/.senior-dev-kit/backups/<timestamp>/` first. |

### Flags

| Flag | Does |
| --- | --- |
| `-n`, `--dry-run` | Show what would change; write nothing |
| `-y`, `--yes` | Skip the confirmation prompt (CI and scripted setups) |
| `--target DIR` | Install into `DIR` instead of `~/.claude` / `$CLAUDE_CONFIG_DIR` |
| `--only LIST` | Install a subset: `agents,skills,commands,rules,agent_docs,presets,protocol,deny-rules,settings,statusline`. `statusline` (model · folder · branch · context %) is opt-in and never replaces a `statusLine` you already have |
| `--check` | Report whether the installed copy still matches this checkout; exit 1 if it drifted. Writes nothing |
| `--uninstall` | Remove everything a previous run wrote |
| `--allow-duplicate-protocol` | Override the duplicate-protocol guard — see [Troubleshooting](troubleshooting.md) |
| `-h`, `--help` | The same list, from the installer itself |

---

## Option 3 — one project only, no global install

Copy the preset for your stack into the project:

```bash
cp presets/web/nextjs-saas/CLAUDE.md /path/to/project/CLAUDE.md
```

**Installed as a plugin and don't have the repo cloned?** The presets shipped with it anyway —
Claude Code checks the whole repository out into the plugin directory. Ask in a session: *"copy
the Laravel preset from this plugin into my project's CLAUDE.md"*; the plugin root is available
as `${CLAUDE_PLUGIN_ROOT}`, and `/kit-doctor` prints its absolute path if you'd rather copy the
file yourself.

For a project spanning several stacks, concatenate the relevant `compact.md` files instead of
picking one full `CLAUDE.md` — see [`../presets/README.md`](../presets/README.md) for which
combinations make sense.

This gives you the house rules for that project with none of the agents, skills or deny rules.

## Starting a brand-new project

[`../PROJECT-BOOTSTRAP.md`](../PROJECT-BOOTSTRAP.md) is a different tool for a different job: drop
it into an empty repo and have Claude Code read it, and it generates a `.claude/` tailored to the
project you are about to build rather than installing this kit's own agents.

---

## Don't mix the two

Installing the plugin **and** running a full Option 2 install gives you every agent, skill and
command twice — once from the plugin, once from `~/.claude`. With the plugin installed, the only
part you still need is the part a plugin cannot deliver — the installer detects an enabled plugin
and defaults to exactly that:

```bash
node scripts/install.mjs --only rules,deny-rules,settings
```

which is exactly what `/kit-setup` runs for you.

---

## Uninstall

```bash
node scripts/install.mjs --uninstall
```

Removes the files the installer wrote, strips the marked protocol block out of
`~/.claude/CLAUDE.md`, and removes the deny rules it added — leaving anything you wrote yourself
in place. Backups stay in `~/.claude/.senior-dev-kit/backups/` until you delete them.

For a plugin install where you also ran `/kit-setup`, undo that first, while the plugin is still
installed: those rules and settings live in your settings directory, not in the plugin, and the
installer that removes them ships inside the plugin. `/kit-doctor` prints the plugin's absolute
root (it sits under `~/.claude/plugins/`); run the installer from there:

```bash
node "<plugin root>/scripts/install.mjs" --uninstall
```

If the plugin is already gone, clone the repository and run `node scripts/install.mjs --uninstall`
from the clone instead. Then remove the plugin the way you added it, from inside Claude Code:

```text
/plugin
```
