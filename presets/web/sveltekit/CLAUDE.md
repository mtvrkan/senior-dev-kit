# Project Preset — SvelteKit

## Architecture

- Follow existing `+page`, `+layout`, `load`, action, and server route patterns.
- Keep server code in server-only modules/routes.
- Do not touch auth hooks, server actions, or DB logic unless requested.
- Keep components small and colocated when project convention supports it.

## Data / forms

- Validate form actions and API inputs server-side.
- Return useful errors without leaking sensitive details.
- Keep permission checks server-side.
- Preserve progressive enhancement where forms/actions are used.

## Verification

- check → lint → test → build

## Anti-patterns

- Mixing server-only imports into browser code.
- Enforcing protected behavior only in UI.
- Broad route rewrites for local fixes.

---

## Design From Scratch — SvelteKit Admin Page Standard

Use when building a new admin page (`+page.svelte` + optional `+page.server.ts`).

### Step 0 — Detect installed UI library (read package.json)

| Installed | Component system |
| --- | --- |
| `shadcn-svelte` | shadcn-svelte |
| `@skeletonlabs/skeleton` | Skeleton UI |
| `flowbite-svelte` | Flowbite Svelte |
| `carbon-components-svelte` | Carbon Design |
| none | plain Tailwind / DaisyUI |

### Pre-code checklist (all 5 required)

1. Find similar existing `+page.svelte` — read it, match its load/layout/component structure
2. Find `+layout.svelte` for the route — use it (never rebuild the shell)
3. Identify data source: `+page.server.ts` load fn / `+server.ts` endpoint / client fetch
4. List components from installed library only
5. Plan all 4 states: loading | empty | error | populated

### SvelteKit data pattern

```typescript
// +page.server.ts
export async function load({ locals, params }) {
  const items = await db.getItems()
  if (!items) error(404, 'Not found')
  return { items }
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  export let data  // from load()
  // data.items is typed automatically
</script>

{#if !data.items.length}
  <!-- empty state -->
{:else}
  <!-- populated -->
{/if}
```

For client-side loading (when load fn is not used):

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  let items: Item[] = []
  let loading = true
  let error: string | null = null

  onMount(async () => {
    try {
      const res = await fetch('/api/items')
      if (!res.ok) throw new Error(await res.text())
      items = await res.json()
    } catch (e) {
      error = e.message
    } finally { loading = false }
  })
</script>

{#if loading}<!-- skeleton -->{:else if error}<!-- error -->{:else if !items.length}<!-- empty -->{:else}<!-- populated -->{/if}
```

### Universal rules

**Loading:** skeleton slots / spinners matching content shape
**Empty:** icon + message + optional CTA — `{#if !items.length}`
**Error:** message + retry button — `{#if error}`
**Populated:** real content

**Form (with SvelteKit actions):**

```svelte
<form method="POST" use:enhance>
  <button type="submit" disabled={submitting}>
    {#if submitting}Saving...{:else}Save{/if}
  </button>
</form>
```

Use `superforms` + `zod` if installed — match project pattern.
Feedback: `$page.form` for action result, or toast library if installed — never `alert()`.

### shadcn-svelte palette (if installed)

`<DataTable>` (TanStack) | `<Form.Root>` + superforms | `<Dialog.Root>` | `<AlertDialog.Root>` | `<Badge>` | `<Skeleton>` | `<Alert>` | `<DropdownMenu.Root>` | `<Select.Root>` | `<Tabs.Root>`

Colors: `text-foreground`, `bg-card`, `text-primary`, `text-muted-foreground`, `text-destructive` — never raw Tailwind colors.
Spacing: `space-y-4/6`, `gap-2/4/6`, `p-4/6` — never arbitrary values.

### Skeleton UI palette (if installed)

`<DataTable>` | `<SlideToggle>` | `<Modal>` | `<Drawer>` | `<Badge>` | `<ProgressBar>` | `<Toast>` via `toastStore` | `<TabGroup>` | `<ListBox>`
Colors: Skeleton theme tokens (`variant-filled-primary`, `text-primary-500`) — never hardcoded.
