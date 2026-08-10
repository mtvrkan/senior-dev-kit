#!/usr/bin/env node
/**
 * Scans every markdown file in the repo for relative links pointing to files
 * that don't exist on disk, and for anchor links (#section, file.md#section)
 * pointing to headings that don't exist. Skips external URLs (http:, mailto:, etc.).
 *
 * Usage: node --experimental-strip-types scripts/check-links.ts
 */
import { readFileSync, readdirSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { findBrokenLinks } from './lib/links.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.LINKS_ROOT ?? join(__dirname, '..')
const SKIP_DIRS = new Set(['node_modules', '.git'])

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.name.endsWith('.md')) {
      out.push(full)
    }
  }
}

const files: string[] = []
walk(ROOT, files)

console.log(`\nChecking internal markdown links across ${files.length} files...\n`)

let totalBroken = 0
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  for (const b of findBrokenLinks(file, content)) {
    const rel = relative(ROOT, b.file).replace(/\\/g, '/')
    const what = b.reason === 'missing-anchor' ? 'link to missing anchor' : 'broken link to'
    console.error(`  ✗ ${rel}:${b.line} — ${what} '${b.target}'`)
    totalBroken++
  }
}

// The READMEs advertise the markdown-file count as a "measured, reproducible"
// number — assert it still matches what this walk actually found, so the claim
// can't silently drift (it read "188" while the repo had 189 until this guard
// was added). This walk IS the source of truth, so there's no second traversal
// to keep in sync.
let countDrift = 0
for (const readme of ['README.md']) {
  let text: string
  try {
    text = readFileSync(join(ROOT, readme), 'utf8')
  } catch {
    continue // README not present (e.g. a fixture root) — nothing to check
  }
  for (const m of text.matchAll(/(\d+) markdown (?:files|dosyası)/g)) {
    if (Number(m[1]) !== files.length) {
      console.error(`  ✗ ${readme} claims ${m[1]} markdown files, this walk found ${files.length}`)
      countDrift++
    }
  }
}

if (totalBroken > 0 || countDrift > 0) {
  if (totalBroken > 0) console.error(`\n✗ ${totalBroken} broken internal link(s) found.`)
  if (countDrift > 0) console.error(`\n✗ ${countDrift} markdown-file-count claim(s) out of sync with disk.`)
  process.exit(1)
}

console.log('✓ No broken internal markdown links found.')
console.log(`✓ README markdown-file count matches disk (${files.length}).`)
process.exit(0)
