---
description: Audit built UI against WCAG 2.2 AA — keyboard, focus, contrast, state announcement, targets, reflow.
argument-hint: "[page, screen, flow, or component — optional]"
---

# /a11y-check

Audit what was actually built for accessibility: $ARGUMENTS

`/design-check` asks whether the UI looks like its own product and checks the accessibility
invariants in one line. This is that line expanded into an audit, because those invariants are
where a distinctive interface most often fails and because a keyboard user does not care how good
the type pairing is. The requirement tables live in `rules/100-web.md` (web) and
`rules/400-mobile.md` (mobile) — read the one that matches the platform; they are not restated
here.

Unlike the other audit commands, **findings here are fix-on-sight** (global CLAUDE.md's `A11Y:`
line): report them, then route the fixes through `ui-change` in the same session rather than
recording them as debt. An accessibility defect is a broken product for the people who hit it.

**Step 1 — Structure.** One `<h1>`; heading levels descend without skipping; landmarks present and
unique (`<main>`, `<nav>`, `<header>`, `<footer>`); lists marked up as lists; `<button>` for
actions and `<a href>` for navigation — a `<div onClick>` is unreachable, unannounced and
unstyled by every assistive layer at once.

**Step 2 — Keyboard.** Tab through the whole flow in DOM order: every interactive element
reachable, nothing reachable that should not be, no trap, no positive `tabindex`. Escape closes
every overlay. Enter/Space activate what looks activatable. Custom widgets (menu, combobox, tabs,
tree) implement the APG keyboard pattern, not a partial one.

**Step 3 — Focus.** Visible indicator on every focusable element, ≥3:1 against its own surround,
never removed without a replacement. Focus moves into a dialog on open and returns to the trigger
on close. A route change moves focus to the new page's heading — otherwise a screen-reader user is
still in the old page. Sticky headers must not cover the focused element (2.4.11 — `scroll-margin`).

**Step 4 — Names and forms.** Every icon-only control has an accessible name; every input has a
real `<label>` (a placeholder is not one); the accessible name contains the visible label (2.5.3);
errors are associated via `aria-describedby` and announced (`role="alert"`); required and invalid
are conveyed to the API, not only in colour; `autocomplete` set on identity/payment fields (1.3.5);
and no field asks the user to re-enter information they already gave (3.3.7).

**Step 5 — State reaches the API.** `aria-busy` while submitting, `aria-invalid` on a failed field,
native `disabled` (or `aria-disabled` when the control must stay focusable and explain itself),
`aria-expanded`/`aria-selected`/`aria-current` where the widget claims them, and a live region for
content that changes without a page load. A spinner and a red border announce nothing.

**Step 6 — Colour and contrast.** Body ≥4.5:1, large text ≥3:1, UI components and focus indicators
≥3:1 — measured against the **actual composited background**, which is where glass, gradients,
overlays and saturated colour fields fail. Nothing conveyed by colour alone. Check both themes,
and check the disabled and placeholder states people habitually skip.

**Step 7 — Targets and pointer.** Interactive targets ≥24×24 CSS px (2.5.8), 44×44 recommended;
adequate spacing between adjacent targets. Every drag has a single-pointer alternative (2.5.7).
No hover-only affordance and no action bound to a path-based gesture without a simple alternative.

**Step 8 — Reflow, zoom and motion.** 320px width with no horizontal scrolling (1.4.10); 200% zoom
without loss of content or function; text-spacing overrides do not clip (1.4.12).
`prefers-reduced-motion` honoured, and nothing flashes more than three times a second.

**Step 9 — Content.** Meaningful `alt` on informative images and `alt=""` on decorative ones; link
text that makes sense out of context (never "click here"); `lang` on `<html>` and on any passage in
another language; captions on video and a transcript for audio; tables with real headers and scope.

**Step 10 — Mobile, when it applies.** Content descriptions on every control, Dynamic Type / font
scaling honoured (never a fixed size for body copy), touch targets 44pt/48dp, focus order sensible
under TalkBack/VoiceOver, safe areas respected, and the reduce-motion setting obeyed —
`rules/400-mobile.md` is canonical.

**Tooling — run what the project has, and say what you could not run.** `axe` / Lighthouse
accessibility audit, `eslint-plugin-jsx-a11y`, `@axe-core/playwright` in an e2e run, Accessibility
Scanner (Android), Accessibility Inspector (Xcode). Automated tools catch roughly a third of
WCAG failures: steps 2, 3 and 5 above are keyboard and screen-reader work no scanner performs, so
a green axe run is not a pass and must never be reported as one.

**Output format:**

```text
ACCESSIBILITY AUDIT — WCAG 2.2 AA
=================================

SCOPE: [page/flow audited] · [themes checked] · [tool run | none available]

BLOCKERS (unusable for someone):
  ✗ [SC number] [file:line] — [what breaks, for whom] — [fix]

VIOLATIONS (AA, not blocking):
  ✗ [SC number] [file:line] — [issue] — [fix]

KEYBOARD:  tab order [✓/✗] · traps [✓/✗] · focus visible [✓/✗] · dialog focus [✓/✗] · route focus [✓/✗]
NAMES:     icon buttons [n/n] · inputs labelled [n/n] · errors associated [n/n]
STATE:     busy [✓/✗] · invalid [✓/✗] · disabled [✓/✗] · live regions [✓/✗]
CONTRAST:  body [✓/✗] · large [✓/✗] · UI+focus [✓/✗] · both themes [✓/✗]
TARGETS:   ≥24px [n/n] · drag alternatives [✓/✗]
REFLOW:    320px [✓/✗] · 200% zoom [✓/✗] · reduced-motion [✓/✗]

NOT VERIFIED: [what needed a device, a screen reader or a tool that was unavailable]

VERDICT: [AA clean / AA with violations / blocking defects]
```

Never report "not verified" as a pass. A checklist that quietly marks unrun checks green is worse
than no audit, because it ends the conversation.
