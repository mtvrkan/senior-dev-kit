---
name: security-review
description: Use for auth, permissions, payment, secrets, input validation, session/token handling, SQL/NoSQL injection, and sensitive user data.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for auth, authorization, payment, validation, injection, secrets, sessions, tokens, and sensitive data.
---

# security-review

Check in this order:

1. Authentication bypass: can unauthenticated requests reach protected endpoints?
2. Authorization gaps: are ownership/role checks enforced server-side on every route?
3. Injection: SQL, NoSQL, XSS, command injection — any unsanitized input reaching a sink?
4. Secrets exposure: hardcoded keys, tokens in logs, sensitive data in error messages?
5. Input validation: is all input validated at the API/server boundary?
6. Session/token safety: expiry, rotation, secure/httpOnly flags, JWT validation?
7. Rate limiting: are sensitive endpoints (login, password reset, payment) rate-limited?
8. File operations: upload type/size validation, path traversal prevention?

Output: SEVERITY (critical/high/medium/low) | FILE:LINE | vulnerability description | recommended fix
ESCALATE: security-guard if the fix requires an auth/payment architecture change, otherwise none.
Never print actual secret values. Complements `security-scan` (automated dep/secret/SAST/container tooling) — this is the manual logic review; both may fire on the same change.
