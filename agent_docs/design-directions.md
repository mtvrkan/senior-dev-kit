# Design Directions — Lazy Reference

## WHY THIS FILE EXISTS

The commonest complaint about AI-built UI is that every project looks the same: Inter, slate
neutrals, `rounded-lg`, a subtle shadow, a centred hero, three feature cards. That is not the
model reaching for a favourite. It is what happens when the only project-specific decision left
open is a primary hue, and every other visual variable has been declared fixed somewhere.

So this file opens them. The **token contract does not change** — the names in
`rules/100-web.md`'s required token structure are the same on every project, and every rule that
depends on them (semantic tokens only, three mandatory states, WCAG, reduced motion) still holds.
What changes is what those tokens are *set to*. A direction is a coordinated set of values for
eight axes at once.

One axis alone is not a direction. Changing the hue and keeping everything else produces the same
site in a different colour — which is exactly the current failure. Two projects look genuinely
different when radius, type, depth, density, motion and layout rhythm move **together**.

## THE BRIEF — collect it before offering anything

Building "exactly what the user asked for" fails at the intake, not at the rendering. A direction
picked from the product type alone is a guess about someone else's taste presented as a decision.
So before the gate below runs, gather what the user already gave — and if they gave nothing, ask
once.

| What the user has | Axes it binds | How to read it |
| --- | --- | --- |
| A reference site or app ("like Linear", "like Stripe") | four to six at once | Name what is actually being pointed at: the density and the mono labels, or the type and the whitespace? A reference is a set of axis values, not a mood. Extract the values. Mapping the reference onto the nearest named direction and stopping there is how a specific request becomes a generic result. |
| Logo, existing palette, brand guidelines | colour, often type | Non-negotiable — these constrain the direction; the direction never overrides them. Check the brand colour at body size for contrast before anything is built on it. |
| Screenshot or moodboard | depth, decoration, density | Read the material, the spacing and the edges, not the content. |
| Brand words — premium · playful · editorial · serious · brutal | type, geometry, motion | Push for one more sentence. "Premium" is Swiss restraint to one user and glass-and-gold to another; guessing which costs a whole build. |
| A competitor they must **not** resemble | rules directions out | Sharper and cheaper than any positive brief. Record the exclusion. |
| Hard constraints — density, dark-only, an existing component library, WCAG AAA, low-end devices | discards directions outright | Apply before taste. Glass on a dense dashboard and AAA contrast against a glow accent are already decided. |
| Nothing at all | — | Ask **one** question covering product, audience and two or three adjectives. Not five questions. |

Record the brief's constraints and exclusions in `DESIGN-SPEC.md` next to the direction. The next
session should inherit the reasons, not only the outcome — otherwise the first thing a later
agent does is re-litigate a constraint the user already stated.

## CHOOSING ONE — the gate

A direction is chosen **once per project, before the first component**, and recorded. It is not
re-derived per page, and it is never left implicit.

1. **Start from the brief, not from the menu.** Resolve everything above into axis values first.
   Then discard any direction that contradicts a hard constraint — a dense data tool cannot take
   an airy editorial direction without losing the information density it exists for.
2. **Offer three that are far apart** — one question, three options, each named with a one-line
   consequence. Never offer three neighbours (Soft Product / Glass / Expressive are all "friendly
   and rounded"; that is one option, not three). When the brief already points somewhere none of
   the eight goes, one of the three offered is the bespoke direction below. The user owns their
   brand; this is the one design decision worth a round-trip.
3. **Record it in `DESIGN-SPEC.md`** with the axis values resolved to real numbers, then implement
   them in the project's token file before any component is written.
4. **Never re-roll.** If `DESIGN-SPEC.md` names a direction, that is the answer — a later page,
   a later session and a later agent all read it and hold it. Drift inside one project is the
   failure `rules/100-web.md`'s DESIGN CONTINUITY section exists to prevent.

Do not pick without asking on the grounds that one option is obviously best. Left to itself the
choice collapses back to the single highest-probability default, which is the bug.

## THE EIGHT AXES

| Axis | What it sets |
| --- | --- |
| Type | display + body family, scale ratio, weight strategy, tracking |
| Colour | neutral temperature, accent count, base (light/dark), contrast level |
| Geometry | `--radius-*` values, border weight and whether borders carry structure at all |
| Depth | flat · soft shadow · hard offset shadow · glow · glass — pick **one**, not several |
| Density | spacing ladder, line-height, content measure |
| Motion | what animates, duration band, easing character |
| Decoration | gradient, grain, rules, imagery treatment, or nothing |
| Layout rhythm | how sections are composed (see LAYOUT RHYTHM below) |

Depth is the axis most often got wrong: a soft shadow *and* a glow *and* a border *and* a gradient
is not four times the design, it is mud. One depth model, applied consistently.

## THE DIRECTIONS

All families are Google Fonts (free, self-hostable via `next/font`). Values are starting points to
write into the token file, not laws — but change them as a set, not one at a time.

### 1 — Swiss Editorial

Structure carries the design; nothing is decorated. Best for: developer tools, B2B, documentation,
anything that should read as precise.

```css
--font-display: "Archivo";  --font-body: "Archivo";  --font-mono: "IBM Plex Mono";
--scale-ratio: 1.5;          /* big jumps — hierarchy comes from size, not colour */
--radius-sm: 0; --radius-md: 2px; --radius-lg: 4px;
--color-neutral: pure grey (hue 0, sat 0);   --accents: 1
--shadow-sm: none; --shadow-md: none;        /* depth: FLAT */
--border: 1px solid var(--color-border);     /* hairline rules are the only ornament */
--space-section: 96px;  --measure: 68ch;  --leading-body: 1.55;
```

Motion: scroll-reveal only, `opacity` + 8px rise, 250ms, `cubic-bezier(0.2,0,0,1)`. No hover lift.
Decoration: 1px rules between sections; numerals and labels in mono, uppercase, `0.08em` tracking.

### 2 — Warm Editorial

Long-form and human. Best for: content sites, agencies, health, education, anything selling trust
through writing rather than screenshots.

```css
--font-display: "Fraunces";  --font-body: "Libre Franklin";  --font-mono: "IBM Plex Mono";
--scale-ratio: 1.333;
--radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
--color-neutral: warm (hue ~40, sat 8-14%);  --base: ivory, not white;  --accents: 1 + 1 muted
--shadow-md: 0 2px 16px hsl(30 20% 20% / 0.08);   /* depth: SOFT SHADOW */
--space-section: 128px;  --measure: 62ch;  --leading-body: 1.7;
```

Motion: slow gentle fades, 400ms, no transform on hover beyond a colour shift.
Decoration: generous margins, real photography, an occasional oversized pull-quote in display italic.

### 3 — Neo-Brutalist Block

Loud, flat, high-contrast, deliberately unpolished. Best for: creative studios, launches, dev tools
with attitude, anything that must not read as corporate.

```css
--font-display: "Archivo Black";  --font-body: "Space Grotesk";
--scale-ratio: 1.5;  /* display weights 800-900, body 400-500 — no in-between */
--radius-sm: 0; --radius-md: 0; --radius-lg: 4px;
--color-neutral: pure black on pure white;  --accents: 2-3 fully saturated, used as flat fields
--border: 2px solid #000;                          /* borders carry ALL structure */
--shadow-md: 4px 4px 0 #000;  --shadow-lg: 8px 8px 0 #000;   /* depth: HARD OFFSET, zero blur */
--space-section: 80px;  --leading-body: 1.5;
```

Motion: snappy, 100-150ms, `translate` on hover so the offset shadow collapses (`4px 4px` → `0 0`).
Decoration: none — the colour blocks and borders are the decoration. No gradients, no blur, ever.

### 4 — Soft Product

Approachable and rounded. Best for: consumer apps, onboarding-heavy SaaS, education, wellness.

```css
--font-display: "Plus Jakarta Sans";  --font-body: "Plus Jakarta Sans";  /* one family, weight-led */
--scale-ratio: 1.25;
--radius-sm: 10px; --radius-md: 16px; --radius-lg: 24px;   /* pills for buttons: 999px */
--color-neutral: cool-tinted, never pure grey (sat 6-10%);  --accents: 1 + 2 pastel supports
--shadow-md: 0 4px 20px hsl(var(--primary-hue) 40% 40% / 0.10);  /* depth: SOFT, tinted */
--space-section: 96px;  --leading-body: 1.65;  --padding-card: 24-32px;
```

Motion: spring easing `cubic-bezier(0.34,1.56,0.64,1)`, 200ms, `scale(1.02)` card hover.
Decoration: soft blob/gradient shapes behind sections at low opacity; generous whitespace inside
components, not just between them.

### 5 — Dark Technical

Precision at night. Best for: infra, analytics, AI/dev tooling, anything with a terminal in the
screenshots. This is the direction closest to the current default — pick it deliberately, not by
drift, and if a project wants it, commit to the whole bundle rather than a dark toggle.

```css
--base: dark (hsl 240 8% 6-10%);   --color-neutral: cool (hue 230-250, sat 6-10%)
--font-display: "Inter Tight";  --font-body: "Inter Tight";  --font-mono: "JetBrains Mono";
--scale-ratio: 1.25;   /* mono labels, uppercase, 0.06em tracking, 12-13px */
--radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px;
--border: 1px solid hsl(0 0% 100% / 0.08);   /* hairlines at low opacity */
--accents: 1 luminous;   /* depth: GLOW — radial gradient behind the accent, no drop shadows */
--space-section: 80px;  --leading-body: 1.6;  --measure: 70ch;
```

Motion: precise and fast, 150-200ms, `ease-out`; animate `opacity`/`transform` only.
Decoration: one radial glow per viewport at most, faint grid lines, subtle grain to kill banding.

### 6 — Glass Depth

Layered translucency. Best for: media, devices, showcase and pricing pages, anything with a
strong image or gradient behind the UI. Expensive on low-end GPUs — do not pick it for a dense
dashboard.

```css
--font-display: "Manrope";  --font-body: "Manrope";
--scale-ratio: 1.333;
--radius-md: 16px; --radius-lg: 20px;
--surface: hsl(0 0% 100% / 0.08);  backdrop-filter: blur(16px) saturate(140%);  /* depth: GLASS */
--border: 1px solid hsl(0 0% 100% / 0.18);   /* the light edge is what sells the material */
--color-neutral: cool;  --accents: 1 + a gradient pair
--space-section: 112px;  --leading-body: 1.6;
```

Motion: 300ms `ease-out`, gentle parallax between layers, blur/opacity on enter.
Decoration: a gradient mesh or photograph **behind** the glass — glass over a flat colour reads as
a grey box and defeats the direction. Always provide a solid fallback where `backdrop-filter` is
unsupported.

### 7 — Corporate Dense

Information first. Best for: fintech, admin panels, enterprise, B2B dashboards, anything where the
user's job is to read a lot of numbers quickly.

```css
--font-display: "IBM Plex Sans";  --font-body: "IBM Plex Sans";  --font-mono: "IBM Plex Mono";
--scale-ratio: 1.2;      /* small steps — many levels must coexist on one screen */
--radius-sm: 2px; --radius-md: 4px; --radius-lg: 6px;
--color-neutral: cool grey;  --accents: 1 + semantic status colours carrying real meaning
--shadow-*: none — separation is by 1px border and background step;   /* depth: FLAT + BORDERS */
--space-section: 48px;  --leading-body: 1.5;  --padding-cell: 8px 12px;  --row-height: 36-40px;
```

Motion: minimal — 120ms colour transitions, no entrance animation on data. Motion in a table reads
as a bug, not polish.
Decoration: none. Status colour is data, not ornament, and must never be the only signal.

### 8 — Expressive Colour

Colour and type as the product. Best for: portfolios, campaigns, events, launches, food, fashion.

```css
--font-display: "Bricolage Grotesque";  --font-body: "DM Sans";
--scale-ratio: 1.618;    /* display sizes are genuinely large: clamp(3rem, 8vw, 7rem) */
--radius-sm: 8px; --radius-md: 12px; --radius-lg: 999px;   /* mixed by role, not one value */
--color-neutral: minimal — colour fields do the work;  --accents: 3+, used as full-bleed sections
--shadow-md: none;        /* depth: FLAT COLOUR FIELDS */
--space-section: 120px;  --leading-body: 1.55;
```

Motion: energetic — staggered reveals (50ms/item, max 8), marquee, scroll-linked scale. This is the
one direction where motion is the point, and it is also the one where `prefers-reduced-motion` is
most likely to be tested against you.
Decoration: grain overlay, oversized type as graphic element, sections that alternate full-bleed
accent backgrounds.

### Bespoke — when none of the eight is the answer

Eight named directions solve one template by shipping eight; that is a smaller failure, not a
different one. The eight are **starting bases**, and a brief that points between them or past them
gets its own direction rather than the nearest label. "Brutalist structure but warm, serif, no
black", "a dense data tool that still reads editorial", a brand palette none of the eight is built
around — all bespoke.

What makes a bespoke direction legitimate rather than an excuse to freestyle:

- **All eight axes resolved to real values**, same as any named direction. A label like
  "Neo-Brutalist × Warm Editorial" is two directions arguing; `--radius-md: 2px`, Fraunces over
  Libre Franklin, hard offset shadow, ivory base, 96px sections is a direction.
- **One depth model.** Blending is choosing from both, never running both. This is the axis a blend
  breaks first.
- **A project-specific name**, so the spec and every later session refer to the same thing.
- **The same invariants** — nothing below in WHAT NO DIRECTION MAY BREAK is negotiable because the
  direction was custom.

Derive it from the brief's axis values (see THE BRIEF), borrow the axes it does not speak to from
the nearest base rather than inventing them, and record why in `DESIGN-SPEC.md`.

## THE SIGNATURE — what separates considered from outstanding

Everything above is subtractive: hold a direction, avoid the tells, keep the invariants. Do all of
it and the result is *competent and not generic* — which is not the same as memorable. What makes
work read as designed rather than assembled is that it has **one idea**, and that the idea is
executed properly in one place while everything else stays quiet.

Pick exactly one per project, and give it the page's best real estate:

- A **type moment** — the headline set at a size and cut nothing else on the page uses; a headline
  that reaches both edges of the viewport; weight or width shifting under scroll.
- A **structural move** — a layout that breaks its own grid once, deliberately: a full-bleed
  element crossing the column, an oversized numeral, a sticky half that stays while the other half
  scrolls past it.
- A **material** — one surface treatment applied with real conviction (the hard offset shadow, the
  glass over an actual photograph, an ink-on-paper rule system) rather than a shadow on everything.
- A **motion idea** — one transition the product is remembered for: a shared-element route change,
  a list that assembles in sequence, a control that morphs instead of swapping.
- **Content itself** — a real screenshot, a real number, a real sentence about the real product,
  presented at a scale that says it matters. Frequently the strongest option, and the cheapest.

Rules that keep it a signature rather than noise:

1. **One.** Three signature moments is a page with none — each cancels the others.
2. **It must come from the product.** A decorative flourish with no relationship to what the thing
   does is the "abstract 3D blob" tell wearing better clothes.
3. **It must survive the constraints.** Legible at 360px, intact under `prefers-reduced-motion`,
   contrast-checked against its real background, keyboard-reachable. A signature that fails these
   is a defect with ambition.
4. **Everything around it gets quieter,** not louder. The rest of the page is the reason it lands.

Record it in `DESIGN-SPEC.md` in one sentence — *what* the moment is and *where* it lives — so
later pages support it instead of competing with it. The LEVERS below are the cheap technical
means; this is the decision they serve.

## LAYOUT RHYTHM — the other half of sameness

Styling variety with one layout still produces one website. Hero → three feature cards → testimonial
→ CTA is a template, not a composition. A direction should carry a rhythm too:

| Rhythm | Composition |
| --- | --- |
| Centred | Symmetric, single column, everything on the axis. Honest for simple products; the default that needs to stop being automatic. |
| Editorial asymmetric | 12-col grid, content off-axis, deliberate empty columns, headline and body in different columns. |
| Split | Two vertical halves, one fixed/sticky and one scrolling. Strong for a product with one hero image. |
| Modular grid | Bento tiles of unequal spans; each tile one idea. Suits feature overviews far better than three equal cards. |
| Full-bleed sections | Alternating edge-to-edge colour/image bands, content inset. Suits Expressive and Warm Editorial. |
| Dense shell | Persistent sidebar + toolbar + content region; the page is a workspace, not a document. Corporate Dense only. |

Pair rhythm with direction, then vary **section composition within the page**: if three sections in
a row are a centred heading over a 3-column card grid, the page has one idea repeated, and no
palette will hide that.

## MOBILE DIRECTIONS

<!-- reviewed: 2026-08 -->

Mobile differentiates **inside** the platform idiom, not against it. A web page can throw out every
convention and still be usable; an app that reinvents navigation, gestures or system controls is
just a worse app, and it will be rejected by the users before the reviewers. So the axes are not
the same as the web ones — the first axis is how far from the platform you intend to stand, and
everything else is bounded by that answer.

| Axis | What it sets |
| --- | --- |
| Idiom distance | native default · branded native · fully custom (see the table below) |
| Surface material | opaque · translucent/Liquid Glass (Apple) · tonal elevation (Material 3) |
| Shape | corner radii by role; Material 3 Expressive shape morphing on/off |
| Type | system face at Dynamic Type sizes · brand face with system metrics |
| Colour | Material dynamic colour (wallpaper-derived) · brand-locked palette |
| Motion | spring parameters, what animates on navigation and on state change |
| Navigation rhythm | tab bar · nav rail/drawer · sheet-driven · stack-heavy · immersive |

**Idiom distance decides the rest:**

| Distance | What you keep | What you own | Cost |
| --- | --- | --- | --- |
| Native default | Everything: system components, materials, motion, colour | Almost nothing beyond the accent | Cheapest, ages best, invisible in a screenshot |
| Branded native | Structure, navigation, gestures, accessibility behaviour | Surface, type, colour, shape, motion character | The right answer for most products |
| Fully custom | Only the gestures and the a11y contract | The whole visual system | Justified for games, media and creative tools; a tax everywhere else |

### Platform materials — what the system already gives you

**Apple / iOS 26+ — Liquid Glass.** The system material is translucent and refracts what is behind
it; hierarchy is expressed through depth and transparency rather than through borders and size
steps. Standard components adopt it when the app is built against the new SDK, and SwiftUI exposes
it for custom surfaces (`.glassEffect()`). Two consequences that decide whether it looks
professional: it needs *content* behind it to read as a material at all — over a flat colour it is
a grey box — and legibility is the known failure mode, so text over glass must still be checked at
4.5:1 against the actual composited background, in both appearances.

**Android — Material 3 Expressive.** The expressive revision adds a large shape library with shape
*morphing* (components change shape in response to input), spring-based motion tokens instead of
fixed curves, and a bolder type scale with emphasised styles. In Compose it arrives through the
expressive theme and motion-scheme APIs — check the names against the project's Compose BOM rather
than trusting a snippet, this surface is still moving. Dynamic colour derives the palette from the
user's wallpaper: a genuine differentiator on Android and a genuine problem for a brand that must
own its colour, so decide which one wins and record it.

Do not port one platform's material to the other. Glass on Android and wallpaper-derived colour on
iOS both read as an app that was built for somewhere else.

### The five mobile directions

1. **Platform Native** — system components, system material, system motion, one brand accent.
   Honest for utility, finance and enterprise apps. Its screenshots look like the OS, which is the
   point; do not pick it and then complain the app looks generic.
2. **Branded Native** — platform structure with an owned surface, type, shape and motion character.
   Brand face at system metrics, a shape scale that is consistently *not* the default, spring motion
   tuned once and reused. The default recommendation.
3. **Expressive Motion** — Material 3 Expressive taken seriously on Android, spring-forward custom
   transitions on iOS: shape morphing on press, springy list and sheet transitions, haptics paired
   to the motion. Suits consumer, social, fitness, media. Costs real tuning time; half-done springs
   read as jank, not delight.
4. **Editorial Content-First** — the chrome recedes and the content is the design: large type scale,
   generous measure, imagery full-bleed, navigation hidden until needed. Reading, recipe, news,
   documentation and long-form commerce apps.
5. **Immersive Surface** — content fills the screen edge to edge and controls float over it: maps,
   camera, video, player and creative tools. Requires explicit safe-area work and a legibility
   scrim under every floating control; this is the direction that fails accessibility first.

**Cross-platform (Flutter, React Native) — decide explicitly and record it.** One design on both
platforms, or platform-adaptive components? Both are defensible, silence is not: it produces
Material buttons with iOS navigation, which reads as broken on both. If one design wins, own the
navigation transitions and the back gesture deliberately rather than inheriting whatever the
framework defaults to.

Non-negotiable on every mobile direction, no matter the distance: 44×44pt / 48×48dp targets,
Dynamic Type and font scaling honoured (never a fixed `sp`/`pt` size for body copy), content
descriptions on every control, safe areas respected, and the reduce-motion setting obeyed.

## LEVERS THAT RAISE THE CEILING

Choosing a direction stops the output being *average*. These are what make it look considered —
each is cheap, CSS-native, and almost absent from generated UI, which is precisely why they read as
craft.

- **Variable-font axes.** Weight and width as continuous ranges, not five static cuts. One variable
  family carries a whole hierarchy, and optical-size axes make display type look drawn rather than
  scaled. `font-variation-settings` on a single family costs less bandwidth than two static ones.
- **Scroll-driven typography.** Weight or width mapped to scroll position via CSS scroll-driven
  animations — no JS, compositor-friendly. Headline compression on scroll is a signature effect that
  a generated page never has. Gate it behind `prefers-reduced-motion`.
- **Viewport-scaled display type.** `clamp(2.5rem, 8vw, 7rem)` so a headline actually reaches the
  edges of the screen. Type that spans the viewport is the single fastest way out of the template
  look — and it costs nothing.
- **Serif display + monospace metadata.** Dates, labels, counts and captions in mono with wide
  tracking against a serif or grotesk headline. High contrast between two roles beats a third font.
- **A real measure and a real rhythm.** 60-70ch for body, and section spacing that *varies* with
  importance instead of one constant everywhere. Even spacing throughout is what makes a page feel
  machine-set.
- **One deliberate asymmetry per page.** An off-grid image, an oversized numeral, a section that
  breaks the column. One, chosen — not three, accumulated.
- **Native View Transitions** for route changes (see `agent_docs/design-system.md`): zero KB, and
  the thing users read as "an app, not a page".

## THE TELLS — what makes output read as machine-made

Independent of direction. If a page has three or more of these, it will be recognised as generated
regardless of how good the tokens are:

```text
✗ Violet/indigo gradient on the headline word, or as the hero background
✗ Inter (or the framework default) everywhere, one weight above and below body
✗ Exactly three feature cards, equal width, each with an outline icon in a rounded square
✗ `rounded-lg` + `shadow-sm` on every surface, one radius for everything
✗ A pill badge above the h1 ("✨ Introducing…", "🚀 Now with AI")
✗ Emoji standing in for icons, or as section markers
✗ Everything centred, every section the same height and the same spacing
✗ Marketing verbs with no referent: seamlessly · effortlessly · supercharge · elevate · unlock
✗ Abstract 3D blobs or gradient meshes used as stock decoration with no relation to the product
✗ A testimonial section with invented names and a generic avatar
✗ Four sections in the fixed order hero → features → testimonials → pricing → CTA
```

The fix is never to add more decoration. It is to make one thing specific: real copy about the real
product, a real screenshot instead of a blob, one section composed differently from its neighbours.

## WHAT NO DIRECTION MAY BREAK

Unfreezing the visual axes does not unfreeze correctness. Every direction, without exception:

- Contrast ratios per `rules/100-web.md` — body ≥4.5:1, large ≥3:1, UI/focus ≥3:1. Glass and
  Expressive fail this most often; check the text against the *actual* composited background.
- Visible focus indicator, ≥3:1 against its surround. Brutalist offset shadows and glow accents
  must not replace the ring.
- The three mandatory states (loading skeleton / empty / error) and the state-priority and ARIA
  rules in `agent_docs/design-system.md`.
- `prefers-reduced-motion: reduce` honoured — mandatory, and load-bearing for Expressive and Glass.
- Target size ≥24×24px, semantic HTML, one `<h1>`.
- Semantic tokens only. A direction changes token *values* in one file; it never authorises a raw
  hex in a component.

## RECORDING THE CHOICE

`DESIGN-SPEC.md` (written by the `from-scratch` skill; see `agent_docs/from-scratch-guide.md`)
carries the resolved direction — its name plus the eight axis values as real numbers, because
"Soft Product" alone is a label that the next session will interpret differently. The token file
is generated from those values, and every later page reads the spec rather than re-choosing.

Three things go in it beyond the axis values, each because a later session cannot reconstruct it
from the code:

- **The brief's constraints and exclusions** — the brand palette that was fixed, the competitor to
  avoid, the density requirement. Otherwise the first thing a later agent does is re-open a
  decision the user already made.
- **The signature moment**, in one sentence: what it is and where it lives.
- **Bespoke directions only:** which base it started from and what the brief moved.

`/design-check` audits the built UI against exactly these three plus the axes.
