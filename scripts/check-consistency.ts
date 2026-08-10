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
import { parseArgs, resolveComponents } from './lib/install-core.mjs'
import { CHECK_STEPS } from './run-checks.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.CONSISTENCY_ROOT ?? join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const errors: string[] = []

// Every count claim below is made twice — once in the canonical English
// README.md and once in its Turkish translation README.tr.md. Checking only
// one of them would let the other rot into a document that confidently states
// numbers the repo hasn't had for months, which is worse than no translation.
const READMES = ['README.md', 'README.tr.md'].filter(f => existsSync(join(ROOT, f)))

// --- 1. golden-prompts.json count === README's stated prompt count ---
const goldenPrompts = JSON.parse(read('eval/golden-prompts.json')).prompts
const actualPromptCount = goldenPrompts.length
for (const readme of READMES) {
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

// The installer has its own, lower Node floor (see check 2c): it runs on a new
// user's Node, not on the Node 24 the TypeScript validators need. That floor is
// pinned by exactly one CI job, so it is excluded here rather than counted as
// drift — otherwise adding the job that PROVES the README's claim would fail
// the check that guards it.
const pkgJsonForNode = existsSync(join(ROOT, 'package.json')) ? JSON.parse(read('package.json')) : {}
const installerNodeFloor: string | undefined = pkgJsonForNode.seniorDevKit?.installerNodeFloor
const nodeVersionsByFile = new Map<string, Set<string>>()
for (const file of workflowFiles) {
  const text = read(file)
  const versions = new Set(
    [...text.matchAll(/node-version:\s*['"]?(\d+)/g)].map(m => m[1]).filter(v => v !== installerNodeFloor)
  )
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

// --- 2c. The installer's Node floor is one value, claimed once, proven in CI ---
// "Requires Node.js 18+" was the one load-bearing claim in this repo with
// nothing behind it: CI only ever ran Node 24, `engines.node` said >=24, and
// the floor existed as prose in two READMEs and a comment. A user on Node 18
// following the README was running an untested path. The floor is now declared
// once in package.json; this check binds every restatement of it to that value
// and refuses to let the CI job that proves it disappear.
if (installerNodeFloor !== undefined) {
  if (!/^\d+$/.test(installerNodeFloor)) {
    errors.push(`package.json seniorDevKit.installerNodeFloor is "${installerNodeFloor}" — expected a bare major version like "18"`)
  }
  // A floor equal to the CI version would make the exemption in check 2 strip
  // every node-version in the repo, silently disabling that check instead of
  // narrowing it.
  const ciVersions = new Set([...nodeVersionsByFile.values()].flatMap(s => [...s]))
  if (ciVersions.size === 0 && workflowFiles.length > 0) {
    errors.push(
      `every node-version in .github/workflows equals seniorDevKit.installerNodeFloor "${installerNodeFloor}", ` +
        `which leaves check 2 with nothing to compare — drop the floor declaration or raise the toolchain pin`
    )
  }

  // The job that turns the claim into a fact. Named by what it does, not by its
  // job id, so renaming the job is fine and deleting it is not.
  const proofJob = workflowFiles.find(f => {
    const text = read(f)
    return text.includes('scripts/install.mjs') && new RegExp(`node-version:\\s*['"]?${installerNodeFloor}\\b`).test(text)
  })
  if (workflowFiles.length > 0 && !proofJob) {
    errors.push(
      `no CI job pins node-version "${installerNodeFloor}" and runs scripts/install.mjs — ` +
        `the documented installer floor would go back to being an untested claim`
    )
  }

  // Both READMEs state it in prose ("Node.js 18+" / "Node.js 18+ gerekir").
  for (const readme of READMES) {
    const claims = [...read(readme).matchAll(/Node\.js\s+(\d+)\+/g)].map(m => m[1])
    if (claims.length === 0) {
      errors.push(`${readme} states no "Node.js N+" requirement for the installer`)
    }
    for (const claimed of claims) {
      if (claimed !== installerNodeFloor) {
        errors.push(`${readme} claims "Node.js ${claimed}+" but seniorDevKit.installerNodeFloor is "${installerNodeFloor}"`)
      }
    }
  }

  // …and so does the module that has to keep honouring it. Its header explains
  // why the installer is plain JavaScript; the reason is the floor.
  const installCorePath = 'scripts/lib/install-core.mjs'
  if (existsSync(join(ROOT, installCorePath))) {
    const header = read(installCorePath).slice(0, 2000)
    if (!new RegExp(`\\(${installerNodeFloor}\\+\\)`).test(header)) {
      errors.push(
        `${installCorePath}'s header does not mention the "(${installerNodeFloor}+)" floor — ` +
          `it is the file that explains why the installer avoids newer syntax`
      )
    }
  }

  // CONTRIBUTING states the contributor toolchain floor, which is engines.node,
  // not this one. Two different numbers a page apart is exactly how the wrong
  // one gets copied.
  if (existsSync(join(ROOT, 'CONTRIBUTING.md'))) {
    const engineFloor = String(pkgJsonForNode.engines?.node ?? '').match(/(\d+)/)?.[1]
    const stated = [...read('CONTRIBUTING.md').matchAll(/Node\.js\s+(\d+)\+/g)].map(m => m[1])
    for (const claimed of stated) {
      if (engineFloor && claimed !== engineFloor) {
        errors.push(`CONTRIBUTING.md claims "Node.js ${claimed}+" but package.json engines.node is "${pkgJsonForNode.engines?.node}"`)
      }
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
const testCountClaims = READMES.flatMap(readme =>
  [...read(readme).matchAll(claimPattern)].map(m => ({ readme, text: m[0], claimed: Number(m[1]), claimedTotal: Number(m[2]) }))
)
// Suite-count claim lives in the same parenthetical as the pass-count claim
// above ("102/102 passing (25 suites — ...")) but is separate free-text the
// pass-count regex doesn't touch — found stale by hand (claimed 24, actual 25)
// because nothing checked it: this guard exists specifically to close that
// blind spot, not as a hypothetical.
const suiteClaimPattern = /\((\d+)\s+suites?\b/gi
const suiteCountClaims = READMES.flatMap(readme =>
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

// --- 8. Each README's component count table === actual counts on disk ---
// Found by a round-17 audit agent: check 5/6 re-derive README's test-count and
// SECURITY.md's deny-count claims from disk, but nothing re-derived this table
// (Agent/Skill/Rule/Command/Preset/agent_docs) — it was hand-typed and only
// correct because prior rounds happened to hand-verify it, not because
// anything would fail if it drifted. Runs over the English README and its
// Turkish translation, which use different row labels ("Command"/"Komut") and
// a different header word ("Count"/"Sayı") for the same numbers.
const dirCount = (dir: string, filter: (name: string) => boolean) =>
  existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir), { withFileTypes: true }).filter(e => filter(e.name)).length : 0
const actualCounts: Record<string, number> = {
  Agent: dirCount('agents', n => n.endsWith('.md') && n !== 'ROUTING.md' && n !== 'README.md'),
  Skill: existsSync(join(ROOT, 'skills'))
    ? readdirSync(join(ROOT, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory()).length
    : 0,
  Rule: dirCount('rules', n => n.endsWith('.md')),
  Command: dirCount('commands', n => n.endsWith('.md')),
  Preset: existsSync(join(ROOT, 'presets')) ? findPresetDirs(join(ROOT, 'presets')).length : 0,
  agent_docs: dirCount('agent_docs', n => n.endsWith('.md')),
}
// The Turkish table labels its command row "Komut"; both spellings count the
// same directory, so normalize before comparing rather than duplicating the
// actual-count map per language.
const LABEL_ALIASES: Record<string, string> = { Komut: 'Command' }
let readmeCountClaims: { readme: string; label: string; claimed: number; actual: number }[] = []
for (const readme of READMES) {
  const readmeText = read(readme)
  // Whitespace-tolerant on purpose (round-29 fix): the old single-space pattern
  // (`^\| (Agent|…) \| (\d+) \|`) matched 0 rows the moment an editor's
  // format-table realigned the columns — and with 0 matches the loop
  // below compared nothing, silently disabling this check (the exact class
  // checks 4/10/11 already guard against loudly).
  const rowPattern = /^\|\s*(Agent|Skill|Rule|Command|Komut|Preset|agent_docs)\s*\|\s*(\d+)\s*\|/gm
  const claims = [...readmeText.matchAll(rowPattern)].map(m => {
    const label = LABEL_ALIASES[m[1]] ?? m[1]
    return { readme, label, claimed: Number(m[2]), actual: actualCounts[label] }
  })
  readmeCountClaims = [...readmeCountClaims, ...claims]
  // Guard-the-guard (same shape as check 4's "silently disabled" error): the
  // table's header row is the anchor — if it exists but no data row parsed,
  // the regex has drifted from the table format, not the table from disk.
  const hasHeader = /^\|\s*\|\s*(Sayı|Count)\s*\|/m.test(readmeText)
  if (hasHeader && claims.length === 0) {
    errors.push(
      `check-consistency.ts's count-table check found the table header in ${readme} but parsed 0 count rows — rowPattern no longer matches the table format, so this check is silently disabled instead of comparing anything`
    )
  }
  for (const { label, claimed, actual } of claims) {
    if (claimed !== actual) {
      errors.push(`${readme}'s count table claims ${label} = ${claimed}, but disk has ${actual}`)
    }
  }
  // The same 5 numbers also appear as a second, unrelated syntactic form: the
  // summary sentence ("7 agents, 25 skills, 11 rules, 3 commands, 9 presets").
  // Found live in a round-18 audit: the table-row regex above only ever
  // matched the table, so this sentence could drift right past check 8 with
  // the table still correct — the guard closed one syntax, not the underlying
  // claim. The `s`-less alternative is the Turkish spelling; the two patterns
  // are mutually exclusive by construction (`agent,` vs `agents,`).
  const proseMatch =
    readmeText.match(/(\d+) agents, (\d+) skills, (\d+) rules, (\d+) commands, (\d+) presets/) ??
    readmeText.match(/(\d+) agent, (\d+) skill, (\d+) rule, (\d+) komut, (\d+) preset/)
  if (hasHeader && !proseMatch) {
    errors.push(
      `${readme} has a component count table but no summary sentence for check-consistency.ts to cross-check it against — restore the "N agents, N skills, …" line or this second syntax goes unguarded`
    )
  }
  if (proseMatch) {
    const proseClaims: [string, number][] = [
      ['Agent', Number(proseMatch[1])],
      ['Skill', Number(proseMatch[2])],
      ['Rule', Number(proseMatch[3])],
      ['Command', Number(proseMatch[4])],
      ['Preset', Number(proseMatch[5])],
    ]
    for (const [label, claimed] of proseClaims) {
      if (claimed !== actualCounts[label]) {
        errors.push(`${readme}'s summary sentence claims ${label} = ${claimed}, but disk has ${actualCounts[label]}`)
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
  // `|$` is load-bearing, not defensive padding. Without it this check was
  // dead: the Lazy-load list is the last paragraph in global-CLAUDE.md, so
  // there is no trailing `\n\n`, `\n---` or `\n##` to close the section, the
  // match failed, and the whole check skipped in silence — for however long
  // that list has been last in the file. Found in the 2026-08 pre-release
  // audit by noticing its ✓ line missing from a passing run, which is exactly
  // the "silently disabled" failure the guard below now makes impossible.
  const sectionMatch = globalClaude.match(/Lazy-load docs[\s\S]*?:([\s\S]*?)(?:\n\n|\n---|\n##|$)/)
  // Guard-the-guard, same shape as checks 4/8/11: the heading is the anchor.
  // If it is present but the section did not parse, the regex has drifted from
  // the prose and this check is off, not passing.
  if (!sectionMatch && globalClaude.includes('Lazy-load docs')) {
    errors.push(
      `check-consistency.ts found "Lazy-load docs" in global-CLAUDE.md but could not parse the list after it — the section regex has drifted, so the agent_docs cross-check is silently disabled instead of comparing anything`
    )
  }
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
  // 'check' is the gate itself; 'deny-cost' is a reporting CLI already exercised
  // by deny-cost.test.ts inside 'test'; 'setup' is the end-user installer, which
  // writes to ~/.claude and must never run as part of a validation gate — its
  // logic is covered by install.test.mjs, also inside 'test'.
  // 'check-release' is excluded for a different reason than the other three: it
  // needs the network and asserts a property of the *published* repository
  // rather than of this working tree, so a fork or an offline contributor would
  // fail it through no fault of their own. It is a pre-announcement step.
  const EXCLUDED_FROM_GATE = ['check', 'deny-cost', 'setup', 'check-release']
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

  // 12b. The gate's step list is also spelled out in prose, twice: CONTRIBUTING
  // tells a contributor what will run, and CLAUDE.md tells the assistant. Both
  // were hand-typed. Adding the `audit` step meant editing three places, which
  // is the moment this drift is introduced, not the moment it is noticed.
  const proseLists: { file: string; re: RegExp }[] = [
    { file: 'CONTRIBUTING.md', re: /This runs, in order: ([^.]+)\./ },
    { file: 'CLAUDE.md', re: /— runs ([a-z-]+(?:,\s*[a-z-]+)+)/ },
  ]
  for (const { file, re } of proseLists) {
    if (!existsSync(join(ROOT, file))) continue
    const m = read(file).match(re)
    if (!m) {
      errors.push(`${file} no longer states the gate's step order where check 12b reads it — restore the sentence or drop the pattern deliberately`)
      continue
    }
    const listed = [...m[1].matchAll(/[a-z][a-z-]*/g)].map(x => x[0]).filter(s => s !== 'and')
    if (listed.join(' ') !== CHECK_STEPS.join(' ')) {
      errors.push(
        `${file} lists the gate steps as [${listed.join(', ')}] but run-checks.ts runs [${CHECK_STEPS.join(', ')}]`
      )
    }
  }
}

// --- 13. Kit-internal path references in agents/skills/commands resolve -----
// Two failure modes, one scan, neither previously guarded:
//
//   (a) A dangling reference. Agents and skills point at deep documentation
//       with plain backticked paths (`agent_docs/error-handling-patterns.md`),
//       not Markdown links — so check-links.ts, which only resolves real
//       [text](path) syntax, has never seen them. Check 9 pins the *set* of
//       agent_docs files against global-CLAUDE.md's list, which catches a
//       rename, but a typo in one of the ~30 references in agent bodies would
//       ship silently and only surface as Claude failing to find a file
//       mid-task, on a user's machine.
//
//   (b) A path that only resolves in one install mode. `~/.claude/agent_docs/…`
//       is correct for a copy install and dead for a plugin install, where the
//       kit lives in the plugin cache. global-CLAUDE.md's KIT ROOT rule exists
//       precisely so these are written install-mode-agnostically; nothing
//       stopped the absolute form from creeping back in.
const KIT_REF_DIRS = ['agents', 'skills', 'commands']
let kitRefsChecked = 0
function collectMarkdown(dir: string, out: string[]): void {
  if (!existsSync(join(ROOT, dir))) return
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) collectMarkdown(rel, out)
    else if (entry.name.endsWith('.md')) out.push(rel)
  }
}
const kitRefFiles: string[] = []
for (const dir of KIT_REF_DIRS) collectMarkdown(dir, kitRefFiles)
for (const file of kitRefFiles) {
  const text = read(file)
  // Only inside backticks: prose like "the agent_docs/ directory" and this
  // very comment's wording must not be mistaken for a file reference.
  for (const m of text.matchAll(/`(agent_docs\/[a-z0-9-]+\.md|rules\/\d{3}-[a-z-]+\.md)`/g)) {
    kitRefsChecked++
    if (!existsSync(join(ROOT, m[1]))) {
      errors.push(`${file} references \`${m[1]}\`, which does not exist on disk`)
    }
  }
  // `rules` is deliberately absent from this list. `~/.claude/rules/` is the
  // one kit directory whose absolute path is legitimately load-bearing: it is
  // the settings location Claude Code auto-loads path-scoped rules from, and
  // the reason kit-setup exists at all. kit-doctor and kit-setup both have to
  // name it as an install *target*, which is the opposite of the dead
  // *content* reference this check is looking for, and the two are not
  // distinguishable syntactically. Rules are never meant to be read by path
  // anyway (global-CLAUDE.md: "Never manually Read a rule file"), so a stale
  // rules path costs a wrong sentence, not a failed lookup.
  for (const m of text.matchAll(/~\/\.claude\/(agent_docs|agents|skills|commands)\//g)) {
    errors.push(
      `${file} hardcodes "${m[0]}" — that path is dead in a plugin install. Write it relative to KIT ROOT ` +
        `(see global-CLAUDE.md's KIT ROOT rule) so both install modes resolve it.`
    )
  }
}

// --- 13b. global-CLAUDE.md's stack count === rows in stack-commands.md ------
// Always-loaded prose promises "18 stacks" of exact build commands. The table
// it points at is edited independently, and the number is hand-typed — the
// same class as checks 8/9. Cheap to derive: count the table's data rows.
let stackRowCount: number | null = null
if (existsSync(join(ROOT, 'global-CLAUDE.md')) && existsSync(join(ROOT, 'agent_docs/stack-commands.md'))) {
  const claim = read('global-CLAUDE.md').match(/\((\d+) stacks/)
  if (claim) {
    const table = read('agent_docs/stack-commands.md')
    // Data rows only: a leading `|`, and not the header or the `| --- |` divider.
    stackRowCount = table
      .split('\n')
      .filter(l => /^\|/.test(l) && !/^\|\s*-{3}/.test(l) && !/^\|\s*Stack\s*\|/.test(l)).length
    if (Number(claim[1]) !== stackRowCount) {
      errors.push(
        `global-CLAUDE.md claims "${claim[1]} stacks" but agent_docs/stack-commands.md has ${stackRowCount} rows`
      )
    }
  }
}

// --- 14. Every github.com/<owner>/<repo> reference names the same repo ------
// The slug is hand-typed in ~19 places across two manifests, two READMEs,
// package.json, SECURITY.md, the CHANGELOG and two issue templates — the same
// "hand-copied value, no single source of truth" class checks 8/9/11b/12
// already close for counts, doc lists, budgets and gate steps. Getting one
// wrong is not cosmetic here: the README's `/plugin marketplace add <slug>`
// line and the marketplace entry's source are how a stranger installs the kit,
// and a stale slug after a rename or transfer sends them to a 404 with no
// signal on this side. package.json's repository.url is treated as canonical
// because npm, GitHub's UI and Dependabot all already read it.
let repoSlug: string | null = null
let slugRefCount = 0
if (existsSync(join(ROOT, 'package.json'))) {
  const repoUrl: string = JSON.parse(read('package.json')).repository?.url ?? ''
  const canonical = repoUrl.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)
  if (canonical) {
    repoSlug = canonical[1]
    const slugFiles = [
      'README.md', 'README.tr.md', 'SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md', 'package.json', '.claude-plugin/plugin.json',
      '.claude-plugin/marketplace.json', '.github/ISSUE_TEMPLATE/config.yml',
    ].filter(f => existsSync(join(ROOT, f)))
    for (const file of slugFiles) {
      // Greedy `[\w.-]+` twice, then trim, rather than a lookahead listing the
      // characters a URL may end on: the lookahead form silently matched
      // nothing when a link was closed by a backtick, which is how the kit's
      // own install command is written. A check that skips the one line it
      // most needs to guard is worse than no check.
      const [canonOwner, canonName] = repoSlug.split('/')
      for (const m of read(file).matchAll(/github\.com\/([\w.-]+\/[\w.-]+)/g)) {
        const slug = m[1].replace(/\.git$/, '').replace(/\.+$/, '')
        const [owner, name] = slug.split('/')
        // A link is "about this repo" when it shares either half of the slug.
        // That catches both rename shapes — the owner changed (transfer) or the
        // repo name changed — while leaving genuine third-party links alone
        // (Anthropic docs, pinned actions, tool homepages share neither half).
        // Owner-or-name rather than exact-prefix: requiring the owner to match
        // would make the check blind to exactly the transfer it exists to catch.
        if (owner !== canonOwner && name !== canonName) continue
        slugRefCount++
        if (slug !== repoSlug) {
          errors.push(
            `${file} links to github.com/${slug} but package.json's repository.url says this repo is ${repoSlug} — one of them is stale`
          )
        }
      }
    }
  } else if (repoUrl) {
    errors.push(`package.json repository.url ("${repoUrl}") is not a parseable github.com URL — the slug cross-check is disabled`)
  }
}

// --- 15. Everything the docs tell a user to TYPE actually exists ------------
// Checks 1-14 all guard numbers. The other half of what these documents assert
// is executable — `npm run <script>`, `node scripts/install.mjs --<flag>`,
// `/slash-command` — and none of it was verified by anything. Renaming a script,
// a flag or a skill leaves the docs confidently instructing a stranger to run a
// command that errors out, which is a worse first five minutes than a wrong
// count. Scoped by glob to the documents that describe THIS repo: preset and
// rule files also contain `npm run …`, but those describe the user's project.
// Excluded for the same structural reason `presets/*/CLAUDE.md` never enters
// this list: it is a template dropped into someone else's empty repo, so its
// `npm run …` lines and its `/team-bootstrap` reference describe the project it
// generates, not this one.
const TEMPLATE_DOCS = new Set(['PROJECT-BOOTSTRAP.md'])
const REPO_DOC_GLOBS: string[] = [
  ...readdirSync(ROOT).filter(f => f.endsWith('.md') && !TEMPLATE_DOCS.has(f)),
  ...(existsSync(join(ROOT, 'presets/README.md')) ? ['presets/README.md'] : []),
  ...(existsSync(join(ROOT, 'skills'))
    ? readdirSync(join(ROOT, 'skills'))
        .filter(d => d.startsWith('kit-') && existsSync(join(ROOT, 'skills', d, 'SKILL.md')))
        .map(d => `skills/${d}/SKILL.md`)
    : []),
  ...(existsSync(join(ROOT, 'commands'))
    ? readdirSync(join(ROOT, 'commands')).filter(f => f.endsWith('.md')).map(f => `commands/${f}`)
    : []),
]

let executableClaimCount = 0
if (existsSync(join(ROOT, 'package.json'))) {
  const pkgScripts: Record<string, string> = JSON.parse(read('package.json')).scripts ?? {}
  for (const file of REPO_DOC_GLOBS) {
    for (const m of read(file).matchAll(/npm run ([a-z][\w-]*)/g)) {
      executableClaimCount++
      if (!(m[1] in pkgScripts)) {
        errors.push(`${file} tells the reader to run \`npm run ${m[1]}\`, which is not a script in package.json`)
      }
    }
  }
}

// Installer flags and --only components, checked against the parser itself
// rather than a second list — the failure this closes is a renamed flag whose
// old name survives in four documents and one skill.
const installerDocs = REPO_DOC_GLOBS.filter(f => read(f).includes('install.mjs'))
for (const file of installerDocs) {
  for (const line of read(file).split('\n')) {
    if (!line.includes('install.mjs')) continue
    for (const flag of line.match(/--[a-z][a-z-]*/g) ?? []) {
      executableClaimCount++
      if (parseArgs([flag]).unknown.length > 0) {
        errors.push(`${file} passes \`${flag}\` to scripts/install.mjs, which the installer rejects as unknown`)
      }
    }
    const only = line.match(/--only[= ]([a-z][\w,-]*)/)
    if (only) {
      const { invalid } = resolveComponents(only[1].split(',').filter(Boolean))
      if (invalid.length > 0) {
        errors.push(`${file} passes \`--only ${only[1]}\` but ${invalid.join(', ')} is not an installer component`)
      }
    }
  }
}
// The reverse direction: a flag the parser accepts but `--help` never mentions
// is undiscoverable, which is how `--target` shipped unmentioned for a release.
if (existsSync(join(ROOT, 'scripts/install.mjs')) && existsSync(join(ROOT, 'scripts/lib/install-core.mjs'))) {
  const usageText = read('scripts/install.mjs').match(/function usage\(\)[\s\S]*?\n}/)?.[0] ?? ''
  const parserFlags = (read('scripts/lib/install-core.mjs').match(/arg === '(--[a-z-]+)'/g) ?? []).map(m =>
    m.replace(/^arg === '/, '').replace(/'$/, '')
  )
  for (const flag of new Set(parserFlags)) {
    if (!usageText.includes(flag)) {
      errors.push(`scripts/install.mjs accepts \`${flag}\` but its --help output never mentions it`)
    }
  }
}

// Slash commands named in the docs must resolve to a skill or a command file.
// Claude Code's own built-ins are listed explicitly: they are the only names
// that legitimately resolve to nothing in this repo, and spelling them out is
// what keeps the check from degenerating into "ignore anything unrecognised".
const CLAUDE_CODE_BUILTIN_COMMANDS = new Set([
  'plugin', 'reload-plugins', 'compact', 'clear', 'config', 'effort', 'mcp', 'agents', 'help',
  'init', 'review', 'model', 'memory', 'doctor', 'permissions', 'context', 'cost',
])
if (existsSync(join(ROOT, 'skills')) && existsSync(join(ROOT, 'commands'))) {
  const installable = new Set([
    ...readdirSync(join(ROOT, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name),
    ...readdirSync(join(ROOT, 'commands')).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')),
  ])
  // The SessionStart hook tells plugin users to run a specific command when the
  // path-scoped rules are missing. It is the one place a renamed skill breaks
  // silently in code rather than in prose, so it is scanned alongside the docs.
  const slashScanFiles = [...REPO_DOC_GLOBS, 'scripts/session-context.mjs'].filter(f =>
    existsSync(join(ROOT, f))
  )
  for (const file of slashScanFiles) {
    // Backticked only: prose like "and/or" or a path fragment is not a command.
    for (const m of read(file).matchAll(/`\/([a-z][a-z0-9-]*)`/g)) {
      const name = m[1]
      if (CLAUDE_CODE_BUILTIN_COMMANDS.has(name)) continue
      executableClaimCount++
      if (!installable.has(name)) {
        errors.push(`${file} references \`/${name}\`, which is neither a skill in skills/ nor a file in commands/`)
      }
    }
  }
}

// --- 16. Budget numbers quoted in prose === the constants that enforce them --
// The same class as checks 5/6/8, one layer deeper: the caps themselves. Skill
// bodies (20), agent bodies (150), compact.md (7-15) and the always-loaded
// budgets (250/500) are enforced by three different scripts and then restated
// by hand in README.md, README.tr.md, CONTRIBUTING.md, CLAUDE.md and
// presets/README.md. Raising a cap in the validator and leaving five documents
// quoting the old one is not hypothetical — it is what happened to the suite
// count, the deny-rule count and the golden-prompt count before each got a
// check. Gated on the real repo's shape so fixture roots skip it wholesale.
if (existsSync(join(ROOT, 'CONTRIBUTING.md')) && existsSync(join(ROOT, 'scripts/lib/presets.ts'))) {
  const constFrom = (file: string, name: string): number | null => {
    if (!existsSync(join(ROOT, file))) return null
    const m = read(file).match(new RegExp(`const ${name}\\s*=\\s*(\\d+)`))
    if (!m) {
      errors.push(`check-consistency.ts cannot find \`${name}\` in ${file} — the prose cross-check for that budget is comparing nothing`)
      return null
    }
    return Number(m[1])
  }
  const skillBody = constFrom('scripts/lib/validate-skills.ts', 'SKILL_BODY_MAX_LINES')
  const agentBody = constFrom('scripts/lib/validate-agents.ts', 'AGENT_BODY_MAX_LINES')
  const compactMin = constFrom('scripts/lib/presets.ts', 'COMPACT_MIN_LINES')
  const compactMax = constFrom('scripts/lib/presets.ts', 'COMPACT_MAX_LINES')
  const perFile = ALWAYS_LOADED_LINE_BUDGET
  const combined = ALWAYS_LOADED_COMBINED_BUDGET
  const ruleCount = actualCounts.Rule
  const docCount = actualCounts.agent_docs
  const skillCount = actualCounts.Skill

  // Each entry is one sentence, in one file, that quotes numbers owned
  // elsewhere. A pattern that stops matching is reported rather than ignored:
  // a silently-unmatched claim is indistinguishable from a verified one, which
  // is the failure mode checks 4, 8 and 10 each had to be rescued from.
  const claims: { file: string; re: RegExp; expected: (number | null)[]; what: string }[] = [
    { file: 'README.md', re: /capped at (\d+) lines/g, expected: [combined], what: 'always-loaded combined budget' },
    { file: 'README.tr.md', re: /\((\d+) satır üst sınır/g, expected: [combined], what: 'always-loaded combined budget' },
    { file: 'README.md', re: /(\d+) rule files, (\d+) reference docs/g, expected: [ruleCount, docCount], what: 'rule + agent_docs counts in prose' },
    { file: 'README.tr.md', re: /(\d+) rule dosyası, (\d+) referans doküman/g, expected: [ruleCount, docCount], what: 'rule + agent_docs counts in prose' },
    { file: 'README.md', re: /improvising\. (\d+) of them/g, expected: [skillCount], what: 'skill count in prose' },
    { file: 'README.tr.md', re: /Toplam (\d+) tane/g, expected: [skillCount], what: 'skill count in prose' },
    { file: 'CONTRIBUTING.md', re: /Skill bodies are capped at (\d+) lines\*\* and agent bodies at (\d+)/g, expected: [skillBody, agentBody], what: 'skill/agent body caps' },
    { file: 'CONTRIBUTING.md', re: /compact\.md` \((\d+)[–-](\d+) lines\)/g, expected: [compactMin, compactMax], what: 'compact.md line range' },
    { file: 'CONTRIBUTING.md', re: /budget of (\d+) lines each and (\d+) combined/g, expected: [perFile, combined], what: 'always-loaded budgets' },
    { file: 'CLAUDE.md', re: /compact\.md` \((\d+)-(\d+) line summary/g, expected: [compactMin, compactMax], what: 'compact.md line range' },
    { file: 'CLAUDE.md', re: /agent bodies \((\d+) lines\), skill bodies \((\d+) lines\)/g, expected: [agentBody, skillBody], what: 'agent/skill body caps' },
    { file: 'CLAUDE.md', re: /\((\d+) lines\/file, (\d+) combined/g, expected: [perFile, combined], what: 'always-loaded budgets' },
    { file: 'presets/README.md', re: /(\d+)-(\d+) line summary/g, expected: [compactMin, compactMax], what: 'compact.md line range' },
  ]
  for (const { file, re, expected, what } of claims) {
    if (!existsSync(join(ROOT, file))) continue
    const matches = [...read(file).matchAll(re)]
    if (matches.length === 0) {
      errors.push(
        `${file} no longer contains the sentence stating the ${what} that check 16 verifies — restore it, or drop the pattern from check-consistency.ts deliberately rather than leaving a check that matches nothing`
      )
      continue
    }
    for (const m of matches) {
      expected.forEach((want, i) => {
        if (want === null) return
        if (Number(m[i + 1]) !== want) {
          errors.push(`${file} states ${what} as ${m[i + 1]}, but the enforced value is ${want}`)
        }
      })
    }
  }
}

// --- 17. .gitignore really does mirror the PROTECTED FILES list -------------
// `.gitignore` says in a comment that it "mirrors rules/000-security.md's
// PROTECTED FILES list". It did not: `serviceAccountKey.json`, `secrets/`,
// `config/credentials.json` and `config/secrets.json` were absent, and
// `*serviceaccount*.json` does not cover the camelCase filename on a
// case-sensitive filesystem. A hand-copied mirror with a comment asserting it
// is a mirror is the same class as every count claim these checks already
// derive — except the failure mode here is a credential file that `git add -A`
// happily stages in a repo whose CI runs gitleaks.
const PROTECTED_NOT_SECRETS = new Set(['*.lock', 'node_modules/', 'dist/', '.next/'])
if (existsSync(join(ROOT, 'rules/000-security.md')) && existsSync(join(ROOT, '.gitignore'))) {
  const section = read('rules/000-security.md').match(/## PROTECTED FILES[^\n]*\n([\s\S]*?)(?:\n## |$)/)
  if (!section) {
    errors.push('rules/000-security.md has no "## PROTECTED FILES" section — check 17 is comparing nothing')
  } else {
    // Only the ` · `-separated pattern lines, not the prose paragraph that
    // closes the section — that paragraph backticks `SECURITY.md`, and reading
    // it as a pattern demanded a .gitignore entry for the repo's own policy doc.
    const patternLine = /^(?:`[^`\n]+`)(?:\s*·\s*`[^`\n]+`)*$/
    const patterns = section[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => patternLine.test(l))
      .flatMap(l => [...l.matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim()))
      .filter(p => !PROTECTED_NOT_SECRETS.has(p))
    if (patterns.length === 0) {
      errors.push('check 17 parsed 0 patterns out of the PROTECTED FILES section — the list format changed')
    }
    const ignored = new Set(
      read('.gitignore')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l !== '' && !l.startsWith('#'))
    )
    for (const pattern of patterns) {
      if (!ignored.has(pattern)) {
        errors.push(
          `.gitignore claims to mirror rules/000-security.md's PROTECTED FILES but has no entry for \`${pattern}\` — ` +
            `that file would be staged by \`git add -A\``
        )
      }
    }
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
if (readmeCountClaims.length > 0) {
  console.log(`✓ README count tables match disk (${readmeCountClaims.length} rows across ${READMES.length} file(s)).`)
}
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
if (installerNodeFloor !== undefined) {
  console.log(`✓ Installer Node floor "${installerNodeFloor}" stated once, claimed consistently, and exercised by a CI job.`)
}
if (existsSync(join(ROOT, 'CONTRIBUTING.md')) && existsSync(join(ROOT, 'scripts/lib/presets.ts'))) {
  console.log(`✓ Budget numbers quoted in prose (skill/agent body, compact.md range, always-loaded) match the constants that enforce them.`)
}
if (existsSync(join(ROOT, 'rules/000-security.md')) && existsSync(join(ROOT, '.gitignore'))) {
  console.log(`✓ .gitignore covers every secret pattern in rules/000-security.md's PROTECTED FILES list.`)
}
if (executableClaimCount > 0) {
  console.log(`✓ Every documented command, installer flag and slash command resolves (${executableClaimCount} checked across ${REPO_DOC_GLOBS.length} document(s) plus the SessionStart hook).`)
}
if (kitRefFiles.length > 0) {
  console.log(
    `✓ ${kitRefsChecked} kit-internal path reference(s) across ${kitRefFiles.length} agent/skill/command file(s) resolve and are install-mode agnostic.`
  )
}
if (stackRowCount !== null) console.log(`✓ global-CLAUDE.md's stack count matches stack-commands.md (${stackRowCount}).`)
if (repoSlug) console.log(`✓ ${slugRefCount} GitHub link(s) all point at ${repoSlug} (package.json canonical).`)
process.exit(0)
