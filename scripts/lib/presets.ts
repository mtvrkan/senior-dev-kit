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
