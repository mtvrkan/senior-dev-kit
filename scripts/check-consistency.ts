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
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} consistency drift issue(s) found:\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ Version fields match (${pkgVersion}).`)
console.log(`✓ Golden-prompt count claims match disk (${actualPromptCount}).`)
console.log(`✓ Node version consistent across ${workflowFiles.length} workflow file(s) (${[...allVersions][0] ?? 'none pinned'}).`)
process.exit(0)
