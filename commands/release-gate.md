---
description: Run a pre-release safety checklist with a GO / NO-GO verdict per item.
argument-hint: "[release or version]"
---

# /release-gate

Prepare a release safety check for: $ARGUMENTS

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
