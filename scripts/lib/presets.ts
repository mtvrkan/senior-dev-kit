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
const COMPACT_MAX_LINES = 15

// NOTE on content-drift detection (round-9 finding, investigated and rejected
// twice): neither a CLAUDE.md-heading-keyword-vs-compact.md-text overlap
// check nor a git last-commit-timestamp comparison survived testing against
// the real presets without unacceptable false-positive rates (the keyword
// check flagged nextjs-saas, an independently spot-checked well-synced pair,
// at 10% overlap because compact.md legitimately paraphrases into dense
// bullets rather than restating headings; the timestamp check flagged ~1 in
// 4 presets purely because SOME commit touched CLAUDE.md's wording without a
// compact.md change being warranted). Judging whether a CLAUDE.md edit was
// "meaningful enough to need a compact.md update" requires reading the diff,
// not measuring it — left to manual review instead of a noisy automated
// check that would itself become next round's false-alarm finding.
export function checkCompactMd(claudePath: string, relPath: string): PresetResult {
  const compactPath = join(dirname(claudePath), 'compact.md')
  if (!existsSync(compactPath)) {
    return { ok: false, rel: relPath, reason: `compact.md missing — add a ${COMPACT_MIN_LINES}-${COMPACT_MAX_LINES} line token-optimized summary` }
  }
  const lines = readFileSync(compactPath, 'utf8').split('\n').filter(l => l.trim() !== '').length
  if (lines < COMPACT_MIN_LINES) {
    return { ok: false, rel: relPath, reason: `compact.md too short (${lines} non-blank lines, min ${COMPACT_MIN_LINES}) — add key architecture rules, security patterns, verification commands, anti-patterns` }
  }
  if (lines > COMPACT_MAX_LINES) {
    return { ok: false, rel: relPath, reason: `compact.md too long (${lines} non-blank lines, max ${COMPACT_MAX_LINES}) — compact.md is for composing multiple stacks, keep it dense; move detail into CLAUDE.md` }
  }
  return { ok: true, rel: relPath }
}

// The one compact.md-vs-CLAUDE.md drift signal that survived testing against the real presets
// (unlike the two rejected in the note above): a compact.md is a SUMMARY, so a CLI tool it tells
// you to run must exist in the full document too. A tool that appears only in the summary means
// one half of the pair was edited and the other was not — which is exactly how the drizzle preset
// ended up recommending a `drizzle-kit` invocation that no longer matched its own detail page.
//
// Deliberately matches tool NAMES, not full command strings: compact.md legitimately abbreviates
// (`vitest run [file]` for `npx vitest run src/lib/util.test.ts`), so comparing whole commands
// would fire on every preset. Basenames are normalized, so `./vendor/bin/phpstan` and `phpstan`
// are the same tool. Verified clean across all shipped presets before being turned on.
// Exported because `check-consistency.ts` check 24 uses this same vocabulary to police tool
// VERDICTS across the kit: a tool a rule file calls deprecated must not be recommended anywhere
// else. That is why retired tools (`tfsec`) stay listed here — the list is the set of tool names
// the kit knows how to reason about, not the set it endorses. Deleting one silences check 24 for it.
export const KNOWN_TOOLS = new Set([
  'npm', 'npx', 'pnpm', 'yarn', 'bun', 'node', 'deno', 'vitest', 'jest', 'eslint', 'tsc',
  'svelte-check', 'astro', 'nuxt', 'vite', 'ng', 'php', 'artisan', 'phpunit', 'phpstan', 'pint',
  'composer', 'python', 'pytest', 'ruff', 'mypy', 'uvicorn', 'bundle', 'rspec', 'rubocop',
  'brakeman', 'rails', 'go', 'golangci-lint', 'govulncheck', 'cargo', 'clippy', 'dotnet',
  'gradlew', 'mvnw', 'flutter', 'dart', 'xcodebuild', 'swiftlint', 'eas', 'expo', 'expo-doctor',
  'supabase', 'mongosh', 'drizzle-kit', 'prisma', 'kubectl', 'kubeconform', 'helm', 'trivy',
  'terraform', 'tflint', 'tfsec', 'checkov', 'docker', 'osv-scanner', 'cmake', 'ctest',
])

// Library APIs — not CLI tools — that the kit's rule files can retire. Kept SEPARATE from
// KNOWN_TOOLS on purpose: `toolsMentionedIn` above scans command snippets for things you RUN, and
// a hook name has no business in that vocabulary. Check 24 unions the two, so a retirement verdict
// written about anything in either set travels kit-wide.
//
// Round-39 audit: check 24 could only reason about tool names, so a retired UI primitive was
// invisible to it — and the shadcn palette is duplicated across two presets with nothing binding
// the copies. `rules/100-web.md` § RETIRED UI APIS is the canonical verdict list this feeds.
export const RETIRABLE_APIS = new Set(['useToast'])

export function toolsMentionedIn(markdown: string): Set<string> {
  const found = new Set<string>()
  const snippets: string[] = []
  for (const m of markdown.matchAll(/`([^`\n]+)`/g)) snippets.push(m[1])
  // Fenced blocks are where a CLAUDE.md keeps its Verification commands — scanning inline code
  // alone made this check fire on 18 of 28 real presets.
  for (const m of markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) snippets.push(...m[1].split('\n'))
  for (const snippet of snippets) {
    for (const word of snippet.trim().split(/\s+/)) {
      const base = word.split('/').pop() ?? word
      if (KNOWN_TOOLS.has(word)) found.add(word)
      if (KNOWN_TOOLS.has(base)) found.add(base)
    }
  }
  return found
}

export function checkCompactToolDrift(claudePath: string, relPath: string): PresetResult {
  const compactPath = join(dirname(claudePath), 'compact.md')
  if (!existsSync(claudePath) || !existsSync(compactPath)) return { ok: true, rel: relPath }

  const inFull = toolsMentionedIn(readFileSync(claudePath, 'utf8'))
  const orphans = [...toolsMentionedIn(readFileSync(compactPath, 'utf8'))].filter(t => !inFull.has(t))
  if (orphans.length > 0) {
    return {
      ok: false,
      rel: relPath,
      reason: `compact.md tells you to run ${orphans.map(t => `\`${t}\``).join(', ')} but CLAUDE.md never mentions it — the pair has drifted; fix whichever half is wrong`,
    }
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
