// Routing behavior evaluation — treats the kit's routing rules like code under test.
//
// Static mode (default, runs in `npm run check` / CI, zero cost):
//   - eval/golden-prompts.json parses, prompts are unique and non-empty
//   - every expected agent exists as agents/<name>.md
//   - every routable agent is covered by at least one golden prompt
//
// Live mode (RUN_ROUTING_EVAL=1, needs the `claude` CLI and API credits):
//   asks the model to route each prompt using the kit's actual routing docs and
//   scores the answers against the golden expectations. Fails below pass_threshold.
//   Run: RUN_ROUTING_EVAL=1 npm run routing-eval
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const GOLDEN_FILE = join(REPO_ROOT, 'eval', 'golden-prompts.json')
const AGENTS_DIR = join(REPO_ROOT, 'agents')

// Support agents invoked directly rather than via task-type routing signals —
// no golden prompt is required for them.
const ROUTING_EXEMPT = new Set<string>([])

interface GoldenPrompt {
  prompt: string
  expect: string
  note?: string
}

let exitCode = 0
const fail = (msg: string): void => {
  console.error(`  ✗ ${msg}`)
  exitCode = 1
}

console.log('Routing eval — static checks...\n')

if (!existsSync(GOLDEN_FILE)) {
  fail('eval/golden-prompts.json is missing')
  process.exit(1)
}

const golden = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')) as {
  pass_threshold: number
  prompts: GoldenPrompt[]
}

if (typeof golden.pass_threshold !== 'number' || golden.pass_threshold <= 0 || golden.pass_threshold > 1) {
  fail(`pass_threshold must be in (0, 1], got: ${golden.pass_threshold}`)
}
if (!Array.isArray(golden.prompts) || golden.prompts.length === 0) {
  fail('prompts array is missing or empty')
  process.exit(1)
}

const agentNames = new Set(
  readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'ROUTING.md')
    .map(f => f.replace(/\.md$/, ''))
)

const seenPrompts = new Set<string>()
const coveredAgents = new Set<string>()
for (const [i, entry] of golden.prompts.entries()) {
  if (!entry.prompt || entry.prompt.trim() === '') fail(`prompts[${i}] has an empty prompt`)
  if (seenPrompts.has(entry.prompt)) fail(`duplicate prompt: "${entry.prompt}"`)
  seenPrompts.add(entry.prompt)
  if (!agentNames.has(entry.expect)) {
    fail(`prompts[${i}] expects unknown agent '${entry.expect}' (no agents/${entry.expect}.md)`)
  }
  coveredAgents.add(entry.expect)
}

for (const agent of agentNames) {
  if (!coveredAgents.has(agent) && !ROUTING_EXEMPT.has(agent)) {
    fail(`agent '${agent}' has no golden prompt — routing to it is untested`)
  }
}

if (exitCode === 0) {
  console.log(`  ✓ ${golden.prompts.length} golden prompts, all expected agents exist`)
  console.log(`  ✓ all ${agentNames.size} routable agents covered by at least one prompt`)
}

// --- live evaluation (opt-in) ---
if (process.env.RUN_ROUTING_EVAL === '1' && exitCode === 0) {
  console.log('\nRouting eval — live (asking the model to route each prompt)...\n')
  const routingDoc = readFileSync(join(AGENTS_DIR, 'ROUTING.md'), 'utf8')
  const agentList = [...agentNames].sort().join(', ')
  let passed = 0
  const failures: Array<{ prompt: string; expected: string; got: string }> = []

  for (const entry of golden.prompts) {
    const evalPrompt =
      `You are the routing layer of a Claude Code agent kit. Using ONLY the routing rules below, ` +
      `decide which single agent handles the user request. Answer with EXACTLY one agent name from this list ` +
      `and nothing else: ${agentList}\n\n<routing-rules>\n${routingDoc}\n</routing-rules>\n\n` +
      `User request: ${entry.prompt}`
    let answer = ''
    try {
      answer = execFileSync('claude', ['-p', evalPrompt, '--output-format', 'text'], {
        encoding: 'utf8',
        timeout: 120_000,
      })
        .trim()
        .toLowerCase()
    } catch (err) {
      fail(`claude CLI failed for "${entry.prompt}": ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    const got = [...agentNames].find(a => answer.includes(a)) ?? answer.slice(0, 40)
    if (got === entry.expect) {
      passed++
      console.log(`  ✓ ${entry.expect} ← "${entry.prompt}"`)
    } else {
      failures.push({ prompt: entry.prompt, expected: entry.expect, got })
      console.error(`  ✗ expected ${entry.expect}, got ${got} ← "${entry.prompt}"`)
    }
  }

  const score = passed / golden.prompts.length
  console.log(`\nLive routing score: ${passed}/${golden.prompts.length} (${(score * 100).toFixed(0)}%) — threshold ${(golden.pass_threshold * 100).toFixed(0)}%`)
  if (score < golden.pass_threshold) exitCode = 1
} else if (exitCode === 0) {
  console.log('\n(live evaluation skipped — set RUN_ROUTING_EVAL=1 with the claude CLI available to score real routing)')
}

process.exit(exitCode)
