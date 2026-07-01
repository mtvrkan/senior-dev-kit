# Project Preset — Monorepo

## Workspace boundaries

- Import across workspaces only via declared package exports — never from internal paths.
- Changes to a shared package may affect all consumers — check dependents before editing.
- Keep app-specific code inside the app; shared code belongs in a package.

## Commands

- Run lint/test/build inside the affected workspace: `cd apps/web && pnpm build`
- Root-level commands (`pnpm -r build`) affect all packages — use only when intentional.
- Check the workspace's own `package.json` scripts before assuming commands exist.

## Scope discipline

- A task scoped to `apps/web` must not touch `apps/api` or `packages/*` unless the task explicitly requires it.
- If a change requires touching a shared package, flag it as a separate, higher-risk step.

## Anti-patterns

- Importing from `apps/other-app/src/...` directly.
- Running all-workspace commands for a single-app fix.
- Adding a dependency to the root `package.json` when it belongs in one workspace.
- Assuming a package's internals are stable — only the exported surface is a contract.
