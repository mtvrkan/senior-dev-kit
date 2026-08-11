# senior-dev-kit — landing page source

The website only. The kit itself lives on `main`; the rendered pages live on `gh-pages`.

Three branches, three jobs:

| branch | holds | written by |
| --- | --- | --- |
| `main` | the kit, plus `scripts/gen-site.ts` and `scripts/gen-og.ts` | people |
| `site-src` | this: templates, stylesheet, locale strings, images | people |
| `gh-pages` | the rendered output | CI, force-pushed as one commit |

## Why the source is not on `main`

Everything in this repository is downloaded by anyone installing the kit, and a website
is not part of a Claude Code configuration kit. Splitting it out keeps ~360 KB of page
source and images off every clone.

## Why it still cannot be edited in isolation

Every number the page states — agent and skill counts, deny rules, the always-loaded
line budget, the steps in the gate — is derived from `main`'s contents at build time,
never typed here. `.github/workflows/site.yml` on `main` checks out both branches, runs
`scripts/gen-site.ts`, and publishes the result. A count typed into a template instead
of a `{{token}}` fails consistency check 28 during that build.

## Working on it

```bash
git clone https://github.com/mtvrkan/senior-dev-kit.git
cd senior-dev-kit
git worktree add site site-src  # this branch, into the path the generator expects
npm ci
npm run gen-site                # writes site/dist/
npm run site-check              # renders everything and throws it away
```

`site/` is git-ignored on `main`, so the worktree sits there without polluting anything.

`npm run gen-og` regenerates `og.png`, `apple-touch-icon.png` and `favicon.ico` with
headless Chrome. It is a manual step and its outputs are committed here: rendering the
card on a Linux CI runner would silently pick different fonts from the ones it was
designed and checked with.

## Publishing

Pushing to `main` publishes. Pushing here does too — this branch carries a thin workflow
that calls the one on `main`, so the build logic exists in exactly one place.
