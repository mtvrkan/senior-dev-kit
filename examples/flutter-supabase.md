# Worked Example — Flutter + Supabase

Complete bootstrap walkthrough for a Flutter mobile app with Supabase backend.

---

## Stack detection

```text
pubspec.yaml contains: flutter, supabase_flutter, riverpod, go_router
Detected: Flutter + Supabase
```

Presets selected: `mobile/flutter` · `database/supabase`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/mobile/flutter/CLAUDE.md
├── settings.json
├── rules/
│   ├── 000-security.md          ← always active
│   ├── 001-conventions.md       ← always active
│   ├── 400-mobile.md            ← **/*.dart
│   ├── 500-database.md          ← Supabase RLS policies
│   └── 800-llm-safety.md        ← if using AI features
├── skills/                      ← all 32 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 14 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Flutter + Supabase

## preset: mobile/flutter

### Architecture
- Feature-first: `lib/features/[name]/{data,domain,presentation}/`
- State: Riverpod (code-gen providers) — `@riverpod` annotation on all providers
- Navigation: GoRouter with named routes — never `Navigator.push` in business logic
- No business logic in widgets. No DB access in widgets.

### Commands
- TEST_CMD: flutter test test/[file]_test.dart
- LINT_CMD: flutter analyze
- BUILD_CMD: flutter build apk (Android) | flutter build ios (iOS)
- PKG_MANAGER: pub (pubspec.yaml)

### Mobile rules
- Heavy work: always `compute()` or `Isolate` — never on main thread
- Images: use `cached_network_image` — never raw NetworkImage without cache
- Lists >20 items: use `flutter_animate` with `ListView.builder` — never Column
- Secrets: `flutter_secure_storage` — never hardcoded, never SharedPreferences

## preset: database/supabase

### Supabase rules
- Every table MUST have RLS enabled: `ALTER TABLE posts ENABLE ROW LEVEL SECURITY`
- Auth: always `supabase.auth.currentUser` — never trust client-provided user ID
- Realtime: subscribe to changes only for authenticated users (check auth in policy)
- Storage: bucket policies required — no public buckets without explicit approval
```

---

## Step 3 — Real usage flows

### Flow A: Add a new screen

**User:** "Add a profile screen where users can update their avatar and display name"

**Routing:** `new-screen` skill → `ui-fixer` agent (haiku)

**Agent behavior:**

1. Reads `lib/features/home/presentation/home_screen.dart` (nearest existing screen)
2. Reads `lib/core/theme/app_theme.dart` (design tokens)
3. Detects: Riverpod + GoRouter pattern
4. Plans 3 states: loading (shimmer) / loaded / saving

**Output:**

```text
PLAN: profile screen — 4 files
[P:A] lib/features/profile/domain/profile_repository.dart — abstract interface
[P:A] lib/features/profile/data/supabase_profile_repository.dart — Supabase impl
[S]   lib/features/profile/presentation/profile_provider.dart — @riverpod AsyncNotifier
[S]   lib/features/profile/presentation/profile_screen.dart — ConsumerWidget, 3 states
OK to proceed?
```

**After approval:**

```dart
// profile_screen.dart — loading state uses Shimmer, not CircularProgressIndicator
profileAsync.when(
  data: (profile) => ProfileForm(profile: profile),
  loading: () => const ProfileShimmer(),   // ← correct: shimmer for data
  error: (e, _) => ErrorView(onRetry: () => ref.refresh(profileProvider)),
)
```

```text
∙ lib/features/profile/domain/profile_repository.dart — interface with getProfile / updateProfile
∙ lib/features/profile/data/supabase_profile_repository.dart — Supabase queries with RLS
∙ lib/features/profile/presentation/profile_provider.dart — @riverpod AsyncNotifier
∙ lib/features/profile/presentation/profile_screen.dart — 3 states + avatar upload
∙ test/features/profile/profile_provider_test.dart — 3 test cases
TEST: flutter test test/features/profile/profile_provider_test.dart ✓ 3 passed
RISK: T2 · senior-engineer · UI+DB
```

---

### Flow B: Add a database table + RLS policy

**User:** "Add a `posts` table for user-created content"

**Routing:** DB schema signal → `db-guard` agent

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW (Supabase)
New table: posts (id, user_id FK, title, content, created_at)

RLS REQUIREMENT: every Supabase table MUST have Row Level Security.
Missing RLS = public read/write access for all users.

MIGRATION PLAN
[S] supabase/migrations/YYYYMMDD_create_posts.sql:
    CREATE TABLE posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX ix_posts_user_id ON posts (user_id);

[S] RLS policies (mandatory):
    ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
    
    -- Users see only their own posts
    CREATE POLICY "users_select_own" ON posts
      FOR SELECT USING (auth.uid() = user_id);
    
    -- Users create only their own posts
    CREATE POLICY "users_insert_own" ON posts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    -- Users update only their own posts
    CREATE POLICY "users_update_own" ON posts
      FOR UPDATE USING (auth.uid() = user_id);
    
    -- Users delete only their own posts
    CREATE POLICY "users_delete_own" ON posts
      FOR DELETE USING (auth.uid() = user_id);

[S] lib/features/posts/data/supabase_posts_repository.dart — CRUD via Supabase client

Approve to proceed?
```

---

### Flow C: Performance review — slow list screen

**User:** "The posts list screen is slow, sometimes freezes"

**Routing:** performance signal → `performance-guard` agent

**Agent reads:**

- `lib/features/posts/presentation/posts_screen.dart`
- `lib/features/posts/data/supabase_posts_repository.dart`

**Output:**

```text
PERFORMANCE REVIEW — posts_screen.dart
=======================================

HIGH: posts_screen.dart:34
  Issue: `Column` with `map()` for post list — rebuilds entire list on every state change
  Fix: Replace with `ListView.builder` — only builds visible items

HIGH: supabase_posts_repository.dart:18
  Issue: fetchPosts() selects `*` (all columns) including large `content` text field
  Fix: Select only needed fields: `.select('id, title, created_at, user_id')`
  Impact: ~70% reduction in payload size for list view

MEDIUM: posts_screen.dart:67
  Issue: `Image.network(url)` — no caching, re-downloads on every scroll
  Fix: Replace with `CachedNetworkImage(imageUrl: url)` from cached_network_image

LOW: posts_screen.dart:12
  Issue: Provider not using `.autoDispose` — posts stay in memory after leaving screen
  Fix: Add `.autoDispose` modifier: `@riverpod Future<List<Post>> posts(...)`

SUMMARY: High:2 Medium:1 Low:1
ESTIMATED IMPROVEMENT: list render time 800ms → ~120ms
```

---

## Step 4 — Cost estimates

| Task | Agent | Model | Typical cost |
| --- | --- | --- | --- |
| New screen (4 files) | senior-engineer | sonnet | ~$0.04 |
| Supabase table + RLS | db-guard | opus | ~$0.18 |
| Performance review | performance-guard | sonnet | ~$0.05 |
| Widget bug fix | bug-hunter | sonnet | ~$0.02 |
| Docs / README update | docs-writer | haiku | ~$0.003 |
