---
name: new-screen
description: Use when building a brand-new mobile screen, bottom sheet, or major UI section from scratch in Kotlin/Compose, Flutter, or Swift/SwiftUI. Enforces design quality gates. Do NOT use for modifying existing screens — use ui-change instead.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically when the task is to create a new screen or major UI section in a mobile app from scratch.
argument-hint: "[screen name]"
---

# new-screen

New mobile screen from scratch. Follow this protocol — do not skip steps. See `agent_docs/new-screen-guide.md` for UiState patterns, component palettes, platform tokens, and the quality gate checklist.

1. Detect platform: build.gradle(.kts) → Kotlin/Compose | pubspec.yaml → Flutter | .xcodeproj/.swift → Swift/SwiftUI.
2. Find a similar existing screen and read it fully — extract navigation/routing pattern, state management, component structure.
3. Plan all 4 states (loading | empty | error | populated), output plan before coding. Wait for "go" if 3+ components or a form.
4. STOP + ESCALATE to security-guard if the screen handles auth or payment data — this is a hard stop, not a "wait for go and proceed" case.
5. Build in order: UiState/state class → ViewModel/Controller → screen skeleton → loading → error → empty → populated → forms/dialogs/sheets → previews.
6. Colors/typography from theme/semantic tokens only — never hardcoded. Spacing: 4dp/8pt grid only. Feedback: Snackbar/SnackBar/.alert — never Toast/alert().
7. First screen in a new app, or no design direction recorded? That belongs to `design-lead` — brief intake, then idiom distance + material + motion + the one signature moment settled **with the user** and recorded before building; existing app → match the screens read in step 2, never introduce a second character.
8. Run `/design-check` and `/a11y-check` after building — this skill covers states and platform tokens, not direction adherence, monotony, whether the signature landed, or TalkBack/VoiceOver conformance.

## Output

```text
· [platform] [screen name — files created]
REF: [similar screen] | STATES: loading ✓ | empty ✓ | error ✓ | populated ✓
VERIFY: [lint/analyze — ✓] | RISK: low | medium
```
