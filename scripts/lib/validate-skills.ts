// Skill-domain validation (frontmatter, agent binding, agent↔skill
// cross-reference, hand-off chains, orphan detection), split out of
// scripts/validate-skills.ts (round-17 audit). Kept as one module because all
// four functions share the same validSkills/referencedSkillNames state, even
// though the CLI orchestrator calls them at different points interleaved with
// agent/routing/command validation (see scripts/validate-skills.ts for why).

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative, dirname } from 'path'
import { parseFrontmatter, findDuplicateFrontmatterKeys, getBodyAfterFrontmatter, stripBom } from './frontmatter.ts'
import { checkModelId, checkEffort, validateToolList, missingRequiredFields, type Counts } from './validate-common.ts'
import { TRIGGER_TEXT_BUDGET_CHARS } from './counts.ts'

const REQUIRED = ['description', 'allowed-tools']
const RECOMMENDED = ['when_to_use']
const SKILL_BODY_MAX_LINES = 20
// description + when_to_use are the skill's TRIGGER text — unlike the body
// (loads only on invocation, capped at 20 lines above), the trigger text for
// every installed skill is injected into every session so the model can decide
// when to invoke. Round-27 audit measured six skills drifted to 375-541
// combined chars against a ~280 median — the same unguarded always-loaded
// growth the 250-line cap on global-CLAUDE.md/000/001 exists to stop. 360
// fits the longest legitimate trigger with headroom; detail beyond that
// belongs in the body, which is free at session time.
//
// The number moved to lib/counts.ts in round 45, when agents and commands turned out to
// pay the same per-session bill with no cap at all and the aggregate had no cap either.
// One value, three validators, one aggregate check — a second copy here is how the caps
// would eventually disagree about what "the trigger budget" is.
const SKILL_TRIGGER_BUDGET_CHARS = TRIGGER_TEXT_BUDGET_CHARS

export interface SkillWalkResult extends Counts {
  checked: number
  validSkills: Set<string>
}

// Matches a skill name used as a standalone word. The hyphen guards on both
// sides are what stop `from-scratch` matching inside `from-scratch-guide` and a
// hypothetical `page` skill matching inside `new-page` — see the long comment in
// checkOrphanSkills() for the two rounds that produced them. Exported and shared
// so the orphan check and the manual-only check below can never disagree about
// what counts as a mention.
export function skillMentionRe(skillName: string, flags = ''): RegExp {
  const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<!-)\\b${escaped}\\b(?!-)`, flags)
}

// Returns the skills whose frontmatter sets `disable-model-invocation: true` —
// the ones Claude Code will never auto-trigger, whatever the request looks like.
export function findManualOnlySkills(skillsDir: string, validSkills: Set<string>): Set<string> {
  const manual = new Set<string>()
  if (!existsSync(skillsDir)) return manual
  for (const skillName of validSkills) {
    const skillFile = join(skillsDir, skillName, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    const fm = parseFrontmatter(readFileSync(skillFile, 'utf8'))
    if (fm && fm['disable-model-invocation']?.trim() === 'true') manual.add(skillName)
  }
  return manual
}

export interface ManualOnlyCheckOptions {
  docFiles: string[]
  repoRoot: string
  skillsDirIsOverridden: boolean
  forced: boolean
}

// A skill marked `disable-model-invocation: true` cannot be reached by routing —
// only by the user typing its slash command. Round-32 audit found ROUTING.md
// listing `deep-research` as the destination for "research / fact-check /
// comparison" requests and binding `env-audit` to devops-guard as a followable
// procedure: both promises the model is structurally unable to keep, and nothing
// caught them because checkOrphanSkills() only tests the opposite direction (an
// unreferenced skill must BE manual-only). The rule enforced here is the missing
// direction, derived from frontmatter rather than a hand-kept list: wherever a
// manual-only skill is named in user-facing routing docs, the same line must
// carry its `/slash` form, so the sentence reads as "type this" and can never
// silently drift back into "routing will pick this".
export function checkManualOnlySkillMentions(
  skillsDir: string,
  validSkills: Set<string>,
  opts: ManualOnlyCheckOptions
): Counts {
  const result: Counts = { errors: 0, warnings: 0 }
  if (!existsSync(skillsDir) || (opts.skillsDirIsOverridden && !opts.forced)) return result

  const manualOnly = findManualOnlySkills(skillsDir, validSkills)
  console.log('\nChecking manual-only skills are never presented as routing destinations...\n')
  if (manualOnly.size === 0) {
    console.log('  ✓ No skills are marked disable-model-invocation: true')
    return result
  }

  for (const file of opts.docFiles) {
    if (!existsSync(file)) continue
    const rel = relative(opts.repoRoot, file).replace(/\\/g, '/')
    const lines = stripBom(readFileSync(file, 'utf8')).split(/\r?\n/)
    lines.forEach((line, i) => {
      for (const skillName of manualOnly) {
        if (!skillMentionRe(skillName).test(line)) continue
        // The slash form on the same line is the marker that this is an
        // instruction to the reader, not a routing destination.
        if (skillMentionRe(`/${skillName}`).test(line) || line.includes(`/${skillName}`)) continue
        console.error(
          `  ✗ ${rel}:${i + 1} — '${skillName}' is manual-only (disable-model-invocation: true) but is named ` +
            `without its /${skillName} slash form, which reads as an automatic routing destination the model can never reach`
        )
        result.errors++
      }
    })
  }
  if (result.errors === 0) {
    console.log(`  ✓ ${manualOnly.size} manual-only skill(s) are named in slash form everywhere they appear`)
  }
  return result
}

function validateSkill(
  filePath: string,
  skillsDir: string,
  agentNames: Set<string>,
  agentTools: Map<string, Set<string>>,
  result: SkillWalkResult
): void {
  const content = readFileSync(filePath, 'utf8')
  const fm = parseFrontmatter(content)
  const rel = relative(skillsDir, filePath).replace(/\\/g, '/')

  if (!fm) {
    console.error(`  ✗ ${rel} — missing frontmatter (--- block required)`)
    result.errors++
    return
  }

  let ok = true
  for (const field of missingRequiredFields(fm, REQUIRED)) {
    console.error(`  ✗ ${rel} — missing required field: ${field}`)
    result.errors++
    ok = false
  }

  for (const field of RECOMMENDED) {
    if (!fm[field] || fm[field].trim() === '') {
      console.warn(`  ⚠ ${rel} — missing recommended field: ${field}`)
      result.warnings++
    }
  }

  if (fm.model && checkModelId(rel, fm.model, result) === 'error') {
    ok = false
  }

  if (fm.effort) {
    const before = result.errors
    checkEffort(rel, fm.effort, result)
    if (result.errors > before) ok = false
  }

  if (fm['allowed-tools']) {
    const before = result.errors
    validateToolList(rel, 'allowed-tools', fm['allowed-tools'], result)
    if (result.errors > before) ok = false
  }

  if (fm.agent && !agentNames.has(fm.agent)) {
    console.error(`  ✗ ${rel} — 'agent:' references non-existent agent: '${fm.agent}' (must match a file in agents/)`)
    result.errors++
    ok = false
  } else if (fm.agent && fm['allowed-tools'] && agentTools.has(fm.agent)) {
    const boundTools = agentTools.get(fm.agent)!
    const skillTools = fm['allowed-tools'].split(',').map(t => t.trim()).filter(Boolean)
    const missing = skillTools.filter(t => !boundTools.has(t))
    if (missing.length > 0) {
      console.error(
        `  ✗ ${rel} — requires tool(s) [${missing.join(', ')}] not granted to bound agent '${fm.agent}' ` +
          `(agent tools: ${[...boundTools].join(', ')}) — reduce to a plan-then-handoff pattern or bind a different agent`
      )
      result.errors++
      ok = false
    }
  }
  if (fm.context && fm.context !== 'fork') {
    console.warn(`  ⚠ ${rel} — unrecognised 'context:' value '${fm.context}' (expected 'fork')`)
    result.warnings++
  }

  for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
    console.error(`  ✗ ${rel} — duplicate frontmatter key: '${dupeKey}'`)
    result.errors++
    ok = false
  }

  const triggerChars = (fm.description?.length ?? 0) + (fm.when_to_use?.length ?? 0)
  if (triggerChars > SKILL_TRIGGER_BUDGET_CHARS) {
    console.error(
      `  ✗ ${rel} — description + when_to_use is ${triggerChars} chars (required ≤${SKILL_TRIGGER_BUDGET_CHARS}); trigger text loads into every session — move detail into the skill body`
    )
    result.errors++
    ok = false
  }

  const body = getBodyAfterFrontmatter(content)
  const bodyLines = body.split('\n').filter(l => l.trim() !== '').length
  if (bodyLines > SKILL_BODY_MAX_LINES) {
    console.error(`  ✗ ${rel} — body is ${bodyLines} non-blank lines (required ≤${SKILL_BODY_MAX_LINES}); split detail into agent_docs/`)
    result.errors++
    ok = false
  }

  if (ok) {
    const skillName = dirname(rel)
    console.log(`  ✓ ${skillName}`)
  }

  result.checked++
}

function walk(
  dir: string,
  skillsDir: string,
  agentNames: Set<string>,
  agentTools: Map<string, Set<string>>,
  result: SkillWalkResult
): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, skillsDir, agentNames, agentTools, result)
    } else if (entry.name === 'SKILL.md') {
      validateSkill(full, skillsDir, agentNames, agentTools, result)
    }
  }
}

// Computes validSkills (skill-directory names) and validates every SKILL.md's
// frontmatter. Does NOT print the final "N skills checked" summary — the
// orchestrator prints that after also running crossReferenceAgentSkills, to
// match the original script's error/warning totals (which include both).
export function walkAndValidateSkills(
  skillsDir: string,
  agentNames: Set<string>,
  agentTools: Map<string, Set<string>>
): SkillWalkResult {
  const validSkills = new Set(
    readdirSync(skillsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
  )
  const result: SkillWalkResult = { errors: 0, warnings: 0, checked: 0, validSkills }
  console.log('\nValidating skills...\n')
  walk(skillsDir, skillsDir, agentNames, agentTools, result)
  return result
}

export interface AgentSkillCrossRefResult {
  errors: number
  agentsChecked: number
  referencedSkillNames: Set<string>
}

// Cross-reference: verify agent skill references point to existing skill directories
// Also re-runs the tool-capability check from validateSkill (which only checks a
// skill's single `agent:` binding) against EVERY agent that lists the skill in its
// own `skills:` frontmatter — a skill can be shared by several agents, and one with
// a narrower tool grant than the skill's `allowed-tools` would otherwise pass
// `npm run check` while being unrunnable under that agent (round-25 finding).
export function crossReferenceAgentSkills(
  agentsDir: string,
  validSkills: Set<string>,
  skillsDir: string,
  agentTools: Map<string, Set<string>>
): AgentSkillCrossRefResult {
  const result: AgentSkillCrossRefResult = { errors: 0, agentsChecked: 0, referencedSkillNames: new Set() }
  if (!existsSync(agentsDir)) return result

  console.log('\nCross-referencing agent skill references...\n')
  let agentErrors = 0
  const skillToolsCache = new Map<string, string[]>()
  function getSkillTools(skillName: string): string[] {
    if (skillToolsCache.has(skillName)) return skillToolsCache.get(skillName)!
    const skillFile = join(skillsDir, skillName, 'SKILL.md')
    let tools: string[] = []
    if (existsSync(skillFile)) {
      const fm = parseFrontmatter(readFileSync(skillFile, 'utf8'))
      if (fm && fm['allowed-tools']) {
        tools = fm['allowed-tools'].split(',').map(t => t.trim()).filter(Boolean)
      }
    }
    skillToolsCache.set(skillName, tools)
    return tools
  }
  for (const file of readdirSync(agentsDir)) {
    if (!file.endsWith('.md')) continue
    const content = readFileSync(join(agentsDir, file), 'utf8')
    const match = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) continue

    const skillsKeyMatch = match[1].match(/^skills:(.*)$/m)
    if (!skillsKeyMatch) continue

    let refs: string[]
    const blockMatch = match[1].match(/^skills:\r?\n(( {0,}-\s+\S+\r?\n?)+)/m)
    if (blockMatch) {
      // Quote-strip mirrors the flow-list branch below and getFrontmatterList —
      // rules/ frontmatter conventionally quotes list items, so `- "bug-fix"`
      // must resolve the same as `- bug-fix` (round-29 fix).
      refs = (blockMatch[1].match(/^\s*-\s+(\S+)/gm) || []).map(r =>
        r.replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, '')
      )
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
        result.errors++
        continue
      } else {
        continue // skills: with no value — nothing to validate
      }
    }

    result.agentsChecked++
    for (const skillName of refs) {
      if (!validSkills.has(skillName)) {
        console.error(`  ✗ agents/${file} — references non-existent skill: '${skillName}'`)
        agentErrors++
        result.errors++
      } else {
        console.log(`  ✓ agents/${file} → ${skillName}`)
        result.referencedSkillNames.add(skillName)

        const agentName = file.replace(/\.md$/, '')
        const boundTools = agentTools.get(agentName)
        const skillTools = getSkillTools(skillName)
        if (boundTools && skillTools.length > 0) {
          const missing = skillTools.filter(t => !boundTools.has(t))
          if (missing.length > 0) {
            console.error(
              `  ✗ agents/${file} — lists skill '${skillName}' which requires tool(s) [${missing.join(', ')}] ` +
                `not granted to this agent (agent tools: ${[...boundTools].join(', ')})`
            )
            agentErrors++
            result.errors++
          }
        }
      }
    }
  }
  console.log(`\n${result.agentsChecked} agents cross-referenced — ${agentErrors} broken reference(s)`)
  return result
}

export interface HandoffCheckResult {
  errors: number
  handoffsChecked: number
}

// Cross-reference: a skill body that says "hand off to `x`" / "hands off to x"
// / "hand-off to x" / "handoff to x" must name a skill directory that actually
// exists — otherwise a documented hand-off chain (e.g. db-change →
// migration-review) can silently point at a renamed or removed skill.
// `[\s-]*` covers the spaced, hyphenated, and glued spellings (round-28 fix:
// the hyphenated form this check's own name uses was invisible to it), and
// `hands?` covers the third-person "hands off to" (round-29 fix: the optional
// `s` sat on `off`, so the exact spelling this module's own error message uses
// was invisible to it).
const HANDOFF_RE = /hands?[\s-]*offs?\s+to\s+`?([a-z][a-z0-9-]+)`?/gi

export function checkSkillHandoffs(skillsDir: string, validSkills: Set<string>): HandoffCheckResult {
  const result: HandoffCheckResult = { errors: 0, handoffsChecked: 0 }
  let handoffErrors = 0

  function walkHandoffs(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walkHandoffs(full)
      } else if (entry.name === 'SKILL.md') {
        const content = stripBom(readFileSync(full, 'utf8'))
        const rel = relative(skillsDir, full).replace(/\\/g, '/')
        for (const m of content.matchAll(HANDOFF_RE)) {
          result.handoffsChecked++
          const target = m[1]
          if (!validSkills.has(target)) {
            console.error(`  ✗ ${rel} — hands off to non-existent skill: '${target}'`)
            handoffErrors++
            result.errors++
          }
        }
      }
    }
  }

  console.log('\nValidating skill hand-off chains...\n')
  walkHandoffs(skillsDir)
  console.log(`${result.handoffsChecked} hand-off reference(s) checked — ${handoffErrors} broken`)
  return result
}

export interface OrphanCheckOptions {
  routingFile: string
  globalClaudeFile: string
  commandsDir: string
  skillsDirIsOverridden: boolean
  orphanCheckForced: boolean
}

export interface OrphanCheckResult {
  errors: number
  orphanSkillCount: number
}

// Reachability is inherently a whole-repo property (it cross-checks
// skillsDir against agentsDir/routingFile/globalClaudeFile/commandsDir
// together), so unlike the per-file checks above it doesn't make sense to run
// against a skillsDir swapped out in isolation for a narrow fixture test
// (every single-skill temp fixture would otherwise be "unreferenced" by
// definition) — it runs against the real skills/ by default, or opts in
// explicitly via ORPHAN_CHECK=1 for the dedicated tests that exercise it.
export function checkOrphanSkills(
  skillsDir: string,
  validSkills: Set<string>,
  referencedSkillNames: Set<string>,
  opts: OrphanCheckOptions
): OrphanCheckResult {
  const result: OrphanCheckResult = { errors: 0, orphanSkillCount: 0 }
  if (!existsSync(skillsDir) || (opts.skillsDirIsOverridden && !opts.orphanCheckForced)) return result

  console.log('\nChecking for orphaned skills (unreferenced anywhere)...\n')
  const routingText = existsSync(opts.routingFile) ? readFileSync(opts.routingFile, 'utf8') : ''
  const globalClaudeText = existsSync(opts.globalClaudeFile) ? readFileSync(opts.globalClaudeFile, 'utf8') : ''
  const commandsText = existsSync(opts.commandsDir)
    ? readdirSync(opts.commandsDir).filter(f => f.endsWith('.md')).map(f => readFileSync(join(opts.commandsDir, f), 'utf8')).join('\n')
    : ''

  for (const skillName of [...validSkills].sort()) {
    if (referencedSkillNames.has(skillName)) continue
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
    const mentionRe = skillMentionRe(skillName)
    if (mentionRe.test(routingText) || mentionRe.test(globalClaudeText) || mentionRe.test(commandsText)) {
      continue
    }
    const skillFile = join(skillsDir, skillName, 'SKILL.md')
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
    result.orphanSkillCount++
    result.errors++
  }
  if (result.orphanSkillCount === 0) {
    console.log(`  ✓ No orphaned skills — every skill in skills/ is reachable`)
  }
  return result
}
