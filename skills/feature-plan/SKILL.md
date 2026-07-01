---
name: feature-plan
description: Use before implementing large, multi-file, architecture, DB, auth, payment, or unclear features. Produces a detailed plan; no code.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically for large, unclear, risky, or multi-file features that need a plan before code.
argument-hint: "[feature to plan]"
---

# feature-plan

Produce a detailed, executable plan for multi-file/risky features. No code edits, wait for confirmation. Auto-fires for clear feature work — for non-feature or ambiguous-scope tasks, use `plan-first` instead.

## Output format

```text
GOAL: [≤10 words] | NON-GOALS: [excluded] | RISK: low|medium|high|critical — [why]
PROTECTED: [auth|payment|DB|secrets|CI|none] | GUARD: [db-guard|security-guard|migration-guard|none]
AFFECTED: `exact/file` — [modify|create] — [why]
STEPS:
  [P:A] `exact/file` — [fn name+sig | endpoint+DTO | component+props]
  [P:A] `exact/file` — [independent of above]
  [P:B] `exact/file` — [depends on A]
CONTRACT: API→[method path req→res] | UI→[component props state] | DB→[model fields migration]
VERIFY: [exact command] | ROLLBACK: [strategy | n/a] | OPEN: [questions | none]
```

Rules: grep/glob to confirm paths before listing. Every step specific enough to hand to an engineer. Mark `[P:GroupName]` on independent steps. Do not start coding.
