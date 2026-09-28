---
name: feature-plan
description: Use before implementing large, multi-file, architecture or system-design, or unclear features. Produces a detailed plan; no code.
allowed-tools: Read, Grep, Glob, Bash
disallowed-tools: Edit, Write, NotebookEdit
when_to_use: Use automatically before any code when scope is large, unclear, or risky.
argument-hint: "[feature — goal, constraints, affected areas if known]"
effort: high
---

# feature-plan

Produce a detailed, executable plan for multi-file/risky features. No code edits, wait for confirmation. Auto-fires for clear feature work (the request names a thing to build); also fits non-feature risky work (refactors, config/infra, ambiguous "make X better" asks) when invoked directly. Runs inline in the main loop — it needs the conversation and the user's answers, which a forked subagent has neither of. Tier 3+ / protected-area work runs under native plan mode (read-only) with this output format; a DB/auth/payment/CI slice of the plan goes to its guard for review rather than being planned here. If the feature description lacks a goal or scope, fill `OPEN:` with the missing questions instead of guessing.

## Output format

```text
GOAL: [≤10 words] | NON-GOALS: [excluded] | RISK: low|medium|high|critical — [why]
PROTECTED: [auth|payment|DB|secrets|CI|none] | GUARD: [db-guard|security-guard|devops-guard|none]
AFFECTED: `exact/file` — [modify|create] — [why]
STEPS:
  [P:A] `exact/file` — [fn name+sig | endpoint+DTO | component+props]
  [P:A] `exact/file` — [independent of above]
  [P:B] `exact/file` — [depends on A]
CONTRACT: API→[method path req→res] | UI→[component props state] | DB→[model fields migration]
VERIFY: [exact command] | ROLLBACK: [strategy | n/a] | OPEN: [questions | none]
```

Rules: read the recorded architecture first (`PROJECT-CONTRACTS.md` / `.claude/codebase-overview.md` / project `CLAUDE.md`) and place every new file inside it; a plan that quietly crosses an existing boundary is where a project's second architecture starts. Adding a module, layer or package → `/arch-check` before planning, so the plan starts from the real boundary state. grep/glob to confirm paths before listing. Every step specific enough to hand to an engineer. Mark `[P:GroupName]` on independent steps. Do not start coding.
