---
name: refactor-safe
description: Use for safe refactors that preserve behavior. Keep diffs small and verification strong.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically only for refactors that must preserve behavior.
argument-hint: "[file or module to refactor]"
---

# refactor-safe

Behavior must be identical before and after. If tests don't exist: write them FIRST, then refactor.

1. One concern per diff: rename | move | extract | restructure — never combine two.
2. Run tests before edit, record baseline. Apply ONE mechanical transformation only. Run same tests after — must be identical pass/fail.
3. Diffs >150 lines → split into sequential mini-refactors. No features/bugfixes in same diff.
4. Read budget: refactored file + grep for symbol importers + existing test file. Imports updated across independent files → apply in one parallel batch.

## Output

```text
CONCERN: [rename | move | extract | restructure]
· [files changed — count]
TEST BEFORE: [N passed] → TEST AFTER: [N passed — ✓ identical]
RISK: low
```
