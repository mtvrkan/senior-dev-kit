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
3. Preserve mobile-first responsive behavior — test at mobile breakpoint mentally.
4. Accessibility basics: aria-label for icon-only buttons, role and aria attributes for dialogs, keyboard nav if existing pattern uses it.
5. Do not add UI libraries or new dependencies.
6. Do not touch: API routes, server actions, auth, payment, database, migrations, secrets, CI/CD.
7. Verify with: lint → build (if routing structure changed).

STOP AND ESCALATE if task touches:

- API routes or server actions → senior-engineer
- Auth or payment UI → security-guard
- Data fetching patterns or server state → senior-engineer
