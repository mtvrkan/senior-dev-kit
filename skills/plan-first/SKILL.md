---
name: plan-first
description: Manually invoke before risky or multi-file work to force plan-first behavior and prevent premature edits.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke before any risky, multi-file, or high-tier task to force plan-first behavior.
model: claude-opus-4-8
effort: high
argument-hint: "[task or target]"
---

# plan-first

Plan this work safely: $ARGUMENTS. No code edits — produce plan, then wait for "go". Manual override to force deep, opus-level planning on any risky or ambiguous-scope task (not just features — see `feature-plan` for the auto-firing feature-specific version).

## Output format

```text
GOAL: [≤10 words] | NON-GOALS: [excluded] | RISK: [high|critical] — [what breaks if wrong]
PROTECTED: [auth|payment|DB|secrets|CI|none] | GUARD: [agent|none]
AFFECTED: `exact/file` — [modify|create] — [reason]
STEPS:
  [P:A] `exact/file` — [fn name+sig | endpoint+DTO | component+props]
  [P:A] `exact/file` — [independent — can parallel]
  [P:B] `exact/file` — [depends on A]
CONTRACT: API→[method path req→res errors] | DB→[model fields migration] | UI→[component props state]
VERIFY: [exact command] | ROLLBACK: [undo steps | additive-only] | OPEN: [questions | none]
```

Rules: grep/glob first — all paths must be real. Mark `[P:GroupName]` on independent steps.
