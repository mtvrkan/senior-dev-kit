# Project Preset — React Native

## Architecture

- Follow existing architecture: Expo managed/bare, or CLI bare workflow.
- **Modern default:** Expo SDK 51+ with Expo Router v3 (file-based routing).
- Keep business logic out of screens: use hooks, Zustand stores, or service layers.
- Do not modify `app.json`, `app.config.ts`, `eas.json`, signing config, or native directories (`android/`, `ios/`) unless explicitly requested.

## State / data

- Respect existing state management (Zustand preferred for new, Redux if already used).
- TanStack Query for server state — not manual fetch + useState chains.
- `MMKV` for fast local storage, `expo-secure-store` for sensitive data, never `AsyncStorage` for new code.
- Offline and network error states must always be handled.

## Native / platform

- Do not add native modules without explicit justification — Expo SDK covers most needs.
- Do not modify Podfile, build.gradle, or native code unless asked.
- EAS Build and OTA update config are protected — do not touch.

## Verification

- `npx expo start` for local dev
- `npx expo export` for build check
- `jest` + Testing Library for unit/component tests
- `eslint` for lint

## Anti-patterns

- Business logic in screen components.
- Platform-specific code without `Platform.OS` guard.
- `AsyncStorage` for new projects (use MMKV or expo-secure-store).
- `FlatList` for long lists (use `FlashList` from Shopify).
- Unhandled loading/error states.
- Direct native module modification for a UI task.

---

## Design From Scratch — React Native Screen Standard

Use when building a new screen, bottom sheet, or major UI section from scratch.

### Non-negotiable quality gates

Before reporting done, verify ALL:

- [ ] Similar existing screen found and matched
- [ ] Navigation pattern (Expo Router route / React Navigation screen) used correctly
- [ ] All 4 states: loading | empty | error | populated
- [ ] No hardcoded colors — only design system/theme tokens
- [ ] No hardcoded font sizes — only theme typography scale
- [ ] Spacing from 4pt grid only
- [ ] Safe area handled (`useSafeAreaInsets` / `SafeAreaView`)
- [ ] Keyboard avoiding handled if screen has inputs (`KeyboardAvoidingView`)
- [ ] `eslint` passes

### State pattern

```typescript
// With TanStack Query (preferred for server data)
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['items'],
  queryFn: () => api.getItems(),
})

// Screen rendering
if (isLoading) return <LoadingState />
if (isError) return <ErrorState message={error.message} onRetry={refetch} />
if (!data?.length) return <EmptyState />
return <PopulatedContent data={data} />

// With Zustand (local/global state)
const { items, isLoading, error, fetchItems } = useItemsStore()
useEffect(() => { fetchItems() }, [])
```

### Component palette — prefer these (all free/open-source)

| Need | Component |
| --- | --- |
| Screen root | `<SafeAreaView>` / `<View style={{ flex: 1 }}>` inside safe area |
| Navigation | Expo Router `<Stack>` / `<Tabs>` / `<Link>` |
| Long list | `<FlashList>` (Shopify, free) — never `<FlatList>` for long lists |
| Short list | `<FlatList>` or `<ScrollView>` |
| Loading | `<ActivityIndicator>` centered, or `<Skeleton>` component |
| Card | `<Pressable>` + `<View>` with border/shadow, or project's Card component |
| Primary button | Project's `<Button>` component — or `<Pressable>` + styled `<Text>` |
| Input | `<TextInput>` with project styling, or `react-hook-form` + `<Controller>` |
| Bottom sheet | `@gorhom/bottom-sheet` (free) |
| Modal | `<Modal>` from React Native |
| Toast/snackbar | `react-native-toast-message` (free) or project's existing mechanism — never `Alert.alert()` for feedback |
| Confirmation | `Alert.alert('Title', 'Message', [{text: 'OK'}, {text: 'Cancel'}])` — OK for destructive confirms |
| Image | `<Image>` from Expo (`expo-image`) — faster and cached |

### Color — theme/design system tokens only

Detect project's color system first (read existing screens):

```typescript
// If project uses a theme object (Tamagui / custom ThemeContext)
const theme = useTheme()
colors.primary, colors.background, colors.text, colors.secondaryText, colors.error

// If no theme: use semantic names via StyleSheet, never hardcoded
const styles = StyleSheet.create({
  text: { color: '#000' },  // WRONG
  text: { color: colors.text },  // CORRECT — import from colors.ts
})

// Platform adaptive colors (if no design system)
import { Platform } from 'react-native'
const textColor = Platform.select({ ios: '#000000', android: '#000000' })
// Better: use a project-level colors constant
```

Never hardcode hex values inline — always reference a named token or constant from `constants/colors.ts` or similar.

### Typography scale

Detect project's typography system. If none: create a consistent scale:

```typescript
// typography.ts
export const typography = {
  title: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  headline: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
}
// Use: style={[typography.title, { color: colors.text }]}
```

Never: `fontSize: 17` inline with no reference to scale.

### Spacing — 4pt grid

```typescript
// spacing.ts
export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48 }
// Use: style={{ padding: spacing.base, gap: spacing.sm }}
```

Never: `padding: 17`, `margin: 7`.

### Required states

**Loading:**

```tsx
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <ActivityIndicator size="large" color={colors.primary} />
</View>
```

**Empty:**

```tsx
<View style={styles.centered}>
  <Icon name="inbox-outline" size={48} color={colors.secondaryText} />
  <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.md }]}>
    No records yet.
  </Text>
  <Pressable style={[styles.button, { marginTop: spacing.md }]} onPress={onCreatePress}>
    <Text style={styles.buttonText}>Create your first record</Text>
  </Pressable>
</View>
```

**Error:**

```tsx
<View style={styles.centered}>
  <Icon name="alert-circle-outline" size={48} color={colors.error} />
  <Text style={[typography.body, { color: colors.secondaryText, textAlign: 'center' }]}>
    {errorMessage}
  </Text>
  <Pressable style={[styles.outlineButton, { marginTop: spacing.md }]} onPress={onRetry}>
    <Text style={styles.outlineButtonText}>Try again</Text>
  </Pressable>
</View>
```

### Form pattern

```tsx
// React Hook Form + Zod (modern, free)
const schema = z.object({ title: z.string().min(1) })
const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
  resolver: zodResolver(schema)
})

// Submit button — always show loading while pending
<Pressable
  onPress={handleSubmit(onSubmit)}
  disabled={isSubmitting}
  style={[styles.button, isSubmitting && styles.buttonDisabled]}
>
  {isSubmitting
    ? <ActivityIndicator size="small" color="#fff" />
    : <Text style={styles.buttonText}>Save</Text>
  }
</Pressable>

// On success: toast, not Alert
toast.show('Successfully saved', { type: 'success' })
// On error: toast or inline error
```

### Modern packages (free, prefer these)

| Need | Package |
| --- | --- |
| Navigation | `expo-router` v3+ (file-based) or `@react-navigation/native` v6+ |
| State | `zustand` (lightweight, no boilerplate) |
| Server state | `@tanstack/react-query` v5 |
| Forms | `react-hook-form` + `zod` |
| Long lists | `@shopify/flash-list` |
| Bottom sheet | `@gorhom/bottom-sheet` |
| Animations | `react-native-reanimated` v3 |
| Gestures | `react-native-gesture-handler` |
| Images | `expo-image` |
| Local storage (fast) | `react-native-mmkv` |
| Secure storage | `expo-secure-store` |
| Icons | `@expo/vector-icons` (included with Expo) |
| Toast | `react-native-toast-message` |

**Ask before using:** paid Expo EAS features beyond free tier, commercial icon packs, paid animation libraries.

### New screen checklist — BEFORE writing code

1. Find similar existing screen — read it, match structure
2. Identify navigation pattern (Expo Router route file vs React Navigation screen)
3. Confirm state management pattern in use
4. List components needed from palette above
5. Plan all 4 states
6. Build in order: types → hook/store → screen skeleton → loading → error → empty → populated → forms
