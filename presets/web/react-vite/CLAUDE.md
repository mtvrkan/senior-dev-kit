# Project Preset — React + Vite

## Architecture

- Follow existing component, hook, state, and routing patterns.
- Keep components focused; move reusable logic into hooks only when reuse or separation is clear.
- Do not introduce global state for local UI concerns.
- Keep API/service code separate from presentation if project already uses services/hooks.

## State / data

- Avoid duplicating derived state.
- Keep data fetching consistent with existing library (React Query / SWR / Axios hooks / plain fetch).
- Do not rewrite state management architecture for a local feature.

## Performance

- Avoid unnecessary rerenders from heavy inline computations.
- Memoize only when there is a clear benefit.
- Avoid importing large libraries for tiny utilities.

## Verification

- lint → typecheck → test → build (for routing changes)

## Anti-patterns

- Adding Redux/Zustand/Context for a local modal.
- Large component rewrites for small UI changes.
- Ignoring async error/loading states.

---

## Design From Scratch — React Admin Page Standard

Use this section when building a new admin page. Always run the 5-step checklist below before writing any code.

### Step 0 — Detect installed UI library (read package.json)

| Installed | Component system |
| --- | --- |
| `@shadcn/ui` / `shadcn-ui` | shadcn/ui + Radix |
| `@radix-ui/*` only | Radix primitives + custom |
| `antd` | Ant Design |
| `@mui/material` | Material UI |
| `@mantine/core` | Mantine |
| `react-bootstrap` | Bootstrap |
| none | plain Tailwind / CSS Modules |

Read package.json first — never assume which library is installed.

### Pre-code checklist (all 5 required)

1. Find similar existing page — read it, match structure exactly
2. Find layout/shell component (`Layout.tsx`, `AdminShell.tsx`, `DashboardLayout.tsx`) — use it, never rebuild
3. Identify data source: React Query / SWR hook / plain fetch — match existing pattern
4. List components from installed library (not a different one)
5. Plan all 4 states: loading | empty | error | populated

Loading/empty/error state detail (skeleton shapes, empty-state formula) is in `rules/100-web.md`'s THREE MANDATORY STATES section — applies regardless of UI library.

**Form pattern:**

- Existing library pattern: controlled `useState` / React Hook Form / Formik — match project
- Submit button: `disabled` + loading indicator while pending
- Success: toast / snackbar / redirect — match project's existing feedback mechanism
- Error: inline message under field, or top-level toast — match project

**Data table:**

- Existing pattern: TanStack Table / AG Grid / custom table — match project
- Always include: loading state, empty state, row actions, sorting (if existing tables have it)

**Color:** use design system tokens or Tailwind semantic classes — no hardcoded hex values
**Spacing:** match existing page gaps — read one similar page to extract the scale

### shadcn/ui palette (if installed)

`<DataTable>` (TanStack) | `<Form>` + react-hook-form + zod | `<Dialog>` | `<AlertDialog>` | `<Badge>` | `<Skeleton>` | `<Alert>` | `<DropdownMenu>` | `<Select>` | `<Tabs>` | Sonner's `toast()` (replaced shadcn/ui's old `useToast` hook) — never `alert()`

Colors: `text-foreground`, `text-muted-foreground`, `bg-card`, `text-primary`, `text-destructive` — never raw Tailwind colors like `text-gray-500`.
Spacing: `space-y-4/6`, `gap-2/4/6`, `p-4/6` — never arbitrary values.
Typography: page title `text-2xl font-bold tracking-tight`, desc `text-sm text-muted-foreground`.

### Ant Design palette (if installed)

`<Table>` | `<Form>` + `Form.Item` + `rules` | `<Modal>` | `<Drawer>` | `<Tag>` | `<Skeleton>` | `<Alert>` | `<Dropdown>` | `<Select>` | `<Tabs>` | `message.success()` / `notification.error()` — never `alert()`

Use `token.colorPrimary`, `token.colorBgContainer`, `token.colorText` from `useToken()` — never hardcoded colors.

### Material UI palette (if installed)

`<DataGrid>` (MUI X) | `<TextField>` + `react-hook-form` | `<Dialog>` | `<Chip>` | `<Skeleton>` | `<Alert>` | `<Menu>` | `<Select>` | `<Tabs>` | `useSnackbar()` from notistack or `<Snackbar>`

Colors: `theme.palette.primary.main`, `theme.palette.text.secondary` — never hardcoded.
