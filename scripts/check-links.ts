#!/usr/bin/env node
/**
 * Scans every markdown file in the repo for relative links pointing to files
 * that don't exist on disk. Skips external URLs (http:, mailto:, etc.) and
 * same-file anchor-only links (#foo).
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
    console.error(`  ✗ ${rel}:${b.line} — broken link to '${b.target}'`)
    totalBroken++
  }
}

if (totalBroken > 0) {
  console.error(`\n✗ ${totalBroken} broken internal link(s) found.`)
  process.exit(1)
}

console.log('✓ No broken internal markdown links found.')
process.exit(0)
