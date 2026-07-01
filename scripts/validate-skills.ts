#!/usr/bin/env node
// Validates SKILL.md frontmatter for all skills in skills/
// Usage: node --experimental-strip-types scripts/validate-skills.ts
// Exit code: 0 = pass, 1 = validation errors found

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseFrontmatter, findDuplicateFrontmatterKeys } from './lib/frontmatter.ts'
import { validatePresetClaudeMd, findPresetDirs, checkCompactMd } from './lib/presets.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SKILLS_DIR    = process.env.SKILLS_DIR   ?? join(__dirname, '..', 'skills')
const AGENTS_DIR    = process.env.AGENTS_DIR   ?? join(__dirname, '..', 'agents')
const SETTINGS_FILE = process.env.SETTINGS_FILE ?? join(__dirname, '..', 'settings.json')

const REQUIRED   = ['description', 'allowed-tools']
const RECOMMENDED = ['when_to_use']
// Update this set whenever Anthropic releases new model IDs.
// The full list must also be kept in sync with the "Valid model IDs" line in CONTRIBUTING.md.
const VALID_MODELS = new Set([
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
  'claude-fable-5',
])
const SKILL_BODY_MAX_LINES = 20
// Tool names as they appear in `allowed-tools:` (skills) / `tools:` (agents) — comma-separated,
// not a YAML list. Catches copy/paste typos (e.g. "Wrte") that would otherwise silently
// pass since these fields are free-text as far as the frontmatter parser is concerned.
const VALID_TOOLS = new Set(['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'Agent', 'WebFetch', 'WebSearch'])

function validateToolList(rel: string, source: string, value: string): void {
  for (const tool of value.split(',').map(t => t.trim()).filter(Boolean)) {
    if (!VALID_TOOLS.has(tool)) {
      console.error(`  ✗ ${rel} — unknown tool '${tool}' in ${source} (valid: ${[...VALID_TOOLS].join(', ')})`)
      errors++
    }
  }
}

let errors = 0
let warnings = 0
let checked = 0

function validateSkill(filePath: string): void {
  const content = readFileSync(filePath, 'utf8')
  const fm = parseFrontmatter(content)
  const rel = relative(SKILLS_DIR, filePath).replace(/\\/g, '/')

  if (!fm) {
    console.error(`  ✗ ${rel} — missing frontmatter (--- block required)`)
    errors++
    return
  }

  let ok = true
  for (const field of REQUIRED) {
    if (!fm[field] || fm[field].trim() === '') {
      console.error(`  ✗ ${rel} — missing required field: ${field}`)
      errors++
      ok = false
    }
  }

  for (const field of RECOMMENDED) {
    if (!fm[field] || fm[field].trim() === '') {
      console.warn(`  ⚠ ${rel} — missing recommended field: ${field}`)
      warnings++
    }
  }

  if (fm.model && !VALID_MODELS.has(fm.model)) {
    console.error(`  ✗ ${rel} — invalid model id: '${fm.model}' (use full model id, e.g. claude-sonnet-5)`)
    errors++
    ok = false
  }

  if (fm['allowed-tools']) {
    const before = errors
    validateToolList(rel, 'allowed-tools', fm['allowed-tools'])
    if (errors > before) ok = false
  }

  for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
    console.error(`  ✗ ${rel} — duplicate frontmatter key: '${dupeKey}'`)
    errors++
    ok = false
  }

  const frontmatterEnd = content.indexOf('\n---', content.indexOf('---') + 3)
  const body = frontmatterEnd !== -1 ? content.slice(frontmatterEnd + 4) : ''
  const bodyLines = body.split('\n').filter(l => l.trim() !== '').length
  if (bodyLines > SKILL_BODY_MAX_LINES) {
    console.error(`  ✗ ${rel} — body is ${bodyLines} non-blank lines (required ≤${SKILL_BODY_MAX_LINES} per CONTRIBUTING.md); split detail into agent_docs/`)
    errors++
    ok = false
  }

  if (ok) {
    const skillName = dirname(rel)
    console.log(`  ✓ ${skillName}`)
  }

  checked++
}

function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (entry.name === 'SKILL.md') {
      validateSkill(full)
    }
  }
}

// Collect all valid skill names from skill directories
const validSkills = new Set(
  readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
)

console.log('\nValidating skills...\n')
walk(SKILLS_DIR)

// Cross-reference: verify agent skill references point to existing skill directories
let agentErrors = 0
let agentsChecked = 0

if (existsSync(AGENTS_DIR)) {
  console.log('\nCross-referencing agent skill references...\n')
  for (const file of readdirSync(AGENTS_DIR)) {
    if (!file.endsWith('.md')) continue
    const content = readFileSync(join(AGENTS_DIR, file), 'utf8')
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) continue

    const skillsKeyMatch = match[1].match(/^skills:(.*)$/m)
    if (!skillsKeyMatch) continue

    let refs: string[] = []
    const blockMatch = match[1].match(/^skills:\r?\n((?:\s{2,}-\s+\S+\r?\n?)+)/m)
    if (blockMatch) {
      refs = (blockMatch[1].match(/^\s+-\s+(\S+)/gm) || []).map(r => r.replace(/^\s+-\s+/, '').trim())
    } else {
      const flowMatch = skillsKeyMatch[1].match(/\[([^\]]*)\]/)
      if (flowMatch) {
        refs = flowMatch[1]
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(s => s.length > 0)
      } else if (skillsKeyMatch[1].trim() !== '') {
        console.error(`  ✗ agents/${file} — unparseable 'skills:' field (use block list or [a, b] flow list)`)
        agentErrors++
        errors++
        continue
      } else {
        continue // skills: with no value — nothing to validate
      }
    }

    agentsChecked++
    for (const skillName of refs) {
      if (!validSkills.has(skillName)) {
        console.error(`  ✗ agents/${file} — references non-existent skill: '${skillName}'`)
        agentErrors++
        errors++
      } else {
        console.log(`  ✓ agents/${file} → ${skillName}`)
      }
    }
  }
  console.log(`\n${agentsChecked} agents cross-referenced — ${agentErrors} broken reference(s)`)
}

console.log(`\n${checked} skills checked — ${errors} error(s), ${warnings} warning(s)`)

// Cross-reference: verify every agent in agents/ is mentioned in ROUTING.md
const ROUTING_FILE = join(AGENTS_DIR, 'ROUTING.md')
if (existsSync(ROUTING_FILE)) {
  console.log('\nValidating ROUTING.md agent coverage...\n')
  const routingContent = readFileSync(ROUTING_FILE, 'utf8')
  const allAgents = readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'ROUTING.md')
    .map(f => f.replace(/\.md$/, ''))
  let routingErrors = 0
  for (const agentName of allAgents) {
    if (routingContent.includes(agentName)) {
      console.log(`  ✓ ${agentName} — found in ROUTING.md`)
    } else {
      console.error(`  ✗ ${agentName} — NOT mentioned in ROUTING.md (add routing rule)`)
      routingErrors++
      errors++
    }
  }
  console.log(`\n${allAgents.length} agents checked against ROUTING.md — ${routingErrors} missing`)
}

// Validate agent frontmatter: required fields, valid model IDs, guard agent permissionMode
const AGENT_REQUIRED = ['name', 'description', 'tools', 'model']
const GUARD_AGENTS = new Set(['security-guard', 'db-guard', 'migration-guard', 'devops-guard'])

if (existsSync(AGENTS_DIR)) {
  console.log('\nValidating agent frontmatter...\n')
  let agentFmErrors = 0
  let agentFmChecked = 0
  for (const file of readdirSync(AGENTS_DIR)) {
    if (!file.endsWith('.md') || file === 'ROUTING.md') continue
    const agentName = file.replace(/\.md$/, '')
    const content = readFileSync(join(AGENTS_DIR, file), 'utf8')
    const fm = parseFrontmatter(content)
    agentFmChecked++
    if (!fm) {
      console.error(`  ✗ agents/${file} — missing frontmatter (--- block required)`)
      agentFmErrors++
      errors++
      continue
    }
    let agentOk = true
    for (const field of AGENT_REQUIRED) {
      if (!fm[field] || fm[field].trim() === '') {
        console.error(`  ✗ agents/${file} — missing required field: ${field}`)
        agentFmErrors++
        errors++
        agentOk = false
      }
    }
    if (fm.model && !VALID_MODELS.has(fm.model)) {
      console.error(`  ✗ agents/${file} — invalid model id: '${fm.model}'`)
      agentFmErrors++
      errors++
      agentOk = false
    }
    if (fm.tools) {
      const before = errors
      validateToolList(`agents/${file}`, 'tools', fm.tools)
      if (errors > before) { agentFmErrors += errors - before; agentOk = false }
    }
    for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
      console.error(`  ✗ agents/${file} — duplicate frontmatter key: '${dupeKey}'`)
      agentFmErrors++
      errors++
      agentOk = false
    }
    if (GUARD_AGENTS.has(agentName) && fm.permissionMode !== 'plan') {
      console.error(`  ✗ agents/${file} — guard agent must have permissionMode: plan (found: '${fm.permissionMode ?? 'missing'}')`)
      agentFmErrors++
      errors++
      agentOk = false
    }
    if (agentOk) console.log(`  ✓ agents/${agentName}`)
  }
  console.log(`\n${agentFmChecked} agents frontmatter validated — ${agentFmErrors} error(s)`)
}

// Cross-reference: verify settings.json skillOverrides point to existing skills
if (existsSync(SETTINGS_FILE)) {
  console.log('\nValidating settings.json skillOverrides...\n')
  let settingsErrors = 0
  let settingsChecked = 0
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    const overrides: Record<string, unknown> = settings.skillOverrides ?? {}
    for (const skillName of Object.keys(overrides)) {
      settingsChecked++
      if (!validSkills.has(skillName)) {
        console.error(`  ✗ settings.json skillOverrides — references non-existent skill: '${skillName}'`)
        settingsErrors++
        errors++
      } else {
        console.log(`  ✓ settings.json → ${skillName}`)
      }
    }
    console.log(`\n${settingsChecked} skillOverrides checked — ${settingsErrors} broken reference(s)`)
  } catch (e) {
    const err = e as Error
    console.error(`  ✗ settings.json — failed to parse: ${err.message}`)
    errors++
  }
}

// Validate presets: every leaf preset dir must contain CLAUDE.md with non-trivial content
const PRESETS_DIR = join(__dirname, '..', 'presets')
let presetErrors = 0
let presetsChecked = 0

if (existsSync(PRESETS_DIR)) {
  console.log('\nValidating presets...\n')
  const presetDirs = findPresetDirs(PRESETS_DIR)
  for (const { claudePath, relPath } of presetDirs) {
    const result = validatePresetClaudeMd(claudePath, relPath)
    if (result.ok) {
      const compact = checkCompactMd(claudePath, relPath)
      if (!compact.ok) {
        console.warn(`  ⚠ presets/${compact.rel} — ${compact.reason}`)
        warnings++
      } else {
        console.log(`  ✓ presets/${result.rel}`)
      }
    } else {
      console.error(`  ✗ presets/${result.rel}/CLAUDE.md — ${result.reason}`)
      presetErrors++
      errors++
    }
    presetsChecked++
  }
  console.log(`\n${presetsChecked} presets checked — ${presetErrors} error(s)`)
}

if (errors > 0) {
  console.error('\nValidation FAILED. Fix the errors above before committing.')
  process.exit(1)
} else {
  console.log('\nValidation PASSED.')
  process.exit(0)
}
