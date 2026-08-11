# New Screen Guide — Mobile Platform Standards

Reference for `/new-screen` skill — UiState patterns, component palettes, and quality gates per platform.

---

## Kotlin / Jetpack Compose

### UiState pattern (sealed class — always)

```kotlin
sealed class ScreenUiState {
    object Loading : ScreenUiState()
    data class Success(val items: List<Item>) : ScreenUiState()
    data class Empty(val message: String = "No records yet.") : ScreenUiState()
    data class Error(val message: String) : ScreenUiState()
}
// ViewModel
private val _uiState = MutableStateFlow<ScreenUiState>(ScreenUiState.Loading)
val uiState: StateFlow<ScreenUiState> = _uiState.asStateFlow()
// In Screen composable
val state by viewModel.uiState.collectAsStateWithLifecycle()
```

### Component palette

Scaffold · TopAppBar · LazyColumn / LazyVerticalGrid · Card / ElevatedCard
Button / OutlinedButton / TextButton · OutlinedTextField · FilterChip
AlertDialog · ModalBottomSheet · CircularProgressIndicator · SnackbarHostState

### Rules

- Colors: `MaterialTheme.colorScheme.X` only — never `Color(0xFF...)`
- Typography: `MaterialTheme.typography.X` only — never raw `fontSize = N.sp`
- Spacing: 4dp multiples — 4, 8, 12, 16, 20, 24, 32dp. Never arbitrary.
- Loading: `Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }`
- Empty: centered icon + Text + optional Button
- Error: centered icon + Text + OutlinedButton("Retry")
- Feedback: SnackbarHostState — never Android `Toast` in Compose

---

## Flutter

### State pattern (use existing project pattern)

```dart
// Sealed class / freezed (if project uses it)
abstract class ScreenState {}
class ScreenLoading extends ScreenState {}
class ScreenLoaded extends ScreenState { final List<Item> items; ScreenLoaded(this.items); }
class ScreenEmpty extends ScreenState {}
class ScreenError extends ScreenState { final String message; ScreenError(this.message); }

// OR: AsyncValue<List<Item>> with Riverpod
final itemsProvider = FutureProvider<List<Item>>((ref) => ref.read(repoProvider).fetchAll());
// In widget:
final asyncItems = ref.watch(itemsProvider);
return asyncItems.when(
  data: (items) => items.isEmpty ? EmptyView() : ItemList(items: items),
  loading: () => const Center(child: CircularProgressIndicator.adaptive()),
  error: (e, _) => ErrorView(onRetry: () => ref.refresh(itemsProvider)),
);
```

### Component palette

Scaffold + AppBar · ListView.builder / SliverList · Card · FilledButton / OutlinedButton / TextButton
TextFormField + Form · FilterChip / ActionChip · AlertDialog (via showDialog)
showModalBottomSheet · CircularProgressIndicator.adaptive() · ScaffoldMessenger.showSnackBar

### Rules

- Colors: `Theme.of(context).colorScheme.X` only — never `Colors.blue`, `Colors.grey`, `Color(0xFF...)`
- Typography: `Theme.of(context).textTheme.X` only — never raw `TextStyle(fontSize: N)`
- Spacing: 4dp multiples — 4, 8, 12, 16, 20, 24, 32dp. Never arbitrary.
- Loading: `const Center(child: CircularProgressIndicator.adaptive())`
- Empty: centered icon + Text + optional FilledButton
- Error: centered icon + Text + OutlinedButton("Retry")
- Feedback: `ScaffoldMessenger.of(context).showSnackBar(...)`

---

## Swift / SwiftUI

### ViewModel pattern

```swift
// iOS 17+ (@Observable — preferred)
@Observable class ScreenViewModel {
    var state: ScreenState = .loading
    func load() async { ... }
    func retry() async { await load() }
}
enum ScreenState { case loading, loaded([Item]), empty, error(String) }

// iOS 15-16 (ObservableObject)
class ScreenViewModel: ObservableObject {
    @Published var state: ScreenState = .loading
}

// View wiring
@State private var viewModel = ScreenViewModel()  // iOS 17+
// or
@StateObject private var viewModel = ScreenViewModel()  // iOS 15-16

// Switch on state
switch viewModel.state {
case .loading: ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
case .loaded(let items): ItemList(items: items)
case .empty: ContentUnavailableView("No Items", systemImage: "tray")  // iOS 17+
case .error(let msg): ErrorView(message: msg, onRetry: { Task { await viewModel.retry() } })
}
```

### Component palette

NavigationStack · List / LazyVStack · ProgressView · ContentUnavailableView (iOS17+)
Button.borderedProminent / .bordered · TextField in Form · .sheet / .fullScreenCover
.confirmationDialog · .alert · .swipeActions · .contextMenu

### Rules

- Colors: `Color(.systemBackground)`, `Color(.label)`, `Color(.secondaryLabel)` or Asset Catalog named colors — never `Color(hex:)` for semantic UI
- Typography: `.largeTitle`, `.title`, `.headline`, `.subheadline`, `.body`, `.footnote`, `.caption` — never `.system(size: N)`. Dynamic Type must work.
- Spacing: 8pt grid — 4, 8, 12, 16, 20, 24, 32pt. Never arbitrary.
- Loading: `ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)`
- Empty: `ContentUnavailableView` (iOS17+) or custom VStack(icon + text + button)
- Error: VStack(icon + message + retry button)
- Feedback: `.alert` for errors · custom overlay banner for success

---

## Quality gate — all platforms

- [ ] Similar existing screen found and structure matched
- [ ] Existing navigation/routing pattern used
- [ ] All 4 states: loading + empty (icon+message+optional button) + error (message+retry) + populated
- [ ] No hardcoded colors — only theme/semantic tokens
- [ ] No hardcoded text sizes — only theme/type scale
- [ ] Spacing on 4dp / 8pt grid — no arbitrary values
- [ ] Submit buttons show loading while pending
- [ ] Feedback via platform standard (Snackbar/SnackBar/.alert) — never `alert()`/`Toast`
- [ ] Lint / analyze passes
