---
name: security-scan
description: "Use for dependency audits (CVEs, outdated majors, paid licenses, bloat), secret scans, SAST, and container/filesystem scans. Not for low-risk UI-only tasks. Auto-trigger on a dependency add/update, before a release, or on explicit request."
---

# security-scan

> Codex: run this skill in the `security-guard` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.

A plain auth/DB/API code change is security-review's job, not a repo-wide scanner run; performing an upgrade this scan recommends is `dep-upgrade`.

Trigger: dep add/update, auth/payment/DB/API/secrets/CI/release changes, or explicit user request. Skip for UI-only tasks.

1. Dependency audit (detect package manager): `pnpm audit` | `npm audit --audit-level=moderate` | `bun audit` | `pip-audit` | `cargo audit` | `govulncheck ./...`
2. Dependency hygiene (full audits, not single-dep adds): outdated majors (breaking risk), paid licenses (flag — never silently keep; free alternatives in `KIT_ROOT/agent_docs/dep-check-guide.md`), unused/bloat.
3. Secret scan: `gitleaks detect --source . --no-banner --redact` (missing → continue with available tools).
4. SAST: `semgrep scan --config auto .` (missing → continue). Container/filesystem: `trivy fs .` (missing → note it).

## Output

Group findings CRITICAL → HIGH → MEDIUM → LOW. Redact all secrets, tokens, connection strings — never print raw keys, passwords, or connection strings.
Dep findings: `package@version: CVE — fix` | outdated majors: `current→latest — breaking risk` | `PAID LICENSE: package — alt: X`.
End with: tools run | tools missing | overall risk assessment | ESCALATE: [security-guard code review — if a critical CVE has no patch | none]
Never auto-remove or upgrade — report only. Never `npm audit fix --force`. Paid-license flags block until the user confirms.
Complements `security-review` (manual auth/payment/injection logic review) — this skill runs automated tooling only.
