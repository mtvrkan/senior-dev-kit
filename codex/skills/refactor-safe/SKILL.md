---
name: refactor-safe
description: "Use for safe refactors that preserve behavior. Keep diffs small and verification strong. Use automatically only when the change must leave behavior identical."
---

# refactor-safe

Behavior must be identical before and after. If tests don't exist: write them FIRST, then refactor.

1. One concern per diff: rename | move | extract | restructure — never combine two.
2. Run tests before edit, record baseline. Apply ONE mechanical transformation only. Run same tests after — must be identical pass/fail.
3. Diffs >150 lines → split into sequential mini-refactors. No features/bugfixes in same diff.
4. Read budget: refactored file + grep for symbol importers + existing test file. Imports updated across independent files → apply in one parallel batch.

5. Refactor that moves a module boundary (extract, restructure): run `$arch-check` before and after. The point of a boundary refactor is that violations go down — unmeasured, "cleaner" is an opinion.

Deep reference: `KIT_ROOT/agent_docs/testing-strategy.md` (baseline coverage before refactor) · `KIT_ROOT/agent_docs/architecture.md` (module boundary rules).

## Output

```text
CONCERN: [rename | move | extract | restructure]
· [files changed — count]
TEST BEFORE: [N passed] → TEST AFTER: [N passed — ✓ identical]
RISK: low
```
