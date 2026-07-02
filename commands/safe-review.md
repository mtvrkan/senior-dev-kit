---
description: Review the current diff or a target for correctness, security, and consistency.
argument-hint: "[target — defaults to current diff]"
---

# /safe-review

Review the current diff or target: $ARGUMENTS

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
