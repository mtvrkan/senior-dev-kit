---
name: security-review
description: "Use for auth, permissions, payment, secrets, input validation, session/token handling, SQL/NoSQL injection, and sensitive user data. Use automatically whenever a change touches any security-sensitive area in the description's list."
---

# security-review

> Codex: run this skill in the `security-guard` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.

This skill forks into `security-guard` (frontmatter), so the guard's body is co-loaded — work
through its "What to review" checklist top-to-bottom (authentication → authorization → input
validation → injection → secrets → data protection → rate limiting → OWASP 2025 specifics)
and report in its Output format; neither is restated here.

ESCALATE: flag to user for approval before any auth/payment architecture change; hand implementation to senior-engineer once approved, otherwise none.
Never print actual secret values. Complements `security-scan` (automated dep/secret/SAST/container tooling) — this is the manual logic review; both may fire on the same change.
