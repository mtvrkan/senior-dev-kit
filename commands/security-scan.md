---
description: Run or plan a security scan for auth, payment, DB, API, secrets, or CI changes.
argument-hint: "[target]"
---

# /security-scan

Run or plan a security scan for: $ARGUMENTS

Trigger: auth/payment/DB/API/secrets/CI/release changes, or explicit request.
Do NOT run for UI-only tasks.

Scan sequence:

1. Dependency audit: `pnpm audit` / `npm audit --audit-level=moderate` / `pip-audit` / `cargo audit`
2. Secret scan: `gitleaks detect --source . --no-banner --redact`
3. SAST: `semgrep scan --config auto .`
4. Container/filesystem: `trivy fs .`

Rules:

- Do not install tools automatically — list missing tools with install commands.
- Group findings: CRITICAL → HIGH → MEDIUM → LOW
- Never print secrets, tokens, keys, or connection strings.
- End with: tools run | tools missing | overall risk assessment
