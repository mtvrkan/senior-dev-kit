# Project Preset — Flutter

## Architecture

- Follow existing state management: Provider, Riverpod, Bloc, GetX, setState, or project pattern.
- Keep widgets small and composable.
- Keep business logic out of UI widgets when the project has services/controllers/cubits.
- Do not change native Android/iOS config unless requested.

## Data / platform

- Respect existing API/client/storage patterns.
- Be careful with permissions, notifications, billing, auth, and deep links.
- Keep offline/cache behavior consistent.

## Verification

Use:

- `flutter analyze`
- `flutter test`
- Targeted widget tests when behavior changes

## Anti-patterns

- Rewriting state management for one feature.
- Putting async business logic directly in build methods.
- Modifying native files for Dart-only tasks.
- Hardcoded colors instead of Theme tokens.
- Missing loading/empty/error states.

---

## Design From Scratch — Flutter Material 3 Standard

Use this section when building a NEW screen, bottom sheet, dialog, or major widget section that has no existing design to reference.

### Non-negotiable quality gates

Before calling a from-scratch screen "done", verify ALL of these:

- [ ] Existing similar screen found and structure matched
- [ ] Scaffold with AppBar (or existing chrome pattern) used
- [ ] Loading state renders (not blank flash)
- [ ] Empty state shown when list is empty
- [ ] Error state shown with retry when fetch fails
- [ ] All colors from `Theme.of(context).colorScheme` — never `Colors.X`
- [ ] All text styles from `Theme.of(context).textTheme` — never raw `TextStyle(fontSize: ...)`
- [ ] Spacing uses 4x multiples only
- [ ] `flutter analyze` passes with no errors

### State pattern

Use the existing project pattern (Bloc, Riverpod, Provider, GetX). Always represent screen state with a sealed class / union / freezed class:

```dart
// Bloc / Cubit example
abstract class ScreenState {}
class ScreenLoading extends ScreenState {}
class ScreenLoaded extends ScreenState { final List<Item> items; ... }
class ScreenEmpty extends ScreenState {}
class ScreenError extends ScreenState { final String message; ... }

// Riverpod AsyncValue example
// Use AsyncValue<List<Item>> — gives loading/data/error for free
```

Screen `build()` renders all states — never return a blank widget.

### Material 3 widget palette — prefer in this order

| Need | Widget |
| --- | --- |
| Screen root | `Scaffold` with `appBar`, `body`, optional `floatingActionButton` |
| App bar | `AppBar` / `SliverAppBar` with M3 styling |
| Scrollable list | `ListView.builder` / `SliverList` — never `Column` with many children |
| Card | `Card` (M3 filled) / `Card(elevation: 0, shape: ...)` |
| Primary action | `FilledButton` |
| Secondary action | `OutlinedButton` / `TextButton` |
| FAB | `FloatingActionButton` / `FloatingActionButton.extended` |
| Loading (list/card content) | Shimmer skeleton (`shimmer` package) matching content shape — never `CircularProgressIndicator` for list loading (see `rules/400-mobile.md`) |
| Loading (brief full-screen block, e.g. app splash) | `CircularProgressIndicator.adaptive()` centered in `Center(child: ...)` |
| Linear progress | `LinearProgressIndicator` at top or inside card |
| Input field | `TextField` with `InputDecoration` / `TextFormField` inside `Form` |
| Chip/filter | `FilterChip` / `InputChip` / `ActionChip` |
| Dialog | `showDialog` + `AlertDialog` (M3) |
| Bottom sheet | `showModalBottomSheet` |
| Snackbar | `ScaffoldMessenger.of(context).showSnackBar(...)` — never third-party toast for M3 UI |
| Status/badge | Custom `Container` with `BorderRadius.circular(12)` + colorScheme token |
| Navigation | `NavigationBar` (bottom, M3) / `NavigationRail` (tablet) / `Drawer` |

### Color — Theme tokens only

Never use `Colors.blue`, `Colors.grey`, `Colors.red` for semantic UI.

```dart
// CORRECT
Theme.of(context).colorScheme.primary
Theme.of(context).colorScheme.onPrimary
Theme.of(context).colorScheme.surface
Theme.of(context).colorScheme.onSurface
Theme.of(context).colorScheme.surfaceVariant
Theme.of(context).colorScheme.onSurfaceVariant
Theme.of(context).colorScheme.error
Theme.of(context).colorScheme.onError
Theme.of(context).colorScheme.background
Theme.of(context).colorScheme.outline
Theme.of(context).colorScheme.secondary

// WRONG — never for semantic UI
Colors.blue
Colors.grey[500]
Color(0xFF3D5AFE)
```

### Typography — Theme.of(context).textTheme only

```dart
// CORRECT
Theme.of(context).textTheme.titleLarge     // screen/section titles
Theme.of(context).textTheme.titleMedium    // card titles, list headers
Theme.of(context).textTheme.bodyLarge      // primary body
Theme.of(context).textTheme.bodyMedium     // secondary body, list subtitles
Theme.of(context).textTheme.labelLarge     // button labels
Theme.of(context).textTheme.labelSmall     // chips, badges, captions
Theme.of(context).textTheme.headlineMedium // hero numbers / stats

// WRONG
TextStyle(fontSize: 16, fontWeight: FontWeight.bold)  // never raw
```

### Spacing — 4dp/px multiples only

```dart
// CORRECT
Padding(padding: const EdgeInsets.all(16))
Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8))
SizedBox(height: 12)
SizedBox(width: 8)
mainAxisSpacing: 12, crossAxisSpacing: 12  // GridView

// WRONG
Padding(padding: const EdgeInsets.all(17))  // arbitrary
SizedBox(height: 7)
```

Standard values: 4, 8, 12, 16, 20, 24, 32, 48 dp

Note: 20dp follows Material Design's 4dp base grid (not the stricter 8dp web grid in `rules/100-web.md`, which governs `.tsx`/`.vue`/etc. only and doesn't apply to Dart) — a deliberate platform allowance, not a violation.

### Required states — all 4

**Loading** (list/card content — shimmer skeleton, not a spinner):

```dart
Shimmer.fromColors(
  baseColor: Theme.of(context).colorScheme.surfaceVariant,
  highlightColor: Theme.of(context).colorScheme.surface,
  child: ListView.builder(
    itemCount: 6,
    itemBuilder: (_, __) => Container(
      height: 72,
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  ),
)
```

**Empty:**

```dart
Center(
  child: Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(Icons.inbox_outlined, size: 48,
           color: Theme.of(context).colorScheme.onSurfaceVariant),
      const SizedBox(height: 16),
      Text('No records yet.',
           style: Theme.of(context).textTheme.bodyMedium?.copyWith(
             color: Theme.of(context).colorScheme.onSurfaceVariant)),
      // Optional CTA:
      const SizedBox(height: 16),
      FilledButton(onPressed: onCreateTap, child: const Text('Create first record')),
    ],
  ),
)
```

**Error:**

```dart
Center(
  child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.error_outline, size: 48,
             color: Theme.of(context).colorScheme.error),
        const SizedBox(height: 16),
        Text(errorMessage, textAlign: TextAlign.center,
             style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 16),
        OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    ),
  ),
)
```

**Populated:** real content inside `ListView.builder` / `GridView.builder`.

### Form pattern

```dart
final _formKey = GlobalKey<FormState>();

// Each field wrapped in TextFormField with validator
TextFormField(
  decoration: const InputDecoration(labelText: 'Field name'),
  validator: (v) => v == null || v.isEmpty ? 'Required field' : null,
)

// Submit button — disabled while loading
FilledButton(
  onPressed: isLoading ? null : _submit,
  child: isLoading
    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
    : const Text('Save'),
)
```

On success/error: `ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(...)))`. Never `showDialog` for simple feedback.

### New screen checklist — run BEFORE writing any code

1. Find an existing similar screen — read it, match structure (state pattern, scaffold, list type)
2. Identify state management pattern in use
3. Plan screen states: loading | empty | error | populated
4. List widgets needed from M3 palette above
5. Only then write code — in order: state class → controller/cubit → screen widget → sub-widgets
