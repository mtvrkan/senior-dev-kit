#!/usr/bin/env node
/**
 * Cross-checks canonical values that live in more than one file and have no
 * single source of truth a human would think to grep before editing one copy.
 * Started with two checks (golden routing-prompt count, CI Node version) and
 * has grown to 12+ numbered check families — always-loaded line budgets,
 * CI/package.json test-command drift, README count claims (tests, İçerik
 * table), SECURITY.md deny-rule count, settings.json/template superset,
 * global-CLAUDE.md doc/rule lists,
 * performance-budget mirrors, and run-checks CHECK_STEPS coverage. Each check
 * documents inline the real drift it was written to catch.
 *
 * Usage: node --experimental-strip-types scripts/check-consistency.ts
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { findPresetDirs } from './lib/presets.ts'
import { CHECK_STEPS } from './run-checks.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.CONSISTENCY_ROOT ?? join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const errors: string[] = []

// --- 1. golden-prompts.json count === README's stated prompt count ---
const goldenPrompts = JSON.parse(read('eval/golden-prompts.json')).prompts
const actualPromptCount = goldenPrompts.length
for (const readme of ['README.md']) {
  const text = read(readme)
  const claims = [...text.matchAll(/pins (\d+) realistic requests/g), ...text.matchAll(/(\d+) gerçekçi isteği/g)]
  for (const m of claims) {
    const claimed = Number(m[1])
    if (claimed !== actualPromptCount) {
      errors.push(`${readme} claims ${claimed} golden prompts, eval/golden-prompts.json has ${actualPromptCount}`)
    }
  }
}

// --- 2. Node version consistent across every CI/template workflow file ---
function findYamlFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) findYamlFiles(rel, out)
    else if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) out.push(rel)
  }
}
const workflowFiles: string[] = []
// Guard, not assumption (round-31): a fixture CONSISTENCY_ROOT without
// .github/workflows used to crash the whole script with a raw ENOENT instead
// of no-opping like checks 6-11's documented fixture behavior.
if (existsSync(join(ROOT, '.github/workflows'))) findYamlFiles('.github/workflows', workflowFiles)

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
// .node-version and package.json's engines.node drift silently past this check the
// same way CI's test command did (see check 4 below) — they're not workflow YAML,
// so the loop above never sees them, and nothing else in the repo cross-checks a
// local dev pin or an npm-install-time floor against what CI actually runs. Found
// live in round-14 audit: .node-version pinned 22 while every workflow ran 24.
if (allVersions.size === 1 && existsSync(join(ROOT, '.node-version'))) {
  const pinned = read('.node-version').trim()
  const ciVersion = [...allVersions][0]
  if (pinned !== ciVersion) {
    errors.push(`.node-version is "${pinned}" but CI workflows pin node-version "${ciVersion}" — align local dev with CI`)
  }
}
if (allVersions.size === 1 && existsSync(join(ROOT, 'package.json'))) {
  const engineNode: string | undefined = JSON.parse(read('package.json')).engines?.node
  const ciVersion = [...allVersions][0]
  if (engineNode) {
    const floorMatch = engineNode.match(/(\d+)/)
    if (!floorMatch || floorMatch[1] !== ciVersion) {
      errors.push(`package.json engines.node is "${engineNode}" but CI workflows pin node-version "${ciVersion}" — align the engines floor with CI`)
    }
  }
}

// --- 3. Line budget on the files that load into EVERY session unconditionally ---
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
  // split('\n').length counts a trailing-newline terminator as one extra line
  // ('a\n' → 2), so a file at exactly the budget would false-fail (round-29 fix).
  const text = read(file)
  const lineCount = text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
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

// --- 4. CI's unit-test invocation === package.json's `test` script ---
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
// Same "silent-skip on anchor drift" class check 11 already guards against for
// its budget specs (round-24 finding): if every workflow file were renamed away
// from a "Run unit tests" step name, `ciWorkflowFile` above quietly becomes
// undefined and the whole comparison above never runs — a real CI/package.json
// drift could exist right after that rename and this check would report
// nothing rather than failing loudly.
if (pkgTestScript && workflowFiles.length > 0 && !ciWorkflowFile) {
  errors.push(
    `check-consistency.ts's CI-command drift check found no workflow file with a "Run unit tests" step (renamed?) — this check is silently disabled instead of comparing anything`
  )
}

// --- 5. README's "N/N tests passing" claim === the real npm-test pass count ---
// Found by hand (README claimed 96/96 while the suite had grown to 97/97) in a
// section whose entire premise is "every number is reproducible" — no guard
// caught it because check-links.ts/this file's other checks cover golden-prompt
// count, markdown-file count, and version drift, but not this claim. Only runs
// the suite (re-run rather than a cached result, the only way to get an actual
// current count) when a README actually makes this claim, so a fixture ROOT
// without a real test file to exec doesn't fail this check spuriously.
const claimPattern = /(\d+)\/(\d+)\s+(?:tests?\s+)?(?:passing|geçiyor)/gi
// Both halves of "N/M passing" are claims — round-31 found the denominator was
// never compared, so "1/999 passing" sailed through as long as the numerator
// matched. Carry both and check both below.
const testCountClaims = ['README.md'].flatMap(readme =>
  [...read(readme).matchAll(claimPattern)].map(m => ({ readme, text: m[0], claimed: Number(m[1]), claimedTotal: Number(m[2]) }))
)
// Suite-count claim lives in the same parenthetical as the pass-count claim
// above ("102/102 passing (25 suites — ...")) but is separate free-text the
// pass-count regex doesn't touch — found stale by hand (claimed 24, actual 25)
// because nothing checked it: this guard exists specifically to close that
// blind spot, not as a hypothetical.
const suiteClaimPattern = /\((\d+)\s+suites?\b/gi
const suiteCountClaims = ['README.md'].flatMap(readme =>
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
    for (const { readme, text, claimed, claimedTotal } of testCountClaims) {
      if (claimed !== actualPassCount || claimedTotal !== actualPassCount) {
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

// --- 6. SECURITY.md's "N Read/Bash/PowerShell deny rules" claim === actual count ---
// Found by hand the same way as check 5: the deny list grows every time a new
// secret pattern or bypass is closed, but the prose count in SECURITY.md is
// typed by hand and nothing re-derived it from settings-template.json itself.
// Guarded by existsSync (unlike the checks above, which assume their inputs
// exist): this test suite's CONSISTENCY_ROOT fixtures deliberately build only
// the handful of files each test needs, so settings-template.json/SECURITY.md
// are absent there by design — an unconditional read() would crash the whole
// script on every fixture-based test, not just fail check 6's own assertion.
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

// --- 7. .claude/settings.json's deny list is a superset of settings-template.json's ---
// Found by hand (round-14 audit): the kit's own dev config had drifted 35 rules
// behind the shipped template — specifically every base64/Get-Content secret-read
// rule — so the kit's own sessions were running with weaker protection than the
// template it tells consumers to install. `allow` is expected to diverge per-project
// (UPGRADE.md documents that), but `deny` never should: a rule added to the template
// closes a real bypass, and the kit's own settings.json should get it too. `allow` is
// expected to diverge per-project — the kit's own dev config may grant itself broader
// allow rules than the template ships — but `deny` never should. Superset, not
// exact-equality, so intentionally kit-specific deny rules (if any are ever added)
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

// --- 8. README's "İçerik" count table === actual counts on disk ---
// Found by a round-17 audit agent: check 5/6 re-derive README's test-count and
// SECURITY.md's deny-count claims from disk, but nothing re-derived this table
// (Agent/Skill/Rule/Komut/Preset/agent_docs) — it was hand-typed and only
// correct because prior rounds happened to hand-verify it, not because
// anything would fail if it drifted.
let readmeCountClaims: { label: string; claimed: number; actual: number }[] = []
if (existsSync(join(ROOT, 'README.md'))) {
  const dirCount = (dir: string, filter: (name: string) => boolean) =>
    existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir), { withFileTypes: true }).filter(e => filter(e.name)).length : 0
  const actualCounts: Record<string, number> = {
    Agent: dirCount('agents', n => n.endsWith('.md') && n !== 'ROUTING.md' && n !== 'README.md'),
    Skill: existsSync(join(ROOT, 'skills'))
      ? readdirSync(join(ROOT, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory()).length
      : 0,
    Rule: dirCount('rules', n => n.endsWith('.md')),
    Komut: dirCount('commands', n => n.endsWith('.md')),
    Preset: existsSync(join(ROOT, 'presets')) ? findPresetDirs(join(ROOT, 'presets')).length : 0,
    agent_docs: dirCount('agent_docs', n => n.endsWith('.md')),
  }
  // Whitespace-tolerant on purpose (round-29 fix): the old single-space pattern
  // (`^\| (Agent|…) \| (\d+) \|`) matched 0 rows the moment an editor's
  // format-table realigned the İçerik columns — and with 0 matches the loop
  // below compared nothing, silently disabling this check (the exact class
  // checks 4/10/11 already guard against loudly).
  const rowPattern = /^\|\s*(Agent|Skill|Rule|Komut|Preset|agent_docs)\s*\|\s*(\d+)\s*\|/gm
  const readmeText = read('README.md')
  readmeCountClaims = [...readmeText.matchAll(rowPattern)].map(m => ({
    label: m[1],
    claimed: Number(m[2]),
    actual: actualCounts[m[1]],
  }))
  // Guard-the-guard (same shape as check 4's "silently disabled" error): the
  // İçerik table's header row is the anchor — if it exists but no data row
  // parsed, the regex has drifted from the table format, not the table from disk.
  if (/^\|\s*\|\s*Sayı\s*\|/m.test(readmeText) && readmeCountClaims.length === 0) {
    errors.push(
      `check-consistency.ts's İçerik-table check found the table header in README.md but parsed 0 count rows — rowPattern no longer matches the table format, so this check is silently disabled instead of comparing anything`
    )
  }
  for (const { label, claimed, actual } of readmeCountClaims) {
    if (claimed !== actual) {
      errors.push(`README.md's İçerik table claims ${label} = ${claimed}, but disk has ${actual}`)
    }
  }
  // The same 5 numbers also appear as a second, unrelated syntactic form: the
  // intro paragraph's prose sentence ("12 agent, 25 skill, 11 rule, 2 komut,
  // 12 preset"). Found live in a round-18 audit: the table-row regex above
  // only ever matched the İçerik table, so this sentence could drift right
  // past check 8 with the table still correct — the guard closed one syntax,
  // not the underlying claim.
  const proseMatch = read('README.md').match(/(\d+) agent, (\d+) skill, (\d+) rule, (\d+) komut, (\d+) preset/)
  if (proseMatch) {
    const proseClaims: [string, number][] = [
      ['Agent', Number(proseMatch[1])],
      ['Skill', Number(proseMatch[2])],
      ['Rule', Number(proseMatch[3])],
      ['Komut', Number(proseMatch[4])],
      ['Preset', Number(proseMatch[5])],
    ]
    for (const [label, claimed] of proseClaims) {
      if (claimed !== actualCounts[label]) {
        errors.push(`README.md's intro prose claims ${label} = ${claimed}, but disk has ${actualCounts[label]}`)
      }
    }
  }
}

// --- 9. global-CLAUDE.md's "Lazy-load docs" prose list === actual agent_docs/*.md files ---
// Found the same way as check 8: check-links.ts only resolves real Markdown
// [text](path) syntax, and this list is plain pipe-separated prose naming
// agent_docs/*.md files by basename (no `.md`, no link syntax) — a renamed or
// deleted agent_docs file would desync from this list silently.
let lazyDocsListChecked = false
if (existsSync(join(ROOT, 'global-CLAUDE.md')) && existsSync(join(ROOT, 'agent_docs'))) {
  const globalClaude = read('global-CLAUDE.md')
  const sectionMatch = globalClaude.match(/Lazy-load docs[\s\S]*?:([\s\S]*?)(?:\n\n|\n---|\n##)/)
  if (sectionMatch) {
    lazyDocsListChecked = true
    const namedDocs = new Set(
      [...sectionMatch[1].matchAll(/([a-z][a-z0-9-]*)/g)]
        .map(m => m[1])
        .filter(name => !['agent_docs', 'read', 'on', 'demand', 'all', 'under'].includes(name))
    )
    const actualDocs = new Set(
      readdirSync(join(ROOT, 'agent_docs')).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
    )
    const missingFromDisk = [...namedDocs].filter(n => !actualDocs.has(n))
    const missingFromDoc = [...actualDocs].filter(n => !namedDocs.has(n))
    if (missingFromDisk.length > 0) {
      errors.push(`global-CLAUDE.md's Lazy-load docs list names doc(s) not in agent_docs/: ${missingFromDisk.join(', ')}`)
    }
    if (missingFromDoc.length > 0) {
      errors.push(`agent_docs/ has file(s) not named in global-CLAUDE.md's Lazy-load docs list: ${missingFromDoc.join(', ')}`)
    }
  }
}

// --- 9b. global-CLAUDE.md's RULES REFERENCE topics list === rules/*.md files on disk ---
// Found by a round-28 audit agent: check 9 derives the adjacent "Lazy-load docs"
// list from agent_docs/ on disk, but its section regex stops before the Topics
// list right above it — the exact same hand-maintained-mirror class, one
// paragraph away, was unguarded: a renamed/added/deleted rules/*.md file would
// desync this always-loaded prose silently. Same structure as check 9 (silent
// skip if the section anchor is absent, so minimal fixture roots don't trip it;
// the section itself is always-loaded prose whose wholesale disappearance would
// be caught by a human immediately, unlike a one-token drift).
let topicsListChecked = false
if (existsSync(join(ROOT, 'global-CLAUDE.md')) && existsSync(join(ROOT, 'rules'))) {
  const globalClaude = read('global-CLAUDE.md')
  const topicsSection = globalClaude.match(/## RULES REFERENCE([\s\S]*?)(?:\n## |$)/)
  if (topicsSection) {
    topicsListChecked = true
    const namedRules = new Set([...topicsSection[1].matchAll(/\b(\d{3}-[a-z][a-z-]*)\b/g)].map(m => m[1]))
    const actualRules = new Set(
      readdirSync(join(ROOT, 'rules')).filter(f => /^\d{3}-[a-z][a-z-]*\.md$/.test(f)).map(f => f.replace(/\.md$/, ''))
    )
    const topicsMissingFromDisk = [...namedRules].filter(n => !actualRules.has(n))
    const topicsMissingFromList = [...actualRules].filter(n => !namedRules.has(n))
    if (topicsMissingFromDisk.length > 0) {
      errors.push(`global-CLAUDE.md's RULES REFERENCE topics list names rule(s) not in rules/: ${topicsMissingFromDisk.join(', ')}`)
    }
    if (topicsMissingFromList.length > 0) {
      errors.push(`rules/ has file(s) not named in global-CLAUDE.md's RULES REFERENCE topics list: ${topicsMissingFromList.join(', ')}`)
    }
  }
}

// --- 10. (retired, round 30) 001-conventions.md's "Scope signals" table ---
// Rounds 19-21 built a two-directional sync check between that table and each rule's
// `paths:` frontmatter. Round 30 deleted the table itself — the frontmatter is the only
// copy now, so there is nothing left to drift. Number kept as a tombstone so later
// checks' "checks N already closed" cross-references stay accurate.

// --- 11. Cross-file performance-budget numbers === rules/900-performance.md (canonical) ---
// Found in round-20 audit: CWV budgets (LCP/CLS/INP) and bundle-size thresholds
// are hand-copied into rules/100-web.md and agent_docs/seo-patterns.md (CWV),
// and agent_docs/dep-check-guide.md (single-dependency size) — the same
// "hand-copied list, no single source of truth" class checks 8/9 already
// closed for README/global-CLAUDE.md. A real drift of this
// exact shape (motion tokens duplicated across rules/100-web.md and two
// agent_docs files) was found and hand-fixed in this same round, so this check
// exists to catch the next one instead of relying on an audit to notice by
// hand. rules/900-performance.md is treated as canonical since it's the file
// whose `paths:` frontmatter is broadest (any backend/frontend file); every
// mirror occurrence's captured number must match it exactly. Guarded by
// existsSync like checks 6-9 so fixture roots without these files no-op.
interface BudgetMirror {
  file: string
  regex: RegExp
}
interface BudgetSpec {
  name: string
  canonicalRegex: RegExp
  mirrors: BudgetMirror[]
}
const BUDGET_SPECS: BudgetSpec[] = [
  {
    name: 'LCP',
    canonicalRegex: /LCP[^\n]*?<\s*([\d.]+)s/,
    mirrors: [
      { file: 'rules/100-web.md', regex: /LCP[^\n]*?<\s*([\d.]+)s/g },
      { file: 'agent_docs/seo-patterns.md', regex: /LCP[^\n]*?<\s*([\d.]+)s/g },
    ],
  },
  {
    name: 'CLS',
    canonicalRegex: /CLS[^\n]*?<\s*([\d.]+)/,
    mirrors: [
      { file: 'rules/100-web.md', regex: /CLS[^\n]*?<\s*([\d.]+)/g },
      { file: 'agent_docs/seo-patterns.md', regex: /CLS[^\n]*?<\s*([\d.]+)/g },
    ],
  },
  {
    name: 'INP',
    canonicalRegex: /INP[^\n]*?<\s*([\d.]+)ms/,
    mirrors: [
      { file: 'rules/100-web.md', regex: /INP[^\n]*?<\s*([\d.]+)ms/g },
      { file: 'agent_docs/seo-patterns.md', regex: /INP[^\n]*?<\s*([\d.]+)ms/g },
    ],
  },
  {
    name: 'initial JS bundle size',
    canonicalRegex: /Initial JS bundle \(gzip\)[^\n]*?<\s*([\d.]+)\s*KB/,
    mirrors: [
      { file: 'rules/100-web.md', regex: /JS bundle \(gzip\)\s*\|\s*<\s*([\d.]+)\s*KB/g },
      { file: 'agent_docs/seo-patterns.md', regex: /First page load:\s*<\s*([\d.]+)\s*KB/g },
    ],
  },
  {
    name: 'per-route bundle chunk size',
    canonicalRegex: /Per-route extra chunk[^\n]*?<\s*([\d.]+)\s*KB/,
    mirrors: [{ file: 'rules/100-web.md', regex: /Per-route extra\s*\|\s*<\s*([\d.]+)\s*KB/g }],
  },
  {
    name: 'single-dependency size',
    canonicalRegex: /Single dependency added[^\n]*?<\s*([\d.]+)\s*KB/,
    mirrors: [{ file: 'agent_docs/dep-check-guide.md', regex: /adds\s*>\s*([\d.]+)\s*KB gzip to initial bundle/g }],
  },
]
if (existsSync(join(ROOT, 'rules/900-performance.md'))) {
  const canonicalText = read('rules/900-performance.md')
  for (const spec of BUDGET_SPECS) {
    const canonicalMatch = canonicalText.match(spec.canonicalRegex)
    if (!canonicalMatch) {
      // Round-20 finding: silently skipping here (as check 10 also used to)
      // means the anchor breaking — e.g. rules/900-performance.md's LCP line
      // gets reformatted — drops this spec's drift detection with no signal
      // at all. The whole point of this check is to catch drift; a check
      // that can silently stop checking is worse than no check.
      errors.push(
        `check-consistency.ts's ${spec.name} budget spec couldn't find its canonical value in rules/900-performance.md — the canonicalRegex no longer matches (file reformatted?), so this budget's drift detection is silently disabled`
      )
      continue
    }
    const canonicalValue = canonicalMatch[1]
    for (const mirror of spec.mirrors) {
      if (!existsSync(join(ROOT, mirror.file))) continue
      const mirrorText = read(mirror.file)
      for (const mirrorMatch of mirrorText.matchAll(mirror.regex)) {
        if (mirrorMatch[1] !== canonicalValue) {
          errors.push(
            `${mirror.file}'s ${spec.name} budget is "${mirrorMatch[1]}", but rules/900-performance.md (canonical) has "${canonicalValue}"`
          )
        }
      }
    }
  }

  // --- 11b. Unregistered mirror detector (round-24 finding) ---
  // BUDGET_SPECS' `mirrors` arrays are a hand-maintained list, same "no single
  // source of truth" class checks 8/9/10 already closed elsewhere — a new doc
  // that copies a CWV number is invisible to this file until someone remembers
  // to add it above. Scoped to LCP/CLS/INP only (their canonicalRegex requires
  // the metric name and a "< N unit" on the same line, which real prose like
  // "## INPUT VALIDATION" never satisfies — verified against every current
  // hit of these three substrings in rules/ and agent_docs/). Scans rules/,
  // agent_docs/, and presets/ for any file — other than the canonical file or
  // an already-registered mirror — that matches a spec's own canonical
  // pattern, and fails loudly instead of leaving it unchecked forever.
  function findMarkdownFiles(dir: string, out: string[]): void {
    if (!existsSync(join(ROOT, dir))) return
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) findMarkdownFiles(rel, out)
      else if (entry.name.endsWith('.md')) out.push(rel)
    }
  }
  const budgetScanFiles: string[] = []
  for (const dir of ['rules', 'agent_docs', 'presets']) findMarkdownFiles(dir, budgetScanFiles)
  for (const spec of BUDGET_SPECS) {
    if (!['LCP', 'CLS', 'INP'].includes(spec.name)) continue
    const registered = new Set(['rules/900-performance.md', ...spec.mirrors.map(m => m.file)])
    const detectionRegex = new RegExp(spec.canonicalRegex.source, spec.canonicalRegex.flags + 'g')
    for (const file of budgetScanFiles) {
      if (registered.has(file)) continue
      detectionRegex.lastIndex = 0
      if (detectionRegex.test(read(file))) {
        errors.push(
          `${file} states a ${spec.name} budget number but isn't registered in check-consistency.ts's BUDGET_SPECS mirrors — add it there so drift is actually checked (or rephrase if it's not meant to track the canonical value)`
        )
      }
    }
  }
}

// --- 12. run-checks.ts's CHECK_STEPS === the gate-worthy scripts in package.json ---
// Round-24 finding: CHECK_STEPS is a hand-maintained array, decoupled from
// package.json — the same "hand-copied list, no single source of truth" class
// checks 8/9/11b already closed for README/global-CLAUDE.md/
// budget mirrors. A new validator script added to package.json (or an existing
// CHECK_STEPS entry renamed there) can silently fall out of `npm run check`'s
// coverage with nothing to catch it. EXCLUDED_FROM_GATE documents the two
// scripts that intentionally sit outside CHECK_STEPS: 'check' is the gate
// itself (self-reference), and 'deny-cost' is a CLI reporting tool whose
// underlying logic is already exercised by deny-cost.test.ts inside the
// 'test' step — running it again standalone in the gate would just re-print
// the same numbers, not check anything new. Guarded on scripts/run-checks.ts
// existing (never true for CONSISTENCY_ROOT test fixtures, which don't create
// a scripts/ dir) so fixture roots with a deliberately minimal package.json
// aren't penalized for "missing" scripts they never intended to have.
if (existsSync(join(ROOT, 'scripts', 'run-checks.ts')) && existsSync(join(ROOT, 'package.json'))) {
  const EXCLUDED_FROM_GATE = ['check', 'deny-cost']
  const pkgScripts = Object.keys(JSON.parse(read('package.json')).scripts ?? {})
  const missingFromPkg = CHECK_STEPS.filter(step => !pkgScripts.includes(step))
  if (missingFromPkg.length > 0) {
    errors.push(
      `scripts/run-checks.ts's CHECK_STEPS references script(s) not in package.json: ${missingFromPkg.join(', ')} (renamed or removed?)`
    )
  }
  const missingFromGate = pkgScripts.filter(s => !CHECK_STEPS.includes(s) && !EXCLUDED_FROM_GATE.includes(s))
  if (missingFromGate.length > 0) {
    errors.push(
      `package.json has script(s) not covered by scripts/run-checks.ts's CHECK_STEPS and not in its documented exclusion list: ${missingFromGate.join(', ')} — add to CHECK_STEPS or to the exclusion list with a reason`
    )
  }
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} consistency drift issue(s) found:\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ Golden-prompt count claims match disk (${actualPromptCount}).`)
console.log(`✓ Node version consistent across ${workflowFiles.length} workflow file(s), .node-version, and package.json engines (${[...allVersions][0] ?? 'none pinned'}).`)
console.log(`✓ Always-loaded files (${alwaysLoadedFiles.join(', ')}) within the ${ALWAYS_LOADED_LINE_BUDGET}-line per-file budget (combined: ${alwaysLoadedTotal}/${ALWAYS_LOADED_COMBINED_BUDGET}).`)
if (ciWorkflowFile) console.log(`✓ CI unit-test command matches package.json's "test" script.`)
if (actualPassCount !== null) console.log(`✓ README test-count claims match \`${pkgTestScript}\` (${actualPassCount} passing).`)
if (actualSuiteCount !== null) console.log(`✓ README suite-count claims match \`${pkgTestScript}\` (${actualSuiteCount} suites).`)
if (denyCountClaims.length > 0) console.log(`✓ SECURITY.md deny-rule count claims match settings-template.json (${denyRuleCount ?? 0}).`)
if (existsSync(join(ROOT, '.claude/settings.json')) && existsSync(join(ROOT, 'settings-template.json'))) {
  console.log(`✓ .claude/settings.json's deny list has no gaps vs settings-template.json (drift: ${denyDriftCount}).`)
}
if (readmeCountClaims.length > 0) console.log(`✓ README İçerik table matches disk counts (${readmeCountClaims.length} rows checked).`)
// Gated on the section regex having actually matched, not just the files existing —
// otherwise a fixture root (or a renamed heading) printed ✓ with zero comparisons made.
if (lazyDocsListChecked) {
  console.log(`✓ global-CLAUDE.md's Lazy-load docs list matches agent_docs/ 1:1.`)
}
if (topicsListChecked) {
  console.log(`✓ global-CLAUDE.md's RULES REFERENCE topics list matches rules/*.md 1:1.`)
}
if (existsSync(join(ROOT, 'rules/900-performance.md'))) {
  console.log(`✓ Performance-budget numbers (LCP/CLS/INP/bundle sizes) match rules/900-performance.md across mirrors.`)
}
if (existsSync(join(ROOT, 'scripts', 'run-checks.ts'))) {
  console.log(`✓ run-checks.ts's CHECK_STEPS covers every gate-worthy package.json script (${CHECK_STEPS.length} steps).`)
}
process.exit(0)
