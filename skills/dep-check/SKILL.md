---
name: dep-check
description: Use to audit dependencies for security vulnerabilities, outdated versions, paid-vs-free alternatives, and unnecessary bloat. Produces a prioritized action list.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use before adding a new dependency, before a release, or when asked to audit packages.
argument-hint: "[package name (optional — defaults to full audit)]"
context: fork
agent: devops-guard
effort: medium
---

# dep-check

Audit dependencies for security vulnerabilities, outdated versions, paid-vs-free alternatives, and bloat. See `agent_docs/dep-check-guide.md` for alternatives table and audit commands by runtime.

1. Read package manifest (package.json / requirements.txt / Gemfile / pubspec.yaml / etc.).
2. Run platform audit: `npm audit --audit-level=high` / `pip-audit` / `bundle audit` / `composer audit`.
3. Check each dep: security vulns, outdated major, paid license, free alternative, unused, bundle weight.

## Output

```text
VULNERABILITIES: [N critical, N high, or none] · [package@version: CVE — fix]
OUTDATED MAJORS: · [package: current→latest — breaking risk] | PAID LICENSE: · [package — alt: X]
BLOAT/UNUSED: · [package — remove|replace|keep] | PRIORITY: 1. [urgent] 2. ... | RISK: low|medium|high
ESCALATE: [security-guard — if a critical CVE has no available patch | none]
```

Never auto-remove or upgrade — report only. Paid license flags block until user confirms. Never `npm audit fix --force`.
