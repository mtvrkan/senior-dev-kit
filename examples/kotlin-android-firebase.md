# Worked Example — Kotlin Android + Firebase (Firestore + Auth)

Complete bootstrap walkthrough for a Kotlin Android project using Jetpack Compose, Firebase Firestore, and Firebase Auth.

---

## Stack detection

```text
app/build.gradle.kts contains: com.google.firebase:firebase-firestore-ktx, com.google.firebase:firebase-auth-ktx,
  androidx.compose.ui:ui, androidx.hilt:hilt-android
Detected: Kotlin Android + Jetpack Compose + Firebase
```

Presets selected: `mobile/kotlin-android`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/mobile/kotlin-android/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active
│   ├── 300-testing.md           ← **/*Test.kt, **/*Spec.kt
│   └── 400-mobile.md            ← **/*.kt
├── skills/                      ← all 32 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 14 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Kotlin Android + Firebase

## preset: mobile/kotlin-android

### Architecture
- MVVM: Composable → ViewModel (StateFlow<UiState>) → Repository → Firebase SDK
- UiState: sealed class with Loading / Success / Empty / Error variants
- Hilt for DI — @HiltViewModel, @Inject on Repository
- No business logic in Composables; keep Firebase calls in Repository layer

### Commands
- TEST_CMD: ./gradlew test
- LINT_CMD: ./gradlew lint
- BUILD_CMD: ./gradlew assembleDebug
- DEVICE_TEST: ./gradlew connectedAndroidTest

### Security
- Firebase Auth: use request.auth.uid server-side (Firestore Security Rules)
- NEVER store Firebase tokens in SharedPreferences (use EncryptedSharedPreferences)
- API keys in local.properties — never in source code
- Security Rules must block reads/writes without valid auth.uid
```

---

## Usage flow 1 — New screen (ui-fixer / senior-engineer, Tier 2)

**Input**

```text
Add a "My Orders" screen that shows the current user's orders from Firestore
```

**Auto-routing:** `senior-engineer` (new screen + ViewModel + Firestore = Tier 2)

**Output (plan)**

```text
PLAN: My Orders screen — 4 files
∙ data/repository/OrderRepository.kt — fetchUserOrders(uid) Flow<List<Order>> from Firestore
∙ ui/orders/OrdersUiState.kt — sealed class Loading/Success/Empty/Error
∙ ui/orders/OrdersViewModel.kt — @HiltViewModel, exposes uiState StateFlow
∙ ui/orders/OrdersScreen.kt — Composable rendering all 4 UiState variants
OK to proceed?
```

**After approval**

```text
∙ data/repository/OrderRepository.kt:1 — @Inject constructor, firestore.collection("orders")
    .whereEqualTo("userId", uid).snapshots().map { ... }
∙ ui/orders/OrdersUiState.kt:1 — sealed class; Success wraps List<Order>; Empty when empty
∙ ui/orders/OrdersViewModel.kt:1 — viewModelScope.launch; collectLatest on repository Flow
∙ ui/orders/OrdersScreen.kt:1 — Scaffold + TopAppBar + when(uiState) rendering all 4 states
    Loading: Box(fillMaxSize) + CircularProgressIndicator
    Empty: Column(center) + Icon + Text + FilledButton("Shop now")
    Error: Column(center) + Icon(error) + Text + OutlinedButton("Retry")
    Success: LazyColumn with OrderCard composables
TEST: ./gradlew test --tests "*.OrdersViewModelTest" ✓ 4 passed
RISK: T2 · senior-engineer · new screen + Firestore read
```

---

## Usage flow 2 — Firestore Security Rules review (security-guard, Tier 3)

**Input**

```text
Review our Firestore Security Rules — do they properly scope data to the current user?
```

**Auto-routing:** auth/security keyword → `security-guard` (Tier 3)

**Output**

```text
ESCALATE TO: security-guard — Firebase Security Rules touched

SECURITY REVIEW — firestore.rules

FINDING 1: CRITICAL | rules line 8 | orders collection allows read without auth check
  Current: allow read: if true;
  Fix: allow read: if request.auth != null && resource.data.userId == request.auth.uid;

FINDING 2: HIGH | rules line 15 | write rule trusts client-provided userId field
  Current: allow write: if request.resource.data.userId == request.auth.uid;
  Risk: user can impersonate another by setting userId before writing
  Fix: on create, enforce: request.resource.data.userId == request.auth.uid
       on update, verify: resource.data.userId == request.auth.uid (existing doc ownership)

FINDING 3: MEDIUM | rules line 22 | no validation on order amount field
  Risk: client can write arbitrary amounts; amounts must be computed server-side (Cloud Function)
  Fix: remove amount from client-writable fields; write via Cloud Function after payment confirmation

FINDING 4: LOW | rules — no rate-limit rule (Firestore does not support this natively)
  Recommendation: implement rate limiting in Cloud Functions for write-heavy paths

SEVERITY: CRITICAL — deploy fix before going to prod
```

---

## Usage flow 3 — Crash / bug fix (bug-hunter, Tier 0-1)

**Input**

```text
java.lang.NullPointerException at OrdersViewModel.kt:34
  com.example.app.ui.orders.OrdersViewModel.loadOrders(OrdersViewModel.kt:34)
```

**Auto-routing:** `bug-hunter` (stack trace present, no clarification needed)

**Output**

```text
ROOT: OrdersViewModel.kt:34 — currentUser accessed before auth state is ready; Firebase Auth
  returns null user on cold start before listener fires
FIX:  ui/orders/OrdersViewModel.kt:34 — guard with null check:
  val uid = auth.currentUser?.uid ?: run { _uiState.value = OrdersUiState.Error("Not signed in"); return }
TEST: ./gradlew test --tests "*.OrdersViewModelTest.loadsOrders_whenUserIsNull_showsError" ✓ 1 passed
RISK: low · bug-hunter · null guard added
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| Composable bug fix | bug-hunter | sonnet | ~$0.02 |
| New screen + ViewModel | senior-engineer | sonnet | ~$0.06 |
| Firestore Security Rules review | security-guard | opus | ~$0.18 |
| Auth flow review | security-guard | opus | ~$0.15 |
| Unit test addition | test-engineer | sonnet | ~$0.03 |
| Dep audit (build.gradle) | security-scanner | sonnet | ~$0.04 |
