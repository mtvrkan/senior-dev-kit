#!/usr/bin/env node
/**
 * Reads PRESET-MAINTENANCE.md, RULES-MAINTENANCE.md, AGENTS-MAINTENANCE.md,
 * SKILLS-MAINTENANCE.md, and COMMANDS-MAINTENANCE.md, failing if any item was
 * last reviewed more than STALE_AFTER_DAYS ago (default: 365). Also cross-references
 * directories / files on disk against the maintenance tables.
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-stale.ts
 *   STALE_AFTER_DAYS=180 node --experimental-strip-types scripts/check-stale.ts
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { findPresetDirs } from './lib/presets.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAINTENANCE_FILE = process.env.MAINTENANCE_FILE ?? join(__dirname, '..', 'PRESET-MAINTENANCE.md')
const RULES_MAINTENANCE_FILE = process.env.RULES_MAINTENANCE_FILE ?? join(__dirname, '..', 'RULES-MAINTENANCE.md')
const AGENTS_MAINTENANCE_FILE = process.env.AGENTS_MAINTENANCE_FILE ?? join(__dirname, '..', 'AGENTS-MAINTENANCE.md')
const SKILLS_MAINTENANCE_FILE = process.env.SKILLS_MAINTENANCE_FILE ?? join(__dirname, '..', 'SKILLS-MAINTENANCE.md')
const COMMANDS_MAINTENANCE_FILE = process.env.COMMANDS_MAINTENANCE_FILE ?? join(__dirname, '..', 'COMMANDS-MAINTENANCE.md')
const README_FILE = process.env.README_FILE ?? join(__dirname, '..', 'README.md')
const PRESETS_DIR = join(__dirname, '..', 'presets')
const RULES_DIR = join(__dirname, '..', 'rules')
const SKILLS_DIR = join(__dirname, '..', 'skills')
const AGENTS_DIR = join(__dirname, '..', 'agents')
const AGENT_DOCS_DIR = join(__dirname, '..', 'agent_docs')
const EXAMPLES_DIR = join(__dirname, '..', 'examples')
const COMMANDS_DIR = join(__dirname, '..', 'commands')
const STALE_DAYS = parseInt(process.env.STALE_AFTER_DAYS ?? '365', 10)
if (Number.isNaN(STALE_DAYS) || STALE_DAYS <= 0) {
  console.error(`✗ STALE_AFTER_DAYS must be a positive integer, got: '${process.env.STALE_AFTER_DAYS}'`)
  process.exit(1)
}
const MS_PER_DAY = 86_400_000

// Matches rows with a backtick-quoted name and a YYYY-MM-DD date.
// Example:  | **Web** | `nextjs-saas` | Next.js 14–15 | 2026-06-30 |
const ROW_RE = /\|\s*`([a-zA-Z0-9-]+)`\s*\|[^|]+\|\s*(\d{4}-\d{2}-\d{2})\s*\|/g
// Same pattern without the global flag — safe for repeated .test() calls
// (a global regex would carry lastIndex state between lines).
const ROW_LINE_RE = new RegExp(ROW_RE.source)

// A row inside a "Last Reviewed" table that fails ROW_RE (moved date column,
// missing backticks, extra pipes) would otherwise be skipped silently and its
// item misreported as merely untracked. Scan review tables line-by-line and
// flag non-parsing rows as malformed. Other tables in the same files
// (e.g. Trigger/Action) carry no review dates and are ignored.
function flagMalformedReviewRows(fileContent: string, fileLabel: string): void {
  let inReviewTable = false
  for (const rawLine of fileContent.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('|')) {
      inReviewTable = false
      continue
    }
    if (/last reviewed/i.test(line)) {
      inReviewTable = true
      continue
    }
    if (!inReviewTable) continue
    if (/^\|[\s|:-]*\|$/.test(line)) continue // separator row
    if (!ROW_LINE_RE.test(line)) {
      const name = line.match(/`([a-zA-Z0-9-]+)`/)
      malformedDates.push(
        `${name ? name[1] : `'${line.slice(0, 60)}'`} (${fileLabel}) — row does not match the expected table format (| \`name\` | ... | YYYY-MM-DD |)`
      )
    }
  }
}

interface StaleEntry {
  name: string
  dateStr: string
  daysSince: number
}

if (!existsSync(MAINTENANCE_FILE)) {
  console.error('✗ PRESET-MAINTENANCE.md not found. Run from the repo root.')
  process.exit(1)
}

const content = readFileSync(MAINTENANCE_FILE, 'utf8')
const now = new Date()

const stale: StaleEntry[] = []
const untracked: string[] = []
const orphaned: string[] = []
const malformedDates: string[] = []
let presetsChecked = 0
const trackedPresets = new Set<string>()

flagMalformedReviewRows(content, basename(MAINTENANCE_FILE))

for (const match of content.matchAll(ROW_RE)) {
  const [, preset, dateStr] = match
  const reviewed = new Date(dateStr)
  if (isNaN(reviewed.getTime())) {
    malformedDates.push(`${preset} (PRESET-MAINTENANCE.md) — invalid date '${dateStr}'`)
    continue
  }
  const daysSince = Math.floor((now.getTime() - reviewed.getTime()) / MS_PER_DAY)
  presetsChecked++
  trackedPresets.add(preset)
  if (daysSince > STALE_DAYS) {
    stale.push({ name: preset, dateStr, daysSince })
  }
}

if (presetsChecked === 0) {
  console.error('✗ No preset review dates found in PRESET-MAINTENANCE.md — check table format.')
  process.exit(1)
}

// Cross-reference: preset directories on disk vs maintenance table (both directions)
const diskPresets = new Set<string>()
if (existsSync(PRESETS_DIR)) {
  for (const category of readdirSync(PRESETS_DIR, { withFileTypes: true })) {
    if (!category.isDirectory()) continue
    for (const preset of readdirSync(join(PRESETS_DIR, category.name), { withFileTypes: true })) {
      if (!preset.isDirectory()) continue
      const claudePath = join(PRESETS_DIR, category.name, preset.name, 'CLAUDE.md')
      if (existsSync(claudePath)) {
        diskPresets.add(preset.name)
        if (!trackedPresets.has(preset.name)) {
          untracked.push(`${category.name}/${preset.name}`)
        }
      }
    }
  }
}
for (const preset of trackedPresets) {
  if (!diskPresets.has(preset)) {
    orphaned.push(`${preset} (PRESET-MAINTENANCE.md)`)
  }
}

// --- Generic flat maintenance table check (rules, agents, skills, commands) ---
// Parses a maintenance file's review-date rows, flags stale/malformed dates, and
// cross-references the given on-disk entry names against what the table tracks —
// in both directions: disk entries missing from the table (untracked), and table
// rows with no matching entry on disk (orphaned, e.g. after a rename or removal).
function checkFlatMaintenance(maintenanceFile: string, dirLabel: string, entries: string[]): number {
  const fileLabel = basename(maintenanceFile)
  if (!existsSync(maintenanceFile)) {
    console.warn(`⚠ ${fileLabel} not found — ${dirLabel} staleness will not be checked.`)
    return 0
  }

  const fileContent = readFileSync(maintenanceFile, 'utf8')
  flagMalformedReviewRows(fileContent, fileLabel)
  const tracked = new Set<string>()
  let checked = 0

  for (const match of fileContent.matchAll(ROW_RE)) {
    const [, name, dateStr] = match
    const reviewed = new Date(dateStr)
    if (isNaN(reviewed.getTime())) {
      malformedDates.push(`${name} (${fileLabel}) — invalid date '${dateStr}'`)
      continue
    }
    const daysSince = Math.floor((now.getTime() - reviewed.getTime()) / MS_PER_DAY)
    checked++
    tracked.add(name)
    if (daysSince > STALE_DAYS) {
      stale.push({ name, dateStr, daysSince })
    }
  }

  if (checked === 0 && entries.length > 0) {
    console.error(`✗ ${fileLabel} — 0 rows matched the expected table format (| \`name\` | ... | YYYY-MM-DD |) despite ${entries.length} ${dirLabel} on disk. The table format likely changed — fix it rather than trusting the untracked list below.`)
    malformedDates.push(`${fileLabel} — table format unrecognized, 0 rows parsed`)
  }

  const entrySet = new Set(entries)
  for (const entry of entries) {
    if (!tracked.has(entry)) {
      untracked.push(`${dirLabel}/${entry}`)
    }
  }
  for (const name of tracked) {
    if (!entrySet.has(name)) {
      orphaned.push(`${name} (${fileLabel})`)
    }
  }

  return checked
}

const rulesChecked = existsSync(RULES_DIR)
  ? checkFlatMaintenance(
      RULES_MAINTENANCE_FILE,
      'rules',
      readdirSync(RULES_DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
    )
  : 0

const agentsChecked = existsSync(AGENTS_DIR)
  ? checkFlatMaintenance(
      AGENTS_MAINTENANCE_FILE,
      'agents',
      readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md') && f !== 'ROUTING.md').map(f => f.replace(/\.md$/, ''))
    )
  : 0

const skillsChecked = existsSync(SKILLS_DIR)
  ? checkFlatMaintenance(
      SKILLS_MAINTENANCE_FILE,
      'skills',
      readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, 'SKILL.md')))
        .map(e => e.name)
    )
  : 0

const commandsChecked = existsSync(COMMANDS_DIR)
  ? checkFlatMaintenance(
      COMMANDS_MAINTENANCE_FILE,
      'commands',
      readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
    )
  : 0

// --- README.md quantitative claims vs actual files on disk ---
const countMismatches: string[] = []

if (existsSync(README_FILE)) {
  const readme = readFileSync(README_FILE, 'utf8')

  function claimed(re: RegExp): number | null {
    const m = readme.match(re)
    return m ? parseInt(m[1], 10) : null
  }

  const countChecks: Array<{ label: string; claim: number | null; actual: number }> = [
    {
      label: 'Skills',
      claim: claimed(/###\s*Skills\s*\((\d+)\)/),
      actual: existsSync(SKILLS_DIR)
        ? readdirSync(SKILLS_DIR, { withFileTypes: true })
            .filter(e => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, 'SKILL.md'))).length
        : 0,
    },
    {
      label: 'Rules',
      claim: claimed(/###\s*Rules\s*\((\d+)\)/),
      actual: existsSync(RULES_DIR) ? readdirSync(RULES_DIR).filter(f => f.endsWith('.md')).length : 0,
    },
    {
      label: 'Agent Docs',
      claim: claimed(/###\s*Agent Docs\s*\((\d+)\)/),
      actual: existsSync(AGENT_DOCS_DIR) ? readdirSync(AGENT_DOCS_DIR).filter(f => f.endsWith('.md')).length : 0,
    },
    {
      label: 'Examples',
      claim: claimed(/###\s*Examples\s*\((\d+)/),
      actual: existsSync(EXAMPLES_DIR)
        ? readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').length
        : 0,
    },
    {
      label: 'Presets',
      claim: claimed(/###\s*Presets\s*\((\d+)\s*stacks/),
      actual: existsSync(PRESETS_DIR) ? findPresetDirs(PRESETS_DIR).length : 0,
    },
    {
      label: 'Agents',
      claim: claimed(/agents\/\s+←\s*(\d+)\s*agent definitions/),
      actual: existsSync(AGENTS_DIR)
        ? readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md') && f !== 'ROUTING.md').length
        : 0,
    },
    {
      label: 'Commands',
      claim: claimed(/commands\/\s+←\s*(\d+)\s*slash command definitions/),
      actual: existsSync(COMMANDS_DIR) ? readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md')).length : 0,
    },
  ]

  for (const { label, claim, actual } of countChecks) {
    if (claim === null) {
      console.warn(`⚠ README.md — could not find a "${label}" count claim to verify (regex may be stale)`)
      continue
    }
    if (claim !== actual) {
      countMismatches.push(`${label}: README.md claims ${claim}, found ${actual} on disk`)
    }
  }
} else {
  console.warn('⚠ README.md not found — count-claim cross-check skipped.')
}

let exitCode = 0

if (stale.length > 0) {
  console.error(`\n⚠ ${stale.length} item(s) stale (last reviewed > ${STALE_DAYS} days ago):\n`)
  for (const { name, dateStr, daysSince } of stale) {
    console.error(`  ✗ ${name} — last reviewed ${dateStr} (${daysSince} days ago)`)
  }
  console.error(`\nUpdate "Last Reviewed" dates in the relevant *-MAINTENANCE.md file.`)
  exitCode = 1
}

if (untracked.length > 0) {
  console.error(`\n✗ ${untracked.length} item(s) on disk not tracked in a maintenance table:\n`)
  for (const p of untracked) {
    console.error(`  ✗ ${p} — add a row with today's date`)
  }
  console.error('\nSee CONTRIBUTING.md for the maintenance table format.')
  exitCode = 1
}

if (orphaned.length > 0) {
  console.error(`\n✗ ${orphaned.length} maintenance table row(s) with no matching item on disk:\n`)
  for (const o of orphaned) {
    console.error(`  ✗ ${o} — remove the row, or the item was renamed/removed without updating it`)
  }
  exitCode = 1
}

if (countMismatches.length > 0) {
  console.error(`\n✗ ${countMismatches.length} README.md count claim(s) out of sync with disk:\n`)
  for (const m of countMismatches) {
    console.error(`  ✗ ${m}`)
  }
  console.error(`\nUpdate the counts in README.md (or the files on disk) so they match.`)
  exitCode = 1
}

if (malformedDates.length > 0) {
  console.error(`\n✗ ${malformedDates.length} malformed maintenance table row(s)/date(s) — staleness cannot be verified:\n`)
  for (const m of malformedDates) {
    console.error(`  ✗ ${m}`)
  }
  console.error(`\nFix the row to match: | \`name\` | ... | YYYY-MM-DD |`)
  exitCode = 1
}

if (exitCode === 0) {
  console.log(`✓ All ${presetsChecked} presets reviewed within the last ${STALE_DAYS} days.`)
  if (rulesChecked > 0) {
    console.log(`✓ All ${rulesChecked} rules reviewed within the last ${STALE_DAYS} days.`)
  }
  if (agentsChecked > 0) {
    console.log(`✓ All ${agentsChecked} agents reviewed within the last ${STALE_DAYS} days.`)
  }
  if (skillsChecked > 0) {
    console.log(`✓ All ${skillsChecked} skills reviewed within the last ${STALE_DAYS} days.`)
  }
  if (commandsChecked > 0) {
    console.log(`✓ All ${commandsChecked} commands reviewed within the last ${STALE_DAYS} days.`)
  }
  if (untracked.length === 0) {
    console.log(`✓ All items are tracked in maintenance tables.`)
  }
  if (orphaned.length === 0) {
    console.log(`✓ No orphaned maintenance table rows.`)
  }
  if (existsSync(README_FILE)) {
    console.log(`✓ README.md count claims match disk.`)
  }
}

process.exit(exitCode)
