---
name: security-scan
description: Use for dependency audits, secret scans, SAST, container/filesystem scans, and release security checks. Do not use for low-risk UI-only tasks.
when_to_use: Use when dependency audit, secret scan, SAST, or container security review is needed. Auto-trigger on auth/payment/DB/API/secrets/CI/release changes, or explicit user request.
allowed-tools: Read, Grep, Glob, Bash
model: sonnet
effort: medium
argument-hint: "[task or target]"
context: fork
agent: security-scanner
---

# security-scan

Trigger: auth/payment/DB/API/secrets/CI/release changes, or explicit user request. Skip for UI-only tasks.

1. Dependency audit (detect package manager): `pnpm audit` | `npm audit --audit-level=moderate` | `bun audit` | `pip-audit` | `cargo audit` | `govulncheck ./...`
2. Secret scan: `gitleaks detect --source . --no-banner --redact` (missing → continue with available tools).
3. SAST: `semgrep scan --config auto .` (missing → continue). Container/filesystem: `trivy fs .` (missing → note it).

## Output

Group findings CRITICAL → HIGH → MEDIUM → LOW. Redact all secrets, tokens, connection strings — never print raw keys, passwords, or connection strings.
End with: tools run | tools missing | overall risk assessment
Complements `security-review` (manual auth/payment/injection logic review) — this skill runs automated tooling only.
