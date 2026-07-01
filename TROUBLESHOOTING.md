# Senior Dev Kit — Troubleshooting

Common setup problems and their fixes.

---

## Installation problems

### `bash install.sh` returns "Permission denied"

```bash
chmod +x install.sh
bash install.sh
```

Or run directly without making it executable: `bash install.sh`

---

### PowerShell blocks `.\install.ps1` — "running scripts is disabled"

Run this once as Administrator, then retry:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### `install.sh --detect` picks wrong preset

The auto-detect reads `package.json`, `requirements.txt`, `go.mod` etc. in the **current directory**. Make sure you are inside your project root when running:

```bash
cd /path/to/my-project
bash /path/to/senior-dev-kit/install.sh --detect
```

---

### Files installed to wrong location

The default target is `~/.claude/` (global). To install to a specific project instead, copy manually:

```bash
# From your project root:
cp -r /path/to/senior-dev-kit/agents     .claude/agents
cp -r /path/to/senior-dev-kit/skills     .claude/skills
cp -r /path/to/senior-dev-kit/commands   .claude/commands
cp -r /path/to/senior-dev-kit/rules      .claude/rules
cp -r /path/to/senior-dev-kit/agent_docs .claude/agent_docs
```

---

## VERIFY.md check failures

### FAIL — `CLAUDE.md` missing

You need a `CLAUDE.md` at the project root (or `~/.claude/CLAUDE.md` for global install). Pick the right preset:

```bash
cp presets/web/nextjs-saas/CLAUDE.md ~/.claude/CLAUDE.md
```

Or run `SETUP.md` in Claude Code which auto-generates it.

---

### FAIL — agent count is 16, expected 17

One agent file was not copied. Re-copy the agents folder:

```bash
# Mac / Linux
cp senior-dev-kit/agents/* .claude/agents/

# Windows
Copy-Item senior-dev-kit\agents\* .claude\agents\ -Force
```

Then re-run VERIFY.md.

---

### FAIL — skill count is less than 32

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

### `/smart-task` or `/plan-first` not recognized

**Cause:** Command files are missing from `.claude/commands/`.

**Fix:**

```bash
cp senior-dev-kit/commands/* .claude/commands/
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

Valid model IDs (check for typos):

- `claude-sonnet-5`
- `claude-opus-4-8`
- `claude-haiku-4-5-20251001`
- `claude-fable-5`

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

1. Run VERIFY.md inside Claude Code: `Read VERIFY.md and run all checks on this project.`
2. Check the project's GitHub Issues
3. Open a fresh session and paste the error message
