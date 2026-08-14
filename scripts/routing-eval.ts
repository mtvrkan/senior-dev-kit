// Routing behavior evaluation — treats the kit's routing rules like code under test.
//
// Static mode (default, runs in `npm run check` / CI, zero cost):
//   - eval/golden-prompts.json parses, prompts are unique and non-empty
//   - every expected agent exists as agents/<name>.md (or is the literal NO_AGENT)
//   - every routable agent is covered by at least one golden prompt
//   - at least one prompt expects NO_AGENT (see below)
//
// The NO_AGENT expectation, added round 45. For four rounds every prompt here expected some
// agent, so the suite could only detect two of the three ways routing fails: sending work to
// the wrong agent, and failing to send work that should go. It was structurally blind to the
// third — sending work that should have stayed in the main loop — because a ROUTING.md that
// delegated absolutely everything would have scored 27/27. That is not a hypothetical bias:
// over-routing is the failure a routing document actively causes (its whole job is to argue
// for delegation), and it is the expensive one, since a subagent is a fresh context window
// that re-reads the project to do a one-line edit. So both arms may now answer `none`, and
// the suite carries Tier 0-1 prompts whose correct answer is exactly that.
//
// Live mode (RUN_ROUTING_EVAL=1, needs the `claude` CLI and API credits):
//   A/B. Every prompt is routed TWICE and both arms are scored against the golden
//   expectations:
//     control   — the agent frontmatter `description` lines only. This is what
//                 Claude Code has natively from any agent install, with no kit
//                 routing doc in context. It is the "without the kit" baseline.
//     treatment — the same, plus agents/ROUTING.md.
//   Three ways to fail: the treatment arm below pass_threshold (the kit routes badly);
//   the treatment arm fixing less than min_error_reduction of the routes control gets
//   wrong (the kit's routing doc costs context every session and buys nothing); or more
//   than max_regressions prompts that
//   plain descriptions route correctly and ROUTING.md breaks (net lift is an aggregate
//   and would otherwise let breakage cancel against improvement). The last two are what
//   matter: before this arm existed, every number in this repo measured whether
//   documentation matched disk, and nothing measured whether the kit changed the
//   model's behavior at all.
//   Cost: 2 CLI calls per prompt (control + treatment). No total here on purpose — a
//   hand-typed one went stale the first time a prompt was added, twice.
//   Run: RUN_ROUTING_EVAL=1 npm run routing-eval
import { readFileSync, readdirSync, existsSync, realpathSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { parseFrontmatter } from './lib/frontmatter.ts'
import { evalContextDigest } from './lib/eval-context.ts'
import { confirmRegression } from './lib/eval-sampling.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const GOLDEN_FILE = join(REPO_ROOT, 'eval', 'golden-prompts.json')
const AGENTS_DIR = join(REPO_ROOT, 'agents')
const SKILLS_DIR = join(REPO_ROOT, 'skills')

// Support agents invoked directly rather than via task-type routing signals —
// no golden prompt is required for them.
const ROUTING_EXEMPT = new Set<string>([])

// The answer that means "handle this in the main loop, delegate to nobody". A reserved word
// rather than an agent, so it can never collide with a real agent name (validated below).
export const NO_AGENT = 'none'

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
    min_error_reduction?: number
    max_regressions?: number
    prompts: GoldenPrompt[]
  }

  if (typeof golden.pass_threshold !== 'number' || golden.pass_threshold <= 0 || golden.pass_threshold > 1) {
    fail(`pass_threshold must be in (0, 1], got: ${golden.pass_threshold}`)
  }
  // Validated statically so a malformed value fails in CI rather than an hour into a paid live run.
  if (
    golden.min_error_reduction !== undefined &&
    (typeof golden.min_error_reduction !== 'number' || golden.min_error_reduction < 0 || golden.min_error_reduction > 1)
  ) {
    fail(`min_error_reduction must be in [0, 1] when present, got: ${golden.min_error_reduction}`)
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

  if (agentNames.has(NO_AGENT)) {
    fail(`an agent is literally named '${NO_AGENT}', which collides with the reserved answer meaning "do not delegate" — rename the agent`)
  }

  const seenPrompts = new Set<string>()
  const coveredAgents = new Set<string>()
  let negativeCases = 0
  for (const [i, entry] of golden.prompts.entries()) {
    if (!entry.prompt || entry.prompt.trim() === '') fail(`prompts[${i}] has an empty prompt`)
    if (seenPrompts.has(entry.prompt)) fail(`duplicate prompt: "${entry.prompt}"`)
    seenPrompts.add(entry.prompt)
    if (entry.expect === NO_AGENT) {
      negativeCases++
    } else if (!agentNames.has(entry.expect)) {
      fail(`prompts[${i}] expects unknown agent '${entry.expect}' (no agents/${entry.expect}.md, and it is not the reserved '${NO_AGENT}')`)
    } else {
      coveredAgents.add(entry.expect)
    }
    checkSkillDescriptionOverlap(entry, fail)
  }

  for (const agent of agentNames) {
    if (!coveredAgents.has(agent) && !ROUTING_EXEMPT.has(agent)) {
      fail(`agent '${agent}' has no golden prompt — routing to it is untested`)
    }
  }

  // Without this the suite silently reverts to one-sided the first time someone prunes it, and
  // a one-sided suite reports a perfect score for a routing doc that delegates everything.
  if (negativeCases === 0) {
    fail(
      `no prompt expects '${NO_AGENT}'. A suite where every correct answer is an agent cannot detect over-routing — ` +
        `it would score a ROUTING.md that delegates every request at 100%. Add at least one Tier 0-1 request whose right ` +
        `answer is "handle it in the main loop"`
    )
  }

  const skillChecked = golden.prompts.filter(p => p.expectedSkill).length
  if (exitCode === 0) {
    console.log(`  ✓ ${golden.prompts.length} golden prompts, all expected agents exist`)
    console.log(`  ✓ all ${agentNames.size} routable agents covered by at least one prompt`)
    console.log(`  ✓ ${negativeCases} prompt(s) expect '${NO_AGENT}' — the suite can detect over-routing, not just mis-routing`)
    if (skillChecked > 0) console.log(`  ✓ ${skillChecked} prompt(s) with expectedSkill share signal with that skill's description`)
  }

  // --- live evaluation (opt-in) ---
  if (process.env.RUN_ROUTING_EVAL === '1' && exitCode === 0) {
    console.log('\nRouting eval — live A/B (control = agent descriptions only, treatment = + ROUTING.md)...\n')
    const routingDoc = readFileSync(join(AGENTS_DIR, 'ROUTING.md'), 'utf8')
    const sortedAgents = [...agentNames].sort()
    const agentList = [...sortedAgents, NO_AGENT].join(', ')
    // Both arms get `none`, so the negative cases are not a trick question the control arm was
    // never told about — the delta stays attributable to ROUTING.md and nothing else.
    const answerSet = new Set([...agentNames, NO_AGENT])

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
        `the user request, or answer '${NO_AGENT}' if it should be handled directly in the main loop ` +
        `without delegating to any agent. Answer with EXACTLY one word from this list and nothing else: ${agentList}\n\n` +
        `${body}\n\nUser request: ${prompt}`
      try {
        // stdin, not argv — see behavior-eval.ts for the failure this prevents. ROUTING.md is
        // small enough that this arm never hit Windows' 32,767-character command-line cap, which
        // is luck rather than design: one preset-sized addition to the treatment body and this
        // eval would have started failing on the maintainer's platform only.
        return execFileSync('claude', ['-p', '--output-format', 'text'], {
          input: evalPrompt,
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
    // Rates are over the whole suite, not over the calls that succeeded — a shrinking denominator
    // reports a partial run as a full one. Same reasoning as behavior-eval.ts.
    const total = golden.prompts.length
    let skipped = 0
    // Prompts the kit's own doc gets wrong while plain descriptions get right. These
    // are the most actionable output of the whole eval — a routing rule actively
    // steering the model away from the right answer — so they are reported separately
    // rather than buried in the treatment-arm failure list.
    const regressions: Array<{ prompt: string; expected: string; got: string; wrong: number; taken: number }> = []
    const flakes: Array<{ prompt: string; wrong: number; taken: number }> = []

    for (const entry of golden.prompts) {
      const controlAnswer = ask(controlBody, entry.prompt)
      const treatmentAnswer = ask(treatmentBody, entry.prompt)
      if (controlAnswer === null || treatmentAnswer === null) {
        skipped++
        continue
      }

      const controlGot = extractRoutedAgent(controlAnswer, answerSet) ?? controlAnswer.slice(0, 40)
      const treatmentGot = extractRoutedAgent(treatmentAnswer, answerSet) ?? treatmentAnswer.slice(0, 40)
      const controlOk = controlGot === entry.expect
      let treatmentOk = treatmentGot === entry.expect
      if (controlOk) controlPassed++

      // Same confirmation rule as behavior-eval, and for the same reason — a zero-tolerance
      // barrier judging a single sample of a stochastic arm. See lib/eval-sampling.ts.
      if (controlOk && !treatmentOk) {
        const verdict = confirmRegression(() => {
          const again = ask(treatmentBody, entry.prompt)
          return again === null ? null : extractRoutedAgent(again, answerSet) === entry.expect
        })
        if (verdict.confirmed) {
          regressions.push({ prompt: entry.prompt, expected: entry.expect, got: treatmentGot, ...verdict })
        } else {
          treatmentOk = true
          flakes.push({ prompt: entry.prompt, wrong: verdict.wrong, taken: verdict.taken })
        }
      }
      if (treatmentOk) treatmentPassed++

      const mark = treatmentOk ? '✓' : '✗'
      const arm = controlOk === treatmentOk ? '=' : controlOk ? 'REGRESSION' : 'lift'
      const line = `  ${mark} [${arm}] expected ${entry.expect}, control=${controlGot}, treatment=${treatmentGot} ← "${entry.prompt}"`
      if (treatmentOk) console.log(line)
      else console.error(line)
    }

    if (skipped === total) {
      fail('live eval scored zero prompts — every claude CLI invocation failed')
    } else {
      const control = controlPassed / total
      const treatment = treatmentPassed / total
      const lift = treatment - control
      // Reported, not gated — see behavior-eval.ts for the full reasoning. Short version: with the
      // treatment arm at 100%, absolute lift is a function of how well the CONTROL arm happened to
      // do, so one control-arm flip (1 prompt = 3.7 pts here) moves it further than a bar pinned to
      // the last run's value. The 2026-08-14 re-run measured 25/27 → 27/27: two errors, both fixed,
      // no regression, and a bar of "+7.7 pts" would have called that a failure of ROUTING.md.
      const controlErrors = total - controlPassed
      const treatmentErrors = total - treatmentPassed
      const minReduction = golden.min_error_reduction ?? 0
      if (skipped > 0) {
        fail(
          `${skipped} of ${total} prompt(s) never reached the CLI — they score as a miss in both arms below. ` +
            'Fix the invocation and re-run; a partial suite is not a measurement of this suite'
        )
      }
      console.log(
        `\nControl   (descriptions only): ${controlPassed}/${total} (${(control * 100).toFixed(0)}%)` +
          `\nTreatment (+ ROUTING.md):      ${treatmentPassed}/${total} (${(treatment * 100).toFixed(0)}%)` +
          `\nLift attributable to ROUTING.md: ${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)} pts (reported, not gated)` +
          `\nRoutes control gets wrong: ${controlErrors} — ROUTING.md fixes ${controlErrors - treatmentErrors} of them` +
          ` — threshold ${(golden.pass_threshold * 100).toFixed(0)}% absolute, min error reduction ${(minReduction * 100).toFixed(0)}%`
      )
      // Printed with the numbers it belongs to, because it has to be recorded in the same edit:
      // `last_measured.context_digest` is what stops this score from outliving the ROUTING.md and
      // agent descriptions that produced it (check 34). Nothing here should be computed by hand.
      console.log(
        `\nRecord in eval/golden-prompts.json → last_measured:` +
          `\n  "prompts": ${total}, "control_passed": ${controlPassed}, "treatment_passed": ${treatmentPassed},` +
          `\n  "context_digest": "${evalContextDigest('eval/golden-prompts.json', REPO_ROOT)}"`
      )

      if (treatment < golden.pass_threshold) {
        fail(`treatment arm scored ${(treatment * 100).toFixed(0)}%, below the ${(golden.pass_threshold * 100).toFixed(0)}% threshold`)
      }
      if (controlErrors > 0) {
        const reduction = (controlErrors - treatmentErrors) / controlErrors
        if (reduction < minReduction) {
          fail(
            `ROUTING.md fixed ${(reduction * 100).toFixed(0)}% of the ${controlErrors} route(s) the agent descriptions alone get wrong ` +
              `(need ${(minReduction * 100).toFixed(0)}%). It is loaded into context to earn that; if it cannot, shrink it or fold its ` +
              `content into the agent descriptions`
          )
        }
      }
      // Regressions are checked on their own, not left to be absorbed by the aggregate: lift is
      // a net figure, so three routes the doc breaks cancel against three it fixes and the run
      // passes while the kit actively misroutes six prompts. A rule that steers the model AWAY
      // from an answer it already had is a defect of a different kind from a rule that fails to
      // help, and the budget for it is zero by default.
      const maxRegressions = golden.max_regressions ?? 0
      if (flakes.length > 0) {
        console.log(`\n  ${flakes.length} unconfirmed regression(s) — wrong once, right on re-sampling:`)
        for (const f of flakes) console.log(`    · ${f.prompt} — wrong in ${f.wrong} of ${f.taken} samples`)
      }
      if (regressions.length > 0) {
        console.error(`\n  ${regressions.length} prompt(s) that plain descriptions route correctly and ROUTING.md breaks:`)
        for (const r of regressions) {
          console.error(`    ✗ ${r.prompt} — expected ${r.expected}, ROUTING.md said ${r.got} (wrong in ${r.wrong} of ${r.taken} samples)`)
        }
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
