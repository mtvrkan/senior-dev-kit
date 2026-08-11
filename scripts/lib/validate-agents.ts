// Agent-domain validation, split out of scripts/validate-skills.ts (round-17
// audit). Two lightweight extractors (getAgentNames/getAgentToolsMap) are
// consumed by scripts/lib/validate-skills.ts for `agent:` binding checks —
// agents are validated before skills in the orchestrator so those are ready
// when skill validation needs them.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { parseFrontmatter, findDuplicateFrontmatterKeys, getBodyAfterFrontmatter } from './frontmatter.ts'
import { checkModelId, checkEffort, validateToolList, missingRequiredFields, type Counts } from './validate-common.ts'

export function getAgentNames(agentsDir: string): Set<string> {
  if (!existsSync(agentsDir)) return new Set()
  return new Set(
    readdirSync(agentsDir)
      .filter(f => f.endsWith('.md') && f !== 'ROUTING.md' && f !== 'README.md')
      .map(f => f.replace(/\.md$/, ''))
  )
}

// A skill bound to an agent via `agent:` runs INSIDE that agent's tool grant — its own
// `allowed-tools` is aspirational unless it's a subset of the agent's `tools:`. Two
// skills (from-scratch, env-audit) independently drifted into requiring Edit/Write
// while bound to a read-only planning/guard agent — textual reachability doesn't catch
// this because both were still "mentioned" everywhere they needed to be; only a
// capability check catches a skill that's wired in but unrunnable as written.
export function getAgentToolsMap(agentsDir: string): Map<string, Set<string>> {
  const agentTools = new Map<string, Set<string>>()
  if (!existsSync(agentsDir)) return agentTools
  for (const file of readdirSync(agentsDir)) {
    if (!file.endsWith('.md') || file === 'ROUTING.md' || file === 'README.md') continue
    const agentFm = parseFrontmatter(readFileSync(join(agentsDir, file), 'utf8'))
    if (agentFm?.tools) {
      agentTools.set(file.replace(/\.md$/, ''), new Set(agentFm.tools.split(',').map(t => t.trim()).filter(Boolean)))
    }
  }
  return agentTools
}

const AGENT_REQUIRED = ['name', 'description', 'tools', 'model']
// Enforced by NAME PATTERN (any agents/*-guard.md), not a hardcoded list — a
// hardcoded set (security-guard/db-guard/devops-guard) silently missed
// performance-guard, which is read-only-by-convention (ROUTING.md) and already
// ships permissionMode: plan, but wasn't validated, so a future edit could
// flip it to `default` and still pass `npm run check`. Naming a new agent
// `*-guard` now automatically opts it into this check.
const isGuardAgent = (agentName: string): boolean => agentName.endsWith('-guard')
// Agents have more room than skills (constraints + core principles + a plan/output
// format), but reference material (templates, tables, command lists) belongs in
// agent_docs/ and gets pulled in only when the task needs it — see the
// "Reference docs (lazy-load when needed)" pattern in agents/performance-guard.md.
const AGENT_BODY_MAX_LINES = 150

export interface AgentValidationResult extends Counts {
  checked: number
}

export function validateAgentFrontmatter(agentsDir: string): AgentValidationResult {
  const result: AgentValidationResult = { errors: 0, warnings: 0, checked: 0 }
  if (!existsSync(agentsDir)) return result

  console.log('\nValidating agent frontmatter...\n')
  for (const file of readdirSync(agentsDir)) {
    if (!file.endsWith('.md') || file === 'ROUTING.md' || file === 'README.md') continue
    const agentName = file.replace(/\.md$/, '')
    const content = readFileSync(join(agentsDir, file), 'utf8')
    const fm = parseFrontmatter(content)
    result.checked++
    if (!fm) {
      console.error(`  ✗ agents/${file} — missing frontmatter (--- block required)`)
      result.errors++
      continue
    }
    let agentOk = true
    for (const field of missingRequiredFields(fm, AGENT_REQUIRED)) {
      console.error(`  ✗ agents/${file} — missing required field: ${field}`)
      result.errors++
      agentOk = false
    }
    if (fm.model && checkModelId(`agents/${file}`, fm.model, result) === 'error') {
      agentOk = false
    }
    if (fm.effort) {
      const before = result.errors
      checkEffort(`agents/${file}`, fm.effort, result)
      if (result.errors > before) agentOk = false
    }
    if (fm.tools) {
      const before = result.errors
      validateToolList(`agents/${file}`, 'tools', fm.tools, result)
      if (result.errors > before) agentOk = false
    }
    for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
      console.error(`  ✗ agents/${file} — duplicate frontmatter key: '${dupeKey}'`)
      result.errors++
      agentOk = false
    }
    if (isGuardAgent(agentName) && fm.permissionMode !== 'plan') {
      console.error(`  ✗ agents/${file} — guard agent must have permissionMode: plan (found: '${fm.permissionMode ?? 'missing'}')`)
      result.errors++
      agentOk = false
    }
    const agentBodyLines = getBodyAfterFrontmatter(content).split('\n').filter(l => l.trim() !== '').length
    if (agentBodyLines > AGENT_BODY_MAX_LINES) {
      console.error(`  ✗ agents/${file} — body is ${agentBodyLines} non-blank lines (required ≤${AGENT_BODY_MAX_LINES}); move reference material into agent_docs/ and link it under "Reference docs (lazy-load when needed)"`)
      result.errors++
      agentOk = false
    }
    if (agentOk) console.log(`  ✓ agents/${agentName}`)
  }
  console.log(`\n${result.checked} agents frontmatter validated — ${result.errors} error(s)`)
  return result
}
