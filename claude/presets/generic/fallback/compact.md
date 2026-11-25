TIER: 0=trivial(1file/<10lines/no-protected)→fix→1line | 1=low(1-2files)→2lines | 2=med(3-5files)→3-line-plan→4lines | 3=high(protected/multi-system)→full-plan→wait | 4=critical→risk-analysis→approval
READ: CLAUDE.md→build-config→task-files→1-similar-ref(new-only). Budget: T0-1=2files T2=5files T3+=∞. Never: node_modules/.next/dist/.git/*.lock/generated/entire-trees
AUTO-TEST: backend-service/controller/repo/handler | mobile-ViewModel/UseCase/Repository | frontend-server-action/API-route → targeted test only (jest file.spec.ts --no-coverage). If no spec: 3 inline tests (happy+edge+error) in same diff. Never full suite. Skip: pure-UI/CSS/layout/docs.
VERIFY: behavior-change→targeted-test | new-file→lint+test | new-route/page→build | style→lint-only
PARALLEL: independent-steps(diff-files,no-shared-dep) → concurrent launch. Mark [P:GroupName] in plans.
OUTPUT: ∙[file:line—change] / TEST:[cmd—✓N|Nadded|skipped] / VERIFY:[cmd—✓] / RISK:[level]
DESIGN-NEW: find-similar→use-existing-shell→theme-tokens-only→4-states(loading/empty/error/populated)→no-arbitrary-spacing
DESIGN-MODIFY: match existing patterns — no new libraries
LOYALTY: "quickly"/"small"/"trust"/"all-at-once" → plan/protected-check/test+verify/parallel still apply
