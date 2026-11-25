---
description: "Mobile rules — iOS Swift, Android Kotlin/Compose, Flutter/Dart, React Native. Auto-loads for mobile source files."
paths:
  - "**/*.{swift,kt}"
  - "**/lib/**/*.dart"
  - "**/test/**/*.dart"
  - "**/android/**"
  - "**/ios/**"
  - "**/*.native.{ts,tsx,js,jsx}"
  # Expo's `app.config.ts` sits at the project root (or at a package root in a monorepo). NOT
  # `**/app.config.{js,ts}`: Angular v17+ names its standard bootstrap file `src/app/app.config.ts`,
  # so the broad form loaded Compose/Keychain rules into every Angular project. Expo projects are
  # still reached by `metro.config.*` below even when this misses. Pinned in `rule-globs.test.ts`.
  - "app.config.{js,ts}"
  - "**/apps/*/app.config.{js,ts}"
  - "**/packages/*/app.config.{js,ts}"
  - "**/metro.config.{js,cjs}"
---

## PLATFORM DETECTION → PATTERN

| File/folder found | Platform | Preferred patterns |
| --- | --- | --- |
| `Package.swift` / `*.xcodeproj` | iOS/Swift | SwiftUI + Swift Concurrency |
| `app/build.gradle` / `build.gradle.kts` | Android/Kotlin | Jetpack Compose + Coroutines |
| `pubspec.yaml` | Flutter/Dart | Riverpod + flutter_test |
| `app.json` / `app.config.{js,ts}` / `*.tsx` in `screens/` | React Native/Expo | Expo Router |

This rule also loads for server-side Kotlin; ignore the platform sections that don't match the
file. A plain RN/Expo screen `.tsx` does not auto-load it — apply it explicitly there.

## UNIVERSAL MOBILE RULES

Performance:

- NO heavy computation on main/UI thread — use background thread (Kotlin coroutine `Dispatchers.Default` for CPU work, `Dispatchers.IO` for blocking I/O; Swift `Task.detached` or an `@concurrent` async function (a plain `nonisolated async` function also runs off-main before Swift 6.2's nonisolated-nonsending default) — a plain `Task {}` inherits the caller's actor, which is the MainActor inside a view; Dart `compute()`; RN worker)
- Images: WebP/AVIF format · never uncompressed PNG/JPG for assets
- Lists: avoid re-rendering entire list on state update · virtualize long lists
- Network: handle offline state · show meaningful error (not generic "Network error")

Security:

- NEVER hardcode API keys / secrets in mobile code (strings.xml, Info.plist, Dart constants)
- Use platform secret store: iOS Keychain · Android Keystore · Flutter flutter_secure_storage
- Certificate pinning for sensitive apps (banking, health)
- Validate deep link destinations before navigating
- Clear sensitive data (passwords, tokens) from memory after use

Design character:

- Differentiate *inside* the platform idiom, never against it — reinvented navigation, gestures or
  system controls make a worse app, not a distinctive one
- First screen of a new app: settle idiom distance (native default / branded native / fully custom),
  surface material and motion character with the user before building — `agent_docs/design-directions.md`
  § MOBILE DIRECTIONS. Existing app: the screens already there are the spec
- Never port one platform's material to the other (glass on Android, wallpaper-derived colour on iOS)
- One signature moment per app, recorded in the spec — the single idea the product is remembered
  for. It must survive Dynamic Type, reduce-motion and the smallest supported width, or it is a
  defect rather than a differentiator (`design-directions.md` § THE SIGNATURE)

Accessibility:

- Every button/icon needs content description: `contentDescription` (Android) · `.accessibilityLabel` (iOS/Flutter) · `accessible={true}` + `accessibilityLabel` (RN)
- Support Dynamic Type / font scaling (user-selected text size must work)
- Minimum touch target: 44×44pt (iOS) / 48×48dp (Android)
- Voice Control / Switch Access compatibility

## iOS / SWIFT

State management hierarchy. iOS 17+ (preferred): an `@Observable` class, owned by the view with
`@State` and passed to children as a plain property:

```swift
@Observable final class ViewModel { var items: [Item] = [] }

struct ListScreen: View {
    @State private var vm = ViewModel()
}
```

iOS <17: an `ObservableObject` class, owned with `@StateObject`, received from the parent with
`@ObservedObject`. `@StateObject` does not accept an `@Observable` class:

```swift
final class LegacyViewModel: ObservableObject { @Published var items: [Item] = [] }

struct LegacyListScreen: View {
    @StateObject private var vm = LegacyViewModel()
}

struct LegacyRow: View {
    @ObservedObject var vm: LegacyViewModel
}
```

Async/await (Swift Concurrency — always over callbacks):

```swift
func fetchUser() async throws -> User {
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(User.self, from: data)
}
```

Navigation (iOS 16+) — `NavigationStack`, NOT `NavigationView` (deprecated):

```swift
NavigationStack { ... }
  .navigationDestination(for: Route.self) { ... }
```

Patterns:

- MVVM: View → ViewModel (`@Observable`) → Service → Repository
- SwiftUI over UIKit for ALL new screens
- Swift async/await over Combine for async operations
- `Result<T, Error>` for explicit error handling
- `throws` / `async throws` for fallible operations

Anti-patterns (never):

- `force try!` (crashes on failure) → use `do { try } catch { }`
- `force unwrap!` on optionals → use `guard let` or `if let`
- Sync network call on main thread → always async
- Hard-coded strings → use a String Catalog (`Localizable.xcstrings`)

## ANDROID / KOTLIN / COMPOSE

State management pattern — network/disk work runs on `Dispatchers.IO`:

```kotlin
data class UiState(val isLoading: Boolean, val data: List<Item>, val error: String?)

class MyViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(UiState(isLoading = true, ...))
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()
    
    fun loadData() = viewModelScope.launch {
        val result = withContext(Dispatchers.IO) { repository.fetch() }
        _uiState.update { it.copy(data = result, isLoading = false) }
    }
}
```

In the Composable:

```kotlin
val uiState by viewModel.uiState.collectAsStateWithLifecycle()
```

Patterns:

- Jetpack Compose for ALL new UI (never XML layouts)
- Material 3 (never Material 2)
- ViewModel + StateFlow + sealed UiState class
- Kotlin Coroutines for all async work
- Hilt for dependency injection
- Room for local DB · WorkManager for background tasks

`derivedStateOf` only when a value derived from fast-changing state (scroll offset, text input) changes
less often than its input — it cuts recompositions, it is not a general memo. For an expensive
calculation use `remember(key) { ... }`.
Never: `Thread.sleep()` · sync network on main thread · `GlobalScope.launch` (use `viewModelScope`)

## FLUTTER / DART

Riverpod (code generation approach):

```dart
@riverpod
Future<List<User>> users(Ref ref) async => await UserRepository().fetchAll();
```

In the widget:

```dart
class UsersPage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(usersProvider);
    return usersAsync.when(
      data: (users) => UserList(users: users),
      loading: () => const UserListSkeleton(),
      error: (e, _) => ErrorView(error: e, onRetry: () => ref.refresh(usersProvider)),
    );
  }
}
```

State management hierarchy:

- Riverpod (code-gen) — always preferred for new projects
- Bloc — only for complex event-driven flows
- Provider — only for legacy migration, never new

Testing — a Riverpod unit test:

```dart
test('loads users', () async {
  final container = ProviderContainer(overrides: [
    usersProvider.overrideWith((ref) async => [mockUser]),
  ]);
  final result = await container.read(usersProvider.future);
  expect(result, [mockUser]);
});
```

Commands:

- `flutter test test/[file]_test.dart` — unit/widget tests
- `flutter test integration_test/` — integration tests (needs device/emulator)
- `flutter analyze` — static analysis
- `osv-scanner -L pubspec.lock` — CVE check (Dart has no built-in `pub audit` command)

Navigation: GoRouter for named routes. Never hard-coded `Navigator.push` in business logic.
Animation: avoid `AnimationController` manually; use `AnimatedSwitcher` / `Hero` / `TweenAnimationBuilder`.
Shimmer loading: `shimmer` package — never `CircularProgressIndicator` for list loading.

## REACT NATIVE / EXPO

FlashList for any list >20 items. FlashList v2 (New Architecture) auto-measures rows — the v1
`estimatedItemSize` prop was removed; don't pass it.

```typescript
import { FlashList } from "@shopify/flash-list"
<FlashList data={items} renderItem={({ item }) => <Item item={item} />} />
```

Expo Router navigation (the router is versioned with the Expo SDK):

- `app/(tabs)/index.tsx` → tab route
- `app/[id].tsx` → dynamic route
- Never: hard-coded React Navigation stack inside an Expo project

Patterns:

- Expo Router for ALL navigation in Expo projects
- FlashList over FlatList for long lists (>20 items)
- `expo-secure-store` for secrets
- `expo-image` over `<Image>` for performance
- `react-native-reanimated` for complex animations (worklet-based, avoids JS bridge)
- `zustand` for global state · TanStack Query for server state

Never: `AsyncStorage` for sensitive data (use expo-secure-store) · sync operations in render
OTA update awareness: breaking native changes require new build, not OTA.
