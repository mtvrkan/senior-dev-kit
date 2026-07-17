# Project Preset — Astro

## Architecture

- Astro components (`.astro`) are server-rendered by default — do not add `client:*` directives unless browser interactivity is required.
- Islands architecture: keep interactive islands small and isolated.
- Use the correct `client:*` directive for the use case: `client:load` for above-the-fold, `client:idle` for below-the-fold, `client:visible` for lazy.
- Respect the content collections schema — do not change it without explicit request.
- Keep integrations (React, Vue, Svelte, etc.) minimal — do not add new UI frameworks without justification.

## Performance

- Avoid unnecessary `client:load` — prefer `client:idle` or `client:visible`.
- Use `<Image />` from `astro:assets` for all images — do not use raw `<img>` tags without explicit reason (raw `<img>` loses both build-time optimization and the layout dimensions that prevent CLS).
- Prefer static generation; use SSR only when dynamic data requires it.
- Watch bundle size — each island adds JS weight.

## Data / content

- Content collections are the source of truth for markdown/MDX content.
- Validate frontmatter against the defined schema.
- Use `getStaticPaths` for dynamic routes in static builds.
- Do not fetch data client-side if it can be fetched at build time.

## Verification

- `astro check` — TypeScript and template diagnostics
- `astro build` — production build
- `astro dev` — local dev

## Anti-patterns

- `client:load` on everything.
- Raw `<img>` instead of `<Image />`.
- Fetching data client-side that could be static.
- Adding multiple UI framework integrations unnecessarily.
