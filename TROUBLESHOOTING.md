# Senior Dev Kit — Troubleshooting

Common setup problems and their fixes.

---

## Installation problems

### `/plugin install` doesn't register the agents/skills

Confirm the marketplace was added first (`/plugin marketplace add mtvrkan/senior-dev-kit`) and that `/plugin install senior-dev-kit@senior-dev-kit` completed without error. Remember the plugin only covers `agents/`, `skills/`, `commands/`, and the protected-path hook — it does not install `rules/`, `agent_docs/`, or `global-CLAUDE.md`. For those, run `SETUP.md` Step 5 (see [README.md Option B](README.md#option-b--install-to-global-claude-applies-to-all-projects)).

---

### `Read SETUP.md and apply it` stops partway or asks unexpected questions

SETUP.md is written for autonomous execution — if Claude pauses to ask something not covered by the file (e.g. an ambiguous stack match), answer directly and tell it to continue from the same step. If it seems to have skipped a step, re-run: `Read SETUP.md and re-check Step [N] on this project.`

---

### Files installed to wrong location

The manual copy commands in [README.md Option C](README.md#option-c--manual-install-for-a-single-project) target the current project's `.claude/`. To install globally instead, replace every `.claude/` destination with `~/.claude/` (macOS/Linux) or `$env:USERPROFILE\.claude\` (Windows), or just run `SETUP.md` Step 5.

---

## Verification check failures (SETUP.md Step 6)

### FAIL — `CLAUDE.md` missing

You need a `CLAUDE.md` at the project root (or `~/.claude/CLAUDE.md` for global install). Pick the right preset:

```bash
cp presets/web/nextjs-saas/CLAUDE.md ~/.claude/CLAUDE.md
```

Or run `SETUP.md` in Claude Code which auto-generates it.

---

### FAIL — agent count is not 13 (12 agents + `ROUTING.md`)

One agent file was not copied. Re-copy the agents folder:

```bash
# Mac / Linux
cp senior-dev-kit/agents/* .claude/agents/

# Windows
Copy-Item senior-dev-kit\agents\* .claude\agents\ -Force
```

Then re-run SETUP.md Step 6.

---

### FAIL — skill count is less than 23

You may have an older installation. Re-copy the skills folder:

```bash
cp -r senior-dev-kit/skills/. .claude/skills/
```

---

### FAIL — rules count is less than 11

Re-copy the rules folder to get all 11 rules:

```bash
cp senior-dev-kit/rules/* .claude/rules/
```

---

### FAIL — `stack-rules.md` is empty or missing

Generate it manually. Example for Next.js + Prisma + PostgreSQL:

```bash
# Mac / Linux
cat presets/web/nextjs-saas/compact.md   >  .claude/stack-rules.md
cat presets/orm/prisma/compact.md        >> .claude/stack-rules.md
cat presets/database/postgres/compact.md >> .claude/stack-rules.md

# Windows
Get-Content presets\web\nextjs-saas\compact.md   | Set-Content .claude\stack-rules.md
Get-Content presets\orm\prisma\compact.md        | Add-Content .claude\stack-rules.md
Get-Content presets\database\postgres\compact.md | Add-Content .claude\stack-rules.md
```

Or run SETUP.md inside Claude Code — it generates `stack-rules.md` automatically.

---

### FAIL — `security-guard.md` missing `permissionMode: plan`

You likely have an old agent file. Re-copy from kit:

```bash
cp senior-dev-kit/agents/security-guard.md .claude/agents/
```

---

## Routing problems

### Claude isn't using the right agent

**Symptom:** You say "fix this bug" but Claude doesn't route to `bug-hunter`.

**Cause:** The routing table in `CLAUDE.md` is missing or malformed.

**Fix:** Check your `CLAUDE.md` contains the `## AGENT ROUTING` table with the signal-to-agent mappings. If missing, re-generate from `global-CLAUDE.md`:

```bash
cp senior-dev-kit/global-CLAUDE.md ~/.claude/CLAUDE.md
```

---

### Claude ignores the agent routing and does everything itself

**Cause:** Claude Code is not loading agents from `.claude/agents/`. This happens when:

1. Files are in the wrong location (project vs. global)
2. Agent frontmatter is malformed

**Fix:**

1. Confirm agent files are in `.claude/agents/` for project or `~/.claude/agents/` for global
2. Check that each agent `.md` starts with `---` frontmatter block

---

### `/agents-guide`, `/seo-check`, or a skill shortcut not recognized

**Cause:** Command files are missing from `.claude/commands/`, or skill directories are missing from `.claude/skills/`.

**Fix:**

```bash
cp senior-dev-kit/commands/* .claude/commands/
cp -r senior-dev-kit/skills/* .claude/skills/
```

---

### Security-guard doesn't stop before writing code

**Cause:** `permissionMode: plan` missing from `security-guard.md`.

**Fix:** Re-copy `agents/security-guard.md` from the kit. Confirm this line exists:

```yaml
permissionMode: plan
```

---

## Settings and permissions problems

### Claude is reading `.env` files

**Cause:** `settings.json` deny list is missing or incomplete.

**Fix:** Copy the settings template:

```bash
cp senior-dev-kit/settings-template.json .claude/settings.json
```

And confirm these entries exist in the `permissions.deny` array:

```json
".env", ".env.*", "*.pem", "*.key", "*.p12", "secrets/"
```

---

### Claude Code asks for permission on every file read

The `settings.json` deny list only blocks writes/reads to sensitive paths. This is expected behavior for new Claude Code users — Claude Code asks for permission on tool use until you set your permission mode to `auto`.

To enable auto-mode: in Claude Code, run `/permissions` and enable automatic tool use for your project.

---

## Validation errors

### `npm run validate` fails with "missing frontmatter"

A `SKILL.md` is missing the `---` frontmatter block. Open the failing file and check the top:

```yaml
---
description: What this skill does
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---
```

Both opening and closing `---` lines are required.

---

### `npm run validate` fails with "invalid model id"

Use a generic alias (check for typos) — this is the default going forward:

- `opus`
- `sonnet`
- `haiku`
- `fable`
- `inherit`

Full dated IDs are still accepted for deliberate pinning:

- `claude-sonnet-5`
- `claude-opus-4-8`
- `claude-haiku-4-5-20251001`
- `claude-fable-5`

An ID that looks like a Claude model (`claude-...`) but isn't in this list only produces a warning, not a failure — if it's a newly released model, add it to `VALID_MODELS` in `scripts/validate-skills.ts` and to CONTRIBUTING.md.

---

### `npm test` fails — "Cannot find module"

Make sure you have Node.js 22+:

```bash
node --version   # must be v22.x.x or higher
```

---

## Windows-specific problems

### Paths with backslashes break scripts

Claude Code on Windows uses forward-slash paths in `.claude/` paths. Always use forward slashes in CLAUDE.md and settings.json:

```json
"deny": [".env", ".env.*"]
```

Not:

```json
"deny": [".\\env", ".\\env.*"]
```

---

### `cp` command not found in PowerShell

PowerShell uses `Copy-Item`, not `cp`. All Windows commands in this kit use the PowerShell syntax. If you see a `cp` command in an example, the equivalent is:

```powershell
Copy-Item source destination -Recurse -Force
```

---

### `~/.claude/` resolves to wrong directory

On Windows, `~` maps to `$env:USERPROFILE`. Confirm:

```powershell
echo $env:USERPROFILE   # should be C:\Users\YourName
ls $env:USERPROFILE\.claude
```

---

## Version mismatch problems

For the full upgrade procedure (what changes between versions, how to merge customizations), see [UPGRADE.md](UPGRADE.md).

### How to check which version is installed

```bash
# Check kit version (what you have):
head -1 CHANGELOG.md

# Check what's in your project:
head -3 .claude/stack-rules.md  # shows ## preset: ... · kit: v[N.N] if generated by SETUP.md
```

---

### After upgrading, Claude still behaves like the old version

Restart your Claude Code session (close and reopen the project). Claude Code loads `.claude/` files at session start. Changes to files mid-session are not picked up until a restart.

---

## Still stuck?

1. Run `SETUP.md` Step 6 inside Claude Code: `Read SETUP.md and run Step 6 (Verify installation) on this project.`
2. Check the project's GitHub Issues
3. Open a fresh session and paste the error message
