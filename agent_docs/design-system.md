# Design System Patterns — Lazy Reference

## W3C DESIGN TOKENS SPEC v1.0 (October 2025)

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

## 8PX GRID — mandatory spacing values

Only these values (matches rules/100-web.md — the canonical list; `p-5`/`p-10`/`p-20` are NOT on it): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128

Tailwind mapping:

```text
p-1 = 4px    p-2 = 8px    p-3 = 12px   p-4 = 16px
p-6 = 24px   p-8 = 32px   p-12 = 48px  p-16 = 64px
```

Never: `p-[13px]` `p-[17px]` `gap-[18px]` `m-[7px]` — arbitrary values break grid consistency.

## TYPOGRAPHY SCALE — Perfect Fourth (1.333 ratio)

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

Font pairing by archetype:

| Archetype | Display (headings) | Body |
| --- | --- | --- |
| SaaS / DevTool | Geist | Inter |
| Corporate | Manrope | Inter |
| Marketing / Creative | Cal Sans | Inter |
| Ecommerce | Plus Jakarta Sans | Inter |
| Healthcare / Education | Source Serif 4 | Source Sans 3 |

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

**Never**: spinner for list loading · "No data" with no icon/CTA · "Error" with no retry

## SKELETON SHAPES BY CONTENT TYPE

| Content | Skeleton shape |
| --- | --- |
| Text line | `h-4 w-[X]` rounded rectangle |
| Avatar/image circle | `h-10 w-10 rounded-full` |
| Card | `h-32 rounded-lg` |
| Table row | Multiple `h-4` lines |
| Paragraph | 3-4 lines, varying widths (60%, 80%, 70%, 40%) |
| Heading | `h-6 w-48` |
| Button | `h-9 w-24 rounded-md` |

```tsx
// WRONG: spinner for data loading
<Spinner /> 

// RIGHT: skeleton matching actual content
<div className="animate-pulse space-y-2">
  <div className="h-5 w-3/4 bg-muted rounded" />
  <div className="h-4 w-1/2 bg-muted rounded" />
</div>
```

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
// Next.js 15+ / React 19
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
  transition-all duration-150                  /* smooth transitions */
"
```

**Every button, link, input, card-with-click must have these 4 states.**
Never `outline: none` without providing an alternative visible focus indicator (WCAG 2.4.11).

## WCAG 2.2 REQUIREMENTS (2025)

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
