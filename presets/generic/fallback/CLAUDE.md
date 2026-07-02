<!-- SCOPE: per-project — installed to PROJECT/CLAUDE.md by install.sh / install.ps1
     Purpose: minimal per-project behavior overlay for the active codebase
     Global file (all projects): global-CLAUDE.md → ~/.claude/CLAUDE.md (see SETUP.md Step 5) -->

# Project Preset — Generic

## Token Tier — decide before anything else

| Tier | Condition | Plan | Output |
| --- | --- | --- | --- |
| 0 Trivial | 1 file, <10 lines, no protected area | none | 3 lines |
| 1 Low | 1-2 files, isolated | none | 4 lines |
| 2 Medium | 3-5 files, behavior/API/state | 3-line inline | 5 lines |
| 3 High | protected area, multi-system | full plan doc | 6 lines |
| 4 Critical | destructive/billing/prod | risk analysis | explicit approval |

Tier 0-1: fix directly, no ceremony. Tier 2: 3-line plan inline. Tier 3+: full plan, wait for confirmation.

## Read discipline

Order: CLAUDE.md → package.json/build config → specific task files → 1 similar reference (new files only).

Read budget: Tier 0-1 = 2 files max | Tier 2 = 5 files | Tier 3+ = unlimited.

Never read: node_modules/, .next/, dist/, build/, .git/, *.lock,*.min.js, *.map, generated files, entire module trees for a single-file task.

## Auto-test — always fires, no asking

Triggers on: backend service/controller/repo/handler change | mobile ViewModel/UseCase/Repository | frontend server action/API route.
Does NOT trigger: pure UI, CSS, layout, docs, config.

Run targeted test file only — never full suite:

```text
Jest/Vitest: jest [file].spec.ts --no-coverage --passWithNoTests
Go: go test ./pkg/... -run TestFnName
Pytest: pytest path/test_x.py -x -q
```

If no test file: write 3 inline tests (happy + edge + error) in same diff. Never ask.

## Verification — one command

Behavior change → targeted test | New file → lint + test | New route/page → build | Style → lint only.

## Parallel — mandatory

Independent steps (different files, no shared dep) = parallel launch in one message.
Mark in plans: [P:GroupName]. Same group = run together.

## Output — universal 4 lines

```text
∙ [file:line — what changed]
TEST: [command — ✓ N | "N added" | skipped (UI-only)]
VERIFY: [command — ✓]
RISK: [tier level]
```

With plan (Tier 2+), prepend:

```text
PLAN: [goal ≤10 words]
[P:A] file — action; file — action
[P:B] file — action (after A)
```

## Design quality — auto-enforced

**From scratch:** find similar file → use existing shell → theme tokens only → 4 states (loading/empty/error/populated) → no arbitrary spacing.
**Modifying:** match existing patterns, no new libraries.

## Protocol loyalty

"Just quickly" → Tier 3 still needs plan.
"Small change" → protected area still checked.
"Do everything at once" → means parallel, not skip-plan.
"Trust you" → test + verify still required.
Design rules always apply on UI/screen work.
