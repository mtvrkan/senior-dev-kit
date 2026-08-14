// The kit's component counts, derived from disk — the single source both
// `check-consistency.ts` (which polices the READMEs' count tables) and
// `gen-site.ts` (which renders the landing page) read from.
//
// Extracted in round 39, when the landing page was added. The counts were already
// derived rather than hand-typed, but only inside check-consistency.ts's check 8. A
// second consumer that re-implemented "how many presets are there" would be a second
// answer to the same question — and the moment the two disagreed, the README would be
// guarded and the public site would quietly be wrong. One derivation, many readers.
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { findPresetDirs } from './presets.ts'
import { parseFrontmatter } from './frontmatter.ts'

export interface ComponentCounts {
  Agent: number
  Skill: number
  Rule: number
  Command: number
  Preset: number
  agent_docs: number
}

const dirCount = (root: string, dir: string, filter: (name: string) => boolean): number =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir), { withFileTypes: true }).filter((e) => filter(e.name)).length
    : 0

export function componentCounts(root: string): ComponentCounts {
  return {
    // ROUTING.md is a decision tree, not an agent; README.md is prose. Neither is dispatchable,
    // so neither counts — this exclusion is the one piece of judgment in the whole module.
    Agent: dirCount(root, 'agents', (n) => n.endsWith('.md') && n !== 'ROUTING.md' && n !== 'README.md'),
    Skill: existsSync(join(root, 'skills'))
      ? readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).length
      : 0,
    Rule: dirCount(root, 'rules', (n) => n.endsWith('.md')),
    Command: dirCount(root, 'commands', (n) => n.endsWith('.md')),
    // A preset is a leaf directory with a CLAUDE.md, not a top-level category folder.
    Preset: existsSync(join(root, 'presets')) ? findPresetDirs(join(root, 'presets')).length : 0,
    agent_docs: dirCount(root, 'agent_docs', (n) => n.endsWith('.md')),
  }
}

// --- Context budget ---------------------------------------------------------------
// The three files every session pays for unconditionally, and the caps they live under.
// These moved here from check-consistency.ts's check 3 when the landing page started
// quoting them: the page's whole claim is that the kit is cheap to carry, and a page
// stating a budget the checker no longer enforces would be the exact drift this module
// exists to prevent. The checker still owns the *verdict*; this owns the *numbers*.
export const ALWAYS_LOADED_FILES = ['global-CLAUDE.md', 'rules/000-security.md', 'rules/001-conventions.md']
export const ALWAYS_LOADED_LINE_BUDGET = 250
export const ALWAYS_LOADED_COMBINED_BUDGET = 500

// split('\n').length counts a trailing-newline terminator as one extra line ('a\n' → 2),
// so a file at exactly the budget would false-fail (round-29 fix).
export function lineCount(text: string): number {
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}

export interface ContextBudget {
  /** Lines loaded on every turn, in every session, forever. */
  alwaysLoadedLines: number
  /** Lines across the whole rule set plus the protocol — what is *available*, not what is paid. */
  totalRuleLines: number
  /** Rule files that load only when an edited path matches their `paths:` globs. */
  pathScopedRules: number
  /** Percentage of the rule set carried on a turn that matches no glob. Rounded. */
  alwaysLoadedShare: number
}

export function contextBudget(root: string): ContextBudget {
  const readIfPresent = (rel: string): string =>
    existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : ''

  const alwaysLoadedLines = ALWAYS_LOADED_FILES.reduce((sum, f) => sum + lineCount(readIfPresent(f)), 0)

  const rulesDir = join(root, 'rules')
  const ruleFiles = existsSync(rulesDir)
    ? readdirSync(rulesDir, { withFileTypes: true }).filter((e) => e.name.endsWith('.md')).map((e) => e.name)
    : []

  // Path-scoped means "declares a `paths:` frontmatter key" — read, never assumed from the
  // filename, so renaming or adding a rule cannot make this number lie.
  const pathScopedRules = ruleFiles.filter((n) => /^---[\s\S]*?^paths:/m.test(readIfPresent(join('rules', n)))).length

  const totalRuleLines =
    lineCount(readIfPresent('global-CLAUDE.md')) +
    ruleFiles.reduce((sum, n) => sum + lineCount(readIfPresent(join('rules', n))), 0)

  return {
    alwaysLoadedLines,
    totalRuleLines,
    pathScopedRules,
    alwaysLoadedShare: totalRuleLines === 0 ? 0 : Math.round((alwaysLoadedLines / totalRuleLines) * 100),
  }
}

// --- Trigger text: the other half of the per-session bill ---------------------------
// The three files above are not what a session actually costs. Claude Code also injects,
// unconditionally and before the user has typed anything, the `description` +
// `when_to_use` of every installed skill, the `description` of every agent, and every
// command's frontmatter. Measured on the kit as it shipped in round 44: 5.8k tokens of
// always-loaded files and a further 2.3k of trigger text — 29% of the real floor, guarded
// by nothing in aggregate.
//
// It was not unguarded by accident. `validate-skills.ts` caps each skill's trigger text at
// 360 chars for precisely this reason. But a per-item cap multiplied by a component count
// that only ever grows is not a budget — it is the same shape check 3's combined cap was
// added to fix, one surface over: 25 skills each passing 360 is 9,000 chars nobody
// approved. Agents and commands had no cap at all, and the routing eval's control arm is
// built from exactly those agent descriptions, so they are load-bearing and will grow.
//
// Chars, not lines: trigger text is prose that wraps arbitrarily, and a line count would
// reward reflowing a paragraph into one long line. The always-loaded files stay on lines
// because they are structured documents whose shape is the thing being budgeted.
export const TRIGGER_TEXT_BUDGET_CHARS = 360
// Room for roughly seven more components at the per-item cap before this fires. It is a
// signal, not a wall: raise it deliberately, in the same commit as the component that
// needs the room, rather than discovering the floor moved a year later.
export const TRIGGER_TEXT_COMBINED_BUDGET_CHARS = 12_000

export interface TriggerTextEntry {
  /** Repo-relative file the text came from. */
  file: string
  /** `skill` | `agent` | `command` — which per-item cap applies. */
  kind: string
  chars: number
}

/**
 * Every piece of frontmatter the harness loads into a session before the first user turn.
 * One derivation, three readers: the aggregate check, the per-item validators, and the
 * landing page's context-budget claim.
 */
export function triggerText(root: string): TriggerTextEntry[] {
  const entries: TriggerTextEntry[] = []
  const read = (rel: string): string => readFileSync(join(root, rel), 'utf8')

  const skillsDir = join(root, 'skills')
  if (existsSync(skillsDir)) {
    for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
      const rel = join('skills', e.name, 'SKILL.md')
      if (!e.isDirectory() || !existsSync(join(root, rel))) continue
      const fm = parseFrontmatter(read(rel))
      // description + when_to_use, the exact pair validate-skills.ts caps — the platform
      // matcher reads both, so both are paid.
      entries.push({ file: rel.replace(/\\/g, '/'), kind: 'skill', chars: (fm?.description?.length ?? 0) + (fm?.when_to_use?.length ?? 0) })
    }
  }

  const agentsDir = join(root, 'agents')
  if (existsSync(agentsDir)) {
    for (const name of readdirSync(agentsDir).filter((n) => n.endsWith('.md') && n !== 'ROUTING.md' && n !== 'README.md')) {
      const fm = parseFrontmatter(read(join('agents', name)))
      entries.push({ file: `agents/${name}`, kind: 'agent', chars: fm?.description?.length ?? 0 })
    }
  }

  const commandsDir = join(root, 'commands')
  if (existsSync(commandsDir)) {
    for (const name of readdirSync(commandsDir).filter((n) => n.endsWith('.md'))) {
      // A command's whole frontmatter block is the injected part — `description` plus
      // `argument-hint`, both of which the harness surfaces in the slash-command list.
      const fm = parseFrontmatter(read(join('commands', name))) ?? {}
      const chars = Object.entries(fm).reduce((sum, [k, v]) => sum + k.length + v.length, 0)
      entries.push({ file: `commands/${name}`, kind: 'command', chars })
    }
  }

  return entries
}

/** Total chars of trigger text across every component. */
export function triggerTextTotal(root: string): number {
  return triggerText(root).reduce((sum, e) => sum + e.chars, 0)
}

// Null when the template is absent — the consistency-check test fixtures build only the
// files each case needs, so an unconditional read would crash them (same reasoning as
// check 6's existsSync guard, which this mirrors rather than replaces).
export function denyRuleCount(root: string): number | null {
  const template = join(root, 'settings-template.json')
  if (!existsSync(template)) return null
  return (JSON.parse(readFileSync(template, 'utf8')).permissions?.deny ?? []).length
}
