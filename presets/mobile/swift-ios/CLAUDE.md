# Project Preset — Swift iOS

## Architecture

- Follow existing UIKit/SwiftUI architecture.
- Respect state ownership and lifecycle.
- Keep networking/storage/business logic out of views when project has services/view models.
- Do not modify entitlements, permissions, in-app purchases, signing, or auth unless requested.

## Data / concurrency

- Respect async/await, Combine, or callback patterns already in the project.
- Avoid blocking the main thread.
- Keep CoreData/SwiftData changes behind the db-change workflow.

## Verification

Use configured tools:

- `swift test`
- `xcodebuild test` if configured
- Build only when relevant

## Anti-patterns

- Force unwraps in user-facing flows.
- Main-thread blocking network/storage work.
- Entitlement changes for local UI tasks.
- Hardcoded colors instead of semantic system colors or Asset Catalog colors.
- Missing loading/empty/error states.

---

## Design From Scratch — SwiftUI Standard

Use this section when building a NEW view, sheet, or major screen section that has no existing design to reference.

### Non-negotiable quality gates

Before calling a from-scratch view "done", verify ALL of these:

- [ ] Existing similar view found and structure matched
- [ ] Existing navigation pattern used (NavigationStack / TabView / existing coordinator)
- [ ] Loading state renders (ProgressView, skeleton, or redacted)
- [ ] Empty state shown when list/content is empty (`ContentUnavailableView` on iOS 17+ or equivalent)
- [ ] Error state shown with retry option
- [ ] `@StateObject` / `@ObservableObject` / `@Observable` ViewModel pattern used
- [ ] All colors use semantic system colors or Asset Catalog named colors — never `Color(hex:)` literals for semantic UI
- [ ] Spacing uses 8pt grid (multiples of 8, or 4 for fine-tuning)
- [ ] Build succeeds

### ViewModel pattern — always use

```swift
// SwiftUI + @Observable (iOS 17+)
@Observable
class ScreenNameViewModel {
    var state: ScreenState = .loading
    
    func load() async { ... }
    func retry() async { await load() }
}

enum ScreenState {
    case loading
    case loaded([Item])
    case empty
    case error(String)
}

// View
struct ScreenNameView: View {
    @State private var viewModel = ScreenNameViewModel()
    
    var body: some View {
        Group {
            switch viewModel.state {
            case .loading: loadingView
            case .loaded(let items): contentView(items)
            case .empty: emptyView
            case .error(let msg): errorView(msg)
            }
        }
        .task { await viewModel.load() }
    }
}
```

For iOS 16 and below, use `@StateObject` + `ObservableObject` + `@Published`.

### SwiftUI component palette — prefer in this order

| Need | Component |
| --- | --- |
| Screen root | `NavigationStack` (iOS 16+) or `NavigationView` (iOS 15) |
| List | `List` / `LazyVStack` in `ScrollView` |
| Card | `VStack` or `HStack` with `.background(.background).clipShape(RoundedRectangle(cornerRadius: 12)).shadow(...)` |
| Primary button | `Button` with `.buttonStyle(.borderedProminent)` |
| Secondary button | `Button` with `.buttonStyle(.bordered)` |
| Destructive button | `Button(role: .destructive)` |
| Loading | `ProgressView()` centered, or `.redacted(reason: .placeholder)` for skeleton |
| Empty state | `ContentUnavailableView` (iOS 17+) or custom centered VStack with icon + text + CTA |
| Error state | Custom centered VStack with icon + message + retry button |
| Input field | `TextField` / `SecureField` inside `Form` or `VStack` |
| Picker | `Picker` / `Menu` with `Picker` |
| Modal/sheet | `.sheet(isPresented:)` / `.fullScreenCover(isPresented:)` |
| Confirmation | `.confirmationDialog(...)` or `Alert` |
| Alert | `.alert(...)` |
| Snackbar/toast | `.overlay` with custom banner or existing project toast — never `UIAlertController` for simple feedback |
| Context menu | `.contextMenu { ... }` / swipe actions: `.swipeActions { ... }` |

### Color — semantic system colors only

Never use `Color(hex: "3D5AFE")` or `Color(.systemBlue)` for semantic UI without a reason.

```swift
// CORRECT — system semantic colors
Color(.systemBackground)      // primary background
Color(.secondarySystemBackground)  // card / cell background
Color(.tertiarySystemBackground)   // inner card / grouped table background
Color(.label)                 // primary text
Color(.secondaryLabel)        // secondary text, captions
Color(.tertiaryLabel)         // placeholder, disabled
Color(.systemFill)            // interactive fills
Color(.systemRed)             // destructive actions
Color(.systemGreen)           // success / positive
Color(.systemOrange)          // warning

// CORRECT — Asset Catalog named colors (preferred for brand colors)
Color("PrimaryBrand")
Color("AccentColor")

// WRONG for semantic UI
Color(hex: "#3D5AFE")
Color(red: 0.23, green: 0.35, blue: 1.0)
```

### Typography — system text styles (Dynamic Type)

Always use system text styles so Dynamic Type works correctly:

```swift
// CORRECT
Text("Title").font(.largeTitle)       // hero, navigation titles
Text("Title").font(.title)            // section headers
Text("Title").font(.title2)           // subsection headers
Text("Text").font(.headline)          // card titles, list headers (semibold)
Text("Text").font(.subheadline)       // list subtitles
Text("Text").font(.body)              // default body text
Text("Text").font(.callout)           // secondary body
Text("Text").font(.footnote)          // footnotes, meta info
Text("Text").font(.caption)           // captions, badges, chips

// WRONG
Text("Text").font(.system(size: 16, weight: .semibold))  // hardcoded size
```

### Spacing — 8pt grid

```swift
// CORRECT
.padding(16)
.padding(.horizontal, 16)
.padding(.vertical, 8)
.padding(.top, 24)
VStack(spacing: 12) { ... }
HStack(spacing: 8) { ... }

// WRONG
.padding(17)   // arbitrary
.padding(7)    // not on grid
VStack(spacing: 5) { ... }
```

Standard values: 4, 8, 12, 16, 20, 24, 32, 48 pt

Note: 20pt is a deliberate platform exception (Apple HIG's standard margin/inset unit), not a violation — iOS spacing follows HIG conventions, not the stricter web 8px grid in `rules/100-web.md` (which governs `.tsx`/`.vue`/etc. only and doesn't apply to Swift).

### Required states — all 4

**Loading:**

```swift
var loadingView: some View {
    ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
}
```

**Empty (iOS 17+):**

```swift
ContentUnavailableView {
    Label("No records yet", systemImage: "tray")
} description: {
    Text("Tap the button to create the first record.")
} actions: {
    Button("Create") { viewModel.onCreate() }
        .buttonStyle(.borderedProminent)
}
```

**Empty (iOS 16 and below):**

```swift
VStack(spacing: 16) {
    Image(systemName: "tray").font(.system(size: 48)).foregroundStyle(.secondary)
    Text("No records yet.").font(.headline).foregroundStyle(.secondary)
    Button("Create") { viewModel.onCreate() }.buttonStyle(.borderedProminent)
}
.frame(maxWidth: .infinity, maxHeight: .infinity)
```

**Error:**

```swift
VStack(spacing: 16) {
    Image(systemName: "exclamationmark.triangle").font(.system(size: 48))
        .foregroundStyle(Color(.systemOrange))
    Text(errorMessage).font(.subheadline).multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    Button("Retry") { Task { await viewModel.retry() } }
        .buttonStyle(.bordered)
}
.padding(32)
.frame(maxWidth: .infinity, maxHeight: .infinity)
```

**Populated:** real content in `List` or `LazyVStack`.

### Form pattern

```swift
// State
@State private var isSubmitting = false
@State private var fieldValue = ""

// Submit button — always show loading
Button {
    Task {
        isSubmitting = true
        await viewModel.submit(...)
        isSubmitting = false
    }
} label: {
    if isSubmitting {
        ProgressView().tint(.white)
    } else {
        Text("Save")
    }
}
.buttonStyle(.borderedProminent)
.disabled(isSubmitting)
```

Feedback: `.alert` for errors, `.overlay` banner for success, or existing project pattern. Never `UIAlertController` from a SwiftUI view.

### New screen checklist — run BEFORE writing any code

1. Find an existing similar view — read it, match its ViewModel/State/navigation pattern
2. Identify iOS deployment target (affects `ContentUnavailableView` availability, `@Observable`, etc.)
3. Identify state management pattern in use
4. Plan all 4 states
5. List SwiftUI components needed from palette above
6. Only then write code — in order: ViewModel/State → View body → sub-views → previews
