---
name: ui-change
description: Use for small UI changes: modal, button, responsive layout, component styling, Tailwind/CSS. Do not use for backend, auth, database, or payment.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically only for small frontend UI edits. Avoid backend, auth, DB, payment, migrations, secrets, and CI.
---

# ui-change

Rules:

1. Check if a matching component already exists before creating a new one.
2. Preserve mobile-first responsive behavior — test at mobile breakpoint mentally.
3. Accessibility basics: aria-label for icon-only buttons, role and aria attributes for dialogs, keyboard nav if existing pattern uses it.
4. Do not add UI libraries or new dependencies.
5. Do not touch: API routes, server actions, auth, payment, database, migrations, secrets, CI/CD.
6. Verify with: lint → build (if routing structure changed).

STOP AND ESCALATE if task touches:

- API routes or server actions → senior-engineer
- Auth or payment UI → security-guard
- Data fetching patterns or server state → senior-engineer
