---
name: release-gate
description: Manually invoke before release/deploy to check tests, build, migrations, env changes, security scan, rollback, and known risks.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke before any release or production deploy to run GO/NO-GO safety checklist.
model: opus
effort: high
argument-hint: "[task or target]"
context: fork
agent: devops-guard
---

# release-gate

Prepare a release safety check for: $ARGUMENTS. Manual override to force an opus-level gate right before deploy — for the auto-firing pre-release check, see `release-check`.

Checklist — output GO / NO-GO per item:

1. BUILD/TEST: passing?
2. MIGRATIONS: pending? Safe to run on production?
3. ENV/CONFIG: new vars? Documented?
4. SECURITY SCAN: done? Findings addressed?
5. BACKWARD COMPAT: breaking API or schema changes?
6. ROLLBACK PLAN: how to revert?
7. KNOWN RISKS: anything uncertain?

Final: GO / NO-GO | blockers | recommended next step
Do not deploy.
