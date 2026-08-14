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
2. Check if a matching component already exists before creating a new one.
3. Match the design character already there — `DESIGN-SPEC.md` if present, otherwise the neighbouring components. An edit is never the place to introduce a new radius, shadow model, font or accent; if the existing design is the actual problem, say so and stop.
4. Preserve mobile-first responsive behavior — test at mobile breakpoint mentally.
5. Accessibility is fix-on-sight, not a later pass: accessible name on every icon-only control, dialog role + focus handling, visible focus, keyboard path preserved. Touched an overlay, a form, a custom widget or a colour token? Run `/a11y-check` on it — these four are the floor, not the standard.
6. Do not add UI libraries or new dependencies.
7. Do not touch: API routes, server actions, auth, payment, database, migrations, secrets, CI/CD.
8. Verify with: lint → build (if routing structure changed).

STOP AND ESCALATE if task touches:

- API routes or server actions → senior-engineer
- Auth or payment UI → security-guard
- Data fetching patterns or server state → senior-engineer
