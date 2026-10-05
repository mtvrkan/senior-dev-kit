# Project Preset — Nuxt 3/4 (Vue)

## Architecture

- Nuxt 4 source lives under `app/` (the default `srcDir`): routing in `app/pages/`, layouts in
  `app/layouts/`, plus `app/components/` and `app/composables/`. Nuxt 3 (or a project that opted
  out) keeps them at the root — follow the layout on disk. Server routes stay in root `server/api/`.
- Auto-imports are on: don't hand-write imports for `composables/`, `components/` or Vue APIs.
- Composition API with `<script setup lang="ts">` everywhere. Options API is not used in new code.
- Shared logic goes in `app/composables/useX.ts` (Nuxt 3: `composables/`); anything that touches a secret goes in
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

`server/api/users/[id].get.ts` — private keys only exist in the server-side `useRuntimeConfig()`.
A server route is a public endpoint: it resolves the caller first and checks that the caller owns
what the id points at, or any visitor can read any user by changing the URL. `requireUserSession`
is `nuxt-auth-utils`; use the project's own session helper if it has another:

```ts
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  if (id !== user.id) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
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

Targeted test, `nuxt typecheck` (vue-tsc under the hood), lint, and a build, which catches
SSR-only failures dev never shows:

```bash
npx vitest run tests/user.spec.ts
npx nuxt typecheck
npx eslint .
npx nuxt build
```

## Anti-patterns

- `$fetch` in `setup` instead of `useFetch` — double request, broken hydration.
- `useAsyncData` without a stable key.
- A module-level `ref` used as shared state (cross-request leak on the server).
- `process.env` / private `runtimeConfig` read in a component.
- `window` / `document` touched during SSR without `import.meta.client` or `onMounted`.
- Destructuring a `reactive` object.
- `v-html` with anything user-supplied — XSS.
