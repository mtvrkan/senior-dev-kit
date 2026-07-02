# Senior Dev Kit — Upgrade Guide

How to update `.claude/` in your project when a new version of the kit is released.

---

## Check your current version

```bash
# Mac / Linux
head -1 .claude/stack-rules.md    # shows: ## preset: [stack] · kit: v[N.N]

# Windows PowerShell
(Get-Content .claude\stack-rules.md -TotalCount 1)
```

Compare against the latest version tag in this repo's CHANGELOG.md.

---

## What changes between versions

| Change type | Files affected | How to update |
| --- | --- | --- |
| Bug fix in an agent | `agents/[name].md` | Copy new file, overwrite existing |
| New skill added | `skills/[name]/SKILL.md` | Copy new skill folder |
| Rule updated | `rules/[NNN]-[name].md` | Copy new file, overwrite existing |
| New rule file | `rules/[NNN]-[name].md` | Copy new file, no conflict |
| agent_docs improved | `agent_docs/[name].md` | Copy new file, overwrite |
| global-CLAUDE.md updated | `CLAUDE.md` in project root | Merge manually — your project may have customizations |
| ROUTING.md changed | `agents/ROUTING.md` | Overwrite — no project-specific content |

---

## Safe update (non-breaking changes)

Agent files, skill files, rule files, agent_docs — these have no project-specific content. Overwrite freely:

**Mac / Linux:**

```bash
# From the repo root, with your project open at ./my-project

# Update agents
cp agents/* my-project/.claude/agents/

# Update skills
cp -r skills/* my-project/.claude/skills/

# Update rules
cp rules/* my-project/.claude/rules/

# Update agent_docs
cp agent_docs/* my-project/.claude/agent_docs/

# Update commands
cp commands/* my-project/.claude/commands/
```

**Windows PowerShell:**

```powershell
Copy-Item agents\* my-project\.claude\agents\ -Force
Copy-Item -Recurse skills\* my-project\.claude\skills\ -Force
Copy-Item rules\* my-project\.claude\rules\ -Force
Copy-Item agent_docs\* my-project\.claude\agent_docs\ -Force
Copy-Item commands\* my-project\.claude\commands\ -Force
```

---

## Manual merge required

These files may have project-specific customizations — don't blindly overwrite:

### `CLAUDE.md` (project root)

The project CLAUDE.md is generated from `global-CLAUDE.md` + your stack preset. If you've added project-specific rules, merge manually:

1. Open your project `CLAUDE.md` and `global-CLAUDE.md` side by side
2. Copy any changed sections from `global-CLAUDE.md` into your project's CLAUDE.md
3. Keep your project-specific additions (team rules, architecture notes, custom escalation paths)

Key sections to check after each release:

- `## AGENT ROUTING` table (new agents may have been added)
- `## HARD STOPS` list (new protected areas may have been added)
- `## AUTO-TEST + VERIFICATION` table (new stacks may have been added)
- `## SECURITY` section (OWASP list updates)

### `settings.json`

Two files in the repo look alike but have different jobs: `settings.json` is the kit's reference copy (it's what `npm run validate` checks and what the docs describe), while `settings-template.json` is the starting copy you install into a project as `.claude/settings.json`. The two are kept content-identical in the repo except that only the reference copy sets `env` — your installed copy then diverges as you customize it.

On upgrade, compare `settings-template.json` from the new release against your `.claude/settings.json`:

1. Add any new `permissions.deny` entries from the template.
2. Keep your own allow/deny additions — merge, never replace the file wholesale.

### `stack-rules.md`

Regenerate from the new preset:

```bash
# Copy updated preset + append your project-specific rules
cat presets/web/nextjs-saas/CLAUDE.md > .claude/stack-rules.md
echo "" >> .claude/stack-rules.md
echo "## Project-specific rules" >> .claude/stack-rules.md
cat .claude/project-rules.md >> .claude/stack-rules.md  # if you have one
```

---

## After upgrading — run VERIFY.md

Open Claude Code and run:

```text
/smart-task verify kit installation
```

Or manually follow VERIFY.md to confirm all counts are correct.

---

## Changelog — what to check before upgrading

Always read CHANGELOG.md before upgrading. Look for:

- **BREAKING:** means a file was renamed/removed — you may need to delete old files
- **ADDED:** new file — copy it in
- **CHANGED:** existing file updated — overwrite
- **FIXED:** bug fix — overwrite

Breaking changes will always include a migration note in CHANGELOG.md.

---

## Staying current (automated)

To get notified of new releases without manual checking:

- Watch the GitHub repo (Watch → Releases only)
- Or add the repo to your RSS reader via `[repo-url]/releases.atom`

There is no automatic update mechanism — changes to `.claude/` must always be reviewed before applying.

---

## If something breaks after upgrading

See [TROUBLESHOOTING.md — Version mismatch problems](TROUBLESHOOTING.md#version-mismatch-problems) for version checks and the session-restart requirement after `.claude/` changes.
