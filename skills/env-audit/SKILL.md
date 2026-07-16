---
name: env-audit
description: Audits environment variables across the codebase — missing declarations, leaked defaults, unused vars, .env.example drift. Invoke via /env-audit.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Manually invoke when setting up a new environment, debugging "undefined env var" errors, onboarding, or before a production deployment.
argument-hint: "[scope: all | frontend | backend | missing-only]"
context: fork
agent: devops-guard
effort: medium
---

# env-audit

Map all environment variables, find gaps, ensure .env.example is complete. See `agent_docs/env-audit-guide.md` for grep commands by language, .env.example format, and the var classification table.

1. Grep all source files for env var access (process.env, os.getenv, os.Getenv, dotenv, etc.). Read `.env.example` / `.env.template` / `.env.sample`.
2. Build SET A (used in code) vs SET B (declared in .env.example). A-B = missing, B-A = unused. Classify each: REQUIRED | OPTIONAL_DEFAULT | OPTIONAL_FEATURE | UNUSED | SECRET.
3. Add missing vars to .env.example: `# [Required|Optional] — [what it does]\nKEY=`. Flag exposure risks: NEXT_PUBLIC_/VITE_ secrets, hardcoded secrets, console.log(process.env), .env in git.

## Output

```text
MISSING from .env.example: KEY_NAME — [file:line] — [REQUIRED|OPTIONAL]
UNUSED in .env.example: KEY_NAME — [consider removing]
SECURITY RISKS: ⚠ [pattern — risk — fix]
SUMMARY: Used:[N] Documented:[N] Missing:[N] Unused:[N] Risks:[N]
.env.example updated: [yes — N vars added | no changes needed]
```
