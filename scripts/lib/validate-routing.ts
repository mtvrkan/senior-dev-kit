// Routing-document validation (agents/ROUTING.md coverage + global-CLAUDE.md's
// AGENT ROUTING section), split out of scripts/validate-skills.ts (round-17
// audit).

import { readFileSync, readdirSync, existsSync } from 'fs'
import { getAgentNames } from './validate-agents.ts'

export interface RoutingCoverageResult {
  errors: number
  agentsChecked: number
}

// Cross-reference: verify every agent in agents/ is mentioned in ROUTING.md
export function validateRoutingCoverage(agentsDir: string, routingFile: string): RoutingCoverageResult {
  const result: RoutingCoverageResult = { errors: 0, agentsChecked: 0 }
  if (!existsSync(routingFile)) return result

  console.log('\nValidating ROUTING.md agent coverage...\n')
  const routingContent = readFileSync(routingFile, 'utf8')
  const allAgents = readdirSync(agentsDir)
    .filter(f => f.endsWith('.md') && f !== 'ROUTING.md' && f !== 'README.md')
    .map(f => f.replace(/\.md$/, ''))
  for (const agentName of allAgents) {
    result.agentsChecked++
    // Word-boundary match (same `(?<!-)\b...\b(?!-)` pattern used for orphan-skill
    // detection) so an agent name can't pass this check by being a substring of an
    // unrelated hyphenated word in ROUTING.md prose (round-25 hardening — no live
    // collision existed, but a raw `.includes()` only ever widens what "covered"
    // means, silently, as new agents/prose are added).
    const escaped = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const mentionRe = new RegExp(`(?<!-)\\b${escaped}\\b(?!-)`)
    if (mentionRe.test(routingContent)) {
      console.log(`  ✓ ${agentName} — found in ROUTING.md`)
    } else {
      console.error(`  ✗ ${agentName} — NOT mentioned in ROUTING.md (add routing rule)`)
      result.errors++
    }
  }
  console.log(`\n${allAgents.length} agents checked against ROUTING.md — ${result.errors} missing`)
  return result
}

export interface RoutingDanglingResult {
  errors: number
  targetsChecked: number
}

// Reverse of validateRoutingCoverage above (round-20 finding): that function
// only checks agents/*.md → ROUTING.md ("every agent is mentioned somewhere"),
// never the opposite direction — a routing rule that still names an
// agent that was later renamed or deleted passes silently. Scoped to tokens
// that are the WHOLE, trimmed content of a markdown table cell (not free
// prose) so an ordinary hyphenated English word in a sentence ("read-only",
// "blast-radius") can never trip this — those never appear as a table cell's
// entire content on their own, only as part of a longer phrase. This also
// covers single-word agent slugs with no hyphen at all (e.g. the
// since-deleted `architect`) — an earlier version additionally required the
// cell to contain a hyphen, which was redundant with the whole-cell match
// above (prose fragments still can't sneak in) and left every single-word
// agent name silently unchecked (round-24 finding).
export function validateRoutingDanglingReferences(
  routingFile: string,
  agentsDir: string,
  validSkills: Set<string>
): RoutingDanglingResult {
  const result: RoutingDanglingResult = { errors: 0, targetsChecked: 0 }
  if (!existsSync(routingFile) || !existsSync(agentsDir)) return result

  console.log('\nValidating ROUTING.md for dangling agent references...\n')
  const routingContent = readFileSync(routingFile, 'utf8')
  const agentFiles = getAgentNames(agentsDir)
  const seen = new Set<string>()
  for (const line of routingContent.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    for (const cell of cells) {
      if (!/^[a-z][a-z0-9-]*$/.test(cell) || seen.has(cell)) continue
      seen.add(cell)
      result.targetsChecked++
      if (agentFiles.has(cell) || validSkills.has(cell)) {
        console.log(`  ✓ ${cell} — resolves to an agent or skill`)
      } else {
        console.error(`  ✗ ${cell} — no agents/${cell}.md (or matching skill) exists (stale routing reference?)`)
        result.errors++
      }
    }
  }
  console.log(`\n${result.targetsChecked} table-cell routing target(s) checked — ${result.errors} dangling`)
  return result
}

export interface GlobalClaudeRoutingResult {
  errors: number
  routedAgents: Set<string>
}

// Cross-reference: every agent name that global-CLAUDE.md's AGENT ROUTING
// section routes to (via a "signal → agent" arrow) must exist as
// agents/<name>.md — otherwise routing silently points nowhere.
// A missing default global-CLAUDE.md is itself an error (the installer ships it);
// a missing GLOBAL_CLAUDE_FILE override is deliberate test isolation and skips.
export function validateGlobalClaudeRouting(
  globalClaudeFile: string,
  agentsDir: string,
  validSkills: Set<string>
): GlobalClaudeRoutingResult {
  const result: GlobalClaudeRoutingResult = { errors: 0, routedAgents: new Set() }

  if (!existsSync(globalClaudeFile)) {
    if (!process.env.GLOBAL_CLAUDE_FILE) {
      console.error('\n  ✗ global-CLAUDE.md — required kit file is missing (installers copy it as ~/.claude/CLAUDE.md)')
      result.errors++
    }
    return result
  }
  if (!existsSync(agentsDir)) return result

  console.log('\nValidating global-CLAUDE.md routing targets...\n')
  const globalContent = readFileSync(globalClaudeFile, 'utf8')
  const agentFiles = getAgentNames(agentsDir)
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
  // Only "routes to non-existent agent" instances count toward the summary
  // line below — matches the original script's `routingTargetErrors` (not
  // `errors`) so a zero-targets-extracted parser failure still bumps the
  // returned error total but doesn't inflate "N missing agent file(s)".
  let danglingTargets = 0
  if (sectionStart !== -1) {
    let sawArrow = false
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i]) || lines[i].trim() === '---') break
      for (const m of lines[i].matchAll(/→\s*`?([a-z][a-z0-9-]*)`?/g)) {
        const token = m[1]
        sawArrow = true
        if (agentFiles.has(token)) {
          result.routedAgents.add(token)
        } else if (validSkills.has(token)) {
          // Deliberately a skill reference, not an agent — not a dangling target.
        } else if (token.includes('-')) {
          console.error(`  ✗ global-CLAUDE.md routes to non-existent agent: '${token}' (no agents/${token}.md)`)
          danglingTargets++
          result.errors++
        }
        // else: a bare non-agent word after an arrow (prose) — ignore
      }
    }
    // Guard against silent format drift: the section always routes to at least
    // the escalation guards, so extracting zero valid targets means the parser
    // no longer understands the section's shape — the exact failure mode where
    // an earlier table-based parser silently "checked 0 targets" after the
    // section was rewritten as prose.
    if (sawArrow && result.routedAgents.size === 0) {
      console.error('  ✗ global-CLAUDE.md — AGENT ROUTING section found but no valid routing targets extracted (parser may be stale relative to the section format)')
      result.errors++
    }
  }
  for (const name of [...result.routedAgents].sort()) {
    console.log(`  ✓ global-CLAUDE.md → ${name}`)
  }
  console.log(`\n${result.routedAgents.size} routing targets checked — ${danglingTargets} missing agent file(s)`)
  return result
}
