---
name: safe-review
description: Manually invoke to review the current diff or specified files for bugs, regressions, missing tests, security, and data-loss risks.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke before merging or deploying to do a read-only review of the current diff or specified files.
model: claude-sonnet-5
effort: high
argument-hint: "[task or target]"
---

# safe-review

Review: $ARGUMENTS. Manual override for a deeper, sonnet-level pass before merge/deploy — for the auto-firing review that runs after every meaningful change, see `code-review`.

Focus (in order):

1. Correctness bugs and regressions
2. Authorization and ownership gaps
3. Input validation missing at boundary
4. Data loss risk
5. Injection vulnerabilities
6. Race conditions and transaction safety
7. Performance problems (N+1, unnecessary rerenders, missing indexes)
8. Missing tests for changed behavior

Output per finding: SEVERITY (critical/high/medium/low) | FILE:LINE | description | fix
Do not edit files. Return only actionable findings.
