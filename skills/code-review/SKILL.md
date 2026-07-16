---
name: code-review
description: Use to review diffs without editing code. Focus on bugs, regressions, security risks, data loss, missing validation, missing tests, and performance risks.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically after meaningful changes or when the user asks for review.
argument-hint: "[files or diff scope (optional — defaults to recent changes)]"
context: fork
agent: reviewer
effort: high
---

# code-review

Review for actionable risks only. Skip subjective style. Read changed files + directly imported deps only. Auto-fires after meaningful changes; also invocable directly via `/code-review` for a deliberate pre-merge pass. If the diff touches a guarded domain (auth/payment/DB/CI), raise effort and escalate per the last line.

Do not use for: a dedicated, exhaustive security audit (`security-review`) — items (5) and (7) below are an inline sanity check on the diff, not a substitute for one; whole-repo health scans (`code-audit`); dependency CVE checks (`security-scan`); pre-release gating (`release-gate`); or a deep performance investigation (`performance-check`) — item (10) below is a quick flag, not a profiling pass.

Review order: (1) correctness bugs — logic errors, off-by-one, wrong condition, unhandled null/undefined. (2) regressions — breaks behavior callers depend on? (3) breaking changes — endpoint removed/renamed, required field added → grep for callers. (4) missing validation — unvalidated input reaching DB or executing code. (5) auth gaps — unauthenticated access, missing ownership check, role bypass.
(6) data loss — overwriting without backup, missing transaction, destructive op. (7) injection — SQL/NoSQL/XSS/command via unsanitized input. (8) race conditions — non-atomic check-then-act, missing lock. (9) missing tests — behavior changed with no test update. (10) performance — N+1, expensive loop, unnecessary full-table scan.

Severity: `critical (ship blocker) | high (fix before merge) | medium | low` — format: `SEVERITY | file:line | issue | fix`

```text
Critical:[N] High:[N] Medium:[N] Low:[N]
BREAKING CHANGES: [N — list | none]
VERDICT: ship ✓ | fix critical first | needs work
ESCALATE: [security-guard | db-guard | none]
```
