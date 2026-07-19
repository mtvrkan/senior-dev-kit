---
description: Audit the project for SEO, AEO, Core Web Vitals, and technical SEO issues.
argument-hint: "[page or route — optional]"
---

# /seo-check

Audit the project for SEO, AEO (AI Engine Optimization), Core Web Vitals, and technical SEO issues: $ARGUMENTS

You are running an SEO and AEO audit. Analyze the codebase for SEO issues and optimization opportunities.
Full checklists, expected metadata shape, JSON-LD schema table, and CWV risk detail are in
`agent_docs/seo-patterns.md` — read it before auditing rather than re-deriving these from scratch.

**Step 1 — Detect framework.** Next.js (App Router vs Pages) / Nuxt / SvelteKit / Astro / Remix — each has a different metadata API; check `agent_docs/seo-patterns.md` for the framework-specific shape.

**Step 2 — Metadata audit.** Scan page/layout files against `seo-patterns.md`'s metadata checklist (title/description length, canonical, OG tags, twitter:card, duplicate metadata across pages).

**Step 3 — Structured data check.** Look for JSON-LD in page files; flag missing/incorrect schema per `seo-patterns.md`'s page-type → schema table, and syntax errors or missing required fields.

**Step 4 — Technical SEO.** sitemap/robots presence and correctness, 404 page, image `alt` coverage, JS-only internal links, unintended `noindex`, `<h1>` uniqueness and heading hierarchy, mobile viewport meta.

**Step 5 — Core Web Vitals risk scan.** LCP (hero image `priority`/`fetchpriority`, missing `sizes`), CLS (`<img>` missing dimensions, non-`next/font` Google Fonts link, post-hydration shift), INP (long handlers without `startTransition`/debouncing, heavy per-render `useEffect`).

**Step 6 — AEO / AI Engine Optimization.** Apply `seo-patterns.md`'s AEO principles (direct-answer H1/lead paragraph, structured facts, definition pattern, cited sources, FAQ question-headings).

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
