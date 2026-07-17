#!/usr/bin/env node
/**
 * Cross-checks canonical values that live in more than one file and have no
 * single source of truth a human would think to grep before editing one copy:
 * the version string (package.json vs .claude-plugin/plugin.json), the golden
 * routing-prompt count (eval/golden-prompts.json vs README.md/README.tr.md's
 * prose), and the Node version pinned across every CI/template workflow file.
 * check-stale.ts already covers agent/skill/command/preset/example counts —
 * this script is for the handful of values check-stale.ts doesn't reach.
 *
 * Usage: node --experimental-strip-types scripts/check-consistency.ts
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.CONSISTENCY_ROOT ?? join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const errors: string[] = []

// --- 1. package.json version === .claude-plugin/plugin.json version ---
const pkgVersion = JSON.parse(read('package.json')).version
const pluginVersion = JSON.parse(read('.claude-plugin/plugin.json')).version
if (pkgVersion !== pluginVersion) {
  errors.push(`package.json version (${pkgVersion}) != .claude-plugin/plugin.json version (${pluginVersion})`)
}

// --- 2. golden-prompts.json count === README's stated prompt count ---
const goldenPrompts = JSON.parse(read('eval/golden-prompts.json')).prompts
const actualPromptCount = goldenPrompts.length
for (const readme of ['README.md', 'README.tr.md']) {
  const text = read(readme)
  const claims = [...text.matchAll(/pins (\d+) realistic requests/g), ...text.matchAll(/(\d+) gerçekçi isteği/g)]
  for (const m of claims) {
    const claimed = Number(m[1])
    if (claimed !== actualPromptCount) {
      errors.push(`${readme} claims ${claimed} golden prompts, eval/golden-prompts.json has ${actualPromptCount}`)
    }
  }
}

// --- 3. Node version consistent across every CI/template workflow file ---
function findYamlFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) findYamlFiles(rel, out)
    else if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) out.push(rel)
  }
}
const workflowFiles: string[] = []
findYamlFiles('.github/workflows', workflowFiles)
findYamlFiles('security/workflows', workflowFiles)

const nodeVersionsByFile = new Map<string, Set<string>>()
for (const file of workflowFiles) {
  const text = read(file)
  const versions = new Set([...text.matchAll(/node-version:\s*['"]?(\d+)/g)].map(m => m[1]))
  if (versions.size > 0) nodeVersionsByFile.set(file, versions)
}
const allVersions = new Set([...nodeVersionsByFile.values()].flatMap(s => [...s]))
if (allVersions.size > 1) {
  const detail = [...nodeVersionsByFile.entries()].map(([f, v]) => `${f}: ${[...v].join(',')}`).join(' | ')
  errors.push(`node-version differs across workflow files (expected one consistent value): ${detail}`)
}

// --- 4. Line budget on the files that load into EVERY session unconditionally ---
// global-CLAUDE.md and rules/000-security.md + rules/001-conventions.md (the
// only two rule files with no `paths:` frontmatter) cost every user's context
// budget on every single turn, forever — unlike agent bodies (capped at 150
// lines by validate-skills.ts) or skills (capped at 20), these three had no
// growth guardrail at all. 250 is a soft ceiling: room to grow, but a signal
// before "always-loaded" quietly becomes "always-loaded and bloated."
const ALWAYS_LOADED_LINE_BUDGET = 250
const alwaysLoadedFiles = ['global-CLAUDE.md', 'rules/000-security.md', 'rules/001-conventions.md']
let alwaysLoadedTotal = 0
for (const file of alwaysLoadedFiles) {
  const lineCount = read(file).split('\n').length
  alwaysLoadedTotal += lineCount
  if (lineCount > ALWAYS_LOADED_LINE_BUDGET) {
    errors.push(`${file} is ${lineCount} lines, over the ${ALWAYS_LOADED_LINE_BUDGET}-line always-loaded budget — trim or move a section to agent_docs/`)
  }
}
// The per-file caps above each pass independently even as every file creeps
// toward its own ceiling — three files at 249 lines each would pass every
// per-file check while costing 747 lines every session. A combined cap catches
// the real per-session tax the per-file checks can't see by construction.
const ALWAYS_LOADED_COMBINED_BUDGET = 500
if (alwaysLoadedTotal > ALWAYS_LOADED_COMBINED_BUDGET) {
  errors.push(
    `${alwaysLoadedFiles.join(' + ')} total ${alwaysLoadedTotal} lines, over the ${ALWAYS_LOADED_COMBINED_BUDGET}-line combined always-loaded budget (each passes its own 250-line cap, but the sum is what every session actually pays) — trim the file with the most slack`
  )
}

// --- 5. CI's unit-test invocation === package.json's `test` script ---
// CI's `validate-skills` job hard-codes its own `node --test ...` command
// instead of calling `npm test`, so the two can drift silently — a stale file
// reference here doesn't fail `npm run check` locally, only CI, and only on
// the next push. (Found live: the job kept naming a test file after it was
// deleted, breaking every push/PR until caught by hand.)
const pkgTestScript = JSON.parse(read('package.json')).scripts?.test ?? ''
const ciWorkflowFile = workflowFiles.find(f => read(f).includes('Run unit tests'))
if (pkgTestScript && ciWorkflowFile) {
  const ciText = read(ciWorkflowFile)
  const runMatch = ciText.match(/Run unit tests\s*\n\s*run:\s*(.+)/)
  const ciCommand = runMatch?.[1]?.trim()
  if (ciCommand && ciCommand !== pkgTestScript) {
    errors.push(
      `${ciWorkflowFile}'s "Run unit tests" step ("${ciCommand}") != package.json's "test" script ("${pkgTestScript}") — one references a file/flag the other doesn't`
    )
  }
}

// --- 6. README's "N/N tests passing" claim === the real npm-test pass count ---
// Found by hand (README claimed 96/96 while the suite had grown to 97/97) in a
// section whose entire premise is "every number is reproducible" — no guard
// caught it because check-links.ts/this file's other checks cover golden-prompt
// count, markdown-file count, and version drift, but not this claim. Only runs
// the suite (re-run rather than a cached result, the only way to get an actual
// current count) when a README actually makes this claim, so a fixture ROOT
// without a real test file to exec doesn't fail this check spuriously.
const claimPattern = /(\d+)\/(\d+)\s+(?:tests?\s+)?(?:passing|geçiyor)/gi
const testCountClaims = ['README.md', 'README.tr.md'].flatMap(readme =>
  [...read(readme).matchAll(claimPattern)].map(m => ({ readme, text: m[0], claimed: Number(m[1]) }))
)
// Suite-count claim lives in the same parenthetical as the pass-count claim
// above ("102/102 passing (25 suites — ...")) but is separate free-text the
// pass-count regex doesn't touch — found stale by hand (claimed 24, actual 25)
// because nothing checked it: this guard exists specifically to close that
// blind spot, not as a hypothetical.
const suiteClaimPattern = /\((\d+)\s+suites?\b/gi
const suiteCountClaims = ['README.md', 'README.tr.md'].flatMap(readme =>
  [...read(readme).matchAll(suiteClaimPattern)].map(m => ({ readme, text: m[0], claimed: Number(m[1]) }))
)
let actualPassCount: number | null = null
let actualSuiteCount: number | null = null
if ((testCountClaims.length > 0 || suiteCountClaims.length > 0) && pkgTestScript) {
  try {
    const testOutput = execSync(pkgTestScript, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const passMatch = testOutput.match(/^# pass (\d+)$/m)
    if (passMatch) actualPassCount = Number(passMatch[1])
    const suitesMatch = testOutput.match(/^# suites (\d+)$/m)
    if (suitesMatch) actualSuiteCount = Number(suitesMatch[1])
  } catch (e) {
    errors.push(`could not run "${pkgTestScript}" to verify README's test-count claim: ${(e as Error).message}`)
  }
  if (actualPassCount !== null) {
    for (const { readme, text, claimed } of testCountClaims) {
      if (claimed !== actualPassCount) {
        errors.push(`${readme} claims "${text}" but \`${pkgTestScript}\` actually reports ${actualPassCount} passing`)
      }
    }
  }
  if (actualSuiteCount !== null) {
    for (const { readme, text, claimed } of suiteCountClaims) {
      if (claimed !== actualSuiteCount) {
        errors.push(`${readme} claims "${text}" but \`${pkgTestScript}\` actually reports # suites ${actualSuiteCount}`)
      }
    }
  }
}

// --- 7. SECURITY.md's "N Read/Bash/PowerShell deny rules" claim === actual count ---
// Found by hand the same way as check 6: the deny list grows every time a new
// secret pattern or bypass is closed, but the prose count in SECURITY.md is
// typed by hand and nothing re-derived it from settings-template.json itself.
// Guarded by existsSync (unlike checks 1-4, which assume their inputs exist):
// this test suite's CONSISTENCY_ROOT fixtures deliberately build only the
// handful of files each test needs, so settings-template.json/SECURITY.md
// are absent there by design — an unconditional read() would crash the whole
// script on every fixture-based test, not just fail check 7's own assertion.
let denyRuleCount: number | null = null
let denyCountClaims: { text: string; claimed: number }[] = []
if (existsSync(join(ROOT, 'settings-template.json')) && existsSync(join(ROOT, 'SECURITY.md'))) {
  denyRuleCount = (JSON.parse(read('settings-template.json')).permissions?.deny ?? []).length
  const denyCountPattern = /\*\*(\d+) Read\/Bash\/PowerShell deny rules\*\*/g
  denyCountClaims = [...read('SECURITY.md').matchAll(denyCountPattern)].map(m => ({
    text: m[0],
    claimed: Number(m[1]),
  }))
  for (const { text, claimed } of denyCountClaims) {
    if (claimed !== denyRuleCount) {
      errors.push(`SECURITY.md claims "${text}" but settings-template.json actually has ${denyRuleCount} deny rules`)
    }
  }
}

// --- 8. SETUP.md's/TROUBLESHOOTING.md's skill-count claims === actual skills/ dir count ---
// Found by hand: SETUP.md's install-list intro, its verification table, and
// TROUBLESHOOTING.md's diagnostic heading all said 23 while skills/ had grown
// to 25 (two skills added earlier this round). A general "N agents/skills/
// rules" regex across every doc was considered and rejected: README.tr.md's
// own PROJECT-BOOTSTRAP description of the *unrelated* 7-agent bootstrap
// roster ("7 agent'lık proje takımı") would false-positive against the kit's
// real 12-agent count under a naive number+noun match — same false-positive
// class already rejected once for compact.md drift detection (see
// PRESET-MAINTENANCE.md). Targeting the exact phrasings that actually broke
// is narrower but doesn't misfire on unrelated counts.
const skillsDirPath = join(ROOT, 'skills')
if (existsSync(skillsDirPath)) {
  const actualSkillCount = readdirSync(skillsDirPath, { withFileTypes: true }).filter(e => e.isDirectory()).length
  if (existsSync(join(ROOT, 'SETUP.md'))) {
    const setupText = read('SETUP.md')
    const introMatch = setupText.match(/Read the following (\d+) subdirectories from `KIT\/skills\/`/)
    if (introMatch && Number(introMatch[1]) !== actualSkillCount) {
      errors.push(`SETUP.md's skill-copy intro claims ${introMatch[1]} subdirectories but skills/ actually has ${actualSkillCount}`)
    }
    const tableMatch = setupText.match(/\|\s*`skills\/`\s*\|\s*(\d+)\s*\|/)
    if (tableMatch && Number(tableMatch[1]) !== actualSkillCount) {
      errors.push(`SETUP.md's verification table claims skills/ has ${tableMatch[1]} files but it actually has ${actualSkillCount}`)
    }
  }
  if (existsSync(join(ROOT, 'TROUBLESHOOTING.md'))) {
    const troubleshootingText = read('TROUBLESHOOTING.md')
    const failMatch = troubleshootingText.match(/skill count is less than (\d+)/)
    if (failMatch && Number(failMatch[1]) !== actualSkillCount) {
      errors.push(`TROUBLESHOOTING.md's "skill count is less than ${failMatch[1]}" should reference ${actualSkillCount} (current skills/ count)`)
    }
  }
}

// --- 9. CHANGELOG.md's "[Unreleased]" section never repeats a "Nth wave" label ---
// Found by hand: two separate audit-round summaries both introduced themselves as
// "Fifth wave —", the second one should have been "Sixth wave" — a copy/paste-style
// slip in the one file whose entire premise is precise self-accounting of what each
// round found and fixed. Scoped to the Unreleased section only (bounded by the next
// `## [` release header) so a future release's own prose can reuse ordinal words
// freely without tripping this guard once Unreleased is cut and reset.
if (existsSync(join(ROOT, 'CHANGELOG.md'))) {
  const changelogText = read('CHANGELOG.md')
  const unreleasedStart = changelogText.indexOf('## [Unreleased]')
  if (unreleasedStart !== -1) {
    const nextHeaderMatch = changelogText.slice(unreleasedStart + 1).match(/\n## \[/)
    const unreleasedEnd = nextHeaderMatch ? unreleasedStart + 1 + nextHeaderMatch.index! : changelogText.length
    const unreleasedText = changelogText.slice(unreleasedStart, unreleasedEnd)
    const waveLabels = [...unreleasedText.matchAll(/^(\w+) wave —/gm)].map(m => m[1])
    const seen = new Set<string>()
    for (const label of waveLabels) {
      if (seen.has(label)) {
        errors.push(`CHANGELOG.md's [Unreleased] section uses the wave label "${label} wave" more than once — rename the later one to the next unused ordinal`)
      }
      seen.add(label)
    }
  }
}

// --- 10. .claude/settings.json's deny list is a superset of settings-template.json's ---
// Found by hand (round-14 audit): the kit's own dev config had drifted 35 rules
// behind the shipped template — specifically every base64/Get-Content secret-read
// rule — so the kit's own sessions were running with weaker protection than the
// template it tells consumers to install. `allow` is expected to diverge per-project
// (UPGRADE.md documents that), but `deny` never should: a rule added to the template
// closes a real bypass, and the kit's own settings.json should get it too. Superset,
// not exact-equality, so intentionally kit-specific deny rules (if any are ever added)
// don't trip this.
let denyDriftCount = 0
if (existsSync(join(ROOT, '.claude/settings.json')) && existsSync(join(ROOT, 'settings-template.json'))) {
  const localDeny = new Set(JSON.parse(read('.claude/settings.json')).permissions?.deny ?? [])
  const templateDeny = JSON.parse(read('settings-template.json')).permissions?.deny ?? []
  const missing = templateDeny.filter((rule: string) => !localDeny.has(rule))
  denyDriftCount = missing.length
  if (missing.length > 0) {
    errors.push(
      `.claude/settings.json is missing ${missing.length} deny rule(s) present in settings-template.json (kit's own dev config is under-protected relative to what it ships): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`
    )
  }
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} consistency drift issue(s) found:\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ Version fields match (${pkgVersion}).`)
console.log(`✓ Golden-prompt count claims match disk (${actualPromptCount}).`)
console.log(`✓ Node version consistent across ${workflowFiles.length} workflow file(s) (${[...allVersions][0] ?? 'none pinned'}).`)
console.log(`✓ Always-loaded files (${alwaysLoadedFiles.join(', ')}) within the ${ALWAYS_LOADED_LINE_BUDGET}-line per-file budget (combined: ${alwaysLoadedTotal}/${ALWAYS_LOADED_COMBINED_BUDGET}).`)
if (ciWorkflowFile) console.log(`✓ CI unit-test command matches package.json's "test" script.`)
if (actualPassCount !== null) console.log(`✓ README test-count claims match \`${pkgTestScript}\` (${actualPassCount} passing).`)
if (actualSuiteCount !== null) console.log(`✓ README suite-count claims match \`${pkgTestScript}\` (${actualSuiteCount} suites).`)
if (denyCountClaims.length > 0) console.log(`✓ SECURITY.md deny-rule count claims match settings-template.json (${denyRuleCount ?? 0}).`)
if (existsSync(skillsDirPath)) console.log(`✓ SETUP.md/TROUBLESHOOTING.md skill-count claims match skills/ (${readdirSync(skillsDirPath, { withFileTypes: true }).filter(e => e.isDirectory()).length}).`)
if (existsSync(join(ROOT, 'CHANGELOG.md'))) console.log(`✓ CHANGELOG.md's [Unreleased] wave labels are unique.`)
if (existsSync(join(ROOT, '.claude/settings.json')) && existsSync(join(ROOT, 'settings-template.json'))) {
  console.log(`✓ .claude/settings.json's deny list has no gaps vs settings-template.json (drift: ${denyDriftCount}).`)
}
process.exit(0)
