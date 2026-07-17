#!/usr/bin/env node
// Validates SKILL.md frontmatter for all skills in skills/
// Usage: node --experimental-strip-types scripts/validate-skills.ts
// Exit code: 0 = pass, 1 = validation errors found

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseFrontmatter, findDuplicateFrontmatterKeys, getBodyAfterFrontmatter, getFrontmatterList, stripBom } from './lib/frontmatter.ts'
import { validatePresetClaudeMd, findPresetDirs, checkCompactMd } from './lib/presets.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SKILLS_DIR    = process.env.SKILLS_DIR   ?? join(__dirname, '..', 'skills')
const AGENTS_DIR    = process.env.AGENTS_DIR   ?? join(__dirname, '..', 'agents')
const SETTINGS_FILE = process.env.SETTINGS_FILE ?? join(__dirname, '..', 'settings-template.json')
const COMMANDS_DIR  = process.env.COMMANDS_DIR ?? join(__dirname, '..', 'commands')
const RULES_DIR      = process.env.RULES_DIR   ?? join(__dirname, '..', 'rules')
const GLOBAL_CLAUDE_FILE = process.env.GLOBAL_CLAUDE_FILE ?? join(__dirname, '..', 'global-CLAUDE.md')

const REQUIRED   = ['description', 'allowed-tools']
const RECOMMENDED = ['when_to_use']
// Generic model aliases are the recommended default — they track Anthropic's current
// snapshot for that tier so agent/skill files don't go stale when a new dated model
// ships. `inherit` runs the subagent on the parent conversation's model.
const ALIAS_MODELS = new Set(['opus', 'sonnet', 'haiku', 'fable', 'inherit'])
// Full dated IDs stay valid for deliberate pinning (e.g. reproducibility — see
// CONTRIBUTING.md). Update this set whenever Anthropic releases new model IDs.
// The full list must also be kept in sync with the "Valid model IDs" line in CONTRIBUTING.md.
const VALID_MODELS = new Set([
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
  'claude-fable-5',
])
// A model ID not in VALID_MODELS but matching this shape is treated as a warning,
// not an error, so a newly released Claude model doesn't hard-break CI before
// anyone updates the set above. Anything else (typos, non-Claude IDs) stays an error.
const CLAUDE_MODEL_ID_RE = /^claude-[a-z0-9][a-z0-9.-]*$/

function checkModelId(rel: string, model: string): 'ok' | 'warn' | 'error' {
  if (ALIAS_MODELS.has(model)) return 'ok'
  if (VALID_MODELS.has(model)) return 'ok'
  if (CLAUDE_MODEL_ID_RE.test(model)) {
    console.warn(`  ⚠ ${rel} — unrecognised model id: '${model}' (if this is a newly released model, add it to VALID_MODELS in scripts/validate-skills.ts and to CONTRIBUTING.md)`)
    warnings++
    return 'warn'
  }
  console.error(`  ✗ ${rel} — invalid model id: '${model}' (use a generic alias — opus | sonnet | haiku | fable | inherit — or a full model id, e.g. claude-sonnet-5)`)
  errors++
  return 'error'
}
// Hard rule: agent/skill frontmatter `effort:` is capped at high — xhigh/max are
// session-level /effort overrides for the *user's own* main-loop work, not values
// an agent or skill definition should ship with. No exceptions, no pinning comment
// escape hatch (unlike model IDs) — always fix to `high` and flag it.
const VALID_EFFORTS = new Set(['low', 'medium', 'high'])

function checkEffort(rel: string, effort: string): void {
  if (VALID_EFFORTS.has(effort)) return
  if (effort === 'xhigh' || effort === 'max') {
    console.error(`  ✗ ${rel} — effort: ${effort} is not allowed in agent/skill frontmatter (cap is 'high' — xhigh/max are session-level /effort overrides, not definition defaults)`)
    errors++
    return
  }
  console.error(`  ✗ ${rel} — invalid effort: '${effort}' (use low | medium | high)`)
  errors++
}
const SKILL_BODY_MAX_LINES = 20
// Agents have more room than skills (constraints + core principles + a plan/output
// format), but reference material (templates, tables, command lists) belongs in
// agent_docs/ and gets pulled in only when the task needs it — see the
// "Reference docs (lazy-load when needed)" pattern in agents/architect.md.
const AGENT_BODY_MAX_LINES = 150
// Tool names as they appear in `allowed-tools:` (skills) / `tools:` (agents) — comma-separated,
// not a YAML list. Catches copy/paste typos (e.g. "Wrte") that would otherwise silently
// pass since these fields are free-text as far as the frontmatter parser is concerned.
// Update this set when Claude Code adds or renames tools — the quarterly checklist in
// SKILLS-MAINTENANCE.md carries the sync reminder.
const VALID_TOOLS = new Set(['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'Agent', 'WebFetch', 'WebSearch'])
// Skills that isolate their (long/noisy) run via `context: fork` name the target in
// `agent:` — cross-checked against agents/ the same way agent `skills:` lists are
// cross-checked against skills/ below.
const AGENT_NAMES = existsSync(AGENTS_DIR)
  ? new Set(readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md') && f !== 'ROUTING.md').map(f => f.replace(/\.md$/, '')))
  : new Set<string>()
// A skill bound to an agent via `agent:` runs INSIDE that agent's tool grant — its own
// `allowed-tools` is aspirational unless it's a subset of the agent's `tools:`. Two
// skills (from-scratch, env-audit) independently drifted into requiring Edit/Write
// while bound to a read-only planning/guard agent — textual reachability (checked
// below) doesn't catch this because both were still "mentioned" everywhere they needed
// to be; only a capability check catches a skill that's wired in but unrunnable as written.
const AGENT_TOOLS: Map<string, Set<string>> = new Map()
if (existsSync(AGENTS_DIR)) {
  for (const file of readdirSync(AGENTS_DIR)) {
    if (!file.endsWith('.md') || file === 'ROUTING.md') continue
    const agentFm = parseFrontmatter(readFileSync(join(AGENTS_DIR, file), 'utf8'))
    if (agentFm?.tools) {
      AGENT_TOOLS.set(file.replace(/\.md$/, ''), new Set(agentFm.tools.split(',').map(t => t.trim()).filter(Boolean)))
    }
  }
}

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

function missingRequiredFields(fm: Record<string, string>, fields: readonly string[]): string[] {
  return fields.filter(field => !fm[field] || fm[field].trim() === '')
}

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
  for (const field of missingRequiredFields(fm, REQUIRED)) {
    console.error(`  ✗ ${rel} — missing required field: ${field}`)
    errors++
    ok = false
  }

  for (const field of RECOMMENDED) {
    if (!fm[field] || fm[field].trim() === '') {
      console.warn(`  ⚠ ${rel} — missing recommended field: ${field}`)
      warnings++
    }
  }

  if (fm.model && checkModelId(rel, fm.model) === 'error') {
    ok = false
  }

  if (fm.effort) {
    const before = errors
    checkEffort(rel, fm.effort)
    if (errors > before) ok = false
  }

  if (fm['allowed-tools']) {
    const before = errors
    validateToolList(rel, 'allowed-tools', fm['allowed-tools'])
    if (errors > before) ok = false
  }

  if (fm.agent && !AGENT_NAMES.has(fm.agent)) {
    console.error(`  ✗ ${rel} — 'agent:' references non-existent agent: '${fm.agent}' (must match a file in agents/)`)
    errors++
    ok = false
  } else if (fm.agent && fm['allowed-tools'] && AGENT_TOOLS.has(fm.agent)) {
    const agentTools = AGENT_TOOLS.get(fm.agent)!
    const skillTools = fm['allowed-tools'].split(',').map(t => t.trim()).filter(Boolean)
    const missing = skillTools.filter(t => !agentTools.has(t))
    if (missing.length > 0) {
      console.error(
        `  ✗ ${rel} — requires tool(s) [${missing.join(', ')}] not granted to bound agent '${fm.agent}' ` +
          `(agent tools: ${[...agentTools].join(', ')}) — reduce to a plan-then-handoff pattern or bind a different agent`
      )
      errors++
      ok = false
    }
  }
  if (fm.context && fm.context !== 'fork') {
    console.warn(`  ⚠ ${rel} — unrecognised 'context:' value '${fm.context}' (expected 'fork')`)
    warnings++
  }

  for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
    console.error(`  ✗ ${rel} — duplicate frontmatter key: '${dupeKey}'`)
    errors++
    ok = false
  }

  const body = getBodyAfterFrontmatter(content)
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
// Populated below wherever a skill turns out to be reachable (agent skills:
// ref, ROUTING.md/global-CLAUDE.md/commands mention) — used by the
// reverse-orphan check near the end of this file.
const referencedSkillNames = new Set<string>()

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
    const match = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) continue

    const skillsKeyMatch = match[1].match(/^skills:(.*)$/m)
    if (!skillsKeyMatch) continue

    let refs: string[]
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
        referencedSkillNames.add(skillName)
      }
    }
  }
  console.log(`\n${agentsChecked} agents cross-referenced — ${agentErrors} broken reference(s)`)
}

console.log(`\n${checked} skills checked — ${errors} error(s), ${warnings} warning(s)`)

// Cross-reference: a skill body that says "hand off to `x`" / "hands off to x"
// must name a skill directory that actually exists — otherwise the hand-off
// chain SKILLS-MAINTENANCE.md documents (e.g. db-change → migration-review)
// can silently point at a renamed or removed skill.
const HANDOFF_RE = /hands?\s+off\s+to\s+`?([a-z][a-z0-9-]+)`?/gi
let handoffErrors = 0
let handoffsChecked = 0

function checkHandoffs(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      checkHandoffs(full)
    } else if (entry.name === 'SKILL.md') {
      const content = stripBom(readFileSync(full, 'utf8'))
      const rel = relative(SKILLS_DIR, full).replace(/\\/g, '/')
      for (const m of content.matchAll(HANDOFF_RE)) {
        handoffsChecked++
        const target = m[1]
        if (!validSkills.has(target)) {
          console.error(`  ✗ ${rel} — hands off to non-existent skill: '${target}'`)
          handoffErrors++
          errors++
        }
      }
    }
  }
}

console.log('\nValidating skill hand-off chains...\n')
checkHandoffs(SKILLS_DIR)
console.log(`${handoffsChecked} hand-off reference(s) checked — ${handoffErrors} broken`)

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

// Validate agent frontmatter: required fields, valid model IDs, guard agent permissionMode.
// Enforced by NAME PATTERN (any agents/*-guard.md), not a hardcoded list — a
// hardcoded set (security-guard/db-guard/devops-guard) silently missed
// performance-guard, which is read-only-by-convention (ROUTING.md) and already
// ships permissionMode: plan, but wasn't validated, so a future edit could
// flip it to `default` and still pass `npm run check`. Naming a new agent
// `*-guard` now automatically opts it into this check.
const AGENT_REQUIRED = ['name', 'description', 'tools', 'model']
const isGuardAgent = (agentName: string): boolean => agentName.endsWith('-guard')

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
    for (const field of missingRequiredFields(fm, AGENT_REQUIRED)) {
      console.error(`  ✗ agents/${file} — missing required field: ${field}`)
      agentFmErrors++
      errors++
      agentOk = false
    }
    if (fm.model && checkModelId(`agents/${file}`, fm.model) === 'error') {
      agentFmErrors++
      agentOk = false
    }
    if (fm.effort) {
      const before = errors
      checkEffort(`agents/${file}`, fm.effort)
      if (errors > before) { agentFmErrors += errors - before; agentOk = false }
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
    if (isGuardAgent(agentName) && fm.permissionMode !== 'plan') {
      console.error(`  ✗ agents/${file} — guard agent must have permissionMode: plan (found: '${fm.permissionMode ?? 'missing'}')`)
      agentFmErrors++
      errors++
      agentOk = false
    }
    const agentBodyLines = getBodyAfterFrontmatter(content).split('\n').filter(l => l.trim() !== '').length
    if (agentBodyLines > AGENT_BODY_MAX_LINES) {
      console.error(`  ✗ agents/${file} — body is ${agentBodyLines} non-blank lines (required ≤${AGENT_BODY_MAX_LINES} per AGENTS-MAINTENANCE.md); move reference material into agent_docs/ and link it under "Reference docs (lazy-load when needed)"`)
      agentFmErrors++
      errors++
      agentOk = false
    }
    if (agentOk) console.log(`  ✓ agents/${agentName}`)
  }
  console.log(`\n${agentFmChecked} agents frontmatter validated — ${agentFmErrors} error(s)`)
}

// Validate command frontmatter: description required; argument-hint recommended
// when the body substitutes $ARGUMENTS (it's what the / autocomplete shows users).
if (existsSync(COMMANDS_DIR)) {
  console.log('\nValidating command frontmatter...\n')
  let cmdErrors = 0
  let cmdChecked = 0
  for (const file of readdirSync(COMMANDS_DIR)) {
    if (!file.endsWith('.md')) continue
    const content = readFileSync(join(COMMANDS_DIR, file), 'utf8')
    const fm = parseFrontmatter(content)
    cmdChecked++
    if (!fm) {
      console.error(`  ✗ commands/${file} — missing frontmatter (--- block with description: required)`)
      cmdErrors++
      errors++
      continue
    }
    let cmdOk = true
    for (const field of missingRequiredFields(fm, ['description'])) {
      console.error(`  ✗ commands/${file} — missing required field: ${field}`)
      cmdErrors++
      errors++
      cmdOk = false
    }
    if (content.includes('$ARGUMENTS') && (!fm['argument-hint'] || fm['argument-hint'].trim() === '')) {
      console.warn(`  ⚠ commands/${file} — uses $ARGUMENTS but has no argument-hint`)
      warnings++
    }
    if (!content.includes('$ARGUMENTS') && fm['argument-hint'] && fm['argument-hint'].trim() !== '') {
      console.warn(`  ⚠ commands/${file} — declares argument-hint but the body never substitutes $ARGUMENTS`)
      warnings++
    }
    for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
      console.error(`  ✗ commands/${file} — duplicate frontmatter key: '${dupeKey}'`)
      cmdErrors++
      errors++
      cmdOk = false
    }
    if (cmdOk) console.log(`  ✓ commands/${file.replace(/\.md$/, '')}`)
  }
  console.log(`\n${cmdChecked} commands validated — ${cmdErrors} error(s)`)
}

// Cross-reference: every agent name that global-CLAUDE.md's AGENT ROUTING
// section routes to (via a "signal → agent" arrow) must exist as
// agents/<name>.md — otherwise routing silently points nowhere.
// A missing default global-CLAUDE.md is itself an error (the installer ships it);
// a missing GLOBAL_CLAUDE_FILE override is deliberate test isolation and skips.
if (!existsSync(GLOBAL_CLAUDE_FILE)) {
  if (!process.env.GLOBAL_CLAUDE_FILE) {
    console.error('\n  ✗ global-CLAUDE.md — required kit file is missing (installers copy it as ~/.claude/CLAUDE.md)')
    errors++
  }
} else if (existsSync(AGENTS_DIR)) {
  console.log('\nValidating global-CLAUDE.md routing targets...\n')
  const globalContent = readFileSync(GLOBAL_CLAUDE_FILE, 'utf8')
  const agentFiles = new Set(
    readdirSync(AGENTS_DIR)
      .filter(f => f.endsWith('.md') && f !== 'ROUTING.md')
      .map(f => f.replace(/\.md$/, ''))
  )
  const routedAgents = new Set<string>()
  const lines = globalContent.split(/\r?\n/)
  // The AGENT ROUTING section is prose with "signal → agent" arrows (not a
  // table). Scan every "→ token" inside the section (from the "## AGENT ROUTING"
  // heading up to the next "## " heading or "---" rule). A token is treated as
  // an agent reference when it either matches an existing agents/<name>.md OR
  // has agent-name shape (contains a hyphen, e.g. db-guard). Bare prose words
  // that merely follow an arrow ("→ act", "→ ask ONCE", "→ state assumption")
  // are neither a known file nor hyphenated, so they're ignored. A hyphenated
  // token with no matching file is a dangling routing reference → error.
  // The optional backticks around the token (`` `?...`? ``) matter: the section
  // also legitimately arrows to a *skill* sometimes (e.g. "→ `incident-response`
  // skill"), and without tolerating backticks here the regex simply never
  // matched that line at all — silently skipping it rather than validating it —
  // because a literal backtick sits between the arrow's whitespace and the
  // token's first letter. Matching through the backticks lets a token be
  // classified correctly (known agent / known skill / dangling) instead of
  // going unseen by coincidence of formatting.
  const sectionStart = lines.findIndex(l => /^##\s.*AGENT ROUTING/.test(l))
  let routingTargetErrors = 0
  if (sectionStart !== -1) {
    let sawArrow = false
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i]) || lines[i].trim() === '---') break
      for (const m of lines[i].matchAll(/→\s*`?([a-z][a-z0-9-]*)`?/g)) {
        const token = m[1]
        sawArrow = true
        if (agentFiles.has(token)) {
          routedAgents.add(token)
        } else if (validSkills.has(token)) {
          // Deliberately a skill reference, not an agent — not a dangling target.
        } else if (token.includes('-')) {
          console.error(`  ✗ global-CLAUDE.md routes to non-existent agent: '${token}' (no agents/${token}.md)`)
          routingTargetErrors++
          errors++
        }
        // else: a bare non-agent word after an arrow (prose) — ignore
      }
    }
    // Guard against silent format drift: the section always routes to at least
    // the escalation guards, so extracting zero valid targets means the parser
    // no longer understands the section's shape — the exact failure mode where
    // an earlier table-based parser silently "checked 0 targets" after the
    // section was rewritten as prose.
    if (sawArrow && routedAgents.size === 0) {
      console.error('  ✗ global-CLAUDE.md — AGENT ROUTING section found but no valid routing targets extracted (parser may be stale relative to the section format)')
      errors++
    }
  }
  for (const name of [...routedAgents].sort()) {
    console.log(`  ✓ global-CLAUDE.md → ${name}`)
  }
  console.log(`\n${routedAgents.size} routing targets checked — ${routingTargetErrors} missing agent file(s)`)
}

// settings-template.json must stay parseable (its deny list is a security baseline)
if (existsSync(SETTINGS_FILE)) {
  console.log('\nValidating settings-template.json...\n')
  try {
    JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    console.log('  ✓ settings-template.json parses')
  } catch (e) {
    const err = e as Error
    console.error(`  ✗ settings-template.json — failed to parse: ${err.message}`)
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

// Reverse-orphan skill detection: a skill referenced by no agent's `skills:`
// list, not mentioned in ROUTING.md, global-CLAUDE.md, or any commands/*.md,
// and not explicitly marked manual-only would pass every check above yet be
// unreachable in practice — this exact class ("orphan skill") was found by
// hand in at least two separate past audit rounds (see CHANGELOG.md) before
// there was a permanent check for it.
// Reachability is inherently a whole-repo property (it cross-checks SKILLS_DIR
// against AGENTS_DIR/ROUTING_FILE/GLOBAL_CLAUDE_FILE/COMMANDS_DIR together), so
// unlike the per-file checks above it doesn't make sense to run against a
// SKILLS_DIR swapped out in isolation for a narrow fixture test (every one of
// this suite's single-skill temp fixtures would otherwise be "unreferenced" by
// definition) — it runs against the real skills/ by default, or opts in
// explicitly via ORPHAN_CHECK=1 for the dedicated tests that exercise it.
if (existsSync(SKILLS_DIR) && (!process.env.SKILLS_DIR || process.env.ORPHAN_CHECK === '1')) {
  console.log('\nChecking for orphaned skills (unreferenced anywhere)...\n')
  let orphanSkillCount = 0
  const routingText = existsSync(ROUTING_FILE) ? readFileSync(ROUTING_FILE, 'utf8') : ''
  const globalClaudeText = existsSync(GLOBAL_CLAUDE_FILE) ? readFileSync(GLOBAL_CLAUDE_FILE, 'utf8') : ''
  const commandsText = existsSync(COMMANDS_DIR)
    ? readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md')).map(f => readFileSync(join(COMMANDS_DIR, f), 'utf8')).join('\n')
    : ''

  for (const skillName of [...validSkills].sort()) {
    if (referencedSkillNames.has(skillName)) continue
    const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // `(?!-)` after the word boundary rejects a match where the skill name is
    // just the PREFIX of a longer hyphenated word — round-11 finding: bare
    // `\bfrom-scratch\b` matched inside the unrelated doc filename
    // `from-scratch-guide` (global-CLAUDE.md's lazy-load docs list), so the
    // `from-scratch` skill passed this check for the wrong reason (an
    // accidental substring, not a genuine invocation reference) while
    // remaining absent from every agent's `skills:` list and ROUTING.md.
    // `(?<!-)` before the word boundary closes the symmetric SUFFIX case the
    // round-11 fix left open: `\b` alone also matches at a '-'→word-char
    // transition, so a future skill whose name is the tail of an unrelated
    // hyphenated word (e.g. a skill named `page` inside a mention of
    // `new-page`) would otherwise pass this check the same way `from-scratch`
    // once did.
    const mentionRe = new RegExp(`(?<!-)\\b${escaped}\\b(?!-)`)
    if (mentionRe.test(routingText) || mentionRe.test(globalClaudeText) || mentionRe.test(commandsText)) {
      continue
    }
    const skillFile = join(SKILLS_DIR, skillName, 'SKILL.md')
    if (existsSync(skillFile)) {
      const skillFm = parseFrontmatter(readFileSync(skillFile, 'utf8'))
      if (skillFm && skillFm['disable-model-invocation']?.trim() === 'true') {
        continue // explicitly manual-only (slash-command-driven) — exempt, not an orphan
      }
    }
    console.error(
      `  ✗ ${skillName} — not referenced by any agent's 'skills:' list, ROUTING.md, global-CLAUDE.md, or commands/, ` +
        `and not marked 'disable-model-invocation: true' (add a reference, mark it manual-only, or remove the skill)`
    )
    orphanSkillCount++
    errors++
  }
  if (orphanSkillCount === 0) {
    console.log(`  ✓ No orphaned skills — every skill in skills/ is reachable`)
  }
}

// Validate rules/ frontmatter: the entire lazy-load mechanism hinges on a
// well-formed `paths:` glob list, but until round 9 nothing validated it — a
// `path:` typo (singular), an empty `paths:` block, or a missing `paths:` key
// on a rule that isn't one of the two documented always-loaded files would
// silently make that rule never load and still pass `npm run check`. Every
// other artifact type (skills, agents, commands, presets) already had
// frontmatter validation above; rules/ was the one gap.
const ALWAYS_LOADED_RULE_NAMES = new Set(['000-security', '001-conventions'])

if (existsSync(RULES_DIR)) {
  console.log('\nValidating rules/ frontmatter...\n')
  let ruleFmErrors = 0
  let ruleFmChecked = 0
  for (const file of readdirSync(RULES_DIR)) {
    if (!file.endsWith('.md')) continue
    const ruleName = file.replace(/\.md$/, '')
    const content = readFileSync(join(RULES_DIR, file), 'utf8')
    const fm = parseFrontmatter(content)
    ruleFmChecked++
    if (!fm) {
      console.error(`  ✗ rules/${file} — missing frontmatter (--- block required)`)
      ruleFmErrors++
      errors++
      continue
    }
    let ruleOk = true
    if (!fm.description || fm.description.trim() === '') {
      console.error(`  ✗ rules/${file} — missing required field: description`)
      ruleFmErrors++
      errors++
      ruleOk = false
    }

    const fmBlockMatch = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
    const fmBlockText = fmBlockMatch ? fmBlockMatch[1] : ''
    const hasPathsKey = /^paths:/m.test(fmBlockText)
    const hasPathTypo = /^path:/m.test(fmBlockText)
    const pathsList = getFrontmatterList(content, 'paths')

    if (ALWAYS_LOADED_RULE_NAMES.has(ruleName)) {
      if (hasPathsKey) {
        console.error(`  ✗ rules/${file} — has 'paths:' frontmatter but is documented as always-loaded (no paths: scoping expected); remove 'paths:' or drop it from ALWAYS_LOADED_RULE_NAMES if it's meant to lazy-load now`)
        ruleFmErrors++
        errors++
        ruleOk = false
      }
    } else if (hasPathTypo && !hasPathsKey) {
      console.error(`  ✗ rules/${file} — found 'path:' (singular) instead of 'paths:' — this rule would never lazy-load`)
      ruleFmErrors++
      errors++
      ruleOk = false
    } else if (!hasPathsKey) {
      console.error(`  ✗ rules/${file} — missing 'paths:' frontmatter (required for lazy-loaded rules; only ${[...ALWAYS_LOADED_RULE_NAMES].join(', ')} load unconditionally)`)
      ruleFmErrors++
      errors++
      ruleOk = false
    } else if (!pathsList || pathsList.length === 0) {
      console.error(`  ✗ rules/${file} — 'paths:' is present but has no glob entries (must be a non-empty YAML list of quoted glob strings)`)
      ruleFmErrors++
      errors++
      ruleOk = false
    } else {
      for (const glob of pathsList) {
        if (!glob) {
          console.error(`  ✗ rules/${file} — 'paths:' contains an empty glob entry`)
          ruleFmErrors++
          errors++
          ruleOk = false
          break
        }
      }
    }

    for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
      console.error(`  ✗ rules/${file} — duplicate frontmatter key: '${dupeKey}'`)
      ruleFmErrors++
      errors++
      ruleOk = false
    }

    if (ruleOk) console.log(`  ✓ rules/${ruleName}`)
  }
  console.log(`\n${ruleFmChecked} rules frontmatter validated — ${ruleFmErrors} error(s)`)
}

if (errors > 0) {
  console.error('\nValidation FAILED. Fix the errors above before committing.')
  process.exit(1)
} else {
  console.log('\nValidation PASSED.')
  process.exit(0)
}
