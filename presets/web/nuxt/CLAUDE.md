# Project Preset — Nuxt 3/4 (Vue)

<!-- reviewed: 2026-08 — the 3/4 version claim in this heading only. Nuxt 4 is current and 3 is
still in wide use, so the range holds. The idioms and commands below were not re-verified in this
pass; re-check them before widening this marker's scope. -->

## Architecture

- File-based routing in `pages/`, layouts in `layouts/`, server routes in `server/api/`.
- Auto-imports are on: don't hand-write imports for `composables/`, `components/` or Vue APIs.
- Composition API with `<script setup lang="ts">` everywhere. Options API is not used in new code.
- Shared logic goes in `composables/useX.ts`; anything that touches a secret goes in
  `server/` instead.

```vue
<script setup lang="ts">
const route = useRoute()
const { data: user, pending, error, refresh } = await useFetch<User>(
  () => `/api/users/${route.params.id}`,
  { key: () => `user-${route.params.id}` }
)
</script>

<template>
  <UserSkeleton v-if="pending" />
  <ErrorState v-else-if="error" @retry="refresh" />
  <UserCard v-else-if="user" :user="user" />
  <EmptyState v-else />
</template>
```

Loading, error-with-retry and empty are three required states, not optional polish.

## Data fetching — pick the right one

| Need | Use |
| --- | --- |
| SSR data for the page, deduped and hydrated | `useFetch` / `useAsyncData` |
| A call in an event handler (submit, click) | `$fetch` |
| Client-only, after mount | `useFetch(..., { server: false })` |

`$fetch` inside `setup` runs twice (server *and* client) and breaks hydration — that is the most
common Nuxt bug. Always give `useAsyncData` a stable `key`.

## Server routes and secrets

```ts
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()          // private keys only exist here
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  return await db.user(id, config.apiSecret)
})
```

- `runtimeConfig.public.*` is shipped to the browser. Anything else stays server-only — a secret
  read in a component is a leaked secret.
- Throw `createError({ statusCode })`; never return a raw driver error to the client.

## State

- `useState('key', init)` for SSR-safe shared state — a module-level `ref` leaks between
  requests on the server and is a real cross-user data bug.
- Pinia for anything with actions and multiple consumers.
- `ref` for primitives, `reactive` for objects; don't destructure a `reactive` (loses
  reactivity) — use `toRefs`.

## Rendering and performance

- `<NuxtImg>` / `<NuxtPicture>` (needs the `@nuxt/image` module) with explicit `width`/`height`;
  a plain `<img>` with dimensions is fine too — what is not optional is the dimensions.
  CLS budget is 0.1.
- `<LazyComponent>` prefix or `defineAsyncComponent` for below-the-fold weight.
- `v-for` needs a stable `:key`; never `v-if` and `v-for` on the same element.
- `useHead` / `useSeoMeta` on every public page: title, description, canonical, OG tags.

## Verification

```bash
npx vitest run tests/user.spec.ts   # targeted
npx nuxt typecheck                  # vue-tsc under the hood
npx eslint .
npx nuxt build                      # catches SSR-only failures dev never shows
```

## Anti-patterns

- `$fetch` in `setup` instead of `useFetch` — double request, broken hydration.
- `useAsyncData` without a stable key.
- A module-level `ref` used as shared state (cross-request leak on the server).
- `process.env` / private `runtimeConfig` read in a component.
- `window` / `document` touched during SSR without `import.meta.client` or `onMounted`.
- Destructuring a `reactive` object.
- `v-html` with anything user-supplied — XSS.
