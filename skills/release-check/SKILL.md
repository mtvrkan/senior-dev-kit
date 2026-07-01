---
name: release-check
description: Use before release/deploy to check build, tests, migrations, env vars, changelog, and rollback notes.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for pre-release safety review, but do not deploy.
argument-hint: "[version or release scope (optional)]"
---

# release-check

Auto-fires for pre-release safety review — for a manual, opus-level gate you invoke yourself right before deploy, use `release-gate` instead. Output GO / NO-GO for each item:

1. BUILD: clean build with no errors?
2. TESTS: all tests passing? Any skipped/flaky tests that matter?
3. MIGRATIONS: pending migrations? Are they safe to run on production data?
4. ENV/CONFIG: new env vars required? Are they documented and configured in all environments?
5. SECURITY: auth/payment/secrets changes present? Security scan completed?
6. BREAKING CHANGES: any API, schema, or behavior changes that affect consumers?
7. ROLLBACK PLAN: how to revert if this release fails?
8. KNOWN RISKS: anything uncertain or untested?

Final: GO / NO-GO | summary | blockers list
Do not deploy. Do not run migrations. Report only.
