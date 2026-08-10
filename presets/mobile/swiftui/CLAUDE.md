# Project Preset — iOS / SwiftUI

## Architecture

- Feature folders: `Features/<Feature>/{Views,ViewModel,Models}`, shared code in `Core/`.
- MVVM with `@Observable` (iOS 17+) — one view model per screen, plain `struct` models.
- Views are declarative and dumb: they render state and send intents. No `URLSession`, no
  persistence, no formatting logic inside `body`.

```swift
@Observable
final class UserViewModel {
    private(set) var state: LoadState<User> = .loading
    private let repo: UserRepository

    init(repo: UserRepository) { self.repo = repo }

    @MainActor
    func load(id: String) async {
        state = .loading
        do    { state = .loaded(try await repo.user(id: id)) }
        catch { state = .failed(error) }
    }
}

struct UserScreen: View {
    let id: String
    @State private var vm: UserViewModel

    var body: some View {
        Group {
            switch vm.state {
            case .loading:        UserSkeleton()
            case .loaded(let u):  UserView(user: u)
            case .failed:         ErrorView { Task { await vm.load(id: id) } }
            }
        }
        .task { await vm.load(id: id) }   // cancelled automatically when the view goes away
    }
}
```

Loading, error-with-retry and empty are three required states.

## Concurrency — Swift 6 strict

- `async`/`await` and structured concurrency only. No completion-handler pyramids, no
  `DispatchQueue.main.async` to hop threads — annotate `@MainActor` instead.
- UI state mutation is `@MainActor`. A view model that touches published state off the main actor
  is a data race the compiler will now reject.
- `Task { }` inside a view is cancelled when the view disappears — use `.task { }` so
  cancellation is wired for you.
- `async let` / `TaskGroup` for independent work; sequential `await` only on a dependency.

## Networking

```swift
protocol UserRepository { func user(id: String) async throws -> User }

// Map transport errors to domain errors at the repository edge
struct APIError: Error { let status: Int }
```

A view never sees a `URLError`. `Codable` models with explicit `CodingKeys`; decoding failures
are surfaced as a domain error, not a crash.

## Storage and secrets

- Tokens and credentials go in the **Keychain**. `UserDefaults` is an unencrypted plist —
  never for anything sensitive.
- No API keys in source, `Info.plist`, or a committed `.xcconfig`. Anything secret belongs
  server-side.
- ATS stays on: no `NSAllowsArbitraryLoads`. Certificate pinning for financial flows.
- Universal links and custom URL schemes are untrusted input — validate every parameter.

## Lists and performance

- `List` / `LazyVStack` for anything scrollable; a plain `VStack` inside a `ScrollView` builds
  every row up front.
- Stable `Identifiable` ids — index-based ids cause wrong-row animations and lost state.
- Heavy work off the main actor; image decoding and JSON parsing are not free.
- `@State` for view-local values only; anything that survives the view belongs to the model.

## Accessibility is not optional

Every interactive element gets a label; support Dynamic Type (no fixed heights on text
containers); check VoiceOver on a real flow before calling a screen done.

## Verification

```bash
xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 15' \
  -only-testing:AppTests/UserViewModelTests
swiftlint
xcodebuild build -scheme App
```

## Anti-patterns

- Business logic or networking inside `body`.
- `UserDefaults` for tokens; secrets in `Info.plist`.
- `DispatchQueue.main.async` instead of `@MainActor`.
- Force unwraps (`!`) and `try!` on anything derived from network or user input.
- `ScrollView { VStack { ForEach ... } }` for a long list.
- `@State` holding data that outlives the view.
- Retain cycles in closures — `[weak self]` where a captured `self` outlives the call.
