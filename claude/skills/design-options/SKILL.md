---
name: design-options
description: Use to show 2–4 rendered design options and get a pick before any UI code — a new page, component, screen, logo or e-mail template, or a design being redone. Not for fixing a defect (ui-change).
allowed-tools: Read, Grep, Glob, Bash, Write
when_to_use: Use automatically when the user asks for options or how something would look, or rejects a design and wants it again.
argument-hint: "[what is being designed]"
---

# design-options

People react to pictures, not to plans. Order: rendered options → the user's pick → implementation. No production code before the pick.

1. Read the real design language first: tokens, fonts, components, spacing, `DESIGN-SPEC.md`, project memory, styles the user already rejected. Every colour and element has a source in the project or brand palette; a reference site inspires, it is never copied.
2. `DESIGN-SPEC.md` exists → options stay inside its direction and vary only layout and composition; reopen the direction only when the user asks for a redo. No spec → options are far apart per `${CLAUDE_PLUGIN_ROOT}/agent_docs/design-directions.md` § CHOOSING ONE (three neighbours are one option).
3. Produce 2–4 options, each with a short code (A, B, C) the user picks by. All of them keep the project's button sizes, fonts and real components, and none breaks contrast, a visible focus ring or target size.
4. Show, don't describe. Web: one HTML file with every option at 390, 768 and 1440 px side by side, real content (no lorem ipsum), light and dark if the project has both; save it where the user can open it and open it. Mobile: render with the real components (preview or one simulator) and send the frames. One line under each option on how it differs.
5. Wait for the pick. A mix ("A, but C's header") → merge and show once more. Two rounds rejected in a row → stop guessing; ask 2–3 numbered questions (what was disliked, a reference, the feeling wanted).
6. A new direction was picked → record it in `DESIGN-SPEC.md` first. Then build with `ui-change` / `new-page` / `new-screen`, verify rendered (`ui-change` step 9), and put the result next to the chosen preview, naming any difference.
7. A first page with no spec and no page to match is `design-lead`'s decision; this skill is how its options are shown.
