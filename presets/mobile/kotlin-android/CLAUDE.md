# Project Preset — Kotlin Android

## Architecture

- Follow existing architecture: MVVM, Clean, Compose, XML, or project pattern.
- Respect lifecycle and coroutine scopes.
- Keep ViewModel/UseCase/Repository responsibilities clear — no business logic in Composables or Activities.
- Do not modify manifest, permissions, billing, auth, or signing config unless requested.

## Data / concurrency

- Use structured concurrency (viewModelScope, lifecycleScope).
- Avoid blocking the main thread.
- Respect Room/Retrofit/DataStore patterns if present.
- Use transactions for multi-step local DB writes.

## Verification

Use Gradle tasks:

- `./gradlew test`
- `./gradlew connectedAndroidTest` (if configured/requested)
- `./gradlew lint`

## Anti-patterns

- GlobalScope in app code.
- Blocking main thread.
- Manifest changes for local UI tasks.
- Business logic inside Composables.
- Hardcoded colors instead of MaterialTheme tokens.

---

## Design From Scratch — Jetpack Compose Standard

Use this section when building a NEW screen, bottom sheet, dialog, or major UI section that has no existing design to reference.

### Non-negotiable quality gates

Before calling a from-scratch screen "done", verify ALL of these:

- [ ] Existing similar screen found and structure matched
- [ ] Scaffold / existing navigation host wrapper used — never rebuild chrome
- [ ] Loading state renders (not a blank flash)
- [ ] Empty state shown when list/content is empty
- [ ] Error state shown with retry when fetch fails
- [ ] UiState sealed class used in ViewModel — not raw booleans
- [ ] No hardcoded colors — only MaterialTheme.colorScheme tokens
- [ ] No hardcoded text sizes — only MaterialTheme.typography tokens
- [ ] Spacing uses 4dp multiples only
- [ ] lint passes

### UiState pattern — always use sealed class

```kotlin
sealed class ScreenNameUiState {
    object Loading : ScreenNameUiState()
    data class Success(val data: List<Item>) : ScreenNameUiState()
    data class Empty(val message: String = "No records yet.") : ScreenNameUiState()
    data class Error(val message: String) : ScreenNameUiState()
}
```

ViewModel exposes: `val uiState: StateFlow<ScreenNameUiState>`
Screen observes: `val state by viewModel.uiState.collectAsStateWithLifecycle()`
Screen renders: `when (state) { is Loading → ... is Success → ... is Empty → ... is Error → ... }`

### Material 3 component palette — prefer in this order

| Need | Component |
| --- | --- |
| Screen root | `Scaffold` with `topBar`, `floatingActionButton` |
| Top bar | `TopAppBar` / `CenterAlignedTopAppBar` / `LargeTopAppBar` |
| Scrollable list | `LazyColumn` / `LazyVerticalGrid` — never `Column` in `verticalScroll` for long lists |
| Card | `Card` / `ElevatedCard` / `OutlinedCard` |
| Primary action | `Button` (filled) |
| Secondary action | `OutlinedButton` / `TextButton` |
| FAB | `FloatingActionButton` / `ExtendedFloatingActionButton` |
| Loading indicator | `CircularProgressIndicator` centered in a `Box(Modifier.fillMaxSize())` |
| Linear progress | `LinearProgressIndicator` at top of screen / inside card |
| Input field | `OutlinedTextField` — never raw `BasicTextField` for user-facing UI |
| Filter/selection | `FilterChip` / `AssistChip` |
| Dialog | `AlertDialog` with `confirmButton` and optional `dismissButton` |
| Bottom sheet | `ModalBottomSheet` |
| Snackbar/toast | `SnackbarHostState` via `ScaffoldState` — never Android `Toast` for Compose UI |
| Status indicator | `Badge` / custom `Surface` with `RoundedCornerShape` |
| Navigation | `NavigationBar` (bottom) / `NavigationRail` (tablet) / `NavigationDrawer` |

### Color — MaterialTheme tokens only

Never use hardcoded `Color(0xFF...)` for semantic UI colors.

```kotlin
// CORRECT
MaterialTheme.colorScheme.primary
MaterialTheme.colorScheme.onPrimary
MaterialTheme.colorScheme.surface
MaterialTheme.colorScheme.onSurface
MaterialTheme.colorScheme.surfaceVariant
MaterialTheme.colorScheme.onSurfaceVariant
MaterialTheme.colorScheme.error
MaterialTheme.colorScheme.onError
MaterialTheme.colorScheme.background
MaterialTheme.colorScheme.outline
MaterialTheme.colorScheme.secondary

// WRONG — never for semantic UI
Color(0xFF3D5AFE)
Color.Red
Color.Gray
```

Exception: illustration/brand art with a fixed color is acceptable if labeled with a comment.

### Typography — MaterialTheme.typography only

```kotlin
// CORRECT
MaterialTheme.typography.titleLarge      // screen titles
MaterialTheme.typography.titleMedium     // section headers, card titles
MaterialTheme.typography.bodyLarge       // primary body text
MaterialTheme.typography.bodyMedium      // secondary body text
MaterialTheme.typography.labelLarge      // button labels
MaterialTheme.typography.labelSmall      // badges, chips, captions
MaterialTheme.typography.headlineMedium  // hero / stats numbers

// WRONG
fontSize = 16.sp   // never hardcode sizes for semantic text
fontWeight = FontWeight.Bold  // only add on top of a style if project pattern uses it
```

### Spacing — 4dp multiples only

```kotlin
// CORRECT
Modifier.padding(16.dp)
Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
Modifier.padding(top = 24.dp)
Spacer(modifier = Modifier.height(8.dp))
Arrangement.spacedBy(12.dp)

// WRONG
Modifier.padding(17.dp)   // arbitrary
Modifier.padding(7.dp)    // not a 4x multiple
```

Standard values: 4, 8, 12, 16, 20, 24, 32, 48, 64 dp

### Required states — all 4

**Loading:**

```kotlin
Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    CircularProgressIndicator()
}
```

**Empty:**

```kotlin
Column(
    modifier = Modifier.fillMaxSize().padding(32.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
) {
    Icon(Icons.Outlined.Inbox, contentDescription = null, modifier = Modifier.size(48.dp),
         tint = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(16.dp))
    Text("No records yet.", style = MaterialTheme.typography.bodyMedium,
         color = MaterialTheme.colorScheme.onSurfaceVariant)
    // Optional CTA:
    Spacer(Modifier.height(16.dp))
    Button(onClick = onCreateClick) { Text("Create first record") }
}
```

**Error:**

```kotlin
Column(
    modifier = Modifier.fillMaxSize().padding(32.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
) {
    Icon(Icons.Outlined.ErrorOutline, contentDescription = null, modifier = Modifier.size(48.dp),
         tint = MaterialTheme.colorScheme.error)
    Spacer(Modifier.height(16.dp))
    Text(errorMessage, style = MaterialTheme.typography.bodyMedium,
         color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    Spacer(Modifier.height(16.dp))
    OutlinedButton(onClick = onRetry) { Text("Retry") }
}
```

**Populated:** the real content inside `LazyColumn` / `LazyVerticalGrid` / etc.

### New screen checklist — run BEFORE writing any code

1. Find an existing similar screen — read it, match its Scaffold/ViewModel/State structure exactly
2. Confirm the navigation pattern (NavController, back stack, arguments)
3. Identify ViewModel → UiState → Composable data flow
4. List M3 components needed from palette above
5. Plan all 4 states
6. Only then write code — in this order: ViewModel → UiState → Screen Composable → Preview

### Form pattern

```kotlin
// ViewModel
val formState = mutableStateOf(FormData())
fun onFieldChange(field: String, value: String) { ... }
fun submit() {
    viewModelScope.launch {
        _uiState.value = ScreenNameUiState.Loading
        // call use case
        // on success: navigate or emit event
        // on error: _uiState.value = ScreenNameUiState.Error(...)
    }
}

// Submit button — always show loading while pending
Button(onClick = viewModel::submit, enabled = !isLoading) {
    if (isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
    else Text("Save")
}
```

User feedback: emit a `SnackbarEvent` via `SharedFlow` — never use Android `Toast` inside Composables. Snackbar shown via `LaunchedEffect + scaffoldState.snackbarHostState.showSnackbar(...)`.
