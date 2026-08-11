# Project Preset — React Native / Expo

> These files share the `.tsx` extension with web React, so `rules/100-web.md` auto-loads for
> them and `rules/400-mobile.md` does not. When working in this project, the mobile rules are the
> ones that apply: there is no DOM, no CSS cascade, and no viewport — ignore the web-only
> guidance and read `rules/400-mobile.md` when a platform question comes up.

## Architecture

- Expo Router v6 for all navigation. Routes are files under `app/`; no hand-rolled React
  Navigation stack inside an Expo project.
- Feature folders: `features/<feature>/{components,hooks,api}/`, shared UI in `components/`.
- TanStack Query for server state, Zustand (or Context for genuinely small cases) for client
  state. Do not keep server data in `useState`.

```tsx
// features/users/hooks/useUser.ts
export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => api.getUser(id),
    staleTime: 30_000,
  })
}

// app/users/[id].tsx
export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isPending, error, refetch } = useUser(id)

  if (isPending) return <UserSkeleton />
  if (error) return <ErrorView onRetry={refetch} />
  return <UserView user={data} />
}
```

Loading, error-with-retry and empty are three required states, not optional polish.

## Lists and rendering

- `FlashList` (Shopify) for any list over ~20 items. `FlatList` only for genuinely short,
  fixed lists; `ScrollView` with `.map()` over network data is a memory leak waiting to happen.
- `React.memo` on row components, and a stable `keyExtractor` — an inline arrow in
  `renderItem` re-renders every row on every parent update.
- Animations via Reanimated on the UI thread. A `setState`-driven animation stutters.

## Platform differences are explicit

```tsx
// Prefer a .native.tsx / .ios.tsx / .android.tsx file split over sprinkled conditionals
Platform.select({ ios: 44, android: 56 })
// Safe area: useSafeAreaInsets() — never a hardcoded status-bar height
```

## Storage and secrets

- Tokens go in `expo-secure-store` (Keychain / Android Keystore). **Never** `AsyncStorage` — it
  is unencrypted plain text on disk.
- `EXPO_PUBLIC_*` env vars are embedded in the bundle and readable by anyone with the app.
  Anything secret belongs on a server, not behind a public prefix.
- Deep links (`app.json` scheme) are untrusted input — validate params before navigating or
  fetching.

## Networking

- One API client module with the base URL, auth header injection and error mapping. Screens call
  hooks, never `fetch` directly.
- Handle offline explicitly: TanStack Query retry plus a NetInfo check. A phone loses network
  constantly; a web app mostly does not.

## Native changes need a rebuild

Adding a library with native code, or editing `app.json`/config plugins, invalidates Expo Go and
any existing dev client. Say so, and rebuild:

```bash
npx expo prebuild --clean
eas build --profile development --platform ios
```

## Verification

```bash
npx jest features/users/__tests__/useUser.test.ts   # targeted
npx tsc --noEmit                                    # type check
npx eslint .                                        # lint
npx expo-doctor                                     # config/dependency sanity
```

## Anti-patterns

- `AsyncStorage` for tokens or any sensitive value.
- `ScrollView` + `.map()` over a dynamic list; `FlatList` past ~20 items instead of `FlashList`.
- Server data mirrored into `useState`/`useEffect` instead of TanStack Query.
- Hardcoded status-bar or notch heights instead of `useSafeAreaInsets()`.
- Web idioms that silently do nothing: `className`, percentage-only layouts assuming a viewport,
  `onMouseEnter`, `window`/`document` access.
- A secret behind `EXPO_PUBLIC_`.
- Adding a native dependency without flagging that a rebuild is required.
