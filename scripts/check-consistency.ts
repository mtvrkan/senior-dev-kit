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
import { execSync, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { findPresetDirs, KNOWN_TOOLS, RETIRABLE_APIS } from './lib/presets.ts'
import { pathGlobToRegExp } from './deny-cost.ts'
import {
  componentCounts, denyRuleCount as deriveDenyRuleCount,
  ALWAYS_LOADED_FILES as alwaysLoadedFiles,
  ALWAYS_LOADED_LINE_BUDGET,
  ALWAYS_LOADED_COMBINED_BUDGET,
  TRIGGER_TEXT_BUDGET_CHARS,
  TRIGGER_TEXT_COMBINED_BUDGET_CHARS,
  triggerText,
  lineCount as countLines,
} from './lib/counts.ts'
import { parseArgs, resolveComponents, COMPONENTS } from './lib/install-core.mjs'
import { CHECK_STEPS } from './run-checks.ts'
import { AB_SUITE_FILES, evalContextDigest } from './lib/eval-context.ts'

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
// The file list, both budgets and the line-counting rule now live in lib/counts.ts,
// because the landing page quotes the same numbers — one derivation, two readers, the
// same argument that moved the component counts there in round 39.
let alwaysLoadedTotal = 0
for (const file of alwaysLoadedFiles) {
  const lineCount = countLines(read(file))
  alwaysLoadedTotal += lineCount
  if (lineCount > ALWAYS_LOADED_LINE_BUDGET) {
    errors.push(`${file} is ${lineCount} lines, over the ${ALWAYS_LOADED_LINE_BUDGET}-line always-loaded budget — trim or move a section to agent_docs/`)
  }
}
// The per-file caps above each pass independently even as every file creeps
// toward its own ceiling — three files at 249 lines each would pass every
// per-file check while costing 747 lines every session. A combined cap catches
// the real per-session tax the per-file checks can't see by construction.
if (alwaysLoadedTotal > ALWAYS_LOADED_COMBINED_BUDGET) {
  errors.push(
    `${alwaysLoadedFiles.join(' + ')} total ${alwaysLoadedTotal} lines, over the ${ALWAYS_LOADED_COMBINED_BUDGET}-line combined always-loaded budget (each passes its own 250-line cap, but the sum is what every session actually pays) — trim the file with the most slack`
  )
}

// --- 4. CI's unit-test invocation === package.json's `test` script ---
// CI used to hard-code its own `node --test <every file>` command instead of
// calling `npm test`, so the two could drift silently — a stale file reference
// there doesn't fail `npm run check` locally, only CI, and only on the next
// push. (Found live twice: once when the job kept naming a deleted test file,
// and again when adding `rule-globs.test.ts` pushed the copied command past
// yamllint's 200-character line limit and broke the YAML Lint job.)
//
// The copy is now gone — CI runs `npm test`, which cannot drift from the script
// it invokes — so this check's job is to keep it that way. A delegating form is
// accepted; anything else must still match the script character for character,
// which is what a re-introduced copy would have to do.
const CI_DELEGATING_FORMS = new Set(['npm test', 'npm run test', 'npm t'])
const pkgTestScript = JSON.parse(read('package.json')).scripts?.test ?? ''
const ciWorkflowFile = workflowFiles.find(f => read(f).includes('Run unit tests'))
if (pkgTestScript && ciWorkflowFile) {
  const ciText = read(ciWorkflowFile)
  const runMatch = ciText.match(/Run unit tests\s*\n\s*run:\s*(.+)/)
  const ciCommand = runMatch?.[1]?.trim()
  if (ciCommand && !CI_DELEGATING_FORMS.has(ciCommand) && ciCommand !== pkgTestScript) {
    errors.push(
      `${ciWorkflowFile}'s "Run unit tests" step ("${ciCommand}") != package.json's "test" script ("${pkgTestScript}") — one references a file/flag the other doesn't. Prefer \`npm test\`, which cannot drift at all`
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
// Scanned across every shipped prose document, not only the READMEs (2026-08 review): the
// stale claim that prompted the widening was "the other 341 tests" inside a console string in
// `routing-eval.ts`, which no check could see. Scripts are excluded here on purpose — this
// file's own explanatory comments quote example claims ("1/999 passing") and
// `validate-skills.test.ts` carries fixtures, so scanning code would grade prose about the
// check as if it were a claim by the check. The rule for scripts is the stricter one instead:
// they state no suite size at all, since anything they print is unverifiable by construction.
const COUNT_CLAIM_DOCS = [
  ...readdirSync(ROOT).filter(f => f.endsWith('.md')),
  ...(existsSync(join(ROOT, 'docs')) ? readdirSync(join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => `docs/${f}`) : []),
]
// Both halves of "N/M passing" are claims — round-31 found the denominator was
// never compared, so "1/999 passing" sailed through as long as the numerator
// matched. Carry both and check both below.
const testCountClaims = COUNT_CLAIM_DOCS.flatMap(readme =>
  [...read(readme).matchAll(claimPattern)].map(m => ({ readme, text: m[0], claimed: Number(m[1]), claimedTotal: Number(m[2]) }))
)
// Suite-count claim lives in the same parenthetical as the pass-count claim
// above ("102/102 passing (25 suites — ...")) but is separate free-text the
// pass-count regex doesn't touch — found stale by hand (claimed 24, actual 25)
// because nothing checked it: this guard exists specifically to close that
// blind spot, not as a hypothetical.
const suiteClaimPattern = /\((\d+)\s+suites?\b/gi
const suiteCountClaims = COUNT_CLAIM_DOCS.flatMap(readme =>
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
  denyRuleCount = deriveDenyRuleCount(ROOT)
  // The tool list inside the claim is not pinned: round 45 added `Write`/`Edit` rules and the
  // old literal `Read/Bash/PowerShell` pattern would have matched nothing — leaving the count
  // unverified while printing a pass, which is worse than the drift it was written to catch.
  // What IS pinned is the shape: a bolded number followed by tool names and "deny rules".
  const denyCountPattern = /\*\*(\d+) (?:[A-Za-z]+\/)+[A-Za-z]+ deny rules\*\*/g
  denyCountClaims = [...read('SECURITY.md').matchAll(denyCountPattern)].map(m => ({
    text: m[0],
    claimed: Number(m[1]),
  }))
  // Same guard as checks 16/22: a pattern that stops matching must fail loudly. Silence here
  // is indistinguishable from a verified claim, and this is the number the whole document is about.
  if (denyCountClaims.length === 0) {
    errors.push(
      'SECURITY.md no longer states a "**N <tools> deny rules**" claim in the shape check 6 verifies — restore it, or ' +
        'retire the check deliberately rather than leaving the deny-rule count unguarded'
    )
  }
  for (const { text, claimed } of denyCountClaims) {
    if (claimed !== denyRuleCount) {
      errors.push(`SECURITY.md claims "${text}" but settings-template.json actually has ${denyRuleCount} deny rules`)
    }
  }
}

// --- 7. .claude/settings.json IS settings-template.json, byte for byte ----------
// Originally (round-14) a superset test: the kit's own dev config had drifted 35
// rules behind the shipped template — every base64/Get-Content secret-read rule —
// so the kit's own sessions ran with weaker protection than the template it tells
// consumers to install. The superset framing fixed that hole and left a smaller one
// open, found in the 2026-08 review: set-difference is blind to ORDER, so the two
// files could hold the same 412 rules in two different sequences (they did, from
// index 57 on) with nothing to notice. That is a small defect on its own, but it
// falsifies the kit's own load-bearing claim that every duplicated fact is bound by
// a script — a reader who checks that claim here finds a hand-maintained copy.
//
// Closed at the class rather than at the ordering: the repo copy is not "kept in
// sync with" the template, it IS the template. Byte-identity is the only comparison
// that leaves nothing unbound — key order, formatting, `$schema`, future top-level
// keys and rule order all travel together, and no future field can be added to one
// file and silently forgotten in the other. The superset test could not have said
// that about anything except `permissions.deny`.
//
// The kit deliberately has no project-local `allow` rules to protect: both files are
// `$schema` + `permissions.deny` only. If the kit ever does need a dev-only allow
// list, put it in `.claude/settings.local.json` (already git-ignored as a session
// artifact) rather than reopening divergence here.
if (existsSync(join(ROOT, '.claude/settings.json')) && existsSync(join(ROOT, 'settings-template.json'))) {
  const local = read('.claude/settings.json')
  const template = read('settings-template.json')
  if (local !== template) {
    const localDeny: string[] = JSON.parse(local).permissions?.deny ?? []
    const templateDeny: string[] = JSON.parse(template).permissions?.deny ?? []
    const missing = templateDeny.filter(rule => !localDeny.includes(rule))
    const extra = localDeny.filter(rule => !templateDeny.includes(rule))
    // Name the failure precisely — a missing rule is a security gap, a reordering is
    // bookkeeping, and the fix differs in urgency even though the command is the same.
    const detail =
      missing.length > 0
        ? `it is missing ${missing.length} deny rule(s) the template ships, so the kit's own sessions are under-protected relative to what it publishes: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`
        : extra.length > 0
          ? `it carries ${extra.length} deny rule(s) the template does not: ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? ', …' : ''}`
          : 'the rule sets match but the files differ in rule order or formatting'
    errors.push(
      `.claude/settings.json is not byte-identical to settings-template.json — ${detail}. ` +
        'The repo copy is a dogfooding mirror with no independent content; regenerate it with ' +
        '`node -e "require(\'fs\').copyFileSync(\'settings-template.json\', \'.claude/settings.json\')"` ' +
        'and make the edit in settings-template.json, which is the single source.'
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
// Round-39: the derivation moved to `lib/counts.ts` when the landing page became a second
// consumer of these numbers. This check is unchanged — it still compares the READMEs' claims
// against disk; it just no longer owns the only copy of "how the kit counts itself".
const actualCounts: Record<string, number> = { ...componentCounts(ROOT) }
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
      // SSR-framework presets restate the budget next to their image guidance, where a reader
      // is actually deciding whether to set width/height. Registered so they drift red.
      { file: 'presets/web/nuxt/compact.md', regex: /CLS[^\n]*?<\s*([\d.]+)/g },
      { file: 'presets/web/sveltekit/compact.md', regex: /CLS[^\n]*?<\s*([\d.]+)/g },
      { file: 'presets/web/astro/compact.md', regex: /CLS[^\n]*?<\s*([\d.]+)/g },
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
  // 'gen-docs' writes docs/reference.md, so it is a generator, not a check —
  // its read-only twin 'docs-check' is what sits in the gate and fails when the
  // generated page and the frontmatter it comes from disagree. 'gen-site' is
  // excluded for exactly that reason too: it writes site/dist/, and 'site-check'
  // is the twin in the gate.
  // 'gen-og' is a generator like those two, but excluded for a second, harder reason:
  // it rasterises with headless Chrome. The gate has to pass on a machine with Node and
  // nothing else, so a step needing a browser installed would fail contributors who
  // have done nothing wrong. Its outputs are committed instead, and regenerated by hand
  // when the mark, the palette or the card's wording changes.
  // 'site-check' left the gate with the templates it validates: the landing page source
  // lives on the `site-src` branch so that installing the kit does not also download a
  // website. It runs in `.github/workflows/site.yml`, which checks out both branches —
  // and so does check 28 below, which is why that check reports when it scanned nothing.
  const EXCLUDED_FROM_GATE = ['check', 'deny-cost', 'setup', 'check-release', 'gen-docs', 'gen-site', 'gen-og', 'site-check']
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
// Round-34: this originally checked global-CLAUDE.md alone, so when the table grew from 18 to 24
// rows the identical claim in rules/300-testing.md stayed at 18 and the gate stayed green.
// Every file that repeats the number is checked now, derived from a glob rather than a list.
const STACK_CLAIMANTS = ['global-CLAUDE.md', 'rules/300-testing.md']
if (existsSync(join(ROOT, 'agent_docs/stack-commands.md'))) {
  const table = read('agent_docs/stack-commands.md')
  // Data rows only: a leading `|`, and not the header or the `| --- |` divider.
  stackRowCount = table
    .split('\n')
    .filter(l => /^\|/.test(l) && !/^\|\s*-{3}/.test(l) && !/^\|\s*Stack\s*\|/.test(l)).length
  for (const file of STACK_CLAIMANTS) {
    if (!existsSync(join(ROOT, file))) continue
    const claim = read(file).match(/\((\d+) stacks/)
    if (claim && Number(claim[1]) !== stackRowCount) {
      errors.push(
        `${file} claims "${claim[1]} stacks" but agent_docs/stack-commands.md has ${stackRowCount} rows`
      )
    }
  }
  // A claimant that stops stating the number silently drops out of this check — catch that too.
  const stating = STACK_CLAIMANTS.filter(f => existsSync(join(ROOT, f)) && /\(\d+ stacks/.test(read(f)))
  if (stating.length === 0) {
    errors.push(
      'no file states a "(N stacks" count any more — check 13b is silently disabled; either restore a claim or remove the check'
    )
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
  // docs/ is where a stranger actually looks up a command to type, so it needs
  // the executable-claim check more than the root-level files do, not less.
  ...(existsSync(join(ROOT, 'docs'))
    ? readdirSync(join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => `docs/${f}`)
    : []),
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
    { file: 'CONTRIBUTING.md', re: /(\d+) chars each and (\d+) combined/g, expected: [TRIGGER_TEXT_BUDGET_CHARS, TRIGGER_TEXT_COMBINED_BUDGET_CHARS], what: 'trigger-text budgets' },
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

// --- 18. Preset NAME lists === the preset directories on disk ---------------
// Check 8 derives the preset COUNT from disk, so 9 → 28 could not drift. The
// names next to it could: they live in three hand-maintained lists (both
// READMEs' table cell and presets/README.md's "Shipped stacks" paragraph), and
// a preset renamed or added without touching them left the gate green while
// the docs advertised a directory that no longer exists. Same class as check
// 13b — deriving one number and leaving the adjacent list hand-typed.
//
// The README cell abbreviates two category directories; the alias map is the
// whole reason this can't be a plain string compare.
const PRESET_CATEGORY_ALIASES: Record<string, string> = { db: 'database', infra: 'infrastructure' }
let presetNameListsChecked = 0
if (existsSync(join(ROOT, 'presets'))) {
  const onDisk = new Set(findPresetDirs(join(ROOT, 'presets')).map(p => p.relPath))
  const compare = (source: string, claimed: Set<string>) => {
    if (claimed.size === 0) {
      errors.push(
        `check 18 parsed 0 preset names out of ${source} — the list format changed and this check is silently comparing nothing`
      )
      return
    }
    presetNameListsChecked++
    for (const name of claimed) {
      if (!onDisk.has(name)) errors.push(`${source} lists preset \`${name}\`, which is not a directory under presets/`)
    }
    for (const name of onDisk) {
      if (!claimed.has(name)) errors.push(`presets/${name} exists on disk but ${source} never names it`)
    }
  }

  for (const readme of READMES) {
    if (!existsSync(join(ROOT, readme))) continue
    // Row shape: `| Preset | 28 | web: nextjs-saas, react-vite · backend: … |`
    const cell = read(readme).match(/^\|\s*Preset\s*\|\s*\d+\s*\|([^\n]*)\|/m)
    if (!cell) continue
    const claimed = new Set<string>()
    for (const group of cell[1].matchAll(/([a-z_]+):\s*([^·|]+)/g)) {
      const category = PRESET_CATEGORY_ALIASES[group[1]] ?? group[1]
      for (const name of group[2].split(',')) {
        const trimmed = name.trim()
        if (trimmed !== '') claimed.add(`${category}/${trimmed}`)
      }
    }
    compare(`${readme}'s preset table row`, claimed)
  }

  if (existsSync(join(ROOT, 'presets/README.md'))) {
    // Paragraph shape: ``Shipped stacks: `web/nextjs-saas`, `web/react-vite`, …``
    // Ends at the blank line — later paragraphs backtick `generic/fallback` as
    // advice, and folding those in would make the check compare a superset.
    const section = read('presets/README.md').match(/Shipped stacks:([\s\S]*?)\n\n/)
    if (section) {
      const claimed = new Set(
        [...section[1].matchAll(/`([a-z-]+\/[a-z0-9-]+)`/g)].map(m => m[1])
      )
      compare('presets/README.md\'s "Shipped stacks" list', claimed)
    } else {
      errors.push('presets/README.md has no "Shipped stacks:" paragraph — check 18 cannot verify its preset list')
    }
  }
}

// --- 19. Every code-stack preset has a row in stack-commands.md -------------
// Check 13b derives the "(N stacks" claim from the table's row COUNT, so the number can't drift
// — but nothing tied the rows to the presets. The angular and astro presets shipped with no row
// at all while 13b stayed green, which means BOOT SEQUENCE sent a reader to a canonical table
// that had no answer for the stack they were in. Same class as 13b/18: one fact derived, the
// adjacent one left to hand discipline.
//
// The mapping can't be a name compare (`go-api` → `Go`, `swiftui` → `iOS/Swift`), so it is
// explicit. That is the point: adding a preset under web/, backend/ or mobile/ now fails this
// check until you either add a table row or state which existing row covers it. Presets under
// orm/, database/, infrastructure/ and generic/ are deliberately out of scope — they are layers
// inside a stack, not stacks with their own test/lint/build commands.
const STACK_PRESET_CATEGORIES = ['web', 'backend', 'mobile']
const STACK_ROW_FOR_PRESET: Record<string, string> = {
  'web/nextjs-saas': 'Next.js/TS',
  'web/react-vite': 'Vite+React',
  'web/nuxt': 'Nuxt 3',
  'web/sveltekit': 'SvelteKit',
  'web/angular': 'Angular',
  'web/astro': 'Astro',
  'backend/node-express': 'Node/Bun',
  'backend/nestjs': 'NestJS',
  'backend/fastapi': 'FastAPI',
  'backend/django': 'Django',
  'backend/laravel': 'Laravel',
  'backend/rails': 'Rails',
  'backend/spring-boot': 'Spring Boot (Maven)',
  'backend/dotnet': '.NET',
  'backend/go-api': 'Go',
  'backend/rust-axum': 'Rust',
  'mobile/flutter': 'Flutter',
  'mobile/react-native': 'React Native/Expo',
  'mobile/swiftui': 'iOS/Swift',
}
let stackPresetsChecked = 0
if (existsSync(join(ROOT, 'presets')) && existsSync(join(ROOT, 'agent_docs/stack-commands.md'))) {
  const rowNames = new Set(
    read('agent_docs/stack-commands.md')
      .split('\n')
      .filter(l => /^\|/.test(l) && !/^\|\s*-{3}/.test(l) && !/^\|\s*Stack\s*\|/.test(l))
      .map(l => l.split('|')[1]?.trim() ?? '')
      .filter(n => n !== '')
  )
  const stackPresets = findPresetDirs(join(ROOT, 'presets'))
    .map(p => p.relPath)
    .filter(rel => STACK_PRESET_CATEGORIES.includes(rel.split('/')[0]))
  for (const rel of stackPresets) {
    const row = STACK_ROW_FOR_PRESET[rel]
    if (row === undefined) {
      errors.push(
        `presets/${rel} is a code stack with no entry in check 19's STACK_ROW_FOR_PRESET — add a row to agent_docs/stack-commands.md and map it, or map it to the existing row that covers it`
      )
    } else if (!rowNames.has(row)) {
      errors.push(
        `presets/${rel} maps to stack-commands.md row "${row}", which no longer exists in the table`
      )
    } else {
      stackPresetsChecked++
    }
  }
  for (const rel of Object.keys(STACK_ROW_FOR_PRESET)) {
    if (!stackPresets.includes(rel)) {
      errors.push(`check 19 maps preset \`${rel}\` to a stack-commands.md row, but that preset no longer exists`)
    }
  }
}

// --- 20. kit-doctor's COUNT step names every directory the installer copies --
// kit-doctor exists to catch a truncated install, so the one list it must not
// get wrong is which directories a full install contains. That list was typed
// by hand, and when `presets` became a component the skill was not touched:
// the diagnostic silently checked 5 of 6 directories, so an install missing all
// 28 presets reported healthy. Deriving it from COMPONENTS means adding the
// next component fails here instead of quietly narrowing the diagnostic.
//
// "Directory-shaped" is resolved against disk rather than a second hand-typed
// allowlist — `protocol` and `deny-rules` are file/JSON merges with no directory
// of their own, and that distinction is already visible in the repo layout.
let doctorComponentsChecked = 0
if (existsSync(join(ROOT, 'skills/kit-doctor/SKILL.md'))) {
  const doctor = read('skills/kit-doctor/SKILL.md')
  const countStep = doctor.match(/^2\. COUNT:[^\n]*/m)
  if (!countStep) {
    errors.push('skills/kit-doctor/SKILL.md has no "2. COUNT:" step — check 20 cannot verify its component list')
  } else {
    const dirComponents = COMPONENTS.filter(c => existsSync(join(ROOT, c)))
    for (const component of dirComponents) {
      // Matched as `component/` so a passing mention in prose ("presets are
      // copied too") can't satisfy the check the way a listed directory does.
      if (!countStep[0].includes(`${component}/`)) {
        errors.push(
          `kit-doctor's COUNT step never names \`${component}/\`, which install-core.mjs's COMPONENTS copies — ` +
            `a truncated install missing it would be reported healthy`
        )
      } else {
        doctorComponentsChecked++
      }
    }
  }
}

// --- 21. kit-doctor states no deny-rule floor of its own --------------------
// The floor used to be written into the skill as a literal (`≥190`) beside a
// pointer to SECURITY.md's exact count. Two copies, one of them not covered by
// check 6, so it drifted to less than half the real number — a deny list
// truncated by 50% still passed as healthy. The fix is that the skill now has
// no number at all; this check keeps it that way.
if (existsSync(join(ROOT, 'skills/kit-doctor/SKILL.md'))) {
  const settingsStep = read('skills/kit-doctor/SKILL.md').match(/^3\. SETTINGS:[^\n]*/m)
  if (settingsStep && /[≥>]=?\s*\d+|\d+\s+rules/.test(settingsStep[0])) {
    errors.push(
      `kit-doctor's SETTINGS step hardcodes a deny-rule count — it must read the number from SECURITY.md, ` +
        `which check 6 pins to settings-template.json; a literal here is a second copy that goes stale`
    )
  }
}

// --- 23. YAML files obey the line limit CI's yamllint job enforces ----------
// The YAML Lint job is the one gate step with no local counterpart: `npm run check` has no
// yamllint (a Python tool this repo otherwise doesn't need), so a YAML defect is invisible until
// the push. It caught a real one — adding `rule-globs.test.ts` to the copied `node --test …`
// command in the workflow pushed that line to 221 characters and the job failed on a change that
// passed the full local gate.
//
// Rather than add a Python dependency, this reproduces the single rule that fails the job at
// error level (line-length; document-start and truthy are warnings, which yamllint exits 0 on).
// Both the limit and the directory are READ OUT OF the workflow's own `config_data`, so raising
// `max:` there raises it here too and the two cannot disagree — the point of the check is that
// the local gate tracks CI's configuration, not a second copy of the number.
// Keyed on the yamllint job's own presence, not on the unit-test job's: a repo with no YAML Lint
// job has nothing to mirror and must not fail here, while a repo that HAS one but whose config
// this can no longer parse must fail loudly rather than skip.
let yamlLinesChecked = 0
const yamlLintWorkflow = workflowFiles.find(f => read(f).includes('yamllint'))
if (yamlLintWorkflow) {
  const ciText = read(yamlLintWorkflow)
  const maxMatch = ciText.match(/line-length:\s*\n\s*max:\s*(\d+)/)
  const dirMatch = ciText.match(/file_or_dir:\s*(\S+)/)
  if (!maxMatch || !dirMatch) {
    errors.push(
      `check 23 could not read yamllint's \`line-length: max\` and \`file_or_dir\` out of ${yamlLintWorkflow} — ` +
        `the YAML Lint job's config changed shape, so the local guard is comparing nothing`
    )
  } else {
    const maxLen = Number(maxMatch[1])
    const yamlDir = join(ROOT, dirMatch[1])
    if (existsSync(yamlDir)) {
      const files = readdirSync(yamlDir, { recursive: true, encoding: 'utf8' })
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      for (const rel of files) {
        const lines = readFileSync(join(yamlDir, rel), 'utf8').split('\n')
        lines.forEach((line, i) => {
          if (line.length > maxLen) {
            errors.push(
              `${dirMatch[1]}${rel.replace(/\\/g, '/')}:${i + 1} is ${line.length} characters, over yamllint's ${maxLen}-character limit — ` +
                `CI's YAML Lint job fails on this, and it is the one gate step with no local equivalent`
            )
          }
        })
        yamlLinesChecked += lines.length
      }
    }
  }
}

// --- 22b. Every data-layer preset is detectable by BOOT SEQUENCE step 4 -----
// Check 19's exact shape, one layer over: a preset is only worth shipping if the boot sequence
// can tell it is the stack in front of it. Step 1 (manifest) was extended for Gradle, csproj,
// Composer, Bundler and pyproject when the preset set grew 9 → 28; step 4 (ORM) was not, so it
// still listed only the JS/TS four. A Rails repo boots with DB+ORM unknown because its migration
// directory is `db/migrate`, not `migrations` — and Flyway's `db/migration` is the same singular-
// directory trap this round already fixed for `rules/500-database.md`'s globs, unfixed one level
// up. Detection is what raises the data layer to Tier 3, so missing it loses the escalation.
//
// Mandatory for orm/ and database/ only: those preset categories exist *because* the data layer
// was detected. A backend/web preset whose framework carries a distinct migration layout is
// listed here too and checked identically, but a new one does not fail the gate — its stack is
// already reachable through step 1's manifest and check 19's table row.
const DATA_PRESET_CATEGORIES = ['orm', 'database']
const BOOT_SIGNAL_FOR_PRESET: Record<string, string> = {
  'orm/prisma': '*.prisma',
  'orm/drizzle': 'drizzle.config.*',
  'database/supabase': 'supabase/config.toml',
  'database/postgres': 'migrations/',
  'database/mongodb': 'mongoose',
  // Not mandatory (see above), but these are the layouts the presets themselves document, and
  // each one was invisible to step 4 before this check existed.
  'backend/rails': 'migrate/',
  'backend/spring-boot': 'migration/',
  'backend/dotnet': '*DbContext.cs',
  'backend/fastapi': 'alembic.ini',
}
let bootSignalsChecked = 0
if (existsSync(join(ROOT, 'presets')) && existsSync(join(ROOT, 'global-CLAUDE.md'))) {
  const step4 = read('global-CLAUDE.md').match(/^4\. ORM[^\n]*(?:\n(?!\d\.|\n)[^\n]*)*/m)
  if (!step4) {
    errors.push('global-CLAUDE.md BOOT SEQUENCE has no step 4 ("4. ORM…") — check 22b is comparing nothing')
  } else {
    const presetPaths = findPresetDirs(join(ROOT, 'presets')).map(p => p.relPath)
    const dataPresets = presetPaths.filter(rel => DATA_PRESET_CATEGORIES.includes(rel.split('/')[0]))
    for (const rel of dataPresets) {
      if (BOOT_SIGNAL_FOR_PRESET[rel] === undefined) {
        errors.push(
          `presets/${rel} is a data-layer preset with no entry in check 22b's BOOT_SIGNAL_FOR_PRESET — ` +
            `name the file or directory that identifies it in global-CLAUDE.md's BOOT SEQUENCE step 4 and map it here, ` +
            `or the boot sequence ships a preset it cannot detect`
        )
      }
    }
    for (const [rel, signal] of Object.entries(BOOT_SIGNAL_FOR_PRESET)) {
      if (!presetPaths.includes(rel)) {
        errors.push(`check 22b maps preset \`${rel}\` to a BOOT SEQUENCE signal, but that preset no longer exists`)
      } else if (!step4[0].includes(signal)) {
        errors.push(
          `presets/${rel} is detected by \`${signal}\`, which BOOT SEQUENCE step 4 does not name — ` +
            `a project on that stack boots with DB+ORM unknown, so its schema work never reaches Tier 3`
        )
      } else {
        bootSignalsChecked++
      }
    }
  }
}

// --- 22. Every PROTECTED FILES pattern has a Read(...) deny rule ------------
// `rules/000-security.md` says these files are "never read"; `settings-template.json` is the
// only thing that enforces it. Nothing tied the two lists together, so they could disagree by
// construction — and did: the kit shipped a terraform preset stating in bold that state holds
// every provider-returned password in plaintext, while `*.tfstate` appeared in neither the
// PROTECTED FILES list nor the deny list. Check 17 already binds PROTECTED FILES → `.gitignore`
// (don't COMMIT it); this binds PROTECTED FILES → deny rules (don't READ it), closing the other
// half of the same promise.
//
// Round 45 — the heading says "never read, MODIFY, or reference", and for four rounds this
// check asserted only the read half while the deny list held 61 `Read(...)` rules and no
// write-side rule at all. A check written to bind a promise to its enforcement, enforcing half
// of it, is the shape round 39 named: a partial digest reads as full coverage, so the gate went
// green on a promise the kit was keeping halfway. The rule file now answers which patterns:
// the credential block is never legitimately written, the second block (`.env`, lockfiles,
// build output) legitimately is, and each is graded against the tools that apply to it rather
// than against a list hand-copied into this file.
//
// `Edit(...)` only, and this one is measured rather than assumed. The first attempt shipped
// `Write(...)` rules alongside `Edit(...)` ones, on the reasonable-looking theory that the two
// tools need separate rules the way `Bash(...)` and `PowerShell(...)` do. Claude Code answered
// directly, once per rule, on the next session start: "Write(~/.pgpass) is not matched by file
// permission checks — only Edit(path) rules are. Use Edit(~/.pgpass) instead (Edit rules cover
// all file-editing tools)." So 33 `Write(...)` rules were inert *and* printed a warning banner
// every session. They are gone. This is the same class of claim as the Assumption note in
// SECURITY.md — someone else's matcher, not this repo's code — except it arrived as an explicit
// upstream diagnostic instead of a differential session, which is better evidence than the kit
// has for anything else in that note.
//
// One direction only, deliberately. The reverse (every Read rule must appear in PROTECTED FILES)
// would fail on every `~/…` home-directory rule — the deny list protects the developer's whole
// machine, PROTECTED FILES describes files inside the project being worked on. They are supersets
// in one direction, not mirrors.
//
// The companion Bash/PowerShell read-verb rules are NOT re-derived here: the symmetry test in
// `scripts/validate-skills.test.ts` already derives them from these same Read(...) rules, so a
// pattern that lands here inherits that coverage automatically.
let protectedPatternsChecked = 0
let credentialWritesChecked = 0
if (existsSync(join(ROOT, 'rules/000-security.md')) && existsSync(join(ROOT, 'settings-template.json'))) {
  const section = read('rules/000-security.md').match(/## PROTECTED FILES[^\n]*\n([\s\S]*?)(?:\n## |$)/)
  if (!section) {
    errors.push('rules/000-security.md has no "## PROTECTED FILES" section — check 22 is comparing nothing')
  } else {
    // Same pattern-line shape check 17 uses: only the ` · `-separated backtick lines, never the
    // prose that closes the section (which backticks `*.tfvars` precisely to say it is excluded).
    const patternLine = /^(?:`[^`\n]+`)(?:\s*·\s*`[^`\n]+`)*$/
    const sectionLines = section[1].split('\n').map(l => l.trim())
    // The rule file's own two-block structure is the source of the write policy — the credential
    // block is "never written", the block after it is not. Tracked by walking the section in
    // order and flipping at the second bold label, so moving a pattern between blocks in the rule
    // file moves its enforcement here with no second list to update.
    const CREDENTIAL_LABEL = '**Credential material'
    const WRITABLE_LABEL = '**Read-denied only'
    const patterns: { glob: string; credential: boolean }[] = []
    let inCredentialBlock = false
    let sawBothLabels = 0
    for (const line of sectionLines) {
      if (line.startsWith(CREDENTIAL_LABEL)) { inCredentialBlock = true; sawBothLabels++; continue }
      if (line.startsWith(WRITABLE_LABEL)) { inCredentialBlock = false; sawBothLabels++; continue }
      if (!patternLine.test(line)) continue
      for (const m of line.matchAll(/`([^`\n]+)`/g)) patterns.push({ glob: m[1].trim(), credential: inCredentialBlock })
    }
    if (sawBothLabels !== 2) {
      errors.push(
        `rules/000-security.md's PROTECTED FILES section no longer opens its two blocks with "${CREDENTIAL_LABEL}…" and ` +
          `"${WRITABLE_LABEL}…" (found ${sawBothLabels} of 2) — check 22 cannot tell which patterns must also be write-denied, ` +
          `so the write half of "never read, modify, or reference" would silently stop being enforced`
      )
    }
    const denyRules: string[] = JSON.parse(read('settings-template.json')).permissions?.deny ?? []
    const rulesFor = (tool: string): string[] =>
      denyRules.filter(r => r.startsWith(`${tool}(`) && r.endsWith(')')).map(r => r.slice(tool.length + 1, -1))
    const readPatterns = rulesFor('Read')
    const editPatterns = rulesFor('Edit')
    // A `Write(...)` rule is not merely redundant here, it is noise: Claude Code prints a
    // warning for every one of them at session start, so the kit would ship a banner instead
    // of a protection. Caught the moment the first batch shipped; pinned so it cannot return.
    for (const rule of rulesFor('Write')) {
      errors.push(
        `settings-template.json ships Write(${rule}). Claude Code does not match Write(...) rules against file ` +
          `permission checks — only Edit(...) rules, which cover every file-editing tool — and prints a warning for each ` +
          `one at session start. Use Edit(${rule}) instead`
      )
    }

    // `**` crosses `/`, a single `*` does not. Imported, not re-implemented: this is the fourth
    // call site of the same path-glob semantics and the copies had already diverged in how they
    // protected `**` from the `*` pass — see `pathGlobToRegExp` in `deny-cost.ts` for what that
    // cost. Deliberately not `globToRegExp` from the same module: that one is for command tails.
    // One concrete path each pattern must match, written the way a deny rule sees it: rooted at
    // `./` and nested, so a rule that only covers the repo root can't pass by accident.
    const sampleFor = (pattern: string): string =>
      (pattern.endsWith('/') ? `./project/${pattern}samplefile` : `./project/${pattern}`).replace(/\*/g, 'x')

    if (patterns.length === 0) {
      errors.push('check 22 parsed 0 patterns out of the PROTECTED FILES section — the list format changed')
    }
    if (patterns.some(p => p.credential) === false && sawBothLabels === 2) {
      errors.push('check 22 parsed 0 credential patterns out of the PROTECTED FILES section — the write half is grading nothing')
    }
    for (const { glob: pattern, credential } of patterns) {
      const sample = sampleFor(pattern)
      if (readPatterns.some((p: string) => pathGlobToRegExp(p).test(sample))) {
        protectedPatternsChecked++
      } else {
        errors.push(
          `rules/000-security.md lists \`${pattern}\` as a PROTECTED FILE ("never read"), but no Read(...) ` +
            `deny rule in settings-template.json matches ${sample} — the rule is prompt discipline with no backstop`
        )
      }
      if (!credential) continue
      if (editPatterns.some(p => pathGlobToRegExp(p).test(sample))) {
        credentialWritesChecked++
      } else {
        errors.push(
          `rules/000-security.md lists \`${pattern}\` as credential material ("never read, never written"), but no Edit(...) ` +
            `deny rule in settings-template.json matches ${sample} — the heading promises "never read, modify, or reference" and ` +
            `only the read half would be enforced`
        )
      }
    }
  }
}

// --- 24. A tool a rule file retires must not be recommended anywhere else ---
// Round-37 audit: `rules/600-devops.md` said "tfsec is deprecated (merged into Trivy) … do not
// add either to a new pipeline" while `presets/infrastructure/terraform/` told you to put tfsec
// in the pipeline — in CLAUDE.md and again in compact.md. Both files load for the same `*.tf`
// edit, so the kit contradicted itself in a single context window. Nothing could catch it: every
// other check compares counts, paths or globs, never what two co-loading files actually say.
//
// The verdict travels automatically: write "X is deprecated" (or archived / do not add / never
// use) about any tool in `KNOWN_TOOLS` in any rule file, and every preset, agent, skill and doc
// that still recommends X fails the gate. Only the tool NAMED BEFORE the verdict word is banned —
// "tfsec is deprecated (merged into Trivy)" retires tfsec without retiring Trivy.
const RETIREMENT_VERDICT = /\b(?:deprecated|archived|unmaintained|no longer maintained|do not add|don't add|do not use|don't use|never use)\b/i
// A mention is allowed when the tool is the SUBJECT of a warning — that is how a file says
// "tfsec is deprecated" or "trivy config instead of tfsec": documentation of the retirement, not
// a recommendation.
//
// Round-38 audit: this used to be tested against the whole LINE, while the verdict side below was
// already clause-scoped. The asymmetry was a hole — any warning word anywhere on a line exempted
// every tool named on it, so `Avoid unpinned scanner versions; add \`tfsec\` to the IaC pipeline.`
// passed the gate (verified before the fix). Both sides now use the same clause split and the same
// proximity window, so a warning only ever exempts the tool it is actually about.
//
// `replaced`/`superseded` are here for the same reason `instead of` is: "shadcn/ui replaced the
// old `useToast` hook with Sonner" documents a retirement. They inherit that arm's known cost —
// "we replaced X with tfsec" exempts a real tfsec recommendation — which is a false NEGATIVE, the
// safe direction for an exemption vocabulary. Before this, those two preset lines passed only
// because an unrelated `never alert()` happened to sit inside the proximity window.
const MENTION_IS_A_WARNING = /\b(?:deprecated|archived|unmaintained|retired|replaced|superseded|do not|don't|never|avoid|instead of|no longer)\b/i
// Sentence enders plus `·`, which this kit uses as a clause separator throughout compact.md and
// the rule bullets — without it a whole compact.md line reads as one sentence.
const CLAUSE_SPLIT = /(?<=[.;·])\s+|\s+(?=·)/
const GUIDANCE_DIRS = ['presets', 'agents', 'skills', 'agent_docs', 'commands', 'rules']
let retiredToolsChecked = 0
if (existsSync(join(ROOT, 'rules'))) {
  const mdFiles = (dir: string): string[] => {
    const out: string[] = []
    const walk = (rel: string): void => {
      for (const entry of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
        const child = `${rel}/${entry.name}`
        if (entry.isDirectory()) walk(child)
        else if (entry.name.endsWith('.md')) out.push(child)
      }
    }
    if (existsSync(join(ROOT, dir))) walk(dir)
    return out
  }

  // Retired = named as the SUBJECT of a retirement verdict in a rule file's prose. Two
  // deliberate narrowings, both learned from false positives on the real corpus:
  //   - Fenced code is skipped. `RUN npm ci --omit=dev  # …, not the deprecated --only=production`
  //     retires a FLAG inside a Dockerfile example; read as prose it retired npm kit-wide.
  //   - The tool must sit within SUBJECT_WINDOW characters before the verdict. English puts the
  //     subject next to its predicate ("tfsec is deprecated"); a tool 90 characters upstream in
  //     the same sentence is a different clause talking about something else.
  const SUBJECT_WINDOW = 40
  // CLI tools plus the library APIs a rule file can retire — see `RETIRABLE_APIS` for why the two
  // vocabularies are stored apart and only joined here.
  const RETIREMENT_VOCABULARY = new Set([...KNOWN_TOOLS, ...RETIRABLE_APIS])
  const retired = new Map<string, string>() // tool -> "rules/600-devops.md:172"
  for (const file of mdFiles('rules')) {
    let inFence = false
    readFileSync(join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('```')) { inFence = !inFence; return }
      if (inFence) return
      for (const sentence of line.split(CLAUSE_SPLIT)) {
        const verdict = sentence.match(RETIREMENT_VERDICT)
        if (!verdict) continue
        const subject = sentence.slice(Math.max(0, (verdict.index ?? 0) - SUBJECT_WINDOW), verdict.index)
        for (const tool of RETIREMENT_VOCABULARY) {
          if (new RegExp(`\\b${tool}\\b`, 'i').test(subject) && !retired.has(tool)) {
            retired.set(tool, `${file}:${i + 1}`)
          }
        }
      }
    })
  }

  // A clause recommends the tool unless that same clause warns about it, with the warning word
  // within SUBJECT_WINDOW characters of the tool name on either side — "tfsec is deprecated"
  // (tool first) and "trivy config instead of tfsec" (warning first) are both exemptions, while a
  // warning about something else earlier in the sentence is not.
  const clauseWarnsAbout = (clause: string, at: number): boolean => {
    for (const m of clause.matchAll(new RegExp(MENTION_IS_A_WARNING.source, 'gi'))) {
      const start = m.index ?? 0
      if (Math.abs(start - at) <= SUBJECT_WINDOW) return true
    }
    return false
  }

  for (const [tool, source] of retired) {
    const pattern = new RegExp(`\\b${tool}\\b`, 'i')
    for (const dir of GUIDANCE_DIRS) {
      for (const file of mdFiles(dir)) {
        readFileSync(join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
          if (!pattern.test(line)) return
          for (const clause of line.split(CLAUSE_SPLIT)) {
            const at = clause.search(pattern)
            if (at < 0 || clauseWarnsAbout(clause, at)) continue
            errors.push(
              `${file}:${i + 1} recommends \`${tool}\`, which ${source} retires ` +
                `(deprecated/archived/"do not add") — both files load for the same edit, so the kit contradicts itself in one context window`
            )
            return
          }
        })
      }
    }
    retiredToolsChecked++
  }
}

// --- 24b. A preset must cite the rule file that co-loads with it ------------
// The root cause behind check 24's finding, one level up: the round-34 preset expansion wrote 19
// new presets without reading the rule files whose globs already covered the same files. Two of
// them shipped direct contradictions — terraform vs. 600's retired-scanner line, and kubernetes
// requiring the opposite of 600's `limits.cpu` checklist item. `presets/infrastructure/docker/`
// is the shape that got it right: it opens by naming 600-devops, says which half of the subject
// each file owns, and therefore cannot restate it wrongly.
//
// Enforced only where the rule file carries a PRESCRIPTIVE CHECKLIST that overlaps the preset's
// own subject (IaC hardening, schema safety) — those are the pairs that can contradict. A
// `backend/*` preset is not required to cite 200-api: that rule is about API contract shape, not
// a checklist the preset re-grades the same files against. Citing is not proof of agreement; it
// is proof the author read the file they were about to duplicate.
const PRESET_MUST_CITE_RULE: Record<string, string> = {
  infrastructure: '600-devops.md',
  database: '500-database.md',
  orm: '500-database.md',
}
let presetCitationsChecked = 0
if (existsSync(join(ROOT, 'presets'))) {
  for (const preset of findPresetDirs(join(ROOT, 'presets'))) {
    const category = preset.relPath.split('/')[0]
    const ruleFile = PRESET_MUST_CITE_RULE[category]
    if (!ruleFile) continue
    if (!existsSync(join(ROOT, 'rules', ruleFile))) {
      errors.push(`check 24b maps presets/${category}/* to rules/${ruleFile}, which no longer exists`)
      continue
    }
    const body = readFileSync(join(ROOT, 'presets', preset.relPath, 'CLAUDE.md'), 'utf8')
    if (body.includes(`rules/${ruleFile}`)) {
      presetCitationsChecked++
    } else {
      errors.push(
        `presets/${preset.relPath}/CLAUDE.md never names \`rules/${ruleFile}\`, which auto-loads for the same files — ` +
          `say which half of the subject each one owns (see presets/infrastructure/docker/CLAUDE.md), or the two drift into contradicting each other`
      )
    }
  }
}

// --- 25. Exemplary code blocks must obey the prose around them --------------
// Round-38 audit: `rules/700-observability.md` shipped
//     // RIGHT:
//     logger.info({ userId: user.id, action: "user.created", email: user.email })
// nineteen lines above its own "Never log: PII (email, phone, SSN, DOB) — log `userId` instead"
// bullet, twenty above "user context (userId, not email)", and under global-CLAUDE.md's
// "NEVER output secrets or PII — even in debug/logs". Three prohibitions; the one line a reader
// actually copies broke all three, in the rule whose glob is every source file in the repo.
//
// Nothing could see it. Check 24 skips fenced code deliberately (a Dockerfile example retiring an
// npm FLAG reads, as prose, as retiring npm kit-wide) and every other check compares counts, paths
// or globs. That left the whole class unpoliced — and examples are the highest-leverage prose in
// any rule file precisely because they are copied verbatim rather than paraphrased.
//
// Closing it at the class, not at the line: parse fenced blocks, track whether each line sits
// under a WRONG or a RIGHT marker (an UNLABELLED example counts as exemplary — that is what makes
// it a recommendation), then grade the exemplary lines. The vocabulary is not hardcoded here; it
// is read from a machine-readable marker in the rule file that owns the prohibition, so the rule
// stays the single source of truth and extending it extends the policing.
const EXAMPLE_DIRS = ['rules', 'presets', 'agent_docs', 'agents', 'skills', 'commands']
// A marker flips the block's verdict. It may be a comment (`// RIGHT`, `# WRONG`, `<!-- ALWAYS`)
// or a bare inline label — `500-database.md` writes `WRONG: users.map(…)` with the code on the
// same line, so the verdict is applied first and the line is then graded under it.
const EXAMPLE_MARKER = /^\s*(?:\/\/+|#+|--|\/\*+|\*|<!--)?\s*(WRONG|BAD|ANTI-?PATTERN|INSECURE|VULNERABLE|RIGHT|GOOD|CORRECT|REQUIRED|ALWAYS|SAFE)\b/i
const MARKER_IS_POSITIVE = /^(?:RIGHT|GOOD|CORRECT|REQUIRED|ALWAYS|SAFE)$/i
const LOG_CALL_OPEN = /\b(?:logger|log|console|logging|slog|zap)\s*\.\s*(?:log|info|warn|warning|error|debug|trace|fatal|exception)\s*\(/
// `uses: owner/action@ref` is exemplary CI, and 600-devops.md's own prose requires an immutable
// 40-hex SHA. `@[SHA]` is the kit's placeholder for "put the SHA here" and is the documented form.
const USES_REF = /\buses:\s*([\w.-]+\/[\w./-]+)@(\S+)/
const PINNED_REF = /^(?:[0-9a-f]{40}|\[SHA\])$/i

// 2026-08 review, third grader. The two graders below (banned log fields, Actions SHA pinning)
// are hardcoded predicates: check 25's fence/verdict MACHINERY is general, but what it grades
// exemplary lines against was not. That gap surfaced two live defects in `rules/800-llm-safety.md`
// — a `RIGHT`-marked prompt-injection example whose `{ role: 'system' }` message array is the
// OpenAI shape and is rejected by the Messages API the same file calls twenty lines later, and a
// `safeParse(JSON.parse(x))` whose `!success` fallback is unreachable because JSON.parse throws
// first. Both sit in the highest-leverage prose in the kit: examples are copied verbatim.
//
// Considered and rejected: extracting fenced `ts` blocks and running `tsc --noEmit` over them.
// Kit examples are deliberately fragments — undefined identifiers, elided context, mixed
// languages — so a real compiler reports hundreds of errors that are not defects, and a check
// that cries wolf gets disabled. That is the same trap as the round-37 fuzzy contradiction
// detector (4/4 false positives, abandoned). A compiler answers "does this parse and resolve",
// and the actual failure class here is "does this shape work against the API it calls" — which no
// offline type-check of a fragment can answer either.
//
// So: same architecture as the never-log-fields marker directly below. The rule file that owns a
// prohibition declares the forbidden SHAPE in a machine-readable marker; this check grades every
// exemplary line in the kit against every declared shape. The script hardcodes no pattern, the
// rule stays the single source of truth, and adding a shape to a rule file extends the policing
// to all six example directories with no code change here.
interface ForbiddenShape { pattern: RegExp; reason: string; source: string }
const forbiddenShapes: ForbiddenShape[] = []
for (const ruleFile of existsSync(join(ROOT, 'rules')) ? readdirSync(join(ROOT, 'rules')).filter(f => f.endsWith('.md')) : []) {
  const rel = `rules/${ruleFile}`
  const block = read(rel).match(/<!--\s*forbidden-in-examples\s*\n([\s\S]*?)-->/)
  if (!block) continue
  for (const raw of block[1].split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const sep = line.indexOf(' :: ')
    if (sep === -1) {
      errors.push(`${rel}: forbidden-in-examples entry "${line}" is missing the \` :: \` separator between pattern and reason`)
      continue
    }
    try {
      forbiddenShapes.push({ pattern: new RegExp(line.slice(0, sep)), reason: line.slice(sep + 4).trim(), source: rel })
    } catch (e) {
      errors.push(`${rel}: forbidden-in-examples pattern \`${line.slice(0, sep)}\` is not a valid regex — ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

// One counter per grading arm. Deliberately not one shared total: the arms grade different
// line populations (every exemplary line vs. only lines inside a log call vs. only `uses:`
// steps), so a single number cannot be read back as coverage for any of them.
let shapeLinesGraded = 0
let logLinesGraded = 0
let actionLinesGraded = 0
const observabilityRule = join(ROOT, 'rules/700-observability.md')
let bannedLogFields: string[] = []
if (existsSync(observabilityRule)) {
  const marker = readFileSync(observabilityRule, 'utf8').match(/<!--\s*never-log-fields:([\s\S]*?)-->/)
  if (!marker) {
    errors.push(
      'rules/700-observability.md no longer carries the `never-log-fields:` marker that check 25 ' +
        'grades the kit\'s own log examples against — restore it, or drop check 25 deliberately rather than by deletion'
    )
  } else {
    bannedLogFields = marker[1].split(/[\s,]+/).filter(Boolean)
  }
}

if (bannedLogFields.length > 0 || forbiddenShapes.length > 0) {
  const bannedInLog = bannedLogFields.length > 0 ? new RegExp(`\\b(${bannedLogFields.join('|')})\\b`, 'i') : null
  for (const dir of EXAMPLE_DIRS) {
    if (!existsSync(join(ROOT, dir))) continue
    const walk = (rel: string): void => {
      for (const entry of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
        const child = `${rel}/${entry.name}`
        if (entry.isDirectory()) { walk(child); continue }
        if (!entry.name.endsWith('.md')) continue

        let inFence = false
        let exemplary = true
        // Depth of the log call currently open, so a multi-line `logger.info({ … })` is graded on
        // every one of its lines, not just the one naming the function.
        let logDepth = 0
        readFileSync(join(ROOT, child), 'utf8').split('\n').forEach((line, i) => {
          if (line.trimStart().startsWith('```')) {
            inFence = !inFence
            exemplary = true
            logDepth = 0
            return
          }
          if (!inFence) return
          const marker = line.match(EXAMPLE_MARKER)
          if (marker) {
            exemplary = MARKER_IS_POSITIVE.test(marker[1])
            logDepth = 0
          }

          const opens = LOG_CALL_OPEN.test(line)
          const inLogCall = opens || logDepth > 0
          if (inLogCall) {
            const from = opens ? (line.search(LOG_CALL_OPEN) ?? 0) : 0
            const tail = line.slice(from)
            logDepth += (tail.match(/[({[]/g) ?? []).length - (tail.match(/[)}\]]/g) ?? []).length
            if (logDepth < 0) logDepth = 0
          }
          if (!exemplary) return

          // Grade the exemplary line against every shape a rule file declares forbidden.
          // Runs on all exemplary lines, not only log calls — the failures this catches are
          // API-shape and control-flow defects, which appear anywhere in a block.
          //
          // Counted before the match test, not inside it (2026-08 review): an earlier version
          // incremented only when a shape HIT, so on a clean kit this arm contributed exactly 0
          // to a summary line that nonetheless advertised it. A coverage counter that reads 0
          // when the check is working is indistinguishable from one that reads 0 because the
          // check scanned nothing — the failure check 28 is written to prevent, inverted.
          if (forbiddenShapes.length > 0) shapeLinesGraded++
          for (const shape of forbiddenShapes) {
            if (!shape.pattern.test(line)) continue
            errors.push(
              `${child}:${i + 1} is exemplary code matching a shape \`${shape.source}\` declares forbidden ` +
                `(\`${shape.pattern.source}\`): ${shape.reason}. ` +
                `An example is copied verbatim, so a broken one outweighs the prose around it — fix the example, ` +
                `or mark the block \`// WRONG\` if it is meant to demonstrate the mistake`
            )
          }

          if (inLogCall && bannedInLog) {
            logLinesGraded++
            const hit = line.match(bannedInLog)
            if (hit) {
              errors.push(
                `${child}:${i + 1} is an exemplary log call that logs \`${hit[1]}\` — ` +
                  `rules/700-observability.md's never-log-fields marker forbids it and global-CLAUDE.md forbids PII in logs outright. ` +
                  `An example is copied verbatim, so it outweighs the prose bullet that contradicts it`
              )
            }
          }

          const uses = line.match(USES_REF)
          if (uses) {
            actionLinesGraded++
            if (!PINNED_REF.test(uses[2])) {
              errors.push(
                `${child}:${i + 1} is an exemplary workflow step pinning \`${uses[1]}\` to \`@${uses[2]}\` — ` +
                  `rules/600-devops.md requires an immutable 40-hex SHA (or the \`@[SHA]\` placeholder). ` +
                  `Mark the block \`# WRONG\` if it is meant to demonstrate the mistake`
              )
            }
          }
        })
      }
    }
    walk(dir)
  }
}

// --- 26. Version pins must carry a conscious review date -------------------
// Round-38 audit: the devops rule recommended `python:3.12-slim` long after 3.13 shipped, round 37
// bumped it to 3.13 while 3.14 was already stable, and nothing noticed either time — because
// nothing could. Staleness is the one drift class that is not decidable offline: no local check
// knows what upstream released this morning, and wiring the gate to a registry would make a
// publicly distributed kit fail on someone else's network.
//
// So do not detect staleness — make the absence of a review impossible to miss. Every pinned
// version line in the file is digested; the digest sits next to the date it was last verified
// against upstream. Move a pin without moving the date and the gate stops you. The check cannot
// tell you a version is old, but it guarantees no pin changes without someone re-dating the claim,
// and it prints the age so a stale review is visible in every run instead of only in an audit.
const PIN_FILE = 'rules/600-devops.md'
// Pinned-version lines. Round-39 audit: the first version of this pattern enumerated the SHAPES it
// had noticed — `FROM image:tag`, the `- Platform: \`image:tag\`` bullets, `<lang>-version: 'x.y'`
// — and was described in the marker as covering "every version-pinned example in this file". It
// did not. The IaC section 90 lines below pins `checkov==3.2.x` and `aquasec/trivy:0.55.x` in
// prose and a bare `version: '3.2.x'` in a fence; none matched, so all three sat outside the
// digest and both scanners drifted ~2 years stale underneath a marker that read "reviewed 2026-08"
// — the exact failure this check exists to prevent, in the same file as the check's own marker.
//
// The lesson is the general one: a shape-enumerating pattern silently under-reports, and a digest
// that under-reports is worse than no digest, because the marker's date then vouches for pins
// nothing is watching. So match on what a PIN IS rather than where it has been seen:
//   - `name:tag` where the tag starts with a digit — every container image, in prose or fence,
//     backticked or bare (`syft oven/bun:1-alpine` in the SBOM example was exempt before too).
//     The lookbehind keeps a URL authority out: `http://localhost:3000/health` in the HEALTHCHECK
//     example is a port, not a pin, and letting it in would make an unrelated healthcheck edit
//     demand a pin re-review — which is how a digest starts training people to re-date blindly.
//   - `name==x.y` — pip pins, the form the Checkov line uses.
//   - `version: '…'` — setup-action inputs; deliberately not `-version:` only, which was what let
//     the checkov-action's bare `version:` through while catching `node-version:` beside it.
// The Go base image (`gcr.io/distroless/static-debian12`) carries its version in the name and has
// no `:tag`, so it keeps its own bullet arm — leaving it out would exempt the one pin whose
// staleness is hardest to eyeball.
const TOOLCHAIN_PIN =
  /(?<![\w/.-])\w[\w./+-]*:\d[\w.-]*|[\w.-]+==\d[\w.]*|\bversion:\s*'[^']+'|^-\s+[\w/.+ ]+:\s*`[^`:]+`/
let pinReviewAge: string | null = null
if (existsSync(join(ROOT, PIN_FILE))) {
  const body = readFileSync(join(ROOT, PIN_FILE), 'utf8')
  const pins = body.split('\n').map((l) => l.trim()).filter((l) => TOOLCHAIN_PIN.test(l))
  const digest = createHash('sha256').update(pins.join('\n')).digest('hex').slice(0, 12)
  const marker = body.match(/<!--\s*toolchain-pins reviewed:\s*(\d{4})-(\d{2})\s+digest:\s*(\S+)/)
  if (!marker) {
    errors.push(
      `${PIN_FILE} has ${pins.length} pinned-version example(s) but no \`toolchain-pins reviewed: YYYY-MM digest: …\` marker — ` +
        `add one with digest \`${digest}\` after verifying the pins against upstream`
    )
  } else if (marker[3] !== digest) {
    errors.push(
      `${PIN_FILE}: the pinned versions changed since they were last reviewed (${marker[1]}-${marker[2]}). ` +
        `Verify all ${pins.length} pin(s) against upstream, then set the marker to \`reviewed: <this month> digest: ${digest}\`. ` +
        `Round 37 bumped Python to a release that was already superseded; re-dating without re-checking is the failure this catches`
    )
  } else {
    const months =
      (new Date().getFullYear() - Number(marker[1])) * 12 + (new Date().getMonth() + 1 - Number(marker[2]))
    pinReviewAge = `${pins.length} pinned-version example(s), last verified against upstream ${marker[1]}-${marker[2]} (${months} month(s) ago)`
  }
}

// --- 28. The landing page may not hard-code a count the repo already derives --
// Round-39: the site was added as a second public surface that states what the kit contains.
// `gen-site.ts` fills every number from `lib/counts.ts`, but nothing stopped a contributor from
// typing "28 stack presets" straight into the template — and that copy would be guarded by
// nothing, on the one page strangers read and no contributor re-reads. Same class as check 8
// (README count tables) and check 21 (a skill stating its own deny count), one surface later.
//
// Deliberately narrow: it fires on a number ADJACENT to a component word, which is how a count
// claim reads in prose ("28 presets", "7 agents"). Version strings, years and CSS values in the
// stylesheet are not component claims and are not scanned — only the two templates are, because
// only they are rendered from `TOKENS`.
const SITE_TEMPLATES = ['site/index.en.html', 'site/index.tr.html']
// English and Turkish words for each countable component, mapped to the token that must be used
// instead. Turkish is here because the translated page is exactly where a hand-typed number is
// least likely to be noticed by a reviewer reading the English one.
const COUNT_WORDS: [RegExp, string][] = [
  [/\b(\d+)\s+(?:agents?|ajan)\b/gi, '{{agents}}'],
  [/\b(\d+)\s+(?:skills?|skill)\b/gi, '{{skills}}'],
  [/\b(\d+)\s+(?:rule files?|rules?|kural)\b/gi, '{{rules}}'],
  [/\b(\d+)\s+(?:stack )?(?:presets?|preset)\b/gi, '{{presets}}'],
  [/\b(\d+)\s+(?:reference docs?|referans)\b/gi, '{{agentDocs}}'],
  [/\b(\d+)\s+(?:deny rules?|deny)\b/gi, '{{denyRules}}'],
]
let siteTemplatesChecked = 0
for (const template of SITE_TEMPLATES) {
  if (!existsSync(join(ROOT, template))) continue
  siteTemplatesChecked++
  const body = read(template)
  for (const [pattern, token] of COUNT_WORDS) {
    pattern.lastIndex = 0
    for (const m of body.matchAll(pattern)) {
      errors.push(
        `${template} hard-codes "${m[0].trim()}" — use ${token} instead, so the published page cannot outlive the number. ` +
          `gen-site.ts fills it from lib/counts.ts, the same derivation check 8 holds the READMEs to`
      )
    }
  }
}

// --- 29. Freshness claims must be dated and must age out ----------------------
// 2026-08 review: check 26 gave `rules/600-devops.md`'s toolchain pins a review date that the gate
// ages, and nothing else in the kit had one. Meanwhile six headings across `rules/` and
// `agent_docs/` carried a bare `(2025)` — "STATE MANAGEMENT (2025)", "SUPPLY CHAIN RULES (2025)" —
// which reads to a user as "current as of 2025" while being maintained by nobody. A stale freshness
// label is worse than none: it converts an unmaintained table into a dated assertion, which is the
// same failure check 26 was written for, one surface over.
//
// Two arms, deliberately different in kind:
//   (a) BARE-YEAR BAN. A year in parentheses attached to a topic heading is a freshness claim with
//       no mechanism. Banned outright — use the `<!-- reviewed: YYYY-MM -->` marker instead, which
//       arm (b) then ages. A year that NAMES A PUBLISHED THING is a fact, not a freshness claim, and
//       is exempt by construction: "OWASP TOP 10 — 2025 EDITION", "WCAG 2.2", "tj-actions (2025)".
//       The exemption is a word-boundary test on the preceding text, not a filename allowlist, so a
//       new spec reference does not need to be registered anywhere.
//   (b) AGE-OUT. Every `<!-- reviewed: YYYY-MM -->` and `<!-- upstream-assumption verified: YYYY-MM -->`
//       marker in the kit is aged against FRESHNESS_MAX_MONTHS. This is what makes the marker a
//       mechanism rather than a decoration, and it is why replacing `(2025)` with a marker is an
//       improvement rather than a rename.
//
// The window is long on purpose. This is a single-maintainer kit; a 3-month tripwire trains people
// to re-date without re-reading, which is exactly the round-37 failure check 26 already records.
const FRESHNESS_MAX_MONTHS = 12
const FRESHNESS_DIRS = ['rules', 'agent_docs', 'agents', 'skills', 'commands', 'presets']
const FRESHNESS_ROOT_FILES = ['SECURITY.md', 'global-CLAUDE.md', 'README.md', 'README.tr.md']
// A year is a *fact* when the token before it names the thing the year belongs to. Spec/standard
// vocabulary + a bare version number ("OWASP TOP 10 — 2025 EDITION" has "10 —" before it, so the
// edition arm carries it) covers every legitimate use without an allowlist of files.
const YEAR_IS_A_FACT = /(?:edition|version|spec|standard|owasp|wcag|rfc|cve|incident|released?|published|since|until|through|report|survey|©|copyright|[\w/.-]+\/[\w/.-]+)\s*$/i
const BARE_YEAR = /\((20\d{2})\)/g
// The optional trailing note is what keeps a marker honest about its own scope. Check 36 requires
// one on every version-naming preset, and "reviewed" over a whole preset would vouch for every
// idiom and command in it; "reviewed: 2026-08 — Rails 7/8 version line" vouches for what was
// actually re-checked. A marker whose scope is implicit is re-dated blindly, which is the round-37
// failure check 26 already records.
const REVIEWED_MARKER =
  /<!--\s*(?:(reviewed)|upstream-assumption\s+(verified)):\s*(\d{4})-(\d{2})\s*(?:—[^>]*)?-->/g
const now = new Date()
let freshnessMarkers = 0
const scanFreshness = (rel: string): void => {
  const body = read(rel)
  for (const m of body.matchAll(BARE_YEAR)) {
    const before = body.slice(Math.max(0, m.index - 60), m.index)
    if (YEAR_IS_A_FACT.test(before)) continue
    const line = body.slice(0, m.index).split('\n').length
    errors.push(
      `${rel}:${line} carries a bare freshness label "${m[0]}" — a year in parentheses tells the reader ` +
        `the content is current as of that year while nothing keeps it so. Replace it with ` +
        `\`<!-- reviewed: YYYY-MM -->\`, which this check ages out after ${FRESHNESS_MAX_MONTHS} months, ` +
        `or reword so the year names a published thing (a spec edition, a CVE, a dated incident), which is exempt`
    )
  }
  for (const m of body.matchAll(REVIEWED_MARKER)) {
    freshnessMarkers++
    const months = (now.getFullYear() - Number(m[3])) * 12 + (now.getMonth() + 1 - Number(m[4]))
    if (months > FRESHNESS_MAX_MONTHS) {
      const line = body.slice(0, m.index).split('\n').length
      errors.push(
        `${rel}:${line} was last ${m[1] ? 'reviewed' : 'verified'} ${m[3]}-${m[4]}, ${months} months ago ` +
          `(limit ${FRESHNESS_MAX_MONTHS}). Re-check the claim against upstream and then move the date. ` +
          `Moving the date without re-checking defeats the only thing this marker does`
      )
    }
  }
}
const walkFreshness = (rel: string): void => {
  for (const entry of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`
    if (entry.isDirectory()) walkFreshness(child)
    else if (entry.name.endsWith('.md')) scanFreshness(child)
  }
}
for (const dir of FRESHNESS_DIRS) if (existsSync(join(ROOT, dir))) walkFreshness(dir)
for (const f of FRESHNESS_ROOT_FILES) if (existsSync(join(ROOT, f))) scanFreshness(f)

// --- 30. No document may cite this repo's git history as evidence -------------
// 2026-08 review: SECURITY.md closed its audit-history section with "for the provenance of a
// specific rule, `git log -p settings-template.json` is authoritative in a way prose is not."
// The repo was published at v1.0.0 with a squashed history — one commit — so that command returns
// a single wall of additions and resolves nothing. The claim was true when written and became
// false at publication, and no check noticed because it is a statement about git, not about a file.
//
// The class is "documentation that cites an artifact the published repo does not carry." Closed by
// deriving the truth from git itself at check time: if the history is too shallow to support a
// provenance claim, no shipped document may make one. If a future release ships real history, this
// check stops firing on its own — the fix is the history existing, not an edit here.
const HISTORY_CLAIM = /git\s+(?:log|blame|show)\b[^`\n]*/g
let historyDepth: number | null = null
try {
  historyDepth = Number(
    execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  )
} catch {
  // Not a git checkout (tarball install, CI export) — nothing to assert. `historyDepth`
  // is already null from its initializer; leaving the assignment out keeps the linter's
  // dead-store rule happy without weakening the guard below.
}
// Below this, `git log <path>` cannot distinguish "this rule was added to close X" from "the repo
// was published". Two commits is the floor at which a diff means anything at all.
const MIN_COMMITS_FOR_PROVENANCE = 3
if (historyDepth !== null && historyDepth < MIN_COMMITS_FOR_PROVENANCE) {
  for (const f of ['SECURITY.md', 'README.md', 'README.tr.md', 'CONTRIBUTING.md', 'CLAUDE.md']) {
    if (!existsSync(join(ROOT, f))) continue
    const body = read(f)
    for (const m of body.matchAll(HISTORY_CLAIM)) {
      // Only fire when the sentence presents git as the *authority*, not when it merely mentions
      // that guards may run `git log` as a read-only investigation tool (SECURITY.md item 2 does).
      const context = body.slice(Math.max(0, m.index - 200), m.index + 200)
      if (!/authoritative|provenance|source of truth|history of|why (?:a|this|that) rule|verify (?:it|this) (?:in|with)/i.test(context)) continue
      const line = body.slice(0, m.index).split('\n').length
      errors.push(
        `${f}:${line} points the reader at \`${m[0].trim()}\` as authoritative, but this repo has ` +
          `${historyDepth} commit(s) — the published history was squashed at v1.0.0, so that command ` +
          `resolves nothing. Cite the shipped file and the test that constrains it instead ` +
          `(settings-template.json + scripts/deny-cost.test.ts), or restore real history`
      )
    }
  }
}

// --- 31. README's measured A/B scores === eval/golden-prompts.json's last_measured ---------
// The live routing A/B is the only number in this repo that describes model behavior rather than
// file contents, which makes it the most quotable number the READMEs carry and the one a reader
// is least able to check. It is also the only one that cannot be re-derived at gate time: running
// it costs API credits and 52 CLI calls, so the gate reads the recorded result instead. Recording
// it in the data file and binding the prose to it is the same treatment every other count in the
// READMEs gets — otherwise the kit's headline evidence would be its one hand-typed number.
// Both fractions and percentages are matched, in both languages, because both READMEs state both.
// Both live suites feed this, not just routing: the behavior A/B started recording a result too,
// and a second measured number quoted in the same prose with nothing binding it would be the exact
// gap this check was written to close — one arm bound, one arm hand-typed.
type MeasuredRun = { prompts: number; control_passed: number; treatment_passed: number; date: string }
// existsSync guard, not optimism: the fixtures in scripts/validate-skills.test.ts copy a partial
// repo, so an unguarded read here fails every one of them at once.
const AB_SUITES = AB_SUITE_FILES.filter(f => existsSync(join(ROOT, f)))
const measuredRuns = AB_SUITES.map(file => ({ file, run: JSON.parse(read(file)).last_measured as MeasuredRun | null | undefined })).filter(
  (r): r is { file: string; run: MeasuredRun } => Boolean(r.run)
)
let abClaimCount = 0
if (measuredRuns.length > 0) {
  const expected = new Map<string, number>()
  const sources: string[] = []
  for (const { file, run } of measuredRuns) {
    const pct = (n: number): number => Math.round((n / run.prompts) * 100)
    expected.set(`${run.control_passed}/${run.prompts}`, pct(run.control_passed))
    expected.set(`${run.treatment_passed}/${run.prompts}`, pct(run.treatment_passed))
    sources.push(`${file} (control ${run.control_passed}/${run.prompts}, treatment ${run.treatment_passed}/${run.prompts}, measured ${run.date})`)
  }
  // "22/26 (85%)" / "22/26 (%85)" — fraction plus the percentage rendered beside it.
  const AB_CLAIM = /(\d+)\/(\d+)\s*\((?:%\s*(\d+)|(\d+)\s*%)\)/g
  for (const readme of READMES) {
    for (const m of read(readme).matchAll(AB_CLAIM)) {
      const fraction = `${m[1]}/${m[2]}`
      const claimedPct = Number(m[3] ?? m[4])
      const truth = expected.get(fraction)
      abClaimCount++
      if (truth === undefined) {
        errors.push(
          `${readme} states A/B score "${m[0]}", which is not an arm of any recorded run — ${sources.join(' · ')}. ` +
            `Re-run the eval it belongs to (RUN_ROUTING_EVAL=1 / RUN_BEHAVIOR_EVAL=1) and record what it actually returns`
        )
      } else if (claimedPct !== truth) {
        errors.push(
          `${readme} states "${m[0]}" but ${fraction} is ${truth}% — the percentage was typed, not computed`
        )
      }
    }
  }
}

// --- 32. Every shipped preset's language has a hotspot row in 000-security ---
// `rules/000-security.md`'s LANGUAGE-SPECIFIC HOTSPOTS table loads in every session, everywhere
// this kit is installed. The preset list grew from 9 to 28 (round 34) and that table did not,
// so the kit shipped a Rails preset for a language whose hotspots — `Marshal.load`, `permit!`,
// `html_safe` on user content — appeared in no always-loaded rule, and a Flutter preset whose
// row said "Swift/Kotlin mobile" and therefore did not obviously cover Dart. Same class as
// check 18's MUST_COVER globs: a preset ships, and the rule meant to protect it never widened.
//
// The map is declared here rather than derived from the preset titles on purpose. A fuzzy
// title→language matcher was tried for a different check in round 37 and produced four false
// positives out of four; a preset added without a decision recorded here fails the gate instead,
// which is the behaviour that actually forces the decision. `null` is a legitimate answer with a
// reason: a stack whose risks are covered by a path-scoped rule rather than by a language row.
const PRESET_HOTSPOT_LANGUAGE: Record<string, string | null> = {
  'web/nextjs-saas': 'JS/TS',
  'web/react-vite': 'JS/TS',
  'web/nuxt': 'JS/TS',
  'web/sveltekit': 'JS/TS',
  'web/astro': 'JS/TS',
  'web/angular': 'JS/TS',
  'backend/node-express': 'JS/TS',
  'backend/nestjs': 'JS/TS',
  'backend/fastapi': 'Python',
  'backend/django': 'Python',
  'backend/laravel': 'PHP',
  'backend/rails': 'Ruby',
  'backend/spring-boot': 'Java/Kotlin',
  'backend/dotnet': 'C#',
  'backend/go-api': 'Go',
  'backend/rust-axum': 'Rust',
  'mobile/flutter': 'Mobile (Swift/Kotlin/Dart/RN)',
  'mobile/react-native': 'Mobile (Swift/Kotlin/Dart/RN)',
  'mobile/swiftui': 'Mobile (Swift/Kotlin/Dart/RN)',
  'orm/prisma': 'JS/TS',
  'orm/drizzle': 'JS/TS',
  // Query languages and config formats, not implementation languages: their injection and
  // exposure risks live in the PASSIVE SCAN table and `rules/500-database.md`.
  'database/postgres': null,
  'database/mongodb': null,
  'database/supabase': null,
  // Infrastructure definitions: `rules/600-devops.md` owns non-root containers, SHA pins, OIDC
  // and IaC scanning, and it path-loads for exactly these files.
  'infrastructure/docker': null,
  'infrastructure/kubernetes': null,
  'infrastructure/terraform': null,
  // Deliberately language-agnostic — it exists for stacks with no preset.
  'generic/fallback': null,
}
let presetLanguagesChecked = 0
if (existsSync(join(ROOT, 'presets')) && existsSync(join(ROOT, 'rules/000-security.md'))) {
  const section = read('rules/000-security.md').match(/## LANGUAGE-SPECIFIC HOTSPOTS[^\n]*\n([\s\S]*?)(?:\n## |$)/)
  if (!section) {
    errors.push('rules/000-security.md has no "## LANGUAGE-SPECIFIC HOTSPOTS" section — check 32 is comparing nothing')
  } else {
    const rows = new Set(
      section[1]
        .split('\n')
        .filter(l => l.startsWith('|') && !/^\|\s*-+/.test(l) && !/^\|\s*Language\s*\|/.test(l))
        .map(l => l.split('|')[1]?.trim())
        .filter((l): l is string => Boolean(l))
    )
    if (rows.size === 0) {
      errors.push('check 32 parsed 0 language rows out of the HOTSPOTS table — its shape changed and the check is inert')
    } else {
      const onDisk = new Set(findPresetDirs(join(ROOT, 'presets')).map(p => p.relPath))
      for (const name of onDisk) {
        if (!(name in PRESET_HOTSPOT_LANGUAGE)) {
          errors.push(
            `presets/${name} ships but check 32's PRESET_HOTSPOT_LANGUAGE map never names it — add it with the ` +
              `hotspot row that covers its language, or \`null\` plus the rule that covers it instead`
          )
        }
      }
      for (const [name, language] of Object.entries(PRESET_HOTSPOT_LANGUAGE)) {
        if (!onDisk.has(name)) {
          errors.push(`check 32's map names preset \`${name}\`, which is not a directory under presets/ — renamed or removed?`)
          continue
        }
        if (language === null) continue
        presetLanguagesChecked++
        if (!rows.has(language)) {
          errors.push(
            `presets/${name} is mapped to hotspot row "${language}", which rules/000-security.md's ` +
              `LANGUAGE-SPECIFIC HOTSPOTS table does not have — the kit ships a stack whose language-specific ` +
              `risks appear in no always-loaded rule`
          )
        }
      }
    }
  }
}

// --- 33. A POSIX-only command shape must ship its Windows equivalent ---------
// `RUN_ROUTING_EVAL=1 npm run routing-eval` and `ANALYZE=true next build` are parse errors in
// PowerShell, which has no inline env-var prefix — and both appeared in this repo's own README
// and rule files while the maintainer works on Windows. The kit's whole promise is that a command
// it tells you to type actually runs, so the shape is allowed only where the same fenced block
// also shows the `$env:NAME=…` form. One check rather than a per-file audit: the failure repeats
// every time someone writes a shell example from muscle memory.
//
// Scoped to fenced blocks so prose that merely names an env var is untouched, and anchored at the
// start of a line so `run: VAR=x cmd` inside YAML and `ENV VAR=x` inside a Dockerfile — both
// genuinely POSIX contexts — never match.
const ENV_PREFIX_LINE = /^[A-Z][A-Z0-9_]*=\S+\s+\S/
const shellDocFiles: string[] = [...COUNT_CLAIM_DOCS]
for (const dir of ['rules', 'agent_docs', 'agents', 'skills', 'commands', 'presets']) {
  collectMarkdown(dir, shellDocFiles)
}
let shellBlocksChecked = 0
for (const file of shellDocFiles) {
  const lines = read(file).split('\n')
  let fenceStart: number | null = null
  let block: string[] = []
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      if (fenceStart === null) {
        fenceStart = i
        block = []
      } else {
        shellBlocksChecked++
        const offenders = block.filter(l => ENV_PREFIX_LINE.test(l.trim()))
        const hasWindowsForm = block.some(l => l.includes('$env:'))
        if (offenders.length > 0 && !hasWindowsForm) {
          errors.push(
            `${file}:${(fenceStart ?? 0) + 1} shows \`${offenders[0].trim().slice(0, 60)}\` — an inline env-var prefix ` +
              `is a parse error in PowerShell, and this block offers no \`$env:NAME=…\` equivalent. Add the Windows ` +
              `form next to it or rewrite the command`
          )
        }
        fenceStart = null
      }
      return
    }
    if (fenceStart !== null) block.push(line)
  })
}

// --- 34. A recorded measurement must describe the suite that is on disk -------
// Check 31 binds the READMEs to `last_measured`. Nothing bound `last_measured` to the file it
// lives in. Round 41 added a design-lead prompt after the 2026-08-11 run, so the suite became 27
// prompts while the recorded — and quoted — result still read 26/26, and the gate stayed green.
// The prompt outside the measurement was the one for the newest agent: precisely the routing a
// reader would want the evidence to cover, and precisely the one it silently did not.
//
// A measurement that no longer describes its suite is not a weaker measurement, it is a wrong one,
// because the reader has no way to see the difference. So growing or shrinking the suite
// invalidates the recording rather than quietly widening what the recording appears to vouch for.
// Same class as check 26: the number is not re-derivable at gate time, so what the gate can
// enforce is that nobody moves the thing being measured without moving the measurement.
//
// The count is only half of it, and the smaller half. A suite measures the effect of KIT FILES —
// ROUTING.md, the rule files a behavior prompt names — and those can change without the suite
// changing at all. Round 41 broke two routes by editing ROUTING.md; the count check caught it only
// because the same round happened to add a prompt too. Edit the routing document alone and every
// check in this file stays green while the recorded score describes a document that no longer
// exists. So the recording also carries `context_digest`: the fingerprint of exactly what the
// treatment arm read (lib/eval-context.ts derives it, and both eval scripts print the fresh value
// after a live run so there is nothing to compute by hand).
let evalSuitesChecked = 0
for (const suiteFile of AB_SUITE_FILES) {
  if (!existsSync(join(ROOT, suiteFile))) continue
  const suite = JSON.parse(read(suiteFile)) as {
    prompts: unknown[]
    last_measured?: { prompts: number; date: string; context_digest?: string } | null
  }
  const recorded = suite.last_measured
  if (!recorded) continue // null is the honest state before the first live run — check 27 guards the prose
  evalSuitesChecked++
  if (recorded.prompts !== suite.prompts.length) {
    errors.push(
      `${suiteFile}: last_measured describes a ${recorded.prompts}-prompt run (${recorded.date}) but the file now ` +
        `holds ${suite.prompts.length} prompt(s). The recorded score no longer covers the suite it is quoted for — ` +
        `re-run the live A/B and record what it returns, or move the new prompt(s) out until it is re-run. ` +
        `Round 41 shipped a design-lead prompt this way: the newest agent was the one arm the "100%" never measured`
    )
  }
  const currentDigest = evalContextDigest(suiteFile, ROOT)
  if (currentDigest === null) continue
  if (!recorded.context_digest) {
    errors.push(
      `${suiteFile}: last_measured has no context_digest. Without it the recording is bound to the prompt count ` +
        `only, and the kit files the run actually measured can be rewritten under it silently. Add ` +
        `"context_digest": "${currentDigest}" if the recorded run read the files as they stand now, otherwise re-run the live A/B`
    )
  } else if (recorded.context_digest !== currentDigest) {
    errors.push(
      `${suiteFile}: last_measured records context_digest ${recorded.context_digest}, but the files that run read now ` +
        `digest to ${currentDigest}. Something the treatment arm depends on changed after the ${recorded.date} run — ` +
        `for routing that is an agent description or ROUTING.md, for behavior a prompt's wording or one of its context ` +
        `files. The score is now about a version of the kit that no longer exists: re-run the live A/B and record what ` +
        `it returns (both eval scripts print the new digest), or revert the change`
    )
  }
}

// --- 35. A command nothing invokes is a command nothing runs ------------------
// Round-41's root finding was that the design infrastructure existed in the repo and nothing
// called it. The same shape reappeared one layer over: `/a11y-check` shipped as a 10-step WCAG
// audit that no skill, agent or guide referenced, so it could only ever run if the user typed it
// — while `new-page` claimed inline that it "covers a11y" with three bullets. The kit's own
// discovery model is that skills and agents route work; a command outside that graph is a file,
// not a capability.
//
// Declared exemptions rather than a heuristic (round-37's lesson: a fuzzy matcher scored 0/4).
// A command is user-entry-only when its whole purpose is to be typed — the guides that list what
// is installed have no upstream caller by construction. Everything else must be reachable from
// something that runs on its own.
const USER_ENTRY_COMMANDS = new Set(['agents-guide', 'skills-guide'])
const COMMAND_CALLERS = ['skills', 'agents', 'agent_docs', 'rules']
const callerCorpus: string[] = []
for (const dir of COMMAND_CALLERS) collectMarkdown(dir, callerCorpus)
const callerText = callerCorpus.map(read).join('\n')
let commandsWired = 0
// Reachability is a question about the routing graph, so it is only asked where the graph exists:
// `agents/` present means a real kit tree, and its absence means a consistency-test fixture that
// copied `commands/` for some other case. The summary line below prints the graded count, so the
// real repo cannot quietly grade zero — the failure mode this guard could otherwise introduce.
const hasRoutingGraph = existsSync(join(ROOT, 'agents')) && existsSync(join(ROOT, 'commands'))
for (const entry of hasRoutingGraph ? readdirSync(join(ROOT, 'commands')) : []) {
  if (!entry.endsWith('.md')) continue
  const name = entry.replace(/\.md$/, '')
  if (USER_ENTRY_COMMANDS.has(name)) continue
  if (callerText.includes(`/${name}`)) {
    commandsWired++
    continue
  }
  errors.push(
    `commands/${entry} is invoked by no skill, agent, agent_doc or rule — it runs only if the user happens to ` +
      `type \`/${name}\`. Reference it from whatever produces the work it audits (the way new-page calls ` +
      `/design-check), or add it to USER_ENTRY_COMMANDS if being typed is the whole point`
  )
}

// --- 36. A preset that names a version must date that claim -------------------
// `CLAUDE.md` states the preset risk in one line: "A new preset must be accurate, not merely
// plausible: the risk is staleness, not breadth." Check 26 built the mechanism for exactly that
// — digest the claim, date the review, age the date — and applied it to one hand-picked file,
// `rules/600-devops.md`. Check 29 then generalised the age-out to every `<!-- reviewed: -->`
// marker in the kit, presets included. What was still missing is the requirement: nothing made a
// preset carry one, so the age-out aged a set that happened to be empty.
//
// Scoped to presets whose H1 asserts a specific upstream major ("Ruby on Rails 7/8", "Nuxt 3/4",
// "Angular (v17+…)", "SvelteKit (Svelte 5)"). That is derived from the title, not from a list of
// files, so a preset acquires the obligation the moment someone writes a version into its
// heading. Presets that assert no version are not exempted by an allowlist — they simply make no
// claim that upstream can falsify, which is why their titles are written the way they are.
//
// The heading was where this started and only ever half of it. A preset makes the same falsifiable
// claim in its body — "Swift 6 strict", "Next.js 16 patterns", "Express 5 · Express 4", "Go 1.22+"
// — and three presets carried one with no marker while the check reported a clean pass, because
// the arm below graded titles. Same class as check 26's original shape: a mechanism aimed at one
// hand-picked location while the population it was built for sat outside the scan.
//
// The body arm derives its vocabulary from the preset H1s themselves rather than from a hand-typed
// list of technologies, so the day a preset for a new stack lands, its name is already a term the
// scan knows. Round 42 tried the opposite — spraying 600-devops's pin regex across the whole kit —
// and it read `4.5:1` as a version; scoping the pattern to `<name the kit itself ships a preset
// for> <number>` inside `presets/` is what keeps the false-positive rate at zero.
const H1_VERSION_CLAIM = /\bv?\d+(?:\.\d+)*(?:\s*\/\s*\d+(?:\.\d+)*)*\s*\+?/
let versionedPresets = 0
const presetFiles: string[] = []
collectMarkdown('presets', presetFiles)

// The marker is a property of the PRESET, not of each file in it: `compact.md` is a 7-15 line
// summary under its own budget, so requiring it to repeat the comment would spend a scarce line to
// say something its `CLAUDE.md` already says.
const presetDir = (f: string): string => f.slice(0, f.lastIndexOf('/'))
const reviewedDirs = new Set<string>()
for (const f of presetFiles) {
  if (/<!--\s*reviewed:\s*\d{4}-\d{2}/.test(read(f))) reviewedDirs.add(presetDir(f))
}

// Connectors that survive tokenising an H1 ("Ruby on Rails") and generic catalogue nouns. Without
// this, `on` matched "…on 19 signals" and reported a version claim that was never made.
const H1_STOPWORDS = new Set(['on', 'of', 'for', 'with', 'and', 'the', 'project', 'preset', 'database', 'orm', 'infrastructure', 'generic'])
const techVocab = new Set<string>()
for (const presetFile of presetFiles) {
  if (!presetFile.endsWith('/CLAUDE.md')) continue
  const h1 = read(presetFile).split('\n').find(l => l.startsWith('# ')) ?? ''
  for (const token of h1.split('—').slice(1).join(' ').split(/[^A-Za-z.#+/]+/)) {
    const term = token.replace(/^[./]+|[./]+$/g, '')
    if (term.length >= 2 && !H1_STOPWORDS.has(term.toLowerCase())) techVocab.add(term)
  }
}
const BODY_VERSION_CLAIM =
  techVocab.size > 0
    ? new RegExp(`\\b(?:${[...techVocab].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+v?\\d+(?:\\.\\d+)*\\+?`)
    : null

for (const presetFile of presetFiles) {
  const body = read(presetFile)
  const dir = presetDir(presetFile)
  const reviewed = reviewedDirs.has(dir)

  if (presetFile.endsWith('/CLAUDE.md')) {
    const h1 = body.split('\n').find(l => l.startsWith('# ')) ?? ''
    const claim = h1.split('—').slice(1).join('—')
    if (H1_VERSION_CLAIM.test(claim)) {
      versionedPresets++
      if (!reviewed) {
        errors.push(
          `${presetFile} names a specific version in its heading (${h1.trim()}) but carries no ` +
            `\`<!-- reviewed: YYYY-MM — what was checked -->\` marker. A version claim is the one thing in a preset ` +
            `that upstream can falsify while the file sits unchanged; date it so check 29 can age it out`
        )
      }
      continue
    }
  }

  if (reviewed || BODY_VERSION_CLAIM === null) continue
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) continue
    const hit = BODY_VERSION_CLAIM.exec(lines[i])
    if (!hit) continue
    errors.push(
      `${presetFile}:${i + 1} states "${hit[0]}" but its preset carries no ` +
        `\`<!-- reviewed: YYYY-MM — what was checked -->\` marker. A version in the body ages exactly like one ` +
        `in the heading; put the marker in the preset's CLAUDE.md`
    )
    break
  }
}

// --- 37. The per-session floor is a SUM, and only its first term was budgeted ----
// Check 3 caps three files at 250 lines each and 500 combined, and states the reason in its
// own comment: they "cost every user's context budget on every single turn, forever". That
// reason does not stop at those three files. Before the user types anything, the harness has
// also injected every skill's description + when_to_use, every agent's description, and every
// command's frontmatter. Measured on round 44's tree: 5.8k tokens of always-loaded files and
// 2.3k of trigger text — 29% of the real floor, and the only guard on it was per-item.
//
// Per-item is not a budget when the item count only grows. Check 3 already learned this once:
// "three files at 249 lines each would pass every per-file check while costing 747 lines every
// session", which is why it has a combined cap. 25 skills each passing a 360-char cap is 9,000
// chars nobody approved, and agents and commands had no cap at all. This is that same combined
// cap, one surface over — and the per-item caps it complements now live beside it in
// lib/counts.ts so the three validators cannot disagree about the number.
//
// Reported with the worst offenders rather than as a bare total: the actionable output is
// which component to trim, and the answer is always the longest few.
const triggerEntries = triggerText(ROOT)
let triggerTotal = 0
if (triggerEntries.length > 0) {
  triggerTotal = triggerEntries.reduce((sum, e) => sum + e.chars, 0)
  if (triggerTotal > TRIGGER_TEXT_COMBINED_BUDGET_CHARS) {
    const worst = [...triggerEntries]
      .sort((a, b) => b.chars - a.chars)
      .slice(0, 3)
      .map(e => `${e.file} (${e.chars})`)
      .join(', ')
    errors.push(
      `skill/agent/command trigger text totals ${triggerTotal} chars across ${triggerEntries.length} component(s), over the ` +
        `${TRIGGER_TEXT_COMBINED_BUDGET_CHARS}-char combined budget. Every one of them is injected into every session before the ` +
        `user types, so this is paid alongside the ${ALWAYS_LOADED_COMBINED_BUDGET}-line always-loaded budget, not instead of it — ` +
        `each item passing its own ${TRIGGER_TEXT_BUDGET_CHARS}-char cap is exactly how the sum grew unseen. Longest: ${worst}`
    )
  }
}

// --- 38. A page the generator renders must have the asset it renders from --------
// `gen-site.ts` declares one PAGES entry per published locale, each naming an `ogImage`.
// Those cards are committed source assets on the `site-src` branch, generated by hand with
// `npm run gen-og` because rasterising needs Chrome. So the claim lives on `main` and its
// evidence lives on another branch, with nothing binding them — add a locale, forget the
// card, and every check on `main` stays green because `main` has nothing to check.
//
// That is not hypothetical: the Turkish locale shipped in PAGES while `og.tr.png` sat
// uncommitted on a maintainer's machine, and the first thing that noticed was the publish
// workflow dying on an ENOENT stack trace inside a PNG header parser — a failure that names
// `binding.open` and `readUInt32BE`, not the file to generate or the command that makes it.
//
// This runs in the same place check 28 does: the site workflow, which is the only context
// where both branches exist. Silence when site/ is absent would read as a pass, so it says so.
const pagesSrc = existsSync(join(ROOT, 'scripts/gen-site.ts')) ? read('scripts/gen-site.ts') : ''
// Parsed from source rather than imported: gen-site.ts throws at module load when site/ is
// absent (deliberately — every read below that point would otherwise fail on an unrecognisable
// path), and a checker that cannot run in a plain clone is a checker that runs nowhere.
const declaredCards = [...pagesSrc.matchAll(/ogImage:\s*'([^']+)'/g)].map(m => m[1])
let siteCardsChecked = 0
if (pagesSrc.includes('export const PAGES') && declaredCards.length === 0) {
  errors.push(
    'check 38 found no `ogImage:` entries in scripts/gen-site.ts despite a PAGES declaration — the literal shape changed and the card check is comparing nothing'
  )
}
if (existsSync(join(ROOT, 'site'))) {
  for (const card of declaredCards) {
    if (existsSync(join(ROOT, 'site', card))) {
      siteCardsChecked++
    } else {
      errors.push(
        `scripts/gen-site.ts declares a locale whose social card is site/${card}, but that file is not on the \`site-src\` branch. ` +
          `Run \`npm run gen-og\` (needs Chrome) and commit the result to \`site-src\` — otherwise the publish workflow fails inside ` +
          `gen-site.ts's PNG header read, which names neither the missing card nor the command that makes it`
      )
    }
  }
}

// --- 39. A rule that escalates must lock its own procedures behind the approval -----
// Round 43 measured it: `global-CLAUDE.md` and `rules/500-database.md`, each producing the correct
// escalation alone, together produced a `DROP COLUMN` migration. The fix went into global-CLAUDE.md
// — "escalating is not a step you complete by printing that line" — and round 45 measured the same
// regression again, 3 of 3 samples, on the same pair.
//
// Because the fix was in the wrong file. When both are loaded, the *procedural* file is the more
// specific one, and 500-database.md carried a zero-downtime pattern, a backup protocol and example
// DROP SQL with nothing scoping them to after the approval. A model reading "escalate" in one file
// and "here is how the migration is written" in another follows the one that answers the request.
//
// So the qualifier belongs beside the procedures, in every rule file that escalates — which is a
// property a check can hold. Derived from `ESCALATE TO:` appearing in the file, not from a list of
// filenames, so a new guarded rule file arrives already owing the sentence.
const ESCALATION_QUALIFIER = /Everything below this line is what \S+ applies \*after\* the user approves its plan/
let escalatingRulesChecked = 0
if (existsSync(join(ROOT, 'rules'))) {
  for (const name of readdirSync(join(ROOT, 'rules')).filter(n => n.endsWith('.md'))) {
    const body = read(join('rules', name))
    if (!body.includes('ESCALATE TO:')) continue
    escalatingRulesChecked++
    if (!ESCALATION_QUALIFIER.test(body)) {
      errors.push(
        `rules/${name} tells the model to ESCALATE TO: a guard, then ships the procedures that satisfy the request ` +
          `anyway, with nothing scoping them to after the approval. Measured twice (rounds 43 and 45): with the ` +
          `always-loaded protocol AND this file in context, the model follows the procedures. Add the ` +
          `"Everything below this line is what <guard> applies *after* the user approves its plan" paragraph ` +
          `directly under the HARD RULE block`
      )
    }
  }
}

// An arm that grades nothing fails rather than vanishing from the summary: a forbidden shape
// with an empty population is a rule nobody is enforcing, and silence reads as a pass. Same
// reasoning as check 22's "parsed 0 patterns" guard and check 28's scan-nothing message.
if (forbiddenShapes.length > 0 && shapeLinesGraded === 0) {
  errors.push(
    `${forbiddenShapes.length} forbidden-in-examples shape(s) are declared by rule files, but the fence/marker ` +
      `scan graded 0 exemplary line(s) against them — the declaration is inert. Either the marker block moved ` +
      `or the fence scan broke; a shape nobody is graded against is not a rule`
  )
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} consistency drift issue(s) found:\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ No bare-year freshness labels; ${freshnessMarkers} dated review marker(s) within the ${FRESHNESS_MAX_MONTHS}-month window.`)
if (historyDepth !== null && historyDepth < MIN_COMMITS_FOR_PROVENANCE) {
  console.log(`✓ No shipped document cites git history as authoritative (repo has ${historyDepth} commit(s) — squashed at v1.0.0).`)
}
if (measuredRuns.length > 0) {
  console.log(
    `✓ ${abClaimCount} README A/B claim(s) match a recorded run in ${measuredRuns.length} eval suite(s): ` +
      measuredRuns
        .map(({ file, run }) => `${file.replace('eval/', '')} control ${run.control_passed}/${run.prompts}, treatment ${run.treatment_passed}/${run.prompts} (${run.date})`)
        .join(' · ')
  )
}
console.log(`✓ ${shellBlocksChecked} fenced command block(s) carry a PowerShell form wherever they use an inline env-var prefix.`)
console.log(`✓ ${evalSuitesChecked} recorded eval measurement(s) still describe the suite on disk (a null last_measured is skipped, not passed).`)
console.log(`✓ ${commandsWired} command(s) reachable from a skill, agent, agent_doc or rule; ${USER_ENTRY_COMMANDS.size} declared user-entry-only.`)
console.log(
  `✓ ${versionedPresets} preset(s) name a version in their heading and date that claim; ` +
    `${reviewedDirs.size} preset(s) carry a dated review marker, and every version claim found in a preset body ` +
    `(vocabulary derived from ${techVocab.size} terms in the preset headings) sits under one (check 29 ages the markers).`
)
if (presetLanguagesChecked > 0) {
  console.log(`✓ ${presetLanguagesChecked} language-bearing preset(s) have a LANGUAGE-SPECIFIC HOTSPOTS row in rules/000-security.md.`)
}
console.log(`✓ Golden-prompt count claims match disk (${actualPromptCount}).`)
console.log(`✓ Node version consistent across ${workflowFiles.length} workflow file(s), .node-version, and package.json engines (${[...allVersions][0] ?? 'none pinned'}).`)
console.log(`✓ Always-loaded files (${alwaysLoadedFiles.join(', ')}) within the ${ALWAYS_LOADED_LINE_BUDGET}-line per-file budget (combined: ${alwaysLoadedTotal}/${ALWAYS_LOADED_COMBINED_BUDGET}).`)
if (ciWorkflowFile) console.log(`✓ CI unit-test command matches package.json's "test" script.`)
if (actualPassCount !== null) console.log(`✓ Test-count claims across ${COUNT_CLAIM_DOCS.length} shipped document(s) match \`${pkgTestScript}\` (${actualPassCount} passing).`)
if (actualSuiteCount !== null) console.log(`✓ Suite-count claims across ${COUNT_CLAIM_DOCS.length} shipped document(s) match \`${pkgTestScript}\` (${actualSuiteCount} suites).`)
if (denyCountClaims.length > 0) console.log(`✓ SECURITY.md deny-rule count claims match settings-template.json (${denyRuleCount ?? 0}).`)
if (existsSync(join(ROOT, '.claude/settings.json')) && existsSync(join(ROOT, 'settings-template.json'))) {
  console.log(`✓ .claude/settings.json is byte-identical to settings-template.json (${denyRuleCount ?? 0} deny rules, same order).`)
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
if (siteTemplatesChecked > 0) {
  console.log(`✓ Landing-page templates state no hand-typed component count (${siteTemplatesChecked} template(s) scanned).`)
} else {
  // Silence here would read as a pass. It is not: the templates live on the `site`
  // branch, and this check only has anything to say when that branch is checked out
  // into site/ — which the site workflow does, and a plain clone of the kit does not.
  console.log('· Landing-page count check scanned nothing — site/ is absent (page source lives on the `site-src` branch).')
}
if (siteCardsChecked > 0) {
  console.log(`✓ Every locale gen-site.ts publishes has its social card committed on \`site-src\` (${siteCardsChecked} card(s)).`)
} else if (declaredCards.length > 0) {
  console.log(`· Social-card check scanned nothing — site/ is absent, so the ${declaredCards.length} card(s) gen-site.ts needs cannot be verified from a plain clone.`)
}
if (triggerEntries.length > 0) {
  console.log(
    `✓ Per-session trigger text is ${triggerTotal}/${TRIGGER_TEXT_COMBINED_BUDGET_CHARS} chars across ${triggerEntries.length} component(s) ` +
      `— the half of the session floor that sits outside the always-loaded line budget.`
  )
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
if (presetNameListsChecked > 0) {
  console.log(`✓ Preset name lists match presets/ 1:1 (${presetNameListsChecked} list(s) checked).`)
}
if (doctorComponentsChecked > 0) {
  console.log(`✓ kit-doctor counts every installer directory component (${doctorComponentsChecked}) and states no stale deny-rule floor.`)
}
if (stackPresetsChecked > 0) {
  console.log(`✓ Every code-stack preset has a row in agent_docs/stack-commands.md (${stackPresetsChecked} checked).`)
}
if (protectedPatternsChecked > 0) {
  console.log(`✓ Every PROTECTED FILES pattern has a Read(...) deny rule behind it (${protectedPatternsChecked} checked).`)
}
if (escalatingRulesChecked > 0) {
  console.log(`✓ Every rule file that escalates scopes its own procedures to after the approval (${escalatingRulesChecked} checked).`)
}
if (credentialWritesChecked > 0) {
  console.log(`✓ Every credential pattern is Edit(...)-denied too, not just Read (${credentialWritesChecked} pattern(s) matched).`)
}
if (bootSignalsChecked > 0) {
  console.log(`✓ Every data-layer preset is detectable by BOOT SEQUENCE step 4 (${bootSignalsChecked} signals checked).`)
}
if (yamlLinesChecked > 0) {
  console.log(`✓ YAML files fit yamllint's line limit as CI configures it (${yamlLinesChecked} lines checked).`)
}
if (executableClaimCount > 0) {
  console.log(`✓ Every documented command, installer flag and slash command resolves (${executableClaimCount} checked across ${REPO_DOC_GLOBS.length} document(s) plus the SessionStart hook).`)
}
if (kitRefFiles.length > 0) {
  console.log(
    `✓ ${kitRefsChecked} kit-internal path reference(s) across ${kitRefFiles.length} agent/skill/command file(s) resolve and are install-mode agnostic.`
  )
}
if (retiredToolsChecked > 0) {
  console.log(`✓ No preset/agent/skill/doc recommends a tool a rule file retires (${retiredToolsChecked} retired tool(s) tracked).`)
}
if (presetCitationsChecked > 0) {
  console.log(`✓ Every preset whose rule file ships an overlapping checklist cites it (${presetCitationsChecked} checked).`)
}
if (pinReviewAge) console.log(`✓ ${PIN_FILE}: ${pinReviewAge}.`)
if (shapeLinesGraded + logLinesGraded + actionLinesGraded > 0) {
  console.log(
    `✓ Exemplary code in the kit's own fenced examples obeys the prose around it ` +
      `(${shapeLinesGraded} line(s) vs ${forbiddenShapes.length} rule-declared forbidden shape(s); ` +
      `${logLinesGraded} log-call line(s) vs ${bannedLogFields.length} never-log field(s); ` +
      `${actionLinesGraded} \`uses:\` step(s) vs Actions SHA-pinning).`
  )
}
if (stackRowCount !== null) console.log(`✓ global-CLAUDE.md's stack count matches stack-commands.md (${stackRowCount}).`)
if (repoSlug) console.log(`✓ ${slugRefCount} GitHub link(s) all point at ${repoSlug} (package.json canonical).`)
process.exit(0)
