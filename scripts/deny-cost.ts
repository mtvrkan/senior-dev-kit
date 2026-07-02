#!/usr/bin/env node
/**
 * Measures what the kit's Bash deny rules would have cost YOU: scans every Bash
 * command Claude Code actually ran on this machine (~/.claude/projects/xx/*.jsonl
 * transcripts) and reports which commands the deny list would have blocked.
 *
 * Deny rules are blunt prefix/glob matchers by design (see SECURITY.md — they are
 * defence-in-depth, not a sandbox). This script turns "how much friction do they
 * add?" from a guess into a number before you adopt or tune the list.
 *
 * Read-only and local-only: transcripts never leave the machine; output shows at
 * most the first 120 characters of each matched command.
 *
 * Usage:
 *   npm run deny-cost                      # against the kit's settings.json
 *   npm run deny-cost -- path/to/settings.json
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const settingsPath = process.argv[2] ?? join(__dirname, '..', 'settings.json')

if (!existsSync(settingsPath)) {
  console.error(`✗ settings file not found: ${settingsPath}`)
  process.exit(1)
}

const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
  permissions?: { deny?: string[] }
}
const denyRules = settings.permissions?.deny ?? []
const bashPatterns = denyRules.filter(r => r.startsWith('Bash(') && r.endsWith(')')).map(r => r.slice(5, -1))

if (bashPatterns.length === 0) {
  console.error(`✗ no Bash(...) deny rules found in ${settingsPath}`)
  process.exit(1)
}

// Claude Code deny patterns: literal match, with `*` matching any span
// (including newlines — Bash commands are frequently multi-line).
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*')
  return new RegExp(`^${escaped}$`)
}
const rules = bashPatterns.map(pattern => ({ pattern, re: globToRegExp(pattern) }))

const projectsDir = join(homedir(), '.claude', 'projects')
if (!existsSync(projectsDir)) {
  console.error(`✗ no transcript history at ${projectsDir} — nothing to measure yet`)
  process.exit(1)
}

const transcriptFiles: string[] = []
for (const project of readdirSync(projectsDir, { withFileTypes: true })) {
  if (!project.isDirectory()) continue
  const dir = join(projectsDir, project.name)
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.jsonl')) transcriptFiles.push(join(dir, file))
  }
}

const MAX_SAMPLES_PER_RULE = 5
interface RuleHits {
  count: number
  samples: string[]
}
const hits = new Map<string, RuleHits>()
let totalCommands = 0

for (const file of transcriptFiles) {
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const line of content.split('\n')) {
    if (!line.includes('"Bash"')) continue
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const blocks = (entry as { message?: { content?: unknown } })?.message?.content
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      if (block?.type !== 'tool_use' || block?.name !== 'Bash') continue
      const command = block?.input?.command
      if (typeof command !== 'string') continue
      totalCommands++
      for (const { pattern, re } of rules) {
        if (!re.test(command)) continue
        const hit = hits.get(pattern) ?? { count: 0, samples: [] }
        hit.count++
        if (hit.samples.length < MAX_SAMPLES_PER_RULE) {
          hit.samples.push(command.slice(0, 120).replace(/\n/g, '\\n'))
        }
        hits.set(pattern, hit)
      }
    }
  }
}

console.log(`Transcript files scanned: ${transcriptFiles.length}`)
console.log(`Bash commands scanned:    ${totalCommands}`)
console.log(`Bash deny rules checked:  ${rules.length}`)
console.log('')

if (hits.size === 0) {
  console.log('✓ No historical command matched any Bash deny rule — the list would have cost zero denials.')
  process.exit(0)
}

let totalHits = 0
for (const hit of hits.values()) totalHits += hit.count
const rate = totalCommands > 0 ? ((totalHits / totalCommands) * 100).toFixed(2) : '0'
console.log(`${totalHits} of ${totalCommands} commands (${rate}%) would have been denied, by ${hits.size} rule(s):\n`)

for (const [pattern, { count, samples }] of [...hits.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  Bash(${pattern}) — ${count} match(es):`)
  for (const sample of samples) console.log(`    ${sample}`)
  if (count > samples.length) console.log(`    … and ${count - samples.length} more`)
  console.log('')
}

console.log('Review each rule above: an intended catch (a genuinely destructive command) is the')
console.log('list working; a legitimate command means real friction — tune or drop that rule.')
