#!/usr/bin/env node
// Thin orchestrator: composes the scripts/lib/validate-*.ts modules in the
// same order this file used to run its own inline checks in (skills → agent
// skill cross-ref → hand-off chains → ROUTING.md coverage → agent frontmatter
// → command frontmatter → global-CLAUDE.md routing → settings-template.json →
// presets → orphan skills → rules frontmatter), then sums every module's
// error/warning count for the final pass/fail. Split round-17 audit: this
// file had grown to 716 lines mixing 9 unrelated validator concerns, 2.4x the
// kit's own >300-line god-file threshold — see scripts/lib/validate-*.ts for
// each domain's actual logic.
// Usage: node --experimental-strip-types scripts/validate-skills.ts
// Exit code: 0 = pass, 1 = validation errors found

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validatePresetClaudeMd, findPresetDirs, checkCompactMd, checkCompactToolDrift } from './lib/presets.ts'
import { getAgentNames, getAgentToolsMap, validateAgentFrontmatter } from './lib/validate-agents.ts'
import { validateCommands } from './lib/validate-commands.ts'
import { validateRoutingCoverage, validateGlobalClaudeRouting, validateRoutingDanglingReferences } from './lib/validate-routing.ts'
import { validateRules } from './lib/validate-rules.ts'
import { validateEscalationTargets } from './lib/validate-escalations.ts'
import {
  walkAndValidateSkills,
  crossReferenceAgentSkills,
  checkSkillHandoffs,
  checkOrphanSkills,
  checkManualOnlySkillMentions,
} from './lib/validate-skills.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const SKILLS_DIR    = process.env.SKILLS_DIR   ?? join(__dirname, '..', 'skills')
const AGENTS_DIR    = process.env.AGENTS_DIR   ?? join(__dirname, '..', 'agents')
const SETTINGS_FILE = process.env.SETTINGS_FILE ?? join(__dirname, '..', 'settings-template.json')
const COMMANDS_DIR  = process.env.COMMANDS_DIR ?? join(__dirname, '..', 'commands')
const RULES_DIR      = process.env.RULES_DIR   ?? join(__dirname, '..', 'rules')
const GLOBAL_CLAUDE_FILE = process.env.GLOBAL_CLAUDE_FILE ?? join(__dirname, '..', 'global-CLAUDE.md')
const ROUTING_FILE = join(AGENTS_DIR, 'ROUTING.md')
const PRESETS_DIR = process.env.PRESETS_DIR ?? join(__dirname, '..', 'presets')
const AGENT_DOCS_DIR = process.env.AGENT_DOCS_DIR ?? join(__dirname, '..', 'agent_docs')

let errors = 0

// Agents are resolved before skills so `agent:` binding validation (does this
// skill's tool list fit inside its bound agent's grant?) has real data.
const agentNames = getAgentNames(AGENTS_DIR)
const agentTools = getAgentToolsMap(AGENTS_DIR)

const skillWalk = walkAndValidateSkills(SKILLS_DIR, agentNames, agentTools)
const crossRef = crossReferenceAgentSkills(AGENTS_DIR, skillWalk.validSkills, SKILLS_DIR, agentTools)
errors += skillWalk.errors + crossRef.errors
console.log(`\n${skillWalk.checked} skills checked — ${skillWalk.errors + crossRef.errors} error(s), ${skillWalk.warnings} warning(s)`)

const handoff = checkSkillHandoffs(SKILLS_DIR, skillWalk.validSkills)
errors += handoff.errors

const routingCoverage = validateRoutingCoverage(AGENTS_DIR, ROUTING_FILE)
errors += routingCoverage.errors

const routingDangling = validateRoutingDanglingReferences(ROUTING_FILE, AGENTS_DIR, skillWalk.validSkills)
errors += routingDangling.errors

// Free-text `ESCALATE TO:` targets in agent bodies, rules, skills, and
// global-CLAUDE.md must resolve to a live agent or skill (round-27 fix —
// performance-guard escalated to the deleted `architect` and nothing caught
// it). rules/ and global-CLAUDE.md reference the real roster, so they're
// skipped when a test fixture overrides SKILLS_DIR/AGENTS_DIR (same isolation
// rule as checkOrphanSkills) unless ESCALATION_CHECK=1 forces them on.
const escalations = validateEscalationTargets(
  [
    { root: AGENTS_DIR, label: 'agents' },
    { root: SKILLS_DIR, label: 'skills' },
    { root: RULES_DIR, label: 'rules', crossDomain: true },
    { root: GLOBAL_CLAUDE_FILE, label: 'global-CLAUDE.md', crossDomain: true },
    // Zero occurrences in these trees today, but the module's contract is "ANY
    // ESCALATE TO: in the scanned roots" — leaving them out reopens the
    // round-27 hole the moment a preset or agent_doc gains an escalation
    // template (round-28 fix).
    { root: AGENT_DOCS_DIR, label: 'agent_docs', crossDomain: true },
    { root: PRESETS_DIR, label: 'presets', crossDomain: true },
    { root: COMMANDS_DIR, label: 'commands', crossDomain: true },
  ],
  agentNames,
  skillWalk.validSkills,
  {
    dirsOverridden: !!process.env.SKILLS_DIR || !!process.env.AGENTS_DIR,
    forced: process.env.ESCALATION_CHECK === '1',
  }
)
errors += escalations.errors

const agentFm = validateAgentFrontmatter(AGENTS_DIR)
errors += agentFm.errors

const cmdResult = validateCommands(COMMANDS_DIR)
errors += cmdResult.errors

const globalRouting = validateGlobalClaudeRouting(GLOBAL_CLAUDE_FILE, AGENTS_DIR, skillWalk.validSkills)
errors += globalRouting.errors

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
if (existsSync(PRESETS_DIR)) {
  console.log('\nValidating presets...\n')
  let presetErrors = 0
  let presetsChecked = 0
  const presetDirs = findPresetDirs(PRESETS_DIR)
  for (const { claudePath, relPath } of presetDirs) {
    const result = validatePresetClaudeMd(claudePath, relPath)
    if (result.ok) {
      const compact = checkCompactMd(claudePath, relPath)
      if (!compact.ok) {
        // A missing/over-budget compact.md fails the gate — round-31 found this was
        // warn-only, contradicting both CLAUDE.md's "enforced" claim and the unit
        // tests' "fails when compact.md is absent" semantics.
        console.error(`  ✗ presets/${compact.rel} — ${compact.reason}`)
        presetErrors++
        errors++
      } else {
        const drift = checkCompactToolDrift(claudePath, relPath)
        if (!drift.ok) {
          console.error(`  ✗ presets/${drift.rel} — ${drift.reason}`)
          presetErrors++
          errors++
        } else {
          console.log(`  ✓ presets/${result.rel}`)
        }
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

const orphan = checkOrphanSkills(SKILLS_DIR, skillWalk.validSkills, crossRef.referencedSkillNames, {
  routingFile: ROUTING_FILE,
  globalClaudeFile: GLOBAL_CLAUDE_FILE,
  commandsDir: COMMANDS_DIR,
  skillsDirIsOverridden: !!process.env.SKILLS_DIR,
  orphanCheckForced: process.env.ORPHAN_CHECK === '1',
})
errors += orphan.errors

// The mirror image of checkOrphanSkills: a manual-only skill must never be
// written as somewhere routing sends you. Scans every user-facing doc that
// describes routing — the two READMEs and docs/ included, because that is where
// a stranger reads the promise, not just where the model does.
const DOCS_DIR = process.env.DOCS_DIR ?? join(REPO_ROOT, 'docs')
const manualOnly = checkManualOnlySkillMentions(SKILLS_DIR, skillWalk.validSkills, {
  docFiles: [
    ROUTING_FILE,
    GLOBAL_CLAUDE_FILE,
    join(REPO_ROOT, 'README.md'),
    join(REPO_ROOT, 'README.tr.md'),
    ...(existsSync(DOCS_DIR)
      ? readdirSync(DOCS_DIR).filter(f => f.endsWith('.md')).map(f => join(DOCS_DIR, f))
      : []),
  ],
  repoRoot: REPO_ROOT,
  skillsDirIsOverridden: !!process.env.SKILLS_DIR,
  forced: process.env.ORPHAN_CHECK === '1',
})
errors += manualOnly.errors

const rules = validateRules(RULES_DIR)
errors += rules.errors

if (errors > 0) {
  console.error('\nValidation FAILED. Fix the errors above before committing.')
  process.exit(1)
} else {
  console.log('\nValidation PASSED.')
  process.exit(0)
}
