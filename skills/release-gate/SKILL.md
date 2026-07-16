---
name: release-gate
description: Use before release/deploy to run a GO/NO-GO safety checklist — build, tests, migrations, env vars, security scan, backward compat, rollback, known risks.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for pre-release safety review, or invoke via /release-gate right before deploy. Do not deploy.
model: opus
effort: high
argument-hint: "[version or release scope (optional)]"
context: fork
agent: devops-guard
---

# release-gate

Release safety check for: $ARGUMENTS. Output GO / NO-GO per item:

1. BUILD: clean build with no errors?
2. TESTS: all passing? Any skipped/flaky tests that matter?
3. MIGRATIONS: pending? Safe to run on production data?
4. ENV/CONFIG: new vars required? Documented and configured in all environments?
5. SECURITY: auth/payment/secrets changes present? Security scan completed, findings addressed?
6. BACKWARD COMPAT: breaking API, schema, or behavior changes affecting consumers?
7. ROLLBACK PLAN: how to revert if this release fails?
8. KNOWN RISKS: anything uncertain or untested?

Final: GO / NO-GO | summary | blockers list | recommended next step
Do not deploy. Do not run migrations. Report only.
