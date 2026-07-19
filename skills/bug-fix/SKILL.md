---
name: bug-fix
description: Use for localized bugs, runtime errors, white screens, failing tests, console errors, and regressions. Make the smallest safe fix.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically when something that worked is now broken and the cause is localizable.
argument-hint: "[error message, stack trace, or failing test]"
---

# bug-fix

Read error → root cause → smallest fix → test → done.

1. Read stack trace / error / failing test first. Open ONLY files in the stack trace or directly symptom-related.
2. Fix the smallest responsible code path. Run targeted test — no test exists → add 1 regression test. Non-obvious fix → one-line comment explaining why.
3. Escalate immediately: auth/session/token/payment → security-guard | DB corruption/schema/migration → db-guard.

Deep reference: `agent_docs/error-handling-patterns.md` — typed error hierarchies, boundary handling, retry/fallback patterns.

## Output

```text
ROOT: [what and where]
FIX: [file:line — what changed]
TEST: [command — ✓ | regression test added]
RISK: low | medium
```
