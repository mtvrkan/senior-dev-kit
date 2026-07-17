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

`settings-template.json` in the repo is the template you install into a project as `.claude/settings.json` (Options B/C/D all copy it verbatim on first install). Your installed copy then diverges as you customize `permissions.allow` for your own workflow.

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

## After upgrading — verify

Open Claude Code and run:

```text
/kit-doctor
```

Or manually follow [SETUP.md Step 6](SETUP.md#step-6--verify-installation) to confirm all counts are correct.

---

## Upgrading to 2.0 (from 1.x)

2.0 is a consolidation release: no capability was removed, but several
1.x agents/skills/commands were merged into a broader sibling and the
shell/PowerShell installer layer was replaced by the plugin marketplace +
`SETUP.md`. If your project's `.claude/` was installed from 1.x, delete these
before copying in the 2.0 files — leaving them behind doesn't break anything
(they're just dead weight), but a stale `agents/migration-guard.md` sitting
next to the new `db-guard.md` can confuse a fresh contributor into thinking
both are still live routing targets.

**Delete these files/folders if present in your project's `.claude/`:**

```text
agents/migration-guard.md          → merged into agents/db-guard.md
agents/security-scanner.md         → merged into agents/security-guard.md
agents/academic-writer.md          → out of scope, removed
agents/writer.md                   → out of scope, removed
agents/strategist.md               → out of scope, removed

skills/api-versioning/             → merged into skills/api-design/
skills/data-modeling/              → merged into skills/db-change/
skills/dep-check/                  → merged into skills/security-scan/
skills/plan-first/                 → merged into skills/feature-plan/
skills/release-check/              → merged into skills/release-gate/
skills/safe-review/                → merged into skills/code-review/
skills/llm-integration/            → dropped (covered by rules/800-llm-safety.md)
skills/monorepo-task/              → dropped (routing is native now)
skills/smart-task/                 → dropped (routing is native now)
skills/academic-write/             → out of scope, removed
skills/article-write/              → out of scope, removed
skills/strategy-plan/              → out of scope, removed

commands/deep-research.md          → skills/deep-research auto-triggers now
commands/dep-check.md              → skills/security-scan auto-triggers now
commands/kit-doctor.md             → skills/kit-doctor still exists (invoke via /kit-doctor)
commands/performance-check.md      → skills/performance-check auto-triggers now
commands/plan-first.md             → skills/feature-plan auto-triggers now
commands/release-gate.md           → skills/release-gate auto-triggers now
commands/safe-review.md            → skills/code-review auto-triggers now
commands/security-scan.md          → skills/security-scan auto-triggers now
commands/smart-task.md             → dropped (routing is native now)
commands/article-write.md          → out of scope, removed
commands/strategy-plan.md          → out of scope, removed

agent_docs/academic-writing-guide.md → out of scope, removed

INSTALL.md                         → folded into README.md Option C
VERIFY.md                          → folded into SETUP.md Step 6
install.sh / install.ps1 / bin/    → replaced by the plugin marketplace / SETUP.md
scripts/install.test.ts            → installer removed, test removed with it
settings.json (repo root)          → was a duplicate of settings-template.json

examples/django-postgres.md, dotnet-postgres.md, fastapi-sqlalchemy-postgres.md,
java-spring-postgres.md, kotlin-android-firebase.md, laravel-mysql.md,
nestjs-prisma-postgres.md, nuxt-drizzle-postgres.md, rails-postgres.md,
rust-axum-postgres.md, swift-ios-supabase.md
                                    → trimmed to one walkthrough per platform
                                      class; the dropped stacks' guidance still
                                      lives in their presets/*/CLAUDE.md
```

**If you installed via the plugin marketplace:** nothing to do manually — updating
the plugin replaces the whole `agents/`/`skills/`/`commands/` tree, so deleted
files simply stop being present.

**If you installed manually (Option C) or via the old installer:** run through the
delete list above, then re-copy `agents/`, `skills/`, `commands/`, `rules/`, and
`agent_docs/` per the "Safe update" section above.

**If you previously installed the `protected-paths` hook (any version before this
one):** it has been removed from the kit — deterministic protected-path enforcement
is now limited to `settings-template.json`'s Read-tool and Bash-read-verb deny
rules (see `SECURITY.md`). Delete your local `~/.claude/hooks/protected-paths.mjs`
and `~/.claude/hooks/lib/` (or the project-local `.claude/hooks/` equivalent), and
remove the `protected-paths.mjs` entries from `hooks.PreToolUse`/`hooks.PostToolUse`
in `settings.json` — a dangling hook command pointing at a deleted file will error
on every matching tool call.

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
