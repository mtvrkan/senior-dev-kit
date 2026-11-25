# Project Preset — SvelteKit (Svelte 5)

## Architecture

- File-based routes under `src/routes/`. The filename is the contract:
  `+page.svelte` (UI) · `+page.ts` (universal load) · `+page.server.ts` (server-only load and
  actions) · `+layout.*` · `+server.ts` (API endpoints) · `+error.svelte`.
- Anything touching a database, a secret, or a private API goes in `+page.server.ts` /
  `+server.ts`. A universal `+page.ts` also runs in the browser.
- Shared code in `src/lib/` (`$lib` alias); server-only modules in `src/lib/server/` — importing
  one from client code is a build error, and that is the guardrail to rely on.

`src/routes/users/[id]/+page.server.ts` — the `403` check enforces ownership, not just
authentication:

```ts
import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'

export const load = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Unauthorized')
  const user = await db.user(params.id)
  if (!user) error(404, 'Not found')
  if (user.orgId !== locals.user.orgId) error(403, 'Forbidden')
  return { user }
}
```

## Svelte 5 runes

```svelte
<script lang="ts">
  let { user }: { user: User } = $props()
  let count = $state(0)
  let doubled = $derived(count * 2)
  $effect(() => { document.title = user.name })
</script>
```

- `$state` / `$derived` / `$props` / `$effect` — not `export let`, not `$:` reactive statements.
- `$effect` is for side effects. Computing a value inside one instead of `$derived` causes extra
  renders and stale reads.
- Stores stay for cross-component state that isn't tied to a component tree.

## Forms — use actions, not a fetch handler

`+page.server.ts`:

```ts
export const actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData()
    const parsed = schema.safeParse(Object.fromEntries(data))
    if (!parsed.success) return fail(400, { errors: z.flattenError(parsed.error) })
    await db.createUser(parsed.data, locals.user.id)
    return { success: true }
  },
}
```

`z.flattenError()` is Zod 4; on Zod 3 it is `parsed.error.flatten()`.

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

Targeted test, `svelte-check` (types + template diagnostics), lint, and a build, which catches
server/client boundary violations:

```bash
npx vitest run src/lib/user.test.ts
npx svelte-check
npx eslint .
npx vite build
```

## Anti-patterns

- Database or secret access in `+page.ts` instead of `+page.server.ts`.
- `export let` / `$:` in new Svelte 5 components.
- `$effect` used to derive a value that `$derived` should compute.
- Auth check without an ownership check in `load` — IDOR.
- A `fetch` POST where a form action belongs (loses progressive enhancement).
- `{@html}` with user content.
- `onMount` used to fetch data that `load` should have provided (waterfall + no SSR).
