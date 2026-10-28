---
name: ui-change
description: Use for small UI changes: modal, button, responsive layout, component styling, Tailwind/CSS. Do not use for backend, auth, database, or payment.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically only for small frontend UI edits. Avoid backend, auth, DB, payment, migrations, secrets, and CI.
argument-hint: "[component and change description]"
---

# ui-change

Rules:

1. Brand-new page or screen (not an edit to an existing one)? Use `new-page` (web) or `new-screen` (mobile) instead.
2. Confirm the target before editing: find the exact element, page and state (hover, open modal, locale) in code. A screenshot that reads two ways → one short question; fixing the wrong element is worse than not fixing.
3. Change only what was named. The same defect wherever the component is reused → fix every instance and state the count. Use the project's standard component (modal, tooltip, toast); never write a one-off. Keep decisions already recorded in `CLAUDE.md`, `DESIGN-SPEC.md` or `.claude/PROJECT-MEMORY.md`.
4. Never "fix" by hiding or shrinking information. Boxes and chips keep their geometry; the text fits inside them.
5. Match the design character already there — `DESIGN-SPEC.md` if present, otherwise the neighbouring components. An edit is never the place to introduce a new radius, shadow model, font or accent; if the existing design is the actual problem, say so and stop.
6. Accessibility is fix-on-sight, not a later pass: accessible name on every icon-only control, dialog role + focus handling, visible focus, keyboard path preserved. Touched an overlay, a form, a custom widget or a colour token? Run `/a11y-check` on it — these four are the floor, not the standard.
7. Do not add UI libraries or new dependencies.
8. Do not touch: API routes, server actions, auth, payment, database, migrations, secrets, CI/CD.
9. Verify: lint → build (if routing changed) → render and inspect your own screenshots at 320, 390, 768, 1024 and 1440 px, pointer and touch, every theme and locale the project ships, and WebKit when users are on Safari/iOS. Look for horizontal overflow, unwanted wraps, stray lines, layout shift, doubled animations and console errors. Nothing changed on screen → clear the cache and restart the dev server before touching code again; the same complaint twice → change method, never repeat the fix.
10. Report: what changed, in how many places, which viewports were checked. Defects seen but not touched → one FWD line each in `.claude/TECH-DEBT.md`, fixed only on approval.

STOP AND ESCALATE if task touches:

- API routes or server actions → senior-engineer
- Auth or payment UI → security-guard
- Data fetching patterns or server state → senior-engineer
