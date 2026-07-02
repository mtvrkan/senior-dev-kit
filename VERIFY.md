# Senior Dev Kit — Installation Verification

Read this file and perform each check in order. Report results as [OK] / [FAIL].

> **Shortcut:** instead of counting files by hand, open Claude Code in the project and run `/smart-task verify kit installation` — Claude performs the checks below and reports the counts (see [UPGRADE.md — After upgrading](UPGRADE.md#after-upgrading--run-verifymd)). The manual steps below remain the source of truth.

**PROJECT** = The project root currently open in Claude Code (current working directory)

---

## 1 — Required Files

For each one: does it exist?

```text
PROJECT/CLAUDE.md
PROJECT/.claude/settings.json
PROJECT/.claude/agents/
PROJECT/.claude/skills/
PROJECT/.claude/commands/
PROJECT/.claude/rules/
PROJECT/.claude/stack-rules.md
```

---

## 2 — Agent Count

Count the `.md` files in `PROJECT/.claude/agents/`.
Expected: **18** (17 agents + `ROUTING.md`, which is a routing reference, not an agent)

Expected agent names (17):
academic-writer.md, architect.md, bug-hunter.md, db-guard.md, devops-guard.md,
docs-writer.md, migration-guard.md, performance-guard.md, researcher.md,
reviewer.md, security-guard.md, security-scanner.md, senior-engineer.md,
strategist.md, test-engineer.md, ui-fixer.md, writer.md

Plus `ROUTING.md` (decision tree reference, not counted as an agent).

---

## 3 — Skill Count

Count the `SKILL.md` files in `PROJECT/.claude/skills/`.
Expected: **34**

Expected subdirectories:
academic-write, api-design, api-versioning, article-write, bug-fix, code-audit, code-review,
data-modeling, db-change, deep-research, dep-check, docs-update, env-audit,
feature-build, feature-plan, from-scratch, kit-doctor, llm-integration, migration-review,
monorepo-task, new-page, new-screen, performance-check, plan-first, refactor-safe,
release-check, release-gate, safe-review, security-review, security-scan,
smart-task, strategy-plan, test-writer, ui-change

---

## 4 — Slash Command Count

Count the `.md` files in `PROJECT/.claude/commands/`.
Expected: **13**

Expected:
agents-guide.md, article-write.md, deep-research.md, dep-check.md, kit-doctor.md,
performance-check.md, plan-first.md, release-gate.md, safe-review.md,
security-scan.md, seo-check.md, smart-task.md, strategy-plan.md

---

## 5 — Rules Count

Count the `.md` files in `PROJECT/.claude/rules/`.
Expected: **11**

Expected:
000-security.md, 001-conventions.md, 100-web.md, 200-api.md,
300-testing.md, 400-mobile.md, 500-database.md, 600-devops.md,
700-observability.md, 800-llm-safety.md, 900-performance.md

---

## 6 — Agent Docs

Does `PROJECT/.claude/agent_docs/` exist? Count the `.md` files in it.
Expected: **15**

Expected:
academic-writing-guide.md, api-design-patterns.md, api-versioning-guide.md,
architecture.md, dep-check-guide.md, design-system.md, env-audit-guide.md,
error-handling-patterns.md, from-scratch-guide.md, new-page-guide.md,
new-screen-guide.md, security-protocols.md, seo-patterns.md, testing-strategy.md,
zero-downtime-migration.md

---

## 7 — CLAUDE.md Quality

Read the `PROJECT/CLAUDE.md` file. Does it contain:

- [ ] "TOKEN TIER" table
- [ ] "AGENT ROUTING" table
- [ ] "BOOT SEQUENCE" section
- [ ] "HARD STOPS" — escalation rules
- [ ] "AUTO-TEST + VERIFICATION" section
- [ ] "SECURITY" section (OWASP 2025 or PASSIVE SCAN)

---

## 8 — stack-rules.md Content

Read the `PROJECT/.claude/stack-rules.md` file.

- [ ] Not empty (at least 100 characters)
- [ ] Contains "## preset:" heading

---

## 9 — Critical Agent Quality

Read the `PROJECT/.claude/agents/security-guard.md` file:

- [ ] `model: claude-opus-4-8` present
- [ ] `permissionMode: plan` present
- [ ] HARD CONSTRAINTS section present (at start AND end — U-shaped)

Read the `PROJECT/.claude/agents/ui-fixer.md` file:

- [ ] `model: claude-haiku-4-5-20251001` present
- [ ] HARD CONSTRAINTS section present

Read the `PROJECT/.claude/agents/senior-engineer.md` file:

- [ ] `model: claude-sonnet-5` present

Read the `PROJECT/.claude/agents/devops-guard.md` file:

- [ ] `model: claude-opus-4-8` present
- [ ] `permissionMode: plan` present

---

## 10 — Skill allowed-tools Correctness

Read the following skill files and check the `allowed-tools` line:

Should be read-only (Edit/Write **should NOT** be included):

- `PROJECT/.claude/skills/security-review/SKILL.md` → `allowed-tools: Read, Grep, Glob, Bash`
- `PROJECT/.claude/skills/migration-review/SKILL.md` → `allowed-tools: Read, Grep, Glob, Bash`
- `PROJECT/.claude/skills/feature-plan/SKILL.md` → `allowed-tools: Read, Grep, Glob, Bash`
- `PROJECT/.claude/skills/performance-check/SKILL.md` → `allowed-tools: Read, Grep, Glob, Bash`
- `PROJECT/.claude/skills/release-check/SKILL.md` → `allowed-tools: Read, Grep, Glob, Bash`

---

## 11 — Global Installation (optional but recommended)

Does `%USERPROFILE%\.claude\CLAUDE.md` (Windows) or `~/.claude/CLAUDE.md` (macOS/Linux) exist?

- Does it contain: "Global Claude Senior Protocol"

`%USERPROFILE%\.claude\rules\` (or `~/.claude/rules/`) — 11 files present?

`%USERPROFILE%\.claude\agent_docs\` (or `~/.claude/agent_docs/`) — 15 files present?

`%USERPROFILE%\.claude\settings.json` — `CLAUDE_CODE_SUBAGENT_MODEL` env var present?

Otherwise: [WARN] Global installation not completed — apply SETUP.md Step 5.

---

## Summary

Write [OK] or [FAIL] for each check.

If [FAIL]: specify which step is missing and how to fix it.
E.g.: "FAIL — rules/ folder missing → re-run SETUP.md Step 2d."

If all checks [OK]: "Installation complete. You can start with `/smart-task [task]`."
