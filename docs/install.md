# Install

Two supported ways in. Pick one — **not both** (see [Don't mix the two](#dont-mix-the-two)).

| | Plugin | `~/.claude` |
| --- | --- | --- |
| Steps | 3 lines, all inside Claude Code | clone + one command |
| Updates | `/plugin marketplace update` | `git pull` + rerun |
| Needs a terminal | no | yes |
| Needs Node | no (except the one-time `/kit-setup`) | yes, 18+ |
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
3. Copy `rules/*.md` into `~/.claude/rules/` and merge the deny rules into
   `~/.claude/settings.json` — merge, not replace: your own `allow`, `ask` and every other key
   are left alone.
4. Tell you the backup directory it wrote to.

Then restart Claude Code (or `/reload-plugins`) so the new rules load, and run `/kit-doctor` to
confirm.

### Verify it worked

```text
/kit-doctor
```

It reports what is actually on disk rather than what should be. `/agents-guide` and
`/skills-guide` list the components now available to you.

---

## Option 2 — install into `~/.claude`

Requires **Node.js 18 or newer**. There are no dependencies to install.

```bash
git clone https://github.com/mtvrkan/senior-dev-kit.git
cd senior-dev-kit
node scripts/install.mjs --dry-run   # prints every file it would touch, writes nothing
node scripts/install.mjs             # same run, for real
```

The dry run is not decoration — read it. It prints the target directory, the file count, and how
many deny rules would be added, before anything is written.

### What it will and won't do to your existing setup

| Your file | What happens |
| --- | --- |
| `~/.claude/CLAUDE.md` | The kit's protocol is inserted between `<!-- BEGIN senior-dev-kit -->` markers. Anything you wrote outside those markers is preserved, and reinstalling replaces only the marked block. |
| `~/.claude/settings.json` | The deny rules are merged into `permissions.deny`. Your `allow`, `ask`, env vars and every other key are untouched. |
| Any other file it overwrites | Copied into `~/.claude/.senior-dev-kit/backups/<timestamp>/` first. |

### Flags

| Flag | Does |
| --- | --- |
| `-n`, `--dry-run` | Show what would change; write nothing |
| `-y`, `--yes` | Skip the confirmation prompt (CI and scripted setups) |
| `--target DIR` | Install into `DIR` instead of `~/.claude` / `$CLAUDE_CONFIG_DIR` |
| `--only LIST` | Install a subset: `agents,skills,commands,rules,agent_docs,presets,protocol,deny-rules` |
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
part you still need is the part a plugin cannot deliver:

```bash
node scripts/install.mjs --only rules,deny-rules
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

For a plugin install, remove it the way you added it, from inside Claude Code:

```text
/plugin
```

Then run the `--uninstall` command above if you also ran `/kit-setup`, since those rules live in
your settings directory rather than in the plugin.
