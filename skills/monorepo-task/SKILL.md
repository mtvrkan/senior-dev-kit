---
name: monorepo-task
description: Use for tasks in a monorepo (Turborepo, Nx, pnpm workspaces, Lerna). Identifies the correct workspace, respects package boundaries, and runs workspace-scoped commands.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use when: the project has pnpm-workspace.yaml, turbo.json, or lerna.json and the task spans workspace boundaries or needs workspace-aware tooling.
argument-hint: "[task description] [workspace: apps/web | packages/ui | all]"
---

# monorepo-task

Work within monorepo boundaries. Never cross workspace lines accidentally.

1. Read `pnpm-workspace.yaml` / `turbo.json` / root `package.json workspaces` to map workspace names to paths. Locate the task's workspace.
2. Apps can import packages; packages cannot import apps or other apps. Read the workspace's `package.json` and one existing file before implementing.
3. Shared package change → update all consuming apps in the same diff, run `tsc --build` across all. Use workspace-scoped commands: `pnpm --filter @scope/pkg test` | `turbo test --filter=@scope/pkg`.
4. Before done: no cross-app imports, no package importing from app, no barrel `index.ts` re-exporting everything, version bumped if shared package API changed.

## Output

```text
Workspace: [name — path] | Affected: [consuming workspaces]
Boundary: [clean | ⚠ violation] | · [file:line — what changed]
TEST: [pnpm --filter @scope/pkg test — ✓ N] | TYPECHECK: [turbo typecheck — ✓]
```
