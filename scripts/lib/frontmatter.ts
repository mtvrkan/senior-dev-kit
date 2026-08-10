// A UTF-8 BOM (common when files are saved by Windows editors) would make the
// ^--- anchor miss and misreport the file as having no frontmatter at all.
export function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

// Parses YAML-like frontmatter from a markdown file.
// Returns a flat key→value object, or null if no --- block is found.
// List items, blank lines, and indented continuation lines are skipped.
export function parseFrontmatter(content: string): Record<string, string> | null {
  const match = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const fm: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*-\s/.test(line) || line.trim() === '' || /^\s{2,}/.test(line)) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    if (key && !key.includes(' ')) fm[key] = val
  }
  return fm
}

// Returns the markdown body after the closing frontmatter delimiter (or '' if there
// is no frontmatter block). Reuses the same non-greedy regex as parseFrontmatter so a
// literal "\n---" inside the body itself (e.g. a YAML code sample) can't be mistaken
// for the closing delimiter the way a plain indexOf('\n---') scan would.
export function getBodyAfterFrontmatter(content: string): string {
  const stripped = stripBom(content)
  const match = stripped.match(/^---\r?\n[\s\S]*?\r?\n---/)
  return match ? stripped.slice(match[0].length) : ''
}

// Returns the values of a block-style YAML list frontmatter key (e.g. `paths:`
// followed by `- "glob"` lines, indented two-or-more spaces OR at zero indent —
// both are valid YAML for a list nested under a mapping key), or null if the
// key isn't present in that form. Quotes around each item are stripped. The
// flat parseFrontmatter() above deliberately skips list items, so callers that
// need the actual glob values (not just "the key exists") go through this
// instead.
export function getFrontmatterList(content: string, key: string): string[] | null {
  const match = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  // Flow style (`key: ["a", "b"]`) is valid YAML the harness accepts — parse it
  // rather than misreporting the key as "not a list" (round-31 finding).
  const flowMatch = match[1].match(new RegExp(`^${key}:[ \\t]*\\[(.*)\\][ \\t]*$`, 'm'))
  if (flowMatch) {
    return flowMatch[1]
      .split(',')
      .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(item => item.length > 0)
  }
  // Block style: `- item` lines may be interleaved with `# comment` lines (valid
  // YAML) — round-31 found a mid-list comment silently truncated the parse, leaving
  // globs after it unvalidated. Comments are consumed here, then filtered out below.
  const re = new RegExp(`^${key}:[ \\t]*\\r?\\n((?:[ \\t]*(?:-\\s+\\S|#)[^\\r\\n]*\\r?\\n?)+)`, 'm')
  const blockMatch = match[1].match(re)
  if (!blockMatch) return null
  return (blockMatch[1].match(/^\s*-\s+.+$/gm) || []).map(line =>
    line.replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, '')
  )
}

// Returns any top-level frontmatter keys that appear more than once — a copy/paste
// mistake the flat key→value parse above would otherwise silently resolve by last-write-wins.
export function findDuplicateFrontmatterKeys(content: string): string[] {
  const match = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return []
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*-\s/.test(line) || line.trim() === '' || /^\s{2,}/.test(line)) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    if (!key || key.includes(' ')) continue
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return [...duplicates]
}
