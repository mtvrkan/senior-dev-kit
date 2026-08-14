---
description: Audit built UI for design-direction adherence, generic-output tells, and layout monotony.
argument-hint: "[page, screen, or route — optional]"
---

# /design-check

Audit what was actually built against the design direction it claims: $ARGUMENTS

This is the counterpart to `/seo-check`. It does not review correctness — `/code-review` does that
— it answers one question: *does this look like its own product, or like every other generated UI?*
Read `agent_docs/design-directions.md` first; the direction table, the levers and the tells list
below are all defined there rather than restated here.

**Step 1 — Find the claim.** Read `DESIGN-SPEC.md` (project root) — the direction, the brief's
recorded constraints and exclusions, and the signature moment. No spec on a project that has UI is
itself the top finding: the design was never chosen, so it defaulted. Report it and derive the
*de facto* direction from the code so the rest of the audit still has something to measure against.

**Step 2 — Direction adherence.** For each axis in the spec — type, colour, geometry, depth,
density, motion, decoration, layout rhythm — check the code actually implements the recorded value.
The common failure is a spec naming one direction over a UI built from framework defaults: radius
still `rounded-lg` everywhere, one shadow on every surface, the body font never changed.

**Step 3 — The tells.** Scan for the generic-output signals in `design-directions.md` § THE TELLS.
Three or more means the UI will be read as machine-made whatever the tokens say. Report which ones
fired, with file:line.

**Step 4 — Layout monotony.** Count distinct section compositions across the page or flow. Three
consecutive sections of "centred heading over an N-column card grid" is one idea repeated. Check
the spec's layout rhythm is visible at all.

**Step 5 — Depth coherence.** Exactly one depth model should be in use (flat / soft shadow / hard
offset / glow / glass). Shadow *and* glow *and* border *and* gradient on the same surface is the
commonest way a chosen direction dissolves back into the default.

**Step 6 — Consistency of the system.** Count distinct values actually used for radius, shadow,
font size and section spacing. More values than the token scale defines means the scale is
decorative. Flag every hardcoded hex, `text-[17px]`, `p-[13px]` and raw `text-gray-*`.

**Step 7 — The invariants.** Contrast against the real composited background (glass and saturated
colour fields fail here first), visible focus ring ≥3:1, `prefers-reduced-motion` honoured, target
size, the three mandatory states. A distinctive UI that fails these is not a win. This is a
sanity check on the design's own risk areas, not an accessibility audit — `/a11y-check` is that,
and a direction that scores well here can still be unusable by keyboard.

**Step 8 — The signature.** `design-directions.md` § THE SIGNATURE requires exactly one idea the
work is remembered for, executed in one place. Find it in the code: is the spec's signature moment
actually built, does it survive 360px and reduced-motion, and is the rest of the page quiet enough
for it to land? Absent is the ceiling finding — everything else can pass and the result is still
merely competent. More than one is the same finding from the other side: they cancel.

**Step 9 — The brief.** Every constraint and exclusion recorded in the spec, checked against the
code: the brand palette that was fixed, the competitor to avoid, the density that was required.
A UI that is distinctive but not what the user asked for has failed at the only bar that matters.

**Output format:**

```text
DESIGN AUDIT
============

SPEC: [direction name from DESIGN-SPEC.md | NONE — never chosen]
DE FACTO: [what the code actually implements]
BRIEF: [constraints/exclusions honoured ✓ | ✗ [which one, file:line] | none recorded]

DRIFT (spec says X, code does Y):
  ✗ [axis] — spec: [value] · code: [value] — [file:line]

TELLS FIRED: [n]/11
  ✗ [tell] — [file:line]

MONOTONY:
  ⚠ [n] sections, [m] distinct compositions
  ⚠ depth models in use: [list] — should be exactly 1

SYSTEM:
  ⚠ radius values in use: [n] · shadow: [n] · font sizes: [n] · section spacing: [n]
  ✗ [hardcoded value] — [file:line]

INVARIANTS: contrast [✓/✗] · focus [✓/✗] · reduced-motion [✓/✗] · targets [✓/✗] · 3 states [✓/✗]

SIGNATURE: [the one idea, and where — | MISSING | [n] competing]

VERDICT: [Memorable / Distinctive / Competent but generic / Defaults wearing a direction's name]

TOP FIXES (highest visual return first):
  1. [most impactful]
  2. [second]
  3. [third]
```

**Memorable** is only available when all four hold: the signature moment is built and survives the
constraints, zero tells fired, every invariant passes, and the brief's constraints are honoured.
Anything less is **Distinctive** at best — a UI that holds its direction and breaks nothing is
competent, and calling it more than that is how the bar quietly drops.

Do not fix anything in this command — report only. Apply fixes via `ui-change` (small) or
`new-page` / `new-screen` (rebuild), so the change goes through the usual tier and verification.
