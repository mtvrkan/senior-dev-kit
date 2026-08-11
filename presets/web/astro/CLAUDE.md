# Project Preset — Astro

## The model: zero JS by default

An `.astro` component renders to HTML on the server and ships **no** JavaScript. That is the
whole point of the framework, and every `client:*` directive is a deliberate exception you should
be able to justify.

```astro
---
// Component script — runs at build/request time on the server only.
// Secrets are safe here; this code never reaches the browser.
import { getCollection } from 'astro:content'
const posts = await getCollection('blog')
---
<ul>{posts.map((p) => <li><a href={`/blog/${p.id}`}>{p.data.title}</a></li>)}</ul>

<SearchBox client:visible />   <!-- hydrated only when scrolled into view -->
```

| Directive | Use when |
| --- | --- |
| *(none)* | Static markup — the default, and the right answer most of the time |
| `client:visible` | Below the fold; the cheapest real interactivity |
| `client:idle` | Needed soon after load but not immediately |
| `client:load` | Above the fold and interactive on first paint |
| `client:only="react"` | No SSR possible (browser-only API) — loses SSR and SEO, last resort |

`client:load` on a whole page section is how an Astro site ends up shipping a React app.

## Rendering mode is explicit

- `output: 'static'` by default; `'server'` or per-page `export const prerender = false` for
  anything dynamic.
- Server islands (`server:defer`) for personalized fragments inside an otherwise static page —
  that beats making the whole route dynamic for one widget.
- `Astro.request`/`Astro.cookies` only exist on server-rendered pages; using them on a prerendered
  page silently gives you build-time values.

## Content collections, not raw file globbing

```ts
// src/content.config.ts
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
})
```

The Zod schema is a build-time guarantee: a malformed frontmatter fails the build instead of
rendering `undefined` into a page.

## Islands don't share state

Two separately hydrated islands are two separate app instances — a React context in one is
invisible to the other. Share via nanostores, URL state, or by hoisting them into a single island.
Discovering this after building the UI is a rewrite.

## Performance and SEO — the reason to choose Astro

- Images through `<Image />` / `<Picture />` from `astro:assets` with explicit dimensions;
  CLS budget is 0.1.
- `<link rel="canonical">`, OG tags and a real `<title>` on every page. `@astrojs/sitemap` for the
  sitemap, and check `robots.txt` actually allows what you think it does.
- If a page ships more than ~30 KB of JS, an island is doing too much — look for a `client:load`
  that should be `client:visible`, or a component that should be plain `.astro`.

## Verification

```bash
npx astro check      # types + template diagnostics, including content-schema errors
npx astro build      # catches SSR-only and adapter failures dev never shows
npx vitest run src/lib/util.test.ts
npx astro preview    # serve the real build output
```

## Anti-patterns

- `client:load` used reflexively instead of `client:visible`.
- A `.astro` component converted to React because "it needs one interactive button" — extract the
  button into an island instead.
- Expecting shared state between islands.
- Secrets read in a framework component instead of the `.astro` script (the former ships to the
  browser).
- `set:html` with user content — XSS.
- Raw `import.meta.glob` over markdown instead of a content collection with a schema.
- Missing width/height on images.
