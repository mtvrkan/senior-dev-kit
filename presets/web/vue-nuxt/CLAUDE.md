# Project Preset — Vue / Nuxt

## Architecture

- Follow existing Nuxt/Vue directory conventions: `pages/`, `components/`, `composables/`, `server/api/`.
- Use composables for shared stateful logic when the project already uses them.
- Keep server routes, middleware, and plugins isolated — do not alter without explicit request.
- Do not modify auth middleware, runtime config, Nitro config, or deployment config unless requested.
- Composition API only (`<script setup lang="ts">`) — never Options API in new components.

## State Management (Pinia)

Prefer Pinia setup stores (more flexible, TypeScript-friendly):

```typescript
// stores/users.store.ts
export const useUsersStore = defineStore('users', () => {
  const items = ref<User[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUsers() {
    isLoading.value = true
    error.value = null
    try {
      items.value = await $fetch('/api/users')
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  const isEmpty = computed(() => !isLoading.value && items.value.length === 0)

  return { items, isLoading, error, isEmpty, fetchUsers }
})
```

Use Pinia for: cross-component shared state, persisted state, complex mutations.
Use `useState` (Nuxt) for: SSR-safe shared state scoped to a request.
Use local `ref/reactive` for: component-only state.

## Composables

Extract reusable reactive logic into `composables/`:

```typescript
// composables/useAsync.ts
export function useAsync<T>(fn: () => Promise<T>) {
  const data = ref<T | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function execute() {
    isLoading.value = true
    error.value = null
    try { data.value = await fn() }
    catch (e) { error.value = (e as Error).message }
    finally { isLoading.value = false }
  }

  return { data, isLoading, error, execute }
}
```

Only extract to a composable when logic is reused in 2+ places.

## Data Fetching (Nuxt)

```vue
<script setup lang="ts">
// Server-side fetch (preferred for initial page data)
const { data: users, status, error, refresh } = await useAsyncData('users', () =>
  $fetch<User[]>('/api/users')
)
// status: 'idle' | 'pending' | 'success' | 'error'
</script>
```

Avoid `$fetch` directly in `<script setup>` without `useAsyncData`/`useFetch` — it won't be SSR-aware or cached.

## Server Routes (Nuxt)

```typescript
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  const session = await requireSession(event)  // always verify auth server-side
  const users = await db.user.findMany({ where: { orgId: session.orgId } })
  return users
})

// server/api/users/[id].patch.ts
export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, UserUpdateSchema.parse)  // Zod validation
  return db.user.update({ where: { id }, data: body })
})
```

Never trust client-sent user IDs or org IDs. Always verify ownership server-side.

## SSR & Hydration

- Never access `window`, `document`, or browser APIs at module level — wrap in `onMounted` or `import.meta.client`.
- Secrets: `useRuntimeConfig()` → `config.apiSecret` (server-only) vs `config.public.apiBase` (client-safe).
- Avoid `Math.random()` or `Date.now()` in shared components — causes hydration mismatch.
- `<ClientOnly>` for third-party widgets that can't SSR.

## Security

- Validate all server route inputs with Zod via `readValidatedBody(event, Schema.parse)`.
- Keep secrets in `runtimeConfig` (not `runtimeConfig.public`).
- Auth: check session in every server route — never rely on client-side route guards alone.
- Do not expose stack traces or internal DB errors in server responses.

## Verification

- `nuxt lint` or `eslint src/` + `vue-tsc --noEmit`
- `vitest run` for unit tests
- `nuxt build` — catches SSR issues, type errors, missing imports

## Anti-patterns

- Moving server-only logic (DB access, secrets) into client composables.
- Changing global middleware or plugins for a local feature.
- Using `$fetch` in `<script setup>` without `useAsyncData`/`useFetch` (breaks SSR caching).
- `window` / `document` access outside `onMounted` or `import.meta.client` guard.
- Secrets in `runtimeConfig.public` — public means client-visible.
- Missing loading/empty/error states for async data.

---

## Design From Scratch — Vue/Nuxt Admin Page Standard

Use when building a new admin page/view from scratch.

### Step 0 — Detect installed UI library (read package.json)

| Installed | Component system |
| --- | --- |
| `naive-ui` | Naive UI |
| `element-plus` | Element Plus |
| `primevue` | PrimeVue |
| `vuetify` | Vuetify |
| `@nuxt/ui` | Nuxt UI |
| `shadcn-vue` | shadcn-vue |
| none | plain Tailwind / CSS |

### Pre-code checklist (all 5 required)

1. Find similar existing page/view — read it, match structure exactly
2. Find layout component (`~/layouts/default.vue`, `AdminLayout.vue`) — use it
3. Identify data pattern: `useFetch` / `useAsyncData` / Pinia store / custom composable
4. List components from installed library only
5. Plan all 4 states: loading | empty | error | populated

### Vue 3 state pattern (Composition API)

```vue
<script setup lang="ts">
const { data, status, error, refresh } = await useAsyncData('key', () => $fetch('/api/x'))
// status: 'idle' | 'pending' | 'success' | 'error'
</script>

<template>
  <div v-if="status === 'pending'"><!-- loading --></div>
  <div v-else-if="error"><!-- error --></div>
  <div v-else-if="!data?.length"><!-- empty --></div>
  <div v-else><!-- populated --></div>
</template>
```

### Universal rules

**Loading:** skeleton rows/cards matching content shape — never blank flash
**Empty:** icon + message + optional CTA — `v-else-if="!data?.length"`
**Error:** message + retry button — `v-else-if="error"`
**Populated:** real content

**Form pattern:**

- Use `vee-validate` + `zod` / `yup` if installed — match project
- Or native `ref` + `reactive` with manual validation — match project
- Submit button: `:disabled="isSubmitting"` + loading indicator
- Feedback: toast from installed library (not browser `alert()`)

**Table pattern:** match existing table in project (DataTable component, plain `<table>`, or library component)

### Naive UI palette (if installed)

`<n-data-table>` | `<n-form>` + `<n-form-item>` | `<n-modal>` | `<n-drawer>` | `<n-tag>` | `<n-skeleton>` | `<n-alert>` | `<n-dropdown>` | `<n-select>` | `<n-tabs>` | `useMessage()` / `useNotification()`

Colors: `themeVars.primaryColor`, `themeVars.textColor1`, `themeVars.cardColor` from `useThemeVars()` — never hardcoded.

### Element Plus palette (if installed)

`<el-table>` | `<el-form>` + `<el-form-item>` | `<el-dialog>` | `<el-drawer>` | `<el-tag>` | `<el-skeleton>` | `<el-alert>` | `<el-dropdown>` | `<el-select>` | `<el-tabs>` | `ElMessage.success()` / `ElNotification()`

### Vuetify palette (if installed)

`<v-data-table>` | `<v-form>` | `<v-dialog>` | `<v-chip>` | `<v-skeleton-loader>` | `<v-alert>` | `<v-menu>` | `<v-select>` | `<v-tabs>` | `useSnackbar()`

Colors: `theme.current.value.colors.primary`, semantic color props (`:color="'error'"`) — never hardcoded hex.
