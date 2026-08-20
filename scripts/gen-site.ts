#!/usr/bin/env node
/**
 * Renders the landing page from `site/*.html` templates into `site/dist/`.
 *
 * Why a generator for two static pages: the page states what the kit contains, and every one of
 * those numbers already has a source of truth on disk. A hand-written landing page is the same
 * drift class `check-consistency.ts` exists to kill — except worse, because the README is at
 * least read by contributors while a published page is read by strangers and corrected by nobody.
 * So the templates carry `{{tokens}}`, this script fills them from `lib/counts.ts` (the same
 * derivation the README check uses), and check 28 fails the gate if a template ever hard-codes a
 * count instead.
 *
 * It also injects the shared partials — the brand mark and the four-step pipeline — so the two
 * locale templates hold only prose. Structure duplicated across translations is structure that
 * eventually disagrees; the pipeline's own labels come from `strings.<locale>.json`.
 *
 * The same argument covers the gate step list the page prints: it is read out of `run-checks.ts`,
 * the module that actually runs those steps, rather than transcribed beside it. A page whose
 * headline is "every number here is derived" cannot afford a hand-copied list.
 *
 * `site/dist/` is git-ignored: the rendered page belongs on the `gh-pages` branch and nowhere
 * else. Publishing is `npm run gen-site` followed by copying `site/dist/` onto that branch, so a
 * build is never older than the templates it came from. `--check` therefore renders everything
 * and discards it — see the note on main() for what that still proves.
 *
 * Usage: node --experimental-strip-types scripts/gen-site.ts [--check]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import {
  componentCounts,
  denyRuleCount,
  contextBudget,
  ALWAYS_LOADED_FILES,
  ALWAYS_LOADED_COMBINED_BUDGET,
} from './lib/counts.ts'
import { findPresetDirs } from './lib/presets.ts'
import { CHECK_STEPS, STEP_NOTES } from './run-checks.ts'
import { stripTemplateNote, stripPartialNote, stripCssComments } from './lib/templates.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'site')
const DIST = join(SRC, 'dist')
// The page source is a separate branch, checked out into site/. Without it every read
// below fails on a path nobody would recognise, so say so once, up front.
if (!existsSync(SRC)) {
  throw new Error(
    'site/ is missing. The landing page source lives on the `site-src` branch — run ' +
      '`git worktree add site site-src` (or check it out into site/) before generating.'
  )
}
const readSrc = (file: string): string => readFileSync(join(SRC, file), 'utf8')

// The install snippet's `owner/repo` comes from package.json's repository field — the one place
// the slug is already declared. `check-consistency.ts` check 27 pins every GitHub link in the
// docs to this same value.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const slug = String(pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '').split('github.com/')[1]
if (!slug) throw new Error('package.json repository.url is not a github.com URL — gen-site cannot derive the repository slug')

// Where the page actually answers, which is NOT always where the repository lives. A custom
// domain was added to gh-pages by hand and the generated canonical/hreflang tags kept pointing at
// the github.io path — a self-referencing canonical aimed at a URL that now 301s somewhere else,
// precisely the defect `rules/100-web.md`'s SEO checklist exists to prevent. One declared origin,
// and the CNAME that makes it real is emitted from the same value below.
const siteOrigin = String(pkg.seniorDevKit?.siteOrigin ?? '').replace(/\/+$/, '')
if (!/^https:\/\/[^/]+$/.test(siteOrigin)) {
  throw new Error('package.json seniorDevKit.siteOrigin must be an https origin with no path, e.g. https://example.com')
}
const siteHost = new URL(siteOrigin).host

// The byline in the footer points at the author's own site, not at a GitHub profile. npm's object
// form of `author` is where that URL already belongs, so it is declared once there rather than
// typed into two locale templates that would then drift apart.
const authorUrl = String((pkg.author as { url?: string } | string | undefined) instanceof Object ? (pkg.author as { url?: string }).url ?? '' : '')
if (!/^https:\/\/\S+$/.test(authorUrl)) {
  throw new Error('package.json author must be the object form with an https url, e.g. { "name": "…", "url": "https://example.com" }')
}

// PNG dimensions live in the IHDR chunk, at fixed offsets right after the signature.
// Reading them beats hand-typing 1200x630 into two templates that would then have to be
// remembered if the card is ever re-cropped. Read per locale, not once: each locale ships its
// own card, and a shared width would be a hand-copied number again the moment one is re-cropped.
function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(file)
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

const counts = componentCounts(ROOT)
const budget = contextBudget(ROOT)
const deny = denyRuleCount(ROOT)
if (deny === null) throw new Error('settings-template.json missing — refusing to publish a page that states a deny-rule count it could not verify')

// The ticker is the preset directory listing, not a curated list: adding a preset adds a chip
// with no edit here, and removing one cannot leave a stale name on a published page.
const presetNames = findPresetDirs(join(ROOT, 'presets'))
  .map((p) => basename(p.relPath))
  .sort((a, b) => a.localeCompare(b, 'en'))

// The gate transcript on the page. A step whose green tick means less than it looks like carries
// its caveat here too — `STEP_NOTES` is the same annotation the terminal summary prints, so the
// page cannot advertise a stronger guarantee than the runner gives.
const gateSteps = CHECK_STEPS.map((step) => {
  const note = STEP_NOTES[step]
  return `<li><span class="tick" aria-hidden="true"></span>${step}${note ? `<small>${note}</small>` : ''}</li>`
}).join('')

/**
 * One entry per published locale. `lang` and `ogImage` sit here rather than in the strings
 * files for the same reason the pipeline partial does: those hold prose, this holds structure.
 *
 * The card is per-locale because it is the page's first sentence for anyone who never clicks.
 * A Turkish page that unfurls an English card is a translation that stops at the door — and the
 * failure is invisible from the branch, since `og:locale` was already `tr_TR` and the alt text
 * already Turkish while the image behind them was not.
 *
 * `out` is the file GitHub Pages stores; `path` is the URL it answers on, and they are not the
 * same string. Pages resolves an extensionless request against `<path>.html`, so `/tr` and
 * `/tr.html` both return 200 — two URLs for one page. Whichever one the canonical, the hreflang
 * pair, the sitemap and the language switcher name is the one Google indexes, so the clean path
 * is declared here once and every one of those reads it. Hand-typing `tr.html` into a template
 * is how the `.html` ended up in the search result this field exists to keep out of it.
 */
export const PAGES: {
  template: string
  out: string
  path: string
  strings: string
  lang: string
  ogImage: string
}[] = [
  { template: 'index.en.html', out: 'index.html', path: '', strings: 'strings.en.json', lang: 'en', ogImage: 'og.png' },
  { template: 'index.tr.html', out: 'tr.html', path: 'tr', strings: 'strings.tr.json', lang: 'tr', ogImage: 'og.tr.png' },
]

// Two link tokens per locale, both derived from `path` above: `<lang>Url` is absolute and belongs
// in canonical/hreflang/og:url, `<lang>Href` is root-relative and belongs in the page's own links.
// The 404 page is rendered without locale strings and still has to link Turkish, which is why
// these live in TOKENS rather than in localeTokens().
const localeUrlTokens: Record<string, string> = Object.fromEntries(
  PAGES.flatMap((p) => [
    [`${p.lang}Url`, `${siteOrigin}/${p.path}`],
    [`${p.lang}Href`, `/${p.path}`],
  ])
)

// Structured data. Emitted from the same derived values as the visible page rather than
// hand-written into two templates: a JSON-LD block that disagrees with the page is worse than
// none, because only crawlers read it and nobody proof-reads it.
//
// Two nodes, not one. `SoftwareSourceCode` describes the kit; `WebSite` describes the thing the
// URL is, and it is the only node Google reads to decide what to print where the result's site
// name goes. Without it the search result was headed `mtvrkan.com` — the registrable domain,
// guessed, because nothing on the page had ever claimed a name for the site itself.
const authorName = String((pkg.author as { name?: string }).name ?? '')
const author = { '@type': 'Person', '@id': `${authorUrl}#person`, name: authorName, url: authorUrl }
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteOrigin}/#website`,
      name: 'Senior Dev Kit',
      alternateName: 'senior-dev-kit',
      url: `${siteOrigin}/`,
      inLanguage: ['en', 'tr'],
      author,
      publisher: author,
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': `${siteOrigin}/#kit`,
      name: 'Senior Dev Kit',
      description:
        'A Claude Code configuration kit: read-only guard agents, a written procedure per task shape, path-scoped rules under an enforced context budget, stack presets, and permission rules the harness applies before a tool runs.',
      url: `${siteOrigin}/`,
      isPartOf: { '@id': `${siteOrigin}/#website` },
      codeRepository: `https://github.com/${slug}`,
      programmingLanguage: 'TypeScript',
      runtimePlatform: 'Node.js',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Windows, Linux',
      license: 'https://opensource.org/licenses/MIT',
      version: String(pkg.version),
      inLanguage: ['en', 'tr'],
      isAccessibleForFree: true,
      author,
    },
  ],
})

export const TOKENS: Record<string, string> = {
  agents: String(counts.Agent),
  skills: String(counts.Skill),
  rules: String(counts.Rule),
  commands: String(counts.Command),
  presets: String(counts.Preset),
  agentDocs: String(counts.agent_docs),
  denyRules: String(deny),
  alwaysLoadedLines: String(budget.alwaysLoadedLines),
  alwaysLoadedFiles: String(ALWAYS_LOADED_FILES.length),
  alwaysLoadedShare: String(budget.alwaysLoadedShare),
  combinedBudget: String(ALWAYS_LOADED_COMBINED_BUDGET),
  totalRuleLines: String(budget.totalRuleLines),
  pathScopedRules: String(budget.pathScopedRules),
  gateSteps,
  gateStepCount: String(CHECK_STEPS.length),
  version: String(pkg.version),
  repoSlug: slug,
  repoUrl: `https://github.com/${slug}`,
  baseUrl: siteOrigin,
  ...localeUrlTokens,
  owner: slug.split('/')[0],
  authorUrl,
  authorName,
  jsonLd,
  mark: readSrc('favicon.svg').replace(/^<svg /, '<svg aria-hidden="true" focusable="false" ').trim(),
  presetTicker: presetNames.map((n) => `<span>${n}</span>`).join(''),
  presetList: presetNames.join(', '),
}

// The comment header of each template is for contributors, not visitors — stripping it
// lives in lib/ so it can be unit-tested without this module's file reads. See the note
// there for the CRLF bug that made the separation worth having.

export function render(template: string, tokens: Record<string, string> = TOKENS): string {
  const out = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in tokens)) throw new Error(`template uses {{${key}}}, which gen-site.ts does not define`)
    return tokens[key]
  })
  const leftover = out.match(/\{\{\w+\}\}/)
  if (leftover) throw new Error(`unrendered token ${leftover[0]} survived rendering`)
  return out
}

/**
 * The tokens one locale renders with, minus the card's pixel size. `gen-og.ts` renders the card
 * itself from these, and on a first run the PNG it is about to write does not exist yet — so
 * measuring it belongs to the page build below, not here.
 */
export function localeTokens(page: (typeof PAGES)[number]): Record<string, string> {
  return {
    ...TOKENS,
    ...(JSON.parse(readSrc(page.strings)) as Record<string, string>),
    lang: page.lang,
    ogImage: page.ogImage,
  }
}
// Rendered like a page but deliberately outside PAGES: the sitemap lists pages worth indexing,
// and an error page is neither indexed nor a destination. It takes no locale strings.
const STANDALONE: { template: string; out: string }[] = [{ template: '404.html', out: '404.html' }]

// Text assets, published as-is apart from the comment strip below. `favicon.svg` has no
// comments to lose; `style.css` is the reason the strip exists.
const COPIED = ['style.css', 'favicon.svg']
// Rasters produced by `gen-og.ts`. Copied byte-for-byte: reading them as text would
// corrupt them, which is why they are a separate list rather than another entry above.
const COPIED_BINARY = [...new Set(PAGES.map((p) => p.ogImage)), 'apple-touch-icon.png', 'favicon.ico']

// GitHub Pages runs Jekyll over a branch unless `.nojekyll` exists. CNAME is the same argument
// one step further: it was added to gh-pages by hand, which is how the canonical tags ended up
// pointing somewhere the site no longer answers. Generated from the same `siteOrigin` the
// canonicals use, it cannot drift from them — and is omitted on a github.io origin, where a CNAME
// file would break Pages rather than configure it.
const literalFiles = (): { path: string; content: string }[] => [
  { path: '.nojekyll', content: '' },
  ...(siteHost.endsWith('.github.io') ? [] : [{ path: 'CNAME', content: `${siteHost}\n` }]),
  { path: 'robots.txt', content: `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n` },
  {
    path: 'sitemap.xml',
    content:
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      PAGES.map(({ path }) => `  <url><loc>${siteOrigin}/${path}</loc></url>\n`).join('') +
      '</urlset>\n',
  },
]

function buildArtifacts(): { path: string; content: string | Buffer }[] {
  const pipelineTpl = stripPartialNote(readSrc('pipeline.html'))
  return [
    ...PAGES.map((entry) => {
      const card = pngSize(join(SRC, entry.ogImage))
      const tokens = { ...localeTokens(entry), ogWidth: String(card.width), ogHeight: String(card.height) }
      const pipeline = render(pipelineTpl, tokens)
      const page = render(stripTemplateNote(readSrc(entry.template)), { ...tokens, pipeline })
      return { path: entry.out, content: page }
    }),
    ...STANDALONE.map(({ template, out }) => ({
      path: out,
      content: render(stripTemplateNote(readSrc(template))),
    })),
    ...COPIED.map((asset) => {
      const text = readSrc(asset)
      return { path: asset, content: (asset.endsWith('.css') ? stripCssComments(text) : text) as string | Buffer }
    }),
    ...COPIED_BINARY.map((asset) => ({ path: asset, content: readFileSync(join(SRC, asset)) as string | Buffer })),
    ...literalFiles(),
  ]
}

// `--check` renders everything and throws the build away. It used to diff against a committed
// `site/dist/`, which only answered "did someone forget to rebuild" — a question that stopped
// existing once the output left this branch and every publish began with a fresh render. What is
// left is the question that can still break a publish: does every template render at all. An
// undefined token, a missing partial, malformed locale JSON, an unreadable settings template or a
// bad `siteOrigin` all fail here, on the contributor's machine, instead of at deploy time.
function main(): void {
  const check = process.argv.includes('--check')
  const artifacts = buildArtifacts()

  if (check) {
    // `.nojekyll` is empty by design, so the emptiness assertion covers only the files that carry
    // content: the rendered pages and the copied assets.
    const mustHaveContent = new Set([
      ...PAGES.map((p) => p.out),
      ...STANDALONE.map((p) => p.out),
      ...COPIED,
      ...COPIED_BINARY,
    ])
    const isEmpty = (c: string | Buffer): boolean => (typeof c === 'string' ? c.trim() === '' : c.length === 0)
    const empty = artifacts.filter((a) => mustHaveContent.has(a.path) && isEmpty(a.content)).map((a) => a.path)
    if (empty.length > 0) {
      console.error(`\n✗ rendered empty: ${empty.join(', ')}\n`)
      process.exit(1)
    }
    // The strippers are unit-tested; this asserts they are actually *wired in*, which no unit
    // test can. Every source file here carries contributor notes — art direction, abandoned
    // approaches, why a breakpoint is where it is — and none of it is written for a visitor.
    const leaked = artifacts
      .filter((a) => typeof a.content === 'string')
      .filter((a) => (a.path.endsWith('.css') ? (a.content as string).includes('/*') : /\.html?$/.test(a.path) && (a.content as string).includes('<!--')))
      .map((a) => a.path)
    if (leaked.length > 0) {
      console.error(`\n✗ contributor comments would ship to visitors in: ${leaked.join(', ')}\n`)
      process.exit(1)
    }

    console.log(`✓ site/ renders (${artifacts.length} files) against the counts on disk.`)
    console.log(`  ${counts.Agent} agents · ${counts.Skill} skills · ${counts.Rule} rules · ${counts.Preset} presets · ${deny} deny rules`)
    return
  }

  mkdirSync(DIST, { recursive: true })
  for (const { path, content } of artifacts) writeFileSync(join(DIST, path), content)

  console.log(`✓ Rendered ${artifacts.length} files into site/dist/`)
  console.log(`  ${counts.Agent} agents · ${counts.Skill} skills · ${counts.Rule} rules · ${counts.Preset} presets · ${deny} deny rules`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
