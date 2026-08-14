# Project Preset — SvelteKit (Svelte 5)

<!-- reviewed: 2026-08 — the Svelte 5 claim in this heading only. Svelte 5 is current and runes are
its stable API, so the preset's `export let` ban still reflects upstream. The idioms and commands
below were not re-verified in this pass; re-check them before widening this marker's scope. -->

## Architecture

- File-based routes under `src/routes/`. The filename is the contract:
  `+page.svelte` (UI) · `+page.ts` (universal load) · `+page.server.ts` (server-only load and
  actions) · `+layout.*` · `+server.ts` (API endpoints) · `+error.svelte`.
- Anything touching a database, a secret, or a private API goes in `+page.server.ts` /
  `+server.ts`. A universal `+page.ts` also runs in the browser.
- Shared code in `src/lib/` (`$lib` alias); server-only modules in `src/lib/server/` — importing
  one from client code is a build error, and that is the guardrail to rely on.

```ts
// src/routes/users/[id]/+page.server.ts
import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'

export const load = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Unauthorized')
  const user = await db.user(params.id)
  if (!user) error(404, 'Not found')
  if (user.orgId !== locals.user.orgId) error(403, 'Forbidden')   // ownership, not just auth
  return { user }
}
```

## Svelte 5 runes

```svelte
<script lang="ts">
  let { user }: { user: User } = $props()
  let count = $state(0)
  let doubled = $derived(count * 2)
  $effect(() => { document.title = user.name })   // side effects only — not for deriving values
</script>
```

- `$state` / `$derived` / `$props` / `$effect` — not `export let`, not `$:` reactive statements.
- `$effect` is for side effects. Computing a value inside one instead of `$derived` causes extra
  renders and stale reads.
- Stores stay for cross-component state that isn't tied to a component tree.

## Forms — use actions, not a fetch handler

```ts
// +page.server.ts
export const actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData()
    const parsed = schema.safeParse(Object.fromEntries(data))
    if (!parsed.success) return fail(400, { errors: parsed.error.flatten() })
    await db.createUser(parsed.data, locals.user.id)
    return { success: true }
  },
}
```

Form actions work without JavaScript and give progressive enhancement free via `use:enhance`.
A hand-rolled `fetch` POST throws that away.

## Loading, errors, empty

`{#await}` or the `+page.svelte` streaming promise for pending state, `+error.svelte` for the
error boundary, an explicit empty branch — three states, always.

## Security

- `error(status, message)` and `redirect(status, location)` — never return an error object the
  template forgets to check. SvelteKit 2 removed the `throw`: both throw internally, so
  `throw error(...)` is the SvelteKit 1 idiom and `svelte-migrate` rewrites it.
- `$env/static/private` and `$env/dynamic/private` are server-only; `PUBLIC_*` is shipped to the
  browser. There is no third option for a secret.
- `{@html ...}` is unescaped — sanitize, or don't use it.
- Cookies: `httpOnly`, `secure`, `sameSite: 'lax'` via `cookies.set`.

## Performance

- `export const prerender = true` for static pages; `csr = false` for content that needs no JS.
- Return promises from `load` to stream — don't await everything before the first byte.
- Images with explicit dimensions (`@sveltejs/enhanced-img`) — CLS budget 0.1.

## Verification

```bash
npx vitest run src/lib/user.test.ts   # targeted
npx svelte-check                      # types + template diagnostics
npx eslint .
npx vite build                        # catches server/client boundary violations
```

## Anti-patterns

- Database or secret access in `+page.ts` instead of `+page.server.ts`.
- `export let` / `$:` in new Svelte 5 components.
- `$effect` used to derive a value that `$derived` should compute.
- Auth check without an ownership check in `load` — IDOR.
- A `fetch` POST where a form action belongs (loses progressive enhancement).
- `{@html}` with user content.
- `onMount` used to fetch data that `load` should have provided (waterfall + no SSR).
