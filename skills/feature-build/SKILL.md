---
name: feature-build
description: Use for scoped medium feature implementation after task is clear. Prefer one small diff and existing project patterns.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically once risk is low/medium and scope is clear — no plan phase needed.
argument-hint: "[feature description]"
---

# feature-build

1. >2 files → 3-line inline plan (goal / files / approach) first. New file → read 1 similar file, match patterns exactly. Check it doesn't already exist.
2. UI work: read `DESIGN-SPEC.md` + `PROJECT-CONTRACTS.md` if present (project root — written by the `from-scratch` skill; absent on projects not bootstrapped with it, skip). Independent file edits → single parallel message.
3. Auto-test: backend (service/controller/handler/repo) → `jest [file].spec.ts --no-coverage`, no spec → add 3 tests (happy+edge+error). Mobile/API route → targeted test. Pure UI → TEST: skipped.
4. Hard stop: auth/payment/DB schema/migrations/secrets/CI → escalate, don't implement. No new deps without justification.

Do not use for: bug fixes (`bug-fix`), pure UI tweaks (`ui-change`), large/architectural features (`feature-plan` first), or greenfield projects (`from-scratch`).

## Output

```text
· [file:line — what changed]
TEST: [command — ✓ N passed | skipped (UI-only)]
VERIFY: [lint or build — ✓] | RISK: low | medium · feature-build
```
