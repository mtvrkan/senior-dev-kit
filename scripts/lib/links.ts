// Finds relative markdown links ([text](path)) that point to files missing on disk,
// and anchor links (#section, file.md#section) that point to headings that don't exist.
// Skips external URLs (any scheme, e.g. http:, mailto:).
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { stripBom } from './frontmatter.ts'

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

// GitHub's own SECURITY.md convention: a "../../security/advisories/new" link is
// resolved by GitHub's web UI relative to the repo URL (→ github.com/owner/repo/security/advisories/new),
// not by the filesystem. It intentionally has no matching directory in the repo.
const GITHUB_UI_LINK_RE = /security\/advisories\/new$/

export interface LinkRef {
  target: string
  line: number
}

export interface BrokenLink extends LinkRef {
  file: string
  reason: 'missing-file' | 'missing-anchor'
}

const FENCE_RE = /^\s*(`{3,}|~{3,})/
const HEADING_RE = /^#{1,6}\s+(.*)$/
const HTML_ANCHOR_RE = /<a\s+(?:[^>]*\s)?(?:id|name)=["']([^"']+)["']/gi

// Blanks out <!-- ... --> blocks (including multi-line ones) while preserving
// newlines, so commented-out headings don't become anchor targets and
// commented-out links aren't checked — without shifting reported line numbers.
// Also strips a leading UTF-8 BOM, which would otherwise hide a first-line heading
// from the ^-anchored HEADING_RE.
function stripHtmlComments(content: string): string {
  return stripBom(content).replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
}

export function extractLinks(content: string): LinkRef[] {
  const links: LinkRef[] = []
  const lines = stripHtmlComments(content).split(/\r?\n/)
  let inFence = false
  lines.forEach((lineText, i) => {
    if (FENCE_RE.test(lineText)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    // Strip inline code spans so a link shown as a literal example (e.g. docs
    // illustrating markdown syntax) isn't treated as a real reference to check.
    const withoutInlineCode = lineText.replace(/`[^`]*`/g, '')
    for (const match of withoutInlineCode.matchAll(LINK_RE)) {
      links.push({ target: match[1].trim(), line: i + 1 })
    }
  })
  return links
}

// GitHub-style heading slug: markdown/HTML markup stripped, lowercased,
// punctuation removed (unicode letters/numbers/spaces/hyphens/underscores kept),
// spaces replaced with hyphens.
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

// All anchor targets a markdown file exposes: slugs of its headings (with GitHub's
// -1/-2 suffixing for duplicates) plus any explicit <a id="..."> / <a name="..."> anchors.
export function extractAnchors(content: string): Set<string> {
  const anchors = new Set<string>()
  const seen = new Map<string, number>()
  const lines = stripHtmlComments(content).split(/\r?\n/)
  let inFence = false
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const heading = line.match(HEADING_RE)
    if (heading) {
      const slug = slugifyHeading(heading[1])
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      anchors.add(count === 0 ? slug : `${slug}-${count}`)
    }
    for (const a of line.matchAll(HTML_ANCHOR_RE)) {
      anchors.add(a[1].toLowerCase())
    }
  }
  return anchors
}

// True if the link target is a local file reference that should be checked
// (i.e. not an external URL/scheme, and not a same-file anchor — same-file
// anchors are validated separately in findBrokenLinks).
export function isCheckable(target: string): boolean {
  if (target === '' || target.startsWith('#')) return false
  if (SCHEME_RE.test(target)) return false
  if (GITHUB_UI_LINK_RE.test(target)) return false
  return true
}

export function resolveLinkPath(fileDir: string, target: string): string {
  const withoutAnchor = target.split('#')[0]
  return resolve(fileDir, withoutAnchor)
}

// Anchors compare case-insensitively on both sides — GitHub slugifies headings
// to lowercase, so `#Some-Section` and `#some-section` resolve to the same target.
// Malformed percent-encoding (e.g. "#foo%") is deliberately not an error here:
// the anchor falls through to a raw comparison, and since heading slugs never
// contain '%', such a link surfaces as 'missing-anchor' instead of crashing
// the whole check.
function normalizeAnchor(raw: string): string {
  try {
    return decodeURIComponent(raw).toLowerCase()
  } catch {
    return raw.toLowerCase()
  }
}

// Shared across findBrokenLinks calls so a target file's anchors are extracted
// once per process even when many files link to it. Safe because a check run
// never mutates the markdown it reads.
const anchorCache = new Map<string, Set<string>>()

export function findBrokenLinks(filePath: string, content: string): BrokenLink[] {
  const broken: BrokenLink[] = []
  const dir = dirname(filePath)
  let ownAnchors: Set<string> | null = null

  for (const { target, line } of extractLinks(content)) {
    // Same-file anchor link (#section) — validate against this file's headings.
    if (target.startsWith('#')) {
      const anchor = normalizeAnchor(target.slice(1))
      if (anchor === '') continue
      ownAnchors ??= extractAnchors(content)
      if (!ownAnchors.has(anchor)) {
        broken.push({ file: filePath, line, target, reason: 'missing-anchor' })
      }
      continue
    }

    if (!isCheckable(target)) continue

    const resolved = resolveLinkPath(dir, target)
    if (!existsSync(resolved)) {
      broken.push({ file: filePath, line, target, reason: 'missing-file' })
      continue
    }

    // Cross-file anchor (other.md#section) — validate against the target file's headings.
    const hashIdx = target.indexOf('#')
    if (hashIdx === -1 || !/\.md$/i.test(resolved)) continue
    const anchor = normalizeAnchor(target.slice(hashIdx + 1))
    if (anchor === '') continue
    let anchors = anchorCache.get(resolved)
    if (!anchors) {
      anchors = extractAnchors(readFileSync(resolved, 'utf8'))
      anchorCache.set(resolved, anchors)
    }
    if (!anchors.has(anchor)) {
      broken.push({ file: filePath, line, target, reason: 'missing-anchor' })
    }
  }
  return broken
}
