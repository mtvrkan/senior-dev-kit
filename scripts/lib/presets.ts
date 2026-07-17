// Validates preset directories containing CLAUDE.md files.
// A "preset" is any leaf directory under presets/ that contains CLAUDE.md.
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative, dirname } from 'path'

const MIN_LENGTH = 50

export interface PresetResult {
  ok: boolean
  rel: string
  reason?: string
}

export interface PresetDir {
  claudePath: string
  relPath: string
}

export function validatePresetClaudeMd(claudePath: string, relPath: string): PresetResult {
  if (!existsSync(claudePath)) {
    return { ok: false, rel: relPath, reason: 'CLAUDE.md not found' }
  }
  const content = readFileSync(claudePath, 'utf8')
  if (content.trim().length < MIN_LENGTH) {
    return { ok: false, rel: relPath, reason: `file too short (< ${MIN_LENGTH} chars)` }
  }
  return { ok: true, rel: relPath }
}

const COMPACT_MIN_LINES = 7

// NOTE on content-drift detection (round-9 finding, investigated and rejected
// twice — see PRESET-MAINTENANCE.md's "compact.md sync" note): neither a
// CLAUDE.md-heading-keyword-vs-compact.md-text overlap check nor a git
// last-commit-timestamp comparison survived testing against the real 49
// presets without unacceptable false-positive rates (the keyword check
// flagged nextjs-saas, an independently spot-checked well-synced pair, at
// 10% overlap because compact.md legitimately paraphrases into dense bullets
// rather than restating headings; the timestamp check flagged ~1 in 4
// presets purely because SOME commit touched CLAUDE.md's wording without a
// compact.md change being warranted). Judging whether a CLAUDE.md edit was
// "meaningful enough to need a compact.md update" requires reading the diff,
// not measuring it — left to the quarterly human review checklist instead of
// a noisy automated check that would itself become next round's false-alarm
// finding.
export function checkCompactMd(claudePath: string, relPath: string): PresetResult {
  const compactPath = join(dirname(claudePath), 'compact.md')
  if (!existsSync(compactPath)) {
    return { ok: false, rel: relPath, reason: 'compact.md missing — add 7-15 line token-optimized summary (see EXTENDING.md)' }
  }
  const lines = readFileSync(compactPath, 'utf8').split('\n').filter(l => l.trim() !== '').length
  if (lines < COMPACT_MIN_LINES) {
    return { ok: false, rel: relPath, reason: `compact.md too short (${lines} non-blank lines, min ${COMPACT_MIN_LINES}) — add key architecture rules, security patterns, verification commands, anti-patterns` }
  }
  return { ok: true, rel: relPath }
}

export function findPresetDirs(dir: string, baseDir?: string): PresetDir[] {
  const base = baseDir ?? dir
  const results: PresetDir[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
  const hasClaudeMd = entries.some(e => e.isFile() && e.name === 'CLAUDE.md')

  if (hasClaudeMd) {
    results.push({ claudePath: join(dir, 'CLAUDE.md'), relPath: relative(base, dir).replace(/\\/g, '/') })
  } else {
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push(...findPresetDirs(join(dir, entry.name), base))
      }
    }
  }
  return results
}
