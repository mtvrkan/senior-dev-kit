# Project Preset — Next.js SaaS

## Architecture

- Prefer App Router conventions when `app/` exists; preserve Pages Router conventions when `pages/` is the current pattern.
- Prefer Server Components by default. Use Client Components only for browser state, effects, event handlers, DOM APIs, or interactive UI.
- Keep server-only code out of client components.
- Keep API routes/server actions thin; put business rules in services/modules when the project has that pattern.
- Respect monorepo boundaries such as `apps/web`, `packages/ui`, and `packages/db`.

## Data / server behavior

- Validate all server-side inputs.
- Enforce subscription, permission, quota, and ownership rules server-side.
- Do not modify auth, middleware, payment, database, migrations, or server actions unless requested.
- Avoid leaking stack traces, tokens, database errors, or secrets to the client.

## Performance

- Avoid unnecessary `use client`.
- Avoid importing server-only or heavy libraries into client components.
- Watch for duplicate fetches and expensive rerenders.
- Use cache/revalidation only according to existing project patterns.

---

## Design From Scratch — Admin Panel Standard

Use this section when building a NEW page, section, or screen that doesn't have an existing design to reference.

### Non-negotiable quality gates

Before calling a from-scratch page "done", verify ALL of these:

- [ ] Consistent spacing with the rest of the admin (check an existing page and match its padding/gap values exactly)
- [ ] Proper loading state (skeleton matching content shape — never spinner for list/card/table, per `rules/100-web.md`)
- [ ] Empty state: icon + headline + description + CTA button — all 4 required when list/table has 0 rows (per `rules/100-web.md`)
- [ ] Error state (when fetch fails — show a message, not a crash)
- [ ] Mobile responsiveness: sidebar collapses, table becomes scrollable or stacks
- [ ] No raw `<div>` layout — use the project's existing layout wrapper/shell component

### Layout pattern

Always check for an existing shell/layout component first (`DashboardLayout`, `AdminShell`, `AppLayout`, etc.).
If none exists, the standard admin page structure is:

```html
<PageShell>         ← existing layout, sidebar already inside
  <PageHeader>      ← title + description + optional action button (top right)
  <PageContent>     ← main content area, max-w constraint, padding
    <Card>          ← section cards with CardHeader + CardContent
```

Never build a raw flex/grid layout from scratch when a shell already exists.

### shadcn/ui component palette — prefer in this order

| Need | Component |
| --- | --- |
| Data list / records | `<DataTable>` with TanStack Table — never build a custom table |
| Form | `<Form>` + `<FormField>` + react-hook-form + zod schema |
| Modal/dialog | `<Dialog>` + `<DialogContent>` + `<DialogHeader>` |
| Confirm destructive action | `<AlertDialog>` |
| Status pill / badge | `<Badge variant="...">` |
| Tab navigation | `<Tabs>` + `<TabsList>` + `<TabsContent>` |
| Dropdown action menu | `<DropdownMenu>` |
| Page-level alert | `<Alert>` + `<AlertDescription>` |
| Loading skeleton | `<Skeleton>` — match the shape of the real content |
| Stats/KPI card | `<Card>` + `<CardHeader>` + `<CardTitle>` + large number |
| Select/combobox | `<Select>` or `<Combobox>` — never a raw `<select>` |
| Date picker | `<Calendar>` + `<Popover>` |
| Toast/notification | `useToast()` hook — never alert() |

### Tailwind spacing — use these values only

Gap: `gap-2`, `gap-4`, `gap-6`
Padding: `p-4`, `p-6`, `px-4 py-2`
Margin between sections: `space-y-4`, `space-y-6`
Card padding: `p-6` inside `<CardContent>`
Max content width: `max-w-7xl mx-auto` or match existing pages

Never use arbitrary values like `p-[17px]` or `mt-[23px]`.

### Typography scale

Page title: `text-2xl font-bold tracking-tight` or `text-3xl font-bold`
Section title: `text-lg font-semibold`
Description/subtitle: `text-sm text-muted-foreground`
Table column header: `text-xs font-medium uppercase tracking-wide text-muted-foreground`
Body / cell text: `text-sm`
Meta info: `text-xs text-muted-foreground`

### Color — use semantic tokens only

Never use raw Tailwind colors (`text-gray-500`, `bg-blue-600`). Use semantic tokens:

- `text-foreground` / `text-muted-foreground` / `text-destructive`
- `bg-background` / `bg-card` / `bg-muted`
- `border-border`
- `ring-ring`
- `text-primary` / `bg-primary` / `text-primary-foreground`

### Data table standard (when using <DataTable>)

Always include:

- Column definitions with `header` and `cell` renderer
- Row actions via `<DropdownMenu>` in the last column
- Loading state: skeleton rows (same number as expected data rows, e.g. 5)
- Empty state: `<div className="text-center text-sm text-muted-foreground py-12">No records yet.</div>`
- Pagination if list can exceed 20 rows
- Search/filter input above the table if the data warrants it

### Form standard (when using react-hook-form)

Always include:

- `const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })`
- `<Form {...form}>` wrapper with `<form onSubmit={form.handleSubmit(onSubmit)}>`
- `<FormField>` for every input — never a raw `<input>`
- `<FormMessage />` inside each `<FormItem>` for inline validation errors
- Submit button shows a loading state while pending: `<Button disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>`
- After submit: `toast({ title: "Success", description: "..." })` on success, `toast({ variant: "destructive", ... })` on error

### Page header standard

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">[Page Title]</h1>
    <p className="text-sm text-muted-foreground">[Description]</p>
  </div>
  <Button>[Primary Action]</Button>   {/* only if page has one */}
</div>
```

### New page checklist — run through this before writing any code

1. Find existing similar page in the project — read it, match its structure exactly
2. Find the layout/shell component — wrap content in it, don't rebuild the shell
3. Identify data source: server action, API route, or static
4. Identify components needed from the palette above
5. Plan states: loading | empty | error | populated
6. Plan any modals/forms needed
7. Only then write code

---

## SEO / AEO (App Router)

Full metadata example, JSON-LD types, CWV budget table, and checklist are in `rules/100-web.md`'s
"SEO (Web projects — Next.js 15 patterns)" section — it's already Next.js-specific and loads for
every `.tsx` file, same as this preset. Only the delta worth stating here:

Never leave static metadata only in root layout — every route segment needs its own `generateMetadata`.
Marketing/docs pages: H1 + first paragraph must directly answer the primary query (AEO); use
`<ul>`/`<ol>` for facts and lists — AI systems prefer structured content for citation.

---

## Verification

Use configured scripts only:

- lint
- typecheck
- test
- build when routing/server changes are meaningful

## Anti-patterns

- Turning an entire page into a Client Component for one button.
- Enforcing business limits only in UI.
- Adding new packages for simple UI.
- Broad refactors during small tasks.
- Using arbitrary Tailwind values instead of the scale above.
- Building a raw `<table>` instead of `<DataTable>`.
- Skipping loading/empty/error states.
- Using `alert()` instead of `toast()`.
- Using raw Tailwind color classes instead of semantic tokens.
