// Routing behavior evaluation — treats the kit's routing rules like code under test.
//
// Static mode (default, runs in `npm run check` / CI, zero cost):
//   - eval/golden-prompts.json parses, prompts are unique and non-empty
//   - every expected agent exists as agents/<name>.md
//   - every routable agent is covered by at least one golden prompt
//
// Live mode (RUN_ROUTING_EVAL=1, needs the `claude` CLI and API credits):
//   A/B. Every prompt is routed TWICE and both arms are scored against the golden
//   expectations:
//     control   — the agent frontmatter `description` lines only. This is what
//                 Claude Code has natively from any agent install, with no kit
//                 routing doc in context. It is the "without the kit" baseline.
//     treatment — the same, plus agents/ROUTING.md.
//   Three ways to fail: the treatment arm below pass_threshold (the kit routes badly);
//   the treatment arm failing to beat control by min_lift (the kit's routing doc costs
//   context every session and buys nothing); or more than max_regressions prompts that
//   plain descriptions route correctly and ROUTING.md breaks (net lift is an aggregate
//   and would otherwise let breakage cancel against improvement). The last two are what
//   matter: before this arm existed, every number in this repo measured whether
//   documentation matched disk, and nothing measured whether the kit changed the
//   model's behavior at all.
//   Cost: 2 CLI calls per prompt (control + treatment), so 52 for the current 26.
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
  // 'İ'.toLowerCase() yields 'i' + U+0307 (combining dot above), which falls
  // outside the character class and split words like "İşlem" → "şlem" —
  // round-31 finding. Strip the combining mark before matching.
  return new Set(
    text
      .toLowerCase()
      .replace(/̇/g, '')
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
    min_lift?: number
    max_regressions?: number
    prompts: GoldenPrompt[]
  }

  if (typeof golden.pass_threshold !== 'number' || golden.pass_threshold <= 0 || golden.pass_threshold > 1) {
    fail(`pass_threshold must be in (0, 1], got: ${golden.pass_threshold}`)
  }
  // Validated statically so a malformed value fails in CI rather than an hour into a paid live run.
  if (golden.min_lift !== undefined && (typeof golden.min_lift !== 'number' || golden.min_lift < 0 || golden.min_lift > 1)) {
    fail(`min_lift must be in [0, 1] when present, got: ${golden.min_lift}`)
  }
  if (
    golden.max_regressions !== undefined &&
    (!Number.isInteger(golden.max_regressions) || golden.max_regressions < 0)
  ) {
    fail(`max_regressions must be a non-negative integer when present, got: ${golden.max_regressions}`)
  }
  if (!Array.isArray(golden.prompts) || golden.prompts.length === 0) {
    fail('prompts array is missing or empty')
    process.exit(1)
  }

  const agentNames = new Set(
    readdirSync(AGENTS_DIR)
      .filter(f => f.endsWith('.md') && f !== 'ROUTING.md' && f !== 'README.md')
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
    console.log('\nRouting eval — live A/B (control = agent descriptions only, treatment = + ROUTING.md)...\n')
    const routingDoc = readFileSync(join(AGENTS_DIR, 'ROUTING.md'), 'utf8')
    const sortedAgents = [...agentNames].sort()
    const agentList = sortedAgents.join(', ')

    // The control arm is not "no information" — that would be a strawman that any
    // document beats. It is the information Claude Code already has without this
    // kit's routing doc: each agent's frontmatter `description`, which the harness
    // surfaces for every installed agent. So the delta below isolates exactly what
    // ROUTING.md adds on top of descriptions the kit would ship anyway.
    const descriptions = sortedAgents
      .map(name => {
        const fm = parseFrontmatter(readFileSync(join(AGENTS_DIR, `${name}.md`), 'utf8'))
        return `- ${name}: ${fm?.description ?? '(no description)'}`
      })
      .join('\n')

    const ask = (body: string, prompt: string): string | null => {
      const evalPrompt =
        `You are the routing layer of a Claude Code agent kit. Decide which single agent handles ` +
        `the user request. Answer with EXACTLY one agent name from this list and nothing else: ${agentList}\n\n` +
        `${body}\n\nUser request: ${prompt}`
      try {
        return execFileSync('claude', ['-p', evalPrompt, '--output-format', 'text'], {
          encoding: 'utf8',
          timeout: 120_000,
        })
          .trim()
          .toLowerCase()
      } catch (err) {
        fail(`claude CLI failed for "${prompt}": ${err instanceof Error ? err.message : String(err)}`)
        return null
      }
    }

    const controlBody = `<available-agents>\n${descriptions}\n</available-agents>`
    const treatmentBody =
      `<available-agents>\n${descriptions}\n</available-agents>\n\n` +
      `Use the routing rules below; they take precedence over the descriptions above.\n` +
      `<routing-rules>\n${routingDoc}\n</routing-rules>`

    let controlPassed = 0
    let treatmentPassed = 0
    let scored = 0
    // Prompts the kit's own doc gets wrong while plain descriptions get right. These
    // are the most actionable output of the whole eval — a routing rule actively
    // steering the model away from the right answer — so they are reported separately
    // rather than buried in the treatment-arm failure list.
    const regressions: Array<{ prompt: string; expected: string; got: string }> = []

    for (const entry of golden.prompts) {
      const controlAnswer = ask(controlBody, entry.prompt)
      const treatmentAnswer = ask(treatmentBody, entry.prompt)
      if (controlAnswer === null || treatmentAnswer === null) continue
      scored++

      const controlGot = extractRoutedAgent(controlAnswer, agentNames) ?? controlAnswer.slice(0, 40)
      const treatmentGot = extractRoutedAgent(treatmentAnswer, agentNames) ?? treatmentAnswer.slice(0, 40)
      const controlOk = controlGot === entry.expect
      const treatmentOk = treatmentGot === entry.expect
      if (controlOk) controlPassed++
      if (treatmentOk) treatmentPassed++
      if (controlOk && !treatmentOk) regressions.push({ prompt: entry.prompt, expected: entry.expect, got: treatmentGot })

      const mark = treatmentOk ? '✓' : '✗'
      const arm = controlOk === treatmentOk ? '=' : controlOk ? 'REGRESSION' : 'lift'
      const line = `  ${mark} [${arm}] expected ${entry.expect}, control=${controlGot}, treatment=${treatmentGot} ← "${entry.prompt}"`
      if (treatmentOk) console.log(line)
      else console.error(line)
    }

    if (scored === 0) {
      fail('live eval scored zero prompts — every claude CLI invocation failed')
    } else {
      const control = controlPassed / scored
      const treatment = treatmentPassed / scored
      const lift = treatment - control
      const minLift = golden.min_lift ?? 0
      console.log(
        `\nControl   (descriptions only): ${controlPassed}/${scored} (${(control * 100).toFixed(0)}%)` +
          `\nTreatment (+ ROUTING.md):      ${treatmentPassed}/${scored} (${(treatment * 100).toFixed(0)}%)` +
          `\nLift attributable to ROUTING.md: ${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)} pts` +
          ` — threshold ${(golden.pass_threshold * 100).toFixed(0)}% absolute, min lift ${(minLift * 100).toFixed(1)} pts`
      )

      if (treatment < golden.pass_threshold) {
        fail(`treatment arm scored ${(treatment * 100).toFixed(0)}%, below the ${(golden.pass_threshold * 100).toFixed(0)}% threshold`)
      }
      if (lift < minLift) {
        fail(
          `ROUTING.md lifted routing accuracy by only ${(lift * 100).toFixed(1)} pts (need ${(minLift * 100).toFixed(1)}). ` +
            'It is loaded into context to earn that lift; if it cannot, shrink it or fold its content into the agent descriptions'
        )
      }
      // Regressions are checked on their own, not left to be absorbed by the aggregate: lift is
      // a net figure, so three routes the doc breaks cancel against three it fixes and the run
      // passes while the kit actively misroutes six prompts. A rule that steers the model AWAY
      // from an answer it already had is a defect of a different kind from a rule that fails to
      // help, and the budget for it is zero by default.
      const maxRegressions = golden.max_regressions ?? 0
      if (regressions.length > 0) {
        console.error(`\n  ${regressions.length} prompt(s) that plain descriptions route correctly and ROUTING.md breaks:`)
        for (const r of regressions) console.error(`    ✗ ${r.prompt} — expected ${r.expected}, ROUTING.md said ${r.got}`)
      }
      if (regressions.length > maxRegressions) {
        fail(
          `ROUTING.md broke ${regressions.length} route(s) that the agent descriptions alone get right ` +
            `(budget ${maxRegressions}). Net lift can hide this — fix the rule that misroutes them, or raise ` +
            `max_regressions in eval/golden-prompts.json with a written reason`
        )
      }
    }
  } else if (exitCode === 0) {
    console.log(
      // No test count in this string on purpose: it was hand-typed as "341" and went stale the
      // first time a test was added. Every count this repo prints is derived from disk or not
      // printed at all.
      '\n(live A/B skipped — set RUN_ROUTING_EVAL=1 with the claude CLI available. ' +
        'Until it runs, NOTHING in this repo measures whether the kit changes model behavior; ' +
        'every other check here verifies that documentation matches disk.)'
    )
  }

  process.exit(exitCode)
}

// Run the eval only when invoked as the entry point — importing this module (to
// unit-test extractRoutedAgent) must not trigger the static checks or process.exit.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}
