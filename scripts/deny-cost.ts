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
 *   npm run deny-cost                      # against the kit's settings-template.json
 *   npm run deny-cost -- path/to/settings.json
 */

import { readFileSync, readdirSync, existsSync, realpathSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

// Both tools take the same command-string glob syntax (see docs/permissions —
// "PowerShell permission rules use the same shape as Bash rules"), and Claude
// Code exposes them as two distinct tools, so a rule scoped to one never
// matches a call made through the other. Track each tool's patterns
// separately rather than only scanning `Bash(...)` — the kit shipped
// `Bash(Get-Content ...)` rules for a while that could never fire because
// Get-Content is only ever invoked via the PowerShell tool.
export const TOOLS = ['Bash', 'PowerShell'] as const
export type Tool = (typeof TOOLS)[number]

// Claude Code deny patterns: literal match, with `*` matching any span
// (including newlines — Bash/PowerShell commands are frequently multi-line).
// This mirrors this repo's own settings-template.json rule syntax, NOT a
// verified copy of Claude Code's actual internal matcher — see the
// "assumption, not a guarantee" notes in SECURITY.md for what that distinction
// means for the two secret-read rules this script reports zero matches for.
export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*')
  return new RegExp(`^${escaped}$`)
}

// PATH-shaped deny globs — `Read(./**/*.pem)` — where `**` crosses `/` and a single
// `*` does not. Deliberately NOT `globToRegExp` above: that one is built for command
// tails, where `*` spans separators, so using it on a path would accept a rule that
// can never actually match the file.
//
// Shared rather than re-implemented per call site (2026-08 review): four copies of
// this function existed — one here-equivalent in `check-consistency.ts` and three in
// `validate-skills.test.ts` — each needing a placeholder to keep `**` from being eaten
// by the `*` pass. The `check-consistency.ts` copy used a NUL byte for that, which made
// the repo's largest script report as *binary* to ripgrep: `grep`, and the Grep tool
// built on it, returned no content for the one file whose maintenance loop is "search it
// for the check that owns this rule". Both problems are the same problem, so both are
// closed here: one implementation, no placeholder at all. `**` and `*` are decided in a
// single scan by ordering the alternation, so there is no intermediate state for a
// sentinel to protect.
export function pathGlobToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/\*\*|\*|[.+^${}()|[\]\\]/g, m =>
    m === '**' ? '.*' : m === '*' ? '[^/]*' : `\\${m}`
  )
  return new RegExp(`^${escaped}$`)
}

export interface ToolRule {
  pattern: string
  re: RegExp
}

// Splits a settings.json-shaped deny list into per-tool compiled rules —
// pure and side-effect-free so it's directly unit-testable without a real
// settings-template.json on disk.
export function buildRulesByTool(denyRules: string[]): Record<Tool, ToolRule[]> {
  return Object.fromEntries(
    TOOLS.map(tool => [
      tool,
      denyRules
        .filter(r => r.startsWith(`${tool}(`) && r.endsWith(')'))
        .map(pattern => ({ pattern: pattern.slice(tool.length + 1, -1), re: globToRegExp(pattern.slice(tool.length + 1, -1)) })),
    ])
  ) as Record<Tool, ToolRule[]>
}

// Returns every rule (by tool) that matches a single command string — the
// core "would this have been denied?" question, isolated from file I/O so it
// can be asserted against directly instead of only through a full transcript
// scan.
export function matchCommand(tool: Tool, command: string, rulesByTool: Record<Tool, ToolRule[]>): string[] {
  return rulesByTool[tool].filter(({ re }) => re.test(command)).map(({ pattern }) => pattern)
}

// Pulls {tool, command} pairs out of one parsed transcript line. Both tools put
// the command string under `input.command` — verified against a real PowerShell
// tool_use block in ~/.claude/projects/**/*.jsonl (round-14 audit), not just the
// two tools' documented schemas — so this is one assumption, not two. Isolated
// from the file-scanning loop so the key-name assumption is unit-testable
// against a synthetic entry instead of only "trust the schema docs."
export function extractToolCommands(entry: unknown): { tool: Tool; command: string }[] {
  const blocks = (entry as { message?: { content?: unknown } })?.message?.content
  if (!Array.isArray(blocks)) return []
  const out: { tool: Tool; command: string }[] = []
  for (const block of blocks) {
    if (block?.type !== 'tool_use') continue
    const tool = TOOLS.find(t => t === block?.name)
    if (!tool) continue
    const command = block?.input?.command
    if (typeof command !== 'string') continue
    out.push({ tool, command })
  }
  return out
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function main(): void {
  const settingsPath = process.argv[2] ?? join(__dirname, '..', 'settings-template.json')

  if (!existsSync(settingsPath)) {
    console.error(`✗ settings file not found: ${settingsPath}`)
    process.exit(1)
  }

  const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
    permissions?: { deny?: string[] }
  }
  const denyRules = settings.permissions?.deny ?? []
  const rulesByTool = buildRulesByTool(denyRules)
  const totalRuleCount = TOOLS.reduce((sum, tool) => sum + rulesByTool[tool].length, 0)

  if (totalRuleCount === 0) {
    console.error(`✗ no Bash(...) or PowerShell(...) deny rules found in ${settingsPath}`)
    process.exit(1)
  }

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
  const hits = new Map<string, RuleHits>() // key: `${tool}:${pattern}`
  let totalCommands = 0
  // Counts distinct denied commands, not rule matches — a command matching two
  // rules (e.g. `rm -rf /` matches both `Bash(rm -rf /)` and `Bash(rm -rf /*)`,
  // since `*` matches the empty string) is one denial, not two. Summing
  // per-rule hit counts double-counts it and overstates the friction rate.
  let deniedCommands = 0

  for (const file of transcriptFiles) {
    let content: string
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const line of content.split('\n')) {
      if (!TOOLS.some(tool => line.includes(`"${tool}"`))) continue
      let entry: unknown
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      for (const { tool, command } of extractToolCommands(entry)) {
        totalCommands++
        const matched = matchCommand(tool, command, rulesByTool)
        for (const pattern of matched) {
          const key = `${tool}:${pattern}`
          const hit = hits.get(key) ?? { count: 0, samples: [] }
          hit.count++
          if (hit.samples.length < MAX_SAMPLES_PER_RULE) {
            hit.samples.push(command.slice(0, 120).replace(/\n/g, '\\n'))
          }
          hits.set(key, hit)
        }
        if (matched.length > 0) deniedCommands++
      }
    }
  }

  console.log(`Transcript files scanned:       ${transcriptFiles.length}`)
  console.log(`Bash/PowerShell commands scanned: ${totalCommands}`)
  console.log(`Deny rules checked:             ${totalRuleCount} (${rulesByTool.Bash.length} Bash, ${rulesByTool.PowerShell.length} PowerShell)`)
  console.log('')

  if (hits.size === 0) {
    console.log('✓ No historical command matched any deny rule — the list would have cost zero denials.')
    process.exit(0)
  }

  const rate = totalCommands > 0 ? ((deniedCommands / totalCommands) * 100).toFixed(2) : '0'
  console.log(`${deniedCommands} of ${totalCommands} commands (${rate}%) would have been denied, by ${hits.size} rule(s):\n`)

  for (const [key, { count, samples }] of [...hits.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${key.replace(':', '(')}) — ${count} match(es):`)
    for (const sample of samples) console.log(`    ${sample}`)
    if (count > samples.length) console.log(`    … and ${count - samples.length} more`)
    console.log('')
  }

  console.log('Review each rule above: an intended catch (a genuinely destructive command) is the')
  console.log('list working; a legitimate command means real friction — tune or drop that rule.')
}

// Entry-point guard (same pattern as routing-eval.ts's main() guard): importing
// this module for its pure functions must not trigger a live scan of this
// machine's real transcript history. realpathSync on both sides (not a raw
// string ===) so a symlinked or casing-variant invocation still resolves to
// the same real path instead of silently no-op'ing main().
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}
