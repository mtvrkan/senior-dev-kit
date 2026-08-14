---
description: Audit architecture integrity — boundary violations, dependency direction, mixed patterns, contract drift.
argument-hint: "[directory, package, or feature — optional]"
---

# /arch-check

Audit the structure of what was actually built: $ARGUMENTS

The third audit command, alongside `/design-check` and `/seo-check`, and the same contract: it
does not review correctness — `/code-review` does that — it answers one question: *is this still
one architecture, or several that grew into each other?* Read `agent_docs/architecture.md` first;
the pattern table, the dependency-direction rules, the coupling signals and the `FWD:` vocabulary
are all defined there and in `rules/001-conventions.md` rather than restated here.

Architecture degrades the way design does: not in one bad decision, but in fifty small ones taken
without reference to a recorded choice. So this command starts where `/design-check` starts — with
what the project *claimed*.

**Step 1 — Find the claim.** Look for the architecture recorded in the project's `CLAUDE.md`,
`PROJECT-CONTRACTS.md`, or `.claude/codebase-overview.md`. Nothing recorded on a project with a
non-trivial `src/` is itself a finding: the pattern is re-derived from folder shape by every
session, and two sessions that read the same folders differently produce two architectures. Derive
the de facto pattern from disk so the rest of the audit has something to measure against.

**Step 2 — One architecture, not two.** Layered (`controllers/` + `services/` + `repositories/`)
and vertical-slice (`features/x/…`) both present is the mixed case `rules/001-conventions.md`
flags. Report *which directories are on which side*, so the decision the user faces is "which one
wins here", not "you have both".

**Step 3 — Dependency direction.** Every violation with file:line: repository importing a service,
domain importing a framework, shared kernel importing a feature, `packages/*` importing `apps/*`,
a cross-app import in a monorepo. These are the failures that make a codebase expensive later and
cost nothing to see now.

**Step 4 — Boundary crossings.** Feature A reaching into feature B's internals rather than its
public API; a service calling another service's repository; DB or ORM access in a controller or
route handler; business logic in a UI component; HTTP types (`req`/`res`) below the controller.

**Step 5 — Cycles and barrels.** Circular imports (`madge --circular src/` for TS/JS,
`pylint --enable=cyclic-import` for Python — run the one the project's stack supports, and say so
if neither is available rather than reporting zero). Barrel files anywhere but a module root, and
any `export *` at all.

**Step 6 — Size as a symptom, not a rule.** Files over the project's own convention (the kit's
default is 300 lines) are worth reporting only with *what* they do: a 400-line file with one
responsibility is fine, and a 200-line file with five is not. Report responsibility count, with
the line count as context.

**Step 7 — Contract drift.** Compare `PROJECT-CONTRACTS.md` (if present) with what exists: an
endpoint that ships and was never recorded, a type renamed in one layer only, a route with no
navigation entry. `rules/001-conventions.md`'s HOLISTIC CONSISTENCY table is the list of layers a
change is supposed to reach; this step finds the ones it did not.

**Step 8 — The seams that hide risk.** Where transactions begin and end, where errors convert from
exceptions to a result type (`rules/200-api.md`), where auth is enforced, where retries live.
Each should be at one layer, named. A boundary enforced in two places disagrees eventually; a
boundary enforced in none is the incident.

**Step 9 — Reconcile the debt ledger.** Read `.claude/TECH-DEBT.md` (the `FWD:`/`OBS:` ledger from
`rules/001-conventions.md`). Three questions per row: does the condition still exist, is it now
one of this audit's findings, and has it been quietly fixed? Delete rows whose condition is gone,
add the findings above that are not yet recorded, and report the count of each. A ledger nobody
reconciles becomes a file people stop reading, which is the same failure as never writing it.

**Output format:**

```text
ARCHITECTURE AUDIT
==================

CLAIMED:  [pattern from CLAUDE.md / PROJECT-CONTRACTS.md / codebase-overview.md | NONE — never recorded]
DE FACTO: [what the tree actually implements]

MIXED PATTERNS:
  ⚠ [pattern A] in [dirs] · [pattern B] in [dirs] — [which is the majority]

DIRECTION VIOLATIONS: [n]
  ✗ [file:line] — [importer] → [imported] — [rule broken]

BOUNDARIES: [n]
  ✗ [file:line] — [crossing]

CYCLES: [n — tool used | tool unavailable, not measured]
  ✗ [A → B → A]

SIZE: [file — n lines, m responsibilities]

CONTRACT DRIFT: [n]
  ✗ [what exists in code but not in PROJECT-CONTRACTS.md, or vice versa]

SEAMS: transactions [layer] · error boundary [layer] · authz [layer] · retries [layer]
  ✗ [seam enforced in two places | enforced nowhere]

LEDGER: [n] rows · [n] added · [n] closed (condition gone) · [n] still open

VERDICT: [Coherent / Drifting / Two architectures wearing one name]

TOP FIXES (highest structural return first):
  1. [most impactful]
  2. [second]
  3. [third]
```

**Coherent** requires all of: one pattern, zero direction violations, zero cycles, and every seam
in Step 8 owned by exactly one layer. Boundary and size findings alone are *Drifting* — they are
where a codebase is going, not where it has already arrived.

Do not fix anything in this command — report only. Route fixes through `refactor-safe` when
behavior must stay identical, `feature-plan` when the fix is structural enough to need a plan, or
the matching guard when the seam is auth, payment or the database — so each keeps its tier and its
verification.
