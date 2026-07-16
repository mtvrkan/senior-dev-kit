---
name: code-audit
description: Audits codebase health — god files, dead code, duplication, inconsistent patterns, hardcoded values. Read-only, no edits. Invoke via /code-audit.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke to audit code quality or technical debt across the codebase (not a single diff — use code-review for that; not a specific concern like deps/secrets/env/perf — use security-scan/env-audit/performance-check instead).
argument-hint: "[scope: all | path]"
context: fork
agent: reviewer
effort: medium
---

# code-audit

Read-only codebase health scan. For a diff use `code-review`; for deps/secrets/env/perf use the matching specialist skill instead.

No scope given → default to files changed since the last release tag (`git diff <last-tag>`, or `git diff main` if untagged). Scan the full tree only when the user explicitly says "all"/"whole codebase". Triage with `wc -l`/`grep -c` via Bash to shortlist candidates before Read-ing full file contents — never Read the whole tree file-by-file.

1. GOD FILES: services/modules >300 lines — flag for split.
2. DEAD CODE: unused exports, unreachable branches, stale commented-out blocks.
3. ERROR HANDLING: empty/swallowed catch blocks, inconsistent error shapes across similar handlers.
4. DUPLICATION: near-identical logic (~15+ lines) that should be a shared function.
5. INCONSISTENT PATTERNS: the same operation implemented differently across files.
6. HARDCODED VALUES: magic numbers/strings that belong in config or constants.

## Output

```text
FINDING: [category] | file:line | description | suggested fix
SEVERITY: critical (hides bugs/security risk) | high (blocks maintainability) | medium | low (style)
SUMMARY: god-files:[N] dead-code:[N] duplication:[N] hardcoded:[N]
TOP 3 PRIORITIES: 1. ... 2. ... 3. ...
```

Report only — never edit files.
