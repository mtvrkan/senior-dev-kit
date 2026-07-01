// Finds relative markdown links ([text](path)) that point to files missing on disk.
// Skips external URLs (any scheme, e.g. http:, mailto:), and same-file anchor-only links (#foo).
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'

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
}

const FENCE_RE = /^\s*(`{3,}|~{3,})/

export function extractLinks(content: string): LinkRef[] {
  const links: LinkRef[] = []
  const lines = content.split(/\r?\n/)
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

// True if the link target is a local file reference that should be checked
// (i.e. not an external URL/scheme, and not a same-file anchor).
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

export function findBrokenLinks(filePath: string, content: string): BrokenLink[] {
  const broken: BrokenLink[] = []
  const dir = dirname(filePath)
  for (const { target, line } of extractLinks(content)) {
    if (!isCheckable(target)) continue
    if (!existsSync(resolveLinkPath(dir, target))) {
      broken.push({ file: filePath, line, target })
    }
  }
  return broken
}
