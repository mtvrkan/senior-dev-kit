# Design System Patterns — Lazy Reference

## DTCG DESIGN TOKENS SPEC (2025.10 release)

Published by the Design Tokens Community Group (a W3C Community Group) — this is a Community Group Draft Report, not a formal W3C Recommendation/standard.

Standard token format:

```json
{
  "color": {
    "brand": {
      "primary": { "$value": "#0F172A", "$type": "color" },
      "accent":  { "$value": "#6366F1", "$type": "color" }
    }
  },
  "spacing": {
    "4": { "$value": "4px", "$type": "dimension" },
    "8": { "$value": "8px", "$type": "dimension" }
  }
}
```

Claude Code advantage: shadcn/ui stores component files in `components/ui/` → Claude can read, edit, understand every component directly. No abstraction layer.

## SEMANTIC TOKEN HIERARCHY

```text
Primitive tokens    →  Semantic tokens      →  Component tokens
#6366F1               color.action.primary    button.background
#EF4444               color.feedback.error    input.border.error
16px                  spacing.4               card.padding
```

**Rule: components use ONLY semantic tokens. Never primitive hex values.**

```css
/* WRONG */
background: #6366F1;
color: rgb(239, 68, 68);

/* RIGHT */
background: hsl(var(--primary));
color: hsl(var(--destructive));
```

## SPACING — see rules/100-web.md's SPACING section (canonical) — don't restate

## TYPOGRAPHY SCALE — the fallback ratio, not the project's ratio

One ratio, held across the project, matters more than which ratio. The ladder below is 1.333
(Perfect Fourth) and is what to use when nothing else has been decided. **If the project has a
`DESIGN-SPEC.md`, its direction sets the ratio and this ladder is overridden** — 1.2 for dense
data UI, 1.618 for expressive display type, see `agent_docs/design-directions.md`. Recompute the
steps from the chosen ratio rather than shipping this one under a different name.

```text
xs:   0.75rem   (12px)  → fine print, captions
sm:   0.875rem  (14px)  → helper text, labels
base: 1rem      (16px)  → body text
lg:   1.125rem  (18px)  → subheadings
xl:   1.333rem  (21px)  → section headings
2xl:  1.777rem  (28px)  → page headings
3xl:  2.369rem  (38px)  → hero text
4xl:  3.157rem  (51px)  → display only
```

**Font pairing comes from the chosen direction** — `agent_docs/design-directions.md` gives a
display/body/mono set per direction, and they are deliberately spread across grotesk, serif,
geometric and mono-flavoured rather than converging on one body face. An earlier revision of this
file paired four of five archetypes with the same body font, which is the monoculture the
directions file exists to break; do not reintroduce a "safe" default body family here.

Absent a direction, the pairing rules that still hold: two families (display + body) is a safe
default and one well-cut variable family is a legitimate choice, per `rules/100-web.md`'s
TYPOGRAPHY section. Three or more is where it usually goes wrong.

## THREE MANDATORY STATES — always implement all three

Every component that loads data needs:

```tsx
// 1. LOADING — skeleton matching content shape
function UserListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// 2. EMPTY — all 4 elements required
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Users className="h-12 w-12 text-muted-foreground" />   {/* icon */}
      <h3 className="text-lg font-semibold">No users yet</h3>  {/* headline */}
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Add your first user to get started.                     {/* description */}
      </p>
      <Button onClick={onAdd}>Add User</Button>                 {/* CTA */}
    </div>
  )
}

// 3. ERROR — actionable, never just "Something went wrong"
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="text-sm text-destructive">{error.message}</p>
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
```

**Never**: "No data" with no icon/CTA · "Error" with no retry

## SKELETON SHAPES BY CONTENT TYPE

Canonical shape-by-content table + the never-spinner rule: `rules/100-web.md`'s THREE
MANDATORY STATES section (auto-loads for every web file this doc would ever be used with —
not restated here). Tailwind idiom: `bg-muted animate-pulse` + `h-4` / `rounded-full` /
`rounded-lg` sized to the final content.

## MOTION TOKENS — standardized animation

```css
/* Timing — matches rules/100-web.md's --transition-* tokens */
--transition-fast:  100ms   /* micro-interactions: button press, focus ring */
--transition-base:  200ms   /* hover states, standard transitions */
--transition-slow:  300ms   /* enter animations (page/component mount) */
--duration-stagger: 50ms    /* per-item in lists, max 8 items staggered */

/* Easing */
--ease-enter:   cubic-bezier(0.2, 0, 0, 1)  /* decelerate in — matches rules/100-web.md MOTION RULES */
--ease-exit:    cubic-bezier(0.4, 0, 1, 1)  /* accelerate out */
--ease-bounce:  cubic-bezier(0.34, 1.56, 0.64, 1)  /* spring feel */
```

Enter animation (300ms, decelerate):

```tsx
// Tailwind v4: use @starting-style
// Framer Motion:
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}

// List stagger:
transition={{ delay: index * 0.05 }}
```

Exit animation (150ms, accelerate — faster than enter, opacity-only per rules/100-web.md):

```tsx
exit={{ opacity: 0 }}
transition={{ duration: 0.15, ease: [0.4, 0, 1, 1] }}
```

**Always**: `prefers-reduced-motion: reduce` → disable all animations

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## VIEW TRANSITIONS API — zero-KB page transitions

```tsx
// Next.js 16+ / React 19
function navigate(url: string) {
  if (!document.startViewTransition) {
    router.push(url)
    return
  }
  document.startViewTransition(() => router.push(url))
}
```

CSS for enter/exit:

```css
::view-transition-old(root) {
  animation: 200ms ease-out fade-and-slide-out;
}
::view-transition-new(root) {
  animation: 300ms ease-in fade-and-slide-in;
}
```

**Zero dependencies. Native browser. Progressive enhancement (works without it).**

## DARK MODE — next-themes pattern

```tsx
// Layout wrapper
import { ThemeProvider } from 'next-themes'
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>

// Component usage — semantic tokens only
// 'dark:' prefix works when attribute="class"
className="bg-background text-foreground"  // ← semantic, auto-switches
className="bg-white text-gray-900"         // ← WRONG: no dark mode
```

shadcn/ui CSS variables auto-switch:

```css
:root { --background: 0 0% 100%; }  /* light */
.dark { --background: 222.2 84% 4.9%; }  /* dark */
```

## INTERACTION STATES — every interactive element

```tsx
// Button: hover + active + focus + disabled
className="
  bg-primary text-primary-foreground
  hover:bg-primary/90                          /* hover: slight opacity */
  active:scale-[0.97]                          /* active: slight compress — matches rules/100-web.md button-press scale */
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring  /* focus ring */
  disabled:pointer-events-none disabled:opacity-50  /* disabled */
  transition-all duration-100                  /* matches rules/100-web.md button-press: scale(0.97) 100ms */
"
```

**Every button, link, input, card-with-click must have these 4 states.**
Never `outline: none` without providing an alternative visible focus indicator (WCAG 2.4.11).

### State priority — when more than one applies at once

```text
disabled > loading > active > focus > hover > default
```

A disabled control never shows hover; a submitting one never shows active. Declare them in that
order so the higher-priority rule wins — otherwise the button flashes its hover colour mid-submit,
which reads as "your click did nothing".

### The state has to reach a screen reader too

Visual state is half the job: a spinner inside a button announces nothing, and `opacity-50` never
says why a control is inert.

| State | Visual | What announces it |
| --- | --- | --- |
| Loading | spinner replaces the icon | `aria-busy="true"` + visually-hidden status text |
| Disabled, form control | muted + `opacity-50` | the native `disabled` attribute |
| Disabled, but the reason matters | muted + `opacity-50` | `aria-disabled="true"` — stays focusable |
| Invalid field | error border + helper text | `aria-invalid="true"` + `aria-describedby` at the message, message `role="alert"` |

```tsx
<button aria-busy={isSaving} disabled={isSaving}>
  {isSaving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
  Save
  {isSaving && <span className="sr-only">Saving…</span>}
</button>

<input id="email" aria-invalid={!!error} aria-describedby={error ? 'email-error' : undefined} />
{error && <p id="email-error" role="alert" className="text-destructive text-sm">{error}</p>}
```

`disabled` also removes the element from the tab order, so a keyboard user can never reach the
tooltip explaining why it is off. When that explanation is the point, use `aria-disabled` plus a
handler that returns early — the control stays reachable and stays inert.

### Spinner placement — where the never-a-spinner rule stops

`rules/100-web.md` bans spinners for lists, cards and tables because a skeleton can match their
shape. A button cannot. These are the surfaces where a spinner is the right answer:

| Surface | Loading treatment |
| --- | --- |
| Button | spinner replaces the icon; label stays, width must not change or the row reflows |
| Input | spinner in the trailing slot |
| Card · list · table | skeleton — never a spinner |
| Full page / route change | centred spinner, or a route-level skeleton if the shape is known |

## VARIANTS — one indirection, not a class list per variant

Give the component its own token names and let each variant reassign them. Layout is written once;
a variant changes only what its own tokens point at, so a new size or colour is three declarations
instead of a duplicated class list that drifts the first time padding changes.

```css
.btn {
  --btn-bg: var(--color-primary);          /* component tokens: the defaults */
  --btn-fg: var(--color-primary-foreground);
  --btn-h: 40px;
  --btn-px: var(--space-4);

  background: var(--btn-bg);               /* written once, for every variant */
  color: var(--btn-fg);
  height: var(--btn-h);
  padding-inline: var(--btn-px);
}
.btn--destructive { --btn-bg: var(--color-destructive); --btn-fg: var(--color-destructive-foreground); }
.btn--sm          { --btn-h: 32px; --btn-px: var(--space-3); }
```

This is the component layer of the token hierarchy above, applied: `--btn-bg` is a component token
and may only ever point at a semantic one, never at a raw hex. In a Tailwind codebase `cva`
(class-variance-authority) expresses the same indirection — one base class list, variants that
override named slots — and shadcn/ui components are already written that way; extend their
`variants` map rather than adding a parallel set of conditional class strings.

## WCAG 2.2 REQUIREMENTS

New in 2.2 (all mandatory):

- **2.4.11 Focus Not Obscured (AA)**: sticky header must not fully cover focused element — use `scroll-margin-top`
- **2.5.7 Dragging Movements**: all drag actions need click alternative
- **2.5.8 Target Size Minimum (AA)**: 24×24px minimum for all interactive targets

Existing critical requirements:

- Color contrast: text ≥4.5:1 · large text ≥3:1 · UI components ≥3:1
- Never convey information by color alone — add icon or text
- All interactive elements keyboard-accessible (no keyboard traps)

```tsx
// Icon-only button — required aria-label
<button aria-label="Delete user" onClick={handleDelete}>
  <Trash2 className="h-4 w-4" />
</button>

// Form field — required label association
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Dynamic content — announce changes
<div aria-live="polite">{statusMessage}</div>
```

## ANTI-PATTERNS — never output

```text
✗ Hardcoded hex in JSX/TSX: style={{ color: '#6366F1' }}
✗ Raw color class: text-gray-500 (use text-muted-foreground)
✗ Arbitrary spacing: p-[13px] gap-[18px] m-[7px]
✗ Arbitrary font: text-[17px]
✗ outline: none without visible alternative
✗ Spinner for list/card/table loading (use skeleton)
✗ Empty state without icon + title + description + CTA
✗ Single font (display + body pairing required)
✗ Navigation chrome re-created inside page component
✗ Missing loading/empty/error state (all 3 required)
✗ alert() or window.confirm() in React (use dialog)
✗ Toast for errors that need user action (use dialog)
✗ Animations without prefers-reduced-motion check
```
