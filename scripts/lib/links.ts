// Finds relative markdown links ([text](path)) that point to files missing on disk,
// and anchor links (#section, file.md#section) that point to headings that don't exist.
// Skips external URLs (any scheme, e.g. http:, mailto:).
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { stripBom } from './frontmatter.ts'

// Target is either an angle-bracket form (<path with spaces>) or a bare path that may
// contain balanced parens (one level — e.g. "file(1).md"), followed by an optional
// "title" / 'title' suffix (CommonMark link-title syntax) that must NOT be captured
// as part of the path.
const LINK_RE = /\[[^\]]*\]\(\s*(<[^>]*>|[^()\s]*(?:\([^()]*\)[^()\s]*)*)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g
// Requires 2+ chars before the colon so a single-letter Windows drive prefix
// (`C:`, `D:`) in an absolute local path isn't mistaken for a URI scheme —
// every real scheme in use (http, https, mailto, tel, ftp, ...) is 2+ chars.
const SCHEME_RE = /^[a-z][a-z0-9+.-]+:/i

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

const FENCE_OPEN_RE = /^\s*(`{3,}|~{3,})/
const HEADING_RE = /^#{1,6}\s+(.*)$/

interface OpenFence {
  char: string
  len: number
}

// CommonMark fence-close rule: a fence only closes on a line using the SAME character
// (backtick vs tilde) at a length >= the opener's. A single boolean toggle would
// misfire on e.g. a ~~~ line appearing inside an open ``` block (or a shorter fence of
// the same char), incorrectly closing (or failing to recognize) the real fence and
// mis-hiding/exposing headings and links inside it.
function closesFence(open: OpenFence, marker: string): boolean {
  return marker[0] === open.char && marker.length >= open.len
}
const HTML_ANCHOR_RE = /<a\s+(?:[^>]*\s)?(?:id|name)=["']([^"']+)["']/gi

// Blanks out <!-- ... --> blocks (including multi-line ones) while preserving
// newlines, so commented-out headings don't become anchor targets and
// commented-out links aren't checked — without shifting reported line numbers.
// Fence-aware: a bare "<!--" shown as literal text inside a fenced code block
// (e.g. docs illustrating comment syntax) is never treated as a comment
// opener — a whole-content regex pass run before fence-tracking would let that
// literal merge with an unrelated real "-->" later in the file and blank out
// every real heading/link in between.
// Also strips a leading UTF-8 BOM, which would otherwise hide a first-line heading
// from the ^-anchored HEADING_RE.
function stripHtmlComments(content: string): string[] {
  const lines = stripBom(content).split(/\r?\n/)
  let openFence: OpenFence | null = null
  let inComment = false
  return lines.map(lineText => {
    const fenceMatch = lineText.match(FENCE_OPEN_RE)
    if (openFence) {
      if (fenceMatch && closesFence(openFence, fenceMatch[1])) openFence = null
      return lineText
    }
    // A fence marker only opens a real code fence when we're NOT inside an HTML
    // comment. A ``` shown inside a comment (docs illustrating fenced-code
    // syntax) must fall through to comment handling below and be blanked —
    // otherwise the stray fence never closes and leaks fence state past the
    // comment's -->, hiding every real heading/link that follows (mirror image
    // of the round-15 fence-contains-comment fix above).
    if (fenceMatch && !inComment) {
      openFence = { char: fenceMatch[1][0], len: fenceMatch[1].length }
      return lineText
    }
    let out = ''
    let rest = lineText
    for (;;) {
      if (inComment) {
        const endIdx = rest.indexOf('-->')
        if (endIdx === -1) return out + ' '.repeat(rest.length)
        out += ' '.repeat(endIdx + 3)
        rest = rest.slice(endIdx + 3)
        inComment = false
      } else {
        const startIdx = rest.indexOf('<!--')
        if (startIdx === -1) return out + rest
        out += rest.slice(0, startIdx)
        rest = rest.slice(startIdx)
        inComment = true
      }
    }
  })
}

export function extractLinks(content: string): LinkRef[] {
  const links: LinkRef[] = []
  const lines = stripHtmlComments(content)
  let openFence: OpenFence | null = null
  lines.forEach((lineText, i) => {
    const fenceMatch = lineText.match(FENCE_OPEN_RE)
    if (fenceMatch) {
      if (openFence === null) {
        openFence = { char: fenceMatch[1][0], len: fenceMatch[1].length }
        return
      }
      if (closesFence(openFence, fenceMatch[1])) {
        openFence = null
        return
      }
      // A fence-looking line of a different marker/shorter length while already
      // inside a fence is literal content, not a close — falls through below.
    }
    if (openFence) return
    // Strip inline code spans so a link shown as a literal example (e.g. docs
    // illustrating markdown syntax) isn't treated as a real reference to check.
    const withoutInlineCode = lineText.replace(/`[^`]*`/g, '')
    for (const match of withoutInlineCode.matchAll(LINK_RE)) {
      let target = match[1].trim()
      if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1)
      links.push({ target, line: i + 1 })
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
  const lines = stripHtmlComments(content)
  let openFence: OpenFence | null = null
  for (const line of lines) {
    const fenceMatch = line.match(FENCE_OPEN_RE)
    if (fenceMatch) {
      if (openFence === null) {
        openFence = { char: fenceMatch[1][0], len: fenceMatch[1].length }
        continue
      }
      if (closesFence(openFence, fenceMatch[1])) {
        openFence = null
        continue
      }
    }
    if (openFence) continue
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
