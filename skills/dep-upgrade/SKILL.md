---
name: dep-upgrade
description: Use to upgrade a dependency across a major version or migrate between libraries — framework majors, ORM or test-runner majors, deprecated packages — with the breaking changes read, not guessed.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically when the user asks to upgrade, bump or migrate a dependency to a new major, or when security-scan reports an outdated major that must move.
argument-hint: "[package] [from → to]"
effort: high
---

# dep-upgrade

`security-scan` finds what is outdated and never upgrades. This skill does the upgrade, one package family per change.

1. READ FIRST: the official migration guide and changelog for every major between current and target (WebFetch the official migration guide, or ask the user to run `/deep-research`). List each breaking change that applies to this codebase — grep for the renamed APIs, removed options and changed defaults before editing anything.
2. SCOPE: one package family per change (`react` + `react-dom` together, not with the router). Peer-dependency ranges and the runtime version (Node, Python, JDK) checked against the target.
3. CODEMODS first when the project publishes them, then the manual list from step 1. Each fix is the smallest one the guide prescribes; no refactors on the way.
4. LOCKFILE: regenerate with the project's package manager, never hand-edit. Then run the dependency audit per 000-security.
5. VERIFY: type-check, full test suite (a major is the exception to targeted tests), build, and the app started once. A test changed to pass must be named in the output with the reason.
6. Build, CI, Docker base image or auth library involved → HARD STOPS apply before step 3.

## Output

```text
UPGRADE: [pkg] [from] → [to] | GUIDE: [url]
BREAKING: [change] — [files affected] ✓ (one per line)
VERIFY: typecheck ✓ | tests ✓ N | build ✓ | audit ✓
CHANGED TESTS: [none | test — why]
```
