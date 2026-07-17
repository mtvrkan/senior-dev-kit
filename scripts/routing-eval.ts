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
import { readFileSync, readdirSync, existsSync, realpathSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { parseFrontmatter } from './lib/frontmatter.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const GOLDEN_FILE = join(REPO_ROOT, 'eval', 'golden-prompts.json')
const AGENTS_DIR = join(REPO_ROOT, 'agents')
const SKILLS_DIR = join(REPO_ROOT, 'skills')

// Support agents invoked directly rather than via task-type routing signals —
// no golden prompt is required for them.
const ROUTING_EXEMPT = new Set<string>([])

interface GoldenPrompt {
  prompt: string
  expect: string
  expectedSkill?: string
  note?: string
}

// Skill auto-invocation is Anthropic's platform matcher against a skill's
// `description`/`when_to_use` — not something this repo's CI can meaningfully
// live-test the way agent routing is (the kit owns and ships ROUTING.md; it
// does not own the skill-matching algorithm). What the kit DOES own is the
// description text itself, so this is a cheap drift lint, not a behavioral
// proof: fail only when a golden prompt shares literally zero significant
// words with its expected skill's description/when_to_use — a weak signal
// deliberately, to catch total drift without false-failing on paraphrase.
const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'about', 'into', 'your', 'their',
  'they', 'them', 'were', 'when', 'what', 'which', 'while', 'over', 'need',
  'ekle', 'için', 'olan', 'olur', 'edin', 'yapı', 'değil',
])
export function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-zçğıöşü0-9-]{4,}/g)
      ?.filter(w => !STOPWORDS.has(w)) ?? []
  )
}
function checkSkillDescriptionOverlap(entry: GoldenPrompt, fail: (msg: string) => void): void {
  if (!entry.expectedSkill) return
  const skillFile = join(SKILLS_DIR, entry.expectedSkill, 'SKILL.md')
  if (!existsSync(skillFile)) {
    fail(`prompt "${entry.prompt}" expects unknown skill '${entry.expectedSkill}' (no skills/${entry.expectedSkill}/SKILL.md)`)
    return
  }
  const fm = parseFrontmatter(readFileSync(skillFile, 'utf8'))
  const triggerText = `${fm?.description ?? ''} ${fm?.when_to_use ?? ''}`
  const skillWords = significantWords(triggerText)
  const promptWords = significantWords(entry.prompt)
  const overlap = [...promptWords].some(w => skillWords.has(w))
  if (!overlap) {
    fail(
      `prompt "${entry.prompt}" and skills/${entry.expectedSkill}/SKILL.md's description/when_to_use share zero significant words — likely description drift`
    )
  }
}

// The model is instructed to answer with exactly one agent name, but a chatty
// reply ("route to bug-hunter, not security-guard, because…") must not score
// by substring accident. Exact match first; otherwise accept a name only when
// exactly one distinct agent appears token-bounded in the answer — an answer
// naming several agents is ambiguous and scores as a miss. Pure + exported (and
// taking the agent-name set as a parameter rather than a module global) so the
// scoring rule can be unit-tested without invoking the live CLI eval.
export function extractRoutedAgent(answer: string, agentNames: Set<string>): string | null {
  if (agentNames.has(answer)) return answer
  const mentioned = [...agentNames].filter(a => new RegExp(`(^|[^a-z0-9-])${a}($|[^a-z0-9-])`).test(answer))
  return mentioned.length === 1 ? mentioned[0] : null
}

function main(): void {
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
    checkSkillDescriptionOverlap(entry, fail)
  }

  for (const agent of agentNames) {
    if (!coveredAgents.has(agent) && !ROUTING_EXEMPT.has(agent)) {
      fail(`agent '${agent}' has no golden prompt — routing to it is untested`)
    }
  }

  const skillChecked = golden.prompts.filter(p => p.expectedSkill).length
  if (exitCode === 0) {
    console.log(`  ✓ ${golden.prompts.length} golden prompts, all expected agents exist`)
    console.log(`  ✓ all ${agentNames.size} routable agents covered by at least one prompt`)
    if (skillChecked > 0) console.log(`  ✓ ${skillChecked} prompt(s) with expectedSkill share signal with that skill's description`)
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
      let answer: string
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
      const got = extractRoutedAgent(answer, agentNames) ?? answer.slice(0, 40)
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
}

// Run the eval only when invoked as the entry point — importing this module (to
// unit-test extractRoutedAgent) must not trigger the static checks or process.exit.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}
