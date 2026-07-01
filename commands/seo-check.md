# /seo-check

Audit the project for SEO, AEO (AI Engine Optimization), Core Web Vitals, and technical SEO issues: $ARGUMENTS

You are running an SEO and AEO audit. Analyze the codebase for SEO issues and optimization opportunities.

**Step 1 — Detect framework**

Check for: Next.js (App Router vs Pages), Nuxt, SvelteKit, Astro, Remix. Each has different metadata APIs.

**Step 2 — Metadata audit**

Scan all page/layout files for:

✓ Correct: Next.js App Router metadata

```typescript
export const metadata: Metadata = {
  title: '...',  // under 60 chars
  description: '...',  // under 160 chars
  openGraph: { ... },
  alternates: { canonical: '...' },
}
```

Flag issues:

- Missing `title` on any page
- Missing `description` on any page
- `title` over 60 characters (truncated in SERPs)
- `description` over 160 characters (truncated)
- Missing `canonical` URL (duplicate content risk)
- Missing OG tags (social sharing won't have preview)
- OG image not 1200×630px
- Missing `twitter:card` meta
- Pages with identical titles/descriptions (duplicate metadata)

**Step 3 — Structured data check**

Look for JSON-LD in page files. Flag missing schemas:

| Page type | Expected schema |
| --- | --- |
| Blog post | `Article` or `BlogPosting` |
| Product | `Product` with `AggregateRating` |
| FAQ section | `FAQPage` |
| How-to guides | `HowTo` |
| Home/about | `Organization` |
| Navigation | `BreadcrumbList` |
| Events | `Event` |

Also check: JSON-LD for syntax errors, required fields (name, description, url).

**Step 4 — Technical SEO**

Check for:

- `sitemap.ts` / `sitemap.xml` exists and covers all public pages
- `robots.ts` / `robots.txt` exists and doesn't block important pages
- `404.tsx` exists and returns proper 404 status
- Image `alt` attributes: scan `<img>` tags without `alt` or with empty `alt`
- Internal links use `<a href>` (not JS-only navigation)
- No `noindex` on pages that should be indexed
- `<h1>` present and unique on every page
- Heading hierarchy: h1 → h2 → h3 (no skipping levels)
- Mobile viewport meta: `<meta name="viewport" content="width=device-width, initial-scale=1">`

**Step 5 — Core Web Vitals risk scan**

LCP risks (flag each):

- Hero image without `priority` prop (Next.js) or `fetchpriority="high"`
- Large hero image without proper `sizes` attribute

CLS risks (flag each):

- `<img>` without `width` and `height` attributes
- Font loaded via `<link>` to Google Fonts (use `next/font` instead)
- Content that shifts after hydration

INP risks (flag each):

- Long event handlers without `startTransition` or debouncing
- Heavy `useEffect` running on every render

**Step 6 — AEO / AI Engine Optimization**

Check content structure for AI citability:

- Does H1 directly answer the primary page intent?
- Does the first paragraph provide a direct answer (not fluff)?
- Are key facts in list format (easier for AI to extract)?
- Are there FAQ sections with question headings?
- Are statistics and claims cited?

**Output format:**

```text
SEO AUDIT REPORT
================

CRITICAL:
  ✗ Missing title on: [pages]
  ✗ Missing canonical on: [pages]
  ✗ [page] blocked by robots.txt / noindex

HIGH:
  ✗ Missing sitemap.ts / sitemap.xml
  ✗ [count] pages missing description
  ✗ [count] images without alt text
  ✗ Missing JSON-LD on: [page types]

MEDIUM:
  ⚠ LCP risk: [location] — hero image without priority
  ⚠ CLS risk: [location] — image without dimensions
  ⚠ Title too long: [page] — [current char count] chars

LOW / OPPORTUNITIES:
  → Add FAQPage schema to [page] (AEO improvement)
  → Add BreadcrumbList schema to [page]
  → First paragraph on [page] could be more direct answer

AEO SCORE: [Good / Needs work / Poor]
TECHNICAL SEO SCORE: [Good / Needs work / Poor]
CWV RISK: [Low / Medium / High]

TOP FIXES (prioritized by impact):
  1. [most impactful]
  2. [second]
  3. [third]
```
