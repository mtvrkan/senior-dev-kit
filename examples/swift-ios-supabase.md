# Worked Example — Swift iOS + Supabase

Complete bootstrap walkthrough for a SwiftUI iOS app with Supabase (PostgreSQL + Auth + Storage).

---

## Stack detection

```text
Package.swift contains: supabase-swift (io.supabase:supabase-swift)
Detected: Swift iOS + Supabase (Auth + Postgres + Storage)
```

Presets selected: `mobile/swift-ios`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/mobile/swift-ios/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active
│   ├── 300-testing.md           ← **/*Tests/**
│   └── 400-mobile.md            ← **/*.swift
├── skills/                      ← all 32 skills
├── agents/                      ← all 14 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Swift iOS + Supabase

## preset: mobile/swift-ios

### Architecture
- MVVM: View (@Observable ViewModel) → Service → Supabase client
- State: enum ViewState { loading, loaded([T]), empty, error(String) }
- Networking: async/await only — never callbacks or Combine for Supabase calls
- Auth: session stored by Supabase SDK in Keychain — never UserDefaults
- RLS: all Supabase tables must have Row Level Security enabled

### Commands
- TEST_CMD: xcodebuild test -scheme AppName -only-testing:AppNameTests
- LINT_CMD: swiftlint
- BUILD_CMD: xcodebuild build -scheme AppName -configuration Debug

### Security
- supabase.auth.session is the auth source of truth — never trust client-passed userId
- anon key goes in .xcconfig (never hardcoded in source)
- Service role key stays server-side only (never in iOS app)
- Image uploads via Storage: validate file type and size before upload
```

---

## Usage flow 1 — New screen with Supabase data (senior-engineer, Tier 2)

**Input**

```text
Add a "My Bookings" screen that fetches the user's bookings from Supabase
```

**Auto-routing:** `senior-engineer` (new screen + ViewModel + Supabase query = Tier 2)

**Output (plan)**

```text
PLAN: My Bookings screen — 3 files
∙ Services/BookingService.swift — fetchBookings(userId) async throws → [Booking] via supabase.from("bookings")
∙ ViewModels/BookingsViewModel.swift — @Observable, ViewState enum, load() async, retry()
∙ Views/BookingsView.swift — SwiftUI view rendering all 4 states
OK to proceed?
```

**After approval**

```text
∙ Services/BookingService.swift:1 — fetchBookings via supabase.from("bookings")
    .select().eq("user_id", userId).execute().value
∙ ViewModels/BookingsViewModel.swift:1 — @Observable; enum ViewState; Task { await load() } on appear
∙ Views/BookingsView.swift:1 — NavigationStack → switch viewModel.state rendering all 4 states
    .loading: ProgressView().frame(maxWidth:.infinity, maxHeight:.infinity)
    .empty: ContentUnavailableView("No bookings yet", systemImage: "calendar.badge.plus") + CTA
    .error: VStack with Image(systemName:"exclamationmark.triangle") + Text + retry Button
    .loaded: List with BookingRowView for each item
TEST: xcodebuild test -scheme App -only-testing:AppTests/BookingsViewModelTests ✓ 4 passed
RISK: T2 · senior-engineer · new screen + Supabase read
```

---

## Usage flow 2 — Supabase RLS review (db-guard + security-guard, Tier 3)

**Input**

```text
Add a reviews table so users can leave reviews for each booking
```

**Auto-routing:** new table + RLS = `db-guard` (Tier 3)

**Output**

```text
ESCALATE TO: db-guard — Supabase schema change detected

DB CHANGE REVIEW
Change: new table `reviews` (booking_id FK, user_id, rating INTEGER CHECK 1-5, body TEXT, created_at)
Risk: medium — FK to bookings; RLS policies required before any client access

PLAN
[S] Create table via Supabase Dashboard or migration:
    CREATE TABLE reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id),
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      body TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
[S] Enable RLS: ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
[S] RLS policies:
    CREATE POLICY "Users read own reviews" ON reviews
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users insert own reviews" ON reviews
      FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND user_id = auth.uid())
      );
[S] Index: CREATE INDEX ON reviews(booking_id); CREATE INDEX ON reviews(user_id);
[S] Test with SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" TO 'test-uid';
[S] Update BookingService.swift to include review fetch if needed

Approve to proceed?
```

---

## Usage flow 3 — Auth state bug (bug-hunter, Tier 1)

**Input**

```text
The app shows the home screen for a split second before redirecting to login — looks bad
```

**Auto-routing:** `bug-hunter` (UX flash/bug, no auth logic change needed)

**Output**

```text
ROOT: The root view renders before supabase.auth.session resolves; session check is async
  but the view appears with .loading → briefly shows protected content before redirect fires
FIX:  App.swift / RootView.swift — hold in a splash/loading state until session check completes:
  @Observable class AppState { var isReady = false; var session: Session? }
  In .task: appState.session = try? await supabase.auth.session; appState.isReady = true
  In body: if !appState.isReady { SplashView() } else if appState.session != nil { HomeView() }
              else { LoginView() }
TEST: manual — cold launch no longer flashes home screen before login redirect ✓
RISK: low · bug-hunter · auth state initialization
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| SwiftUI view bug | bug-hunter | sonnet | ~$0.02 |
| New screen + ViewModel | senior-engineer | sonnet | ~$0.06 |
| Supabase table + RLS policies | db-guard → senior-engineer | opus → sonnet | ~$0.20 |
| Auth flow security review | security-guard | opus | ~$0.15 |
| Unit test addition | test-engineer | sonnet | ~$0.03 |
| Dep audit (Package.swift) | security-scanner | sonnet | ~$0.04 |
