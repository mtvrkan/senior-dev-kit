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

// Null when the template is absent — the consistency-check test fixtures build only the
// files each case needs, so an unconditional read would crash them (same reasoning as
// check 6's existsSync guard, which this mirrors rather than replaces).
export function denyRuleCount(root: string): number | null {
  const template = join(root, 'settings-template.json')
  if (!existsSync(template)) return null
  return (JSON.parse(readFileSync(template, 'utf8')).permissions?.deny ?? []).length
}
