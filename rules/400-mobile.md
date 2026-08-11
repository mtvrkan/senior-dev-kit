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
| `app.json` / `expo.json` / `*.tsx` in `screens/` | React Native/Expo | Expo Router v6 |

**Known over-match (accepted):** `**/*.{swift,kt}` also fires for server-side Kotlin (Ktor,
Spring Boot), where the Compose/Keychain sections below do not apply. Narrowing it to
`**/android/**` would silently skip every Android module that lives outside a directory with that
name, which is the worse failure. Ignore the platform sections that clearly don't match the file;
`700-observability.md` and `900-performance.md` load for `.kt` too and carry the rules a backend
Kotlin file actually needs.

`.kts` is deliberately **not** in that glob, and the reasoning above does not extend to it: no
Compose, SwiftUI or Keychain code lives in a `.kts` file. In practice `.kts` means
`build.gradle.kts` / `settings.gradle.kts`, which every JVM backend has — so including it loaded
this whole rule for a Gradle build file in projects with no mobile target at all, at zero true
positives. Nothing is lost on the Android side either: a build file needs none of the platform
guidance below, and the Kotlin sources beside it still match `**/*.kt`. Pinned in
`scripts/rule-globs.test.ts`.

**Known gap:** plain RN/Expo screen `.tsx`/`.jsx` files share their extension with web React —
`paths:` can't disambiguate them from `100-web.md`'s glob without also matching every web
`.tsx` file, so only the `.native.*`/`app.config`/`metro.config` variants above auto-load this
rule. A plain-extension RN file relies on this rule being invoked explicitly (e.g. via the
platform-detection table above), not path-based auto-load.

## UNIVERSAL MOBILE RULES

Performance:

- NO heavy computation on main/UI thread — use background thread (Kotlin coroutine `Dispatchers.IO`, Swift `Task {}`, Dart `compute()`, RN worker)
- Images: WebP/AVIF format · never uncompressed PNG/JPG for assets
- Lists: avoid re-rendering entire list on state update · virtualize long lists
- Network: handle offline state · show meaningful error (not generic "Network error")

Security:

- NEVER hardcode API keys / secrets in mobile code (strings.xml, Info.plist, Dart constants)
- Use platform secret store: iOS Keychain · Android Keystore · Flutter flutter_secure_storage
- Certificate pinning for sensitive apps (banking, health)
- Validate deep link destinations before navigating
- Clear sensitive data (passwords, tokens) from memory after use

Accessibility:

- Every button/icon needs content description: `contentDescription` (Android) · `.accessibilityLabel` (iOS/Flutter) · `accessible={true}` + `accessibilityLabel` (RN)
- Support Dynamic Type / font scaling (user-selected text size must work)
- Minimum touch target: 44×44pt (iOS) / 48×48dp (Android)
- Voice Control / Switch Access compatibility

## iOS / SWIFT

```swift
// State management hierarchy
@Observable class ViewModel { ... }  // iOS 17+ (preferred)
@StateObject var vm = ViewModel()    // iOS <17
@ObservedObject var vm: ViewModel    // passed from parent

// Async/await (Swift Concurrency — always over callbacks)
func fetchUser() async throws -> User {
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(User.self, from: data)
}

// Navigation (iOS 16+)
NavigationStack { ... }
  .navigationDestination(for: Route.self) { ... }
// NOT: NavigationView (deprecated)
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
- Hard-coded strings → use `Localizable.strings`

## ANDROID / KOTLIN / COMPOSE

```kotlin
// State management pattern
data class UiState(val isLoading: Boolean, val data: List<Item>, val error: String?)

class MyViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(UiState(isLoading = true, ...))
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()
    
    fun loadData() = viewModelScope.launch {
        // Dispatchers.IO for network/disk
        val result = withContext(Dispatchers.IO) { repository.fetch() }
        _uiState.update { it.copy(data = result, isLoading = false) }
    }
}

// In Composable:
val uiState by viewModel.uiState.collectAsStateWithLifecycle()
```

Patterns:

- Jetpack Compose for ALL new UI (never XML layouts)
- Material 3 (never Material 2)
- ViewModel + StateFlow + sealed UiState class
- Kotlin Coroutines for all async work
- Hilt for dependency injection
- Room for local DB · WorkManager for background tasks

`derivedStateOf` for expensive `remember` computations.
Never: `Thread.sleep()` · sync network on main thread · `GlobalScope.launch` (use `viewModelScope`)

## FLUTTER / DART

```dart
// Riverpod (code generation approach)
@riverpod
Future<List<User>> users(Ref ref) async => await UserRepository().fetchAll();

// In widget:
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

State management hierarchy: <!-- reviewed: 2026-08 -->

- Riverpod (code-gen) — always preferred for new projects
- Bloc — only for complex event-driven flows
- Provider — only for legacy migration, never new

Testing:

```dart
// Unit test (Riverpod)
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

```typescript
// FlashList for any list >20 items. FlashList v2 (New Architecture) auto-measures
// rows — the v1 `estimatedItemSize` prop was removed; don't pass it.
import { FlashList } from "@shopify/flash-list"
<FlashList data={items} renderItem={({ item }) => <Item item={item} />} />

// Expo Router v6 navigation
// app/(tabs)/index.tsx   → tab route
// app/[id].tsx           → dynamic route
// Never: hard-coded React Navigation stack inside Expo project
```

Patterns:

- Expo Router v6 for ALL navigation in Expo projects
- FlashList over FlatList for long lists (>20 items)
- `expo-secure-store` for secrets
- `expo-image` over `<Image>` for performance
- `react-native-reanimated` for complex animations (worklet-based, avoids JS bridge)
- `zustand` for global state · TanStack Query for server state

Never: `AsyncStorage` for sensitive data (use expo-secure-store) · sync operations in render
OTA update awareness: breaking native changes require new build, not OTA.
