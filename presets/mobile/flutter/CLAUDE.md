# Project Preset — Flutter / Dart

## Architecture

- Feature-first: `lib/features/<feature>/{presentation,domain,data}/`. Shared code in
  `lib/core/`.
- Riverpod for state and dependency injection. Widgets read providers; they never construct
  repositories themselves.
- Repositories return domain models, not raw JSON or `Response` objects.

```dart
// lib/features/users/data/user_repository.dart
final userRepositoryProvider = Provider((ref) => UserRepository(ref.watch(dioProvider)));

final userProvider = FutureProvider.family<User, String>((ref, id) =>
    ref.watch(userRepositoryProvider).getById(id));

// lib/features/users/presentation/user_screen.dart
class UserScreen extends ConsumerWidget {
  const UserScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(userProvider(id)).when(
      data:    (user) => UserView(user: user),
      loading: () => const UserSkeleton(),      // never a bare spinner for a known layout
      error:   (e, _) => ErrorView(onRetry: () => ref.invalidate(userProvider(id))),
    );
  }
}
```

Three states are mandatory on every async surface: loading, error with retry, and empty.

## Widgets — rebuild cost is the whole game

- `const` on every widget that can be `const`. It is the cheapest optimization Flutter has.
- Split large `build()` methods into separate widget classes, not private `_buildX()` methods —
  only a real widget boundary stops the subtree from rebuilding.
- `ListView.builder` / `SliverList` for any list that can exceed a screen. Never
  `ListView(children: [...])` over a network-sized list.
- `compute()` for anything CPU-heavy — JSON parsing of a large payload included. The UI thread
  drops frames at 16ms.

## State — Riverpod rules

- `ref.watch` in `build`, `ref.read` in callbacks. `ref.watch` inside `onPressed` is a bug.
- `AsyncNotifier` for state with side effects; `Provider` for pure dependencies.
- Never store a `BuildContext` in a provider or use one after an `await` without checking
  `context.mounted`.

## Networking and errors

```dart
try {
  final res = await dio.get('/users/$id');
  return User.fromJson(res.data as Map<String, dynamic>);
} on DioException catch (e) {
  throw switch (e.response?.statusCode) {
    404 => NotFoundFailure(),
    401 => UnauthorizedFailure(),
    _   => NetworkFailure(e.message),
  };
}
```

Map transport errors to domain failures at the repository edge. A widget should never see a
`DioException`.

## Security

- Secrets never live in Dart constants or `pubspec.yaml` — they ship inside the binary. Use
  `--dart-define` at build time plus platform secure storage (`flutter_secure_storage`, backed by
  Keychain/Keystore) for tokens.
- Certificate pinning for anything financial. No cleartext HTTP.
- Deep links are untrusted input — validate every parameter before routing.

## Verification

```bash
flutter test test/features/users/user_repository_test.dart   # targeted
flutter analyze                                              # lint + type issues
dart format --set-exit-if-changed .                          # style
flutter build apk --debug                                    # compile check
osv-scanner -L pubspec.lock                                  # CVE check (no `pub audit` exists)
```

## Anti-patterns

- Missing `const` on static widgets.
- `_buildSomething()` helper methods instead of widget classes.
- `ListView(children: [...])` for a dynamic list.
- Business logic or HTTP calls inside `build()`.
- `setState` in a widget that already has a Riverpod provider for that state.
- `BuildContext` used across an `await` without `context.mounted`.
- API keys in Dart source or committed `.env` assets.
- `print()` instead of a logger; it ships to release builds.
