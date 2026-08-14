// Behavior evaluation — does the kit's RULE content change what the model decides to do?
//
// `routing-eval.ts` measures one thing: which agent a request is routed to. Everything else the
// kit ships — the hard stops, the never-log list, the design gate, the architecture record, the
// spinner rule — was guidance whose effect on behavior nobody had measured. This file closes that
// gap with the same A/B shape and the same scoring discipline.
//
// Static mode (default, runs in `npm run check` / CI, zero cost):
//   - eval/behavior-prompts.json parses; prompts unique and non-empty
//   - every prompt's `expect` is one of its own `choices`
//   - every file named in a prompt's `context` exists on disk (a prompt whose treatment context
//     was renamed away silently degrades into a control-vs-control run that always shows no lift)
//
// Live mode (RUN_BEHAVIOR_EVAL=1, needs the `claude` CLI and API credits):
//   control   — the prompt alone, forced to one of its choices. What a Claude Code session with
//               no kit installed decides.
//   treatment — the same, plus the kit files the prompt names as the ones supposed to produce the
//               right answer.
//   Cost: 2 CLI calls per prompt, plus 2 more for each prompt that regresses — a regression is
//   re-sampled before it is believed (lib/eval-sampling.ts), so a clean run costs exactly what it
//   always did and only bad news is expensive.
//   Run: RUN_BEHAVIOR_EVAL=1 npm run behavior-eval   (PowerShell: $env:RUN_BEHAVIOR_EVAL=1; npm run behavior-eval)
//
// What this suite is FOR (established by its first live run, 2026-08-15): it is a regression
// detector. The control arm scores ~100% — eight further candidate prompts were piloted and the
// base model got all eight right with no kit context — because a two-token forced choice where one
// token names a discipline telegraphs its own answer. Lift belongs to routing-eval, whose answer
// space is eight agent names. What only this suite can prove is that a rule file makes the model
// WORSE, and on run one it did: global-CLAUDE.md and rules/500-database.md, each correct alone,
// together produced a DROP-column migration instead of an escalation.
//
// Forced choice on purpose. Scoring free-text answers needs a judge model, and a judge makes the
// result unreproducible and unauditable — the two properties that make a number worth putting in
// a README. Every prompt is a decision with a defensible right answer, so the answer space is a
// token set and scoring is exact.
import { readFileSync, readdirSync, existsSync, realpathSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { evalContextDigest } from './lib/eval-context.ts'
import { confirmRegression } from './lib/eval-sampling.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const PROMPT_FILE = join(REPO_ROOT, 'eval', 'behavior-prompts.json')

export interface BehaviorPrompt {
  prompt: string
  choices: string[]
  expect: string
  context: string[]
  note?: string
}

// Same reasoning as routing-eval's extractRoutedAgent: an answer that names two choices is
// ambiguous and scores as a miss rather than matching whichever appears first. Exported and pure
// so the scoring rule is unit-testable without spending a CLI call.
export function extractChoice(answer: string, choices: string[]): string | null {
  const normalized = answer.trim().toLowerCase()
  if (choices.includes(normalized)) return normalized
  const mentioned = choices.filter(c => new RegExp(`(^|[^a-z0-9_])${c}($|[^a-z0-9_])`).test(normalized))
  return mentioned.length === 1 ? mentioned[0] : null
}

function main(): void {
  let exitCode = 0
  const fail = (msg: string): void => {
    console.error(`  ✗ ${msg}`)
    exitCode = 1
  }

  console.log('Behavior eval — static checks...\n')

  if (!existsSync(PROMPT_FILE)) {
    fail('eval/behavior-prompts.json is missing')
    process.exit(1)
  }

  const data = JSON.parse(readFileSync(PROMPT_FILE, 'utf8')) as {
    pass_threshold: number
    min_error_reduction?: number
    max_regressions?: number
    prompts: BehaviorPrompt[]
  }

  if (typeof data.pass_threshold !== 'number' || data.pass_threshold <= 0 || data.pass_threshold > 1) {
    fail(`pass_threshold must be in (0, 1], got: ${data.pass_threshold}`)
  }
  if (
    data.min_error_reduction !== undefined &&
    (typeof data.min_error_reduction !== 'number' || data.min_error_reduction < 0 || data.min_error_reduction > 1)
  ) {
    fail(`min_error_reduction must be in [0, 1] when present, got: ${data.min_error_reduction}`)
  }
  if (data.max_regressions !== undefined && (!Number.isInteger(data.max_regressions) || data.max_regressions < 0)) {
    fail(`max_regressions must be a non-negative integer when present, got: ${data.max_regressions}`)
  }
  if (!Array.isArray(data.prompts) || data.prompts.length === 0) {
    fail('prompts array is missing or empty')
    process.exit(1)
  }

  const seen = new Set<string>()
  const contextFiles = new Set<string>()
  for (const [i, entry] of data.prompts.entries()) {
    if (!entry.prompt || entry.prompt.trim() === '') fail(`prompts[${i}] has an empty prompt`)
    if (seen.has(entry.prompt)) fail(`duplicate prompt: "${entry.prompt}"`)
    seen.add(entry.prompt)
    if (!Array.isArray(entry.choices) || entry.choices.length < 2) {
      fail(`prompts[${i}] needs at least two choices — a forced choice with one option measures nothing`)
      continue
    }
    if (!entry.choices.includes(entry.expect)) {
      fail(`prompts[${i}] expects '${entry.expect}', which is not among its own choices [${entry.choices.join(', ')}]`)
    }
    if (!Array.isArray(entry.context) || entry.context.length === 0) {
      fail(`prompts[${i}] names no context file — with nothing in the treatment arm it compares the control against itself`)
      continue
    }
    for (const rel of entry.context) {
      if (!existsSync(join(REPO_ROOT, rel))) {
        fail(`prompts[${i}] names context file '${rel}', which does not exist — the treatment arm would load nothing`)
      } else {
        contextFiles.add(rel)
      }
    }
  }

  // Every rule file must be measured by something. Round 45 found four that were not — 200-api,
  // 400-mobile, 800-llm-safety, 1000-i18n — while the suite reported a clean 14/14, because
  // "the prompts that exist all pass" and "the rules that ship are all measured" are different
  // claims and only the first one had a check. Coverage is derived from `rules/` on disk, so a
  // rule file added tomorrow arrives already owing a prompt; the same shape as routing-eval's
  // "every routable agent is covered by at least one golden prompt".
  const rulesDir = join(REPO_ROOT, 'rules')
  const ruleFiles = existsSync(rulesDir) ? readdirSync(rulesDir).filter(n => n.endsWith('.md')) : []
  const uncoveredRules = ruleFiles.map(n => `rules/${n}`).filter(rel => !contextFiles.has(rel))
  if (uncoveredRules.length > 0) {
    fail(
      `${uncoveredRules.length} rule file(s) are named as treatment context by no prompt: ${uncoveredRules.join(', ')}. ` +
        `A rule nothing measures is a rule that can regress silently — this suite's only finding to date was a rule ` +
        `combination, and it was only visible because both files were in some prompt's context`
    )
  }

  if (exitCode === 0) {
    console.log(`  ✓ ${data.prompts.length} behavior prompts, every expectation inside its own choice set`)
    console.log(`  ✓ ${contextFiles.size} kit file(s) named as treatment context, all present on disk`)
    console.log(`  ✓ all ${ruleFiles.length} rule file(s) measured by at least one prompt`)
  }

  if (process.env.RUN_BEHAVIOR_EVAL === '1' && exitCode === 0) {
    console.log('\nBehavior eval — live A/B (control = no kit context, treatment = + the named kit files)...\n')

    const ask = (body: string, entry: BehaviorPrompt): string | null => {
      const evalPrompt =
        `You are a coding assistant deciding how to handle a user request. Answer with EXACTLY one ` +
        `of these tokens and nothing else: ${entry.choices.join(', ')}\n\n` +
        `${body}\n\nUser request: ${entry.prompt}`
      try {
        // The prompt goes over stdin, never as an argv element. A treatment arm embeds whole kit
        // files, and Windows caps a command line at 32,767 characters: the two design prompts
        // (design-directions.md + 100-web.md = ~41 KB) died with ENAMETOOLONG on the maintainer's
        // own machine, so a full behavior number was unobtainable there while the same suite ran
        // fine on Linux. A platform-dependent eval is not a measurement.
        return execFileSync('claude', ['-p', '--output-format', 'text'], {
          input: evalPrompt,
          encoding: 'utf8',
          timeout: 120_000,
        })
          .trim()
          .toLowerCase()
      } catch (err) {
        fail(`claude CLI failed for "${entry.prompt}": ${err instanceof Error ? err.message : String(err)}`)
        return null
      }
    }

    let controlPassed = 0
    let treatmentPassed = 0
    // Both rates are computed over the whole suite, not over the calls that happened to succeed.
    // A shrinking denominator turns "8 of 10 prompts never ran" into a confident "8/8 (100%)" —
    // the exact shape of number a human then copies into `last_measured`.
    const total = data.prompts.length
    let skipped = 0
    const regressions: Array<{ prompt: string; expected: string; got: string; wrong: number; taken: number }> = []
    const flakes: Array<{ prompt: string; wrong: number; taken: number }> = []

    for (const entry of data.prompts) {
      const rules = entry.context
        .map(rel => `<file path="${rel}">\n${readFileSync(join(REPO_ROOT, rel), 'utf8')}\n</file>`)
        .join('\n\n')
      const treatmentBody = `Follow the rules below.\n<kit-rules>\n${rules}\n</kit-rules>`
      const controlAnswer = ask('', entry)
      const treatmentAnswer = ask(treatmentBody, entry)
      if (controlAnswer === null || treatmentAnswer === null) {
        skipped++
        continue
      }

      const controlGot = extractChoice(controlAnswer, entry.choices) ?? controlAnswer.slice(0, 40)
      const treatmentGot = extractChoice(treatmentAnswer, entry.choices) ?? treatmentAnswer.slice(0, 40)
      const controlOk = controlGot === entry.expect
      let treatmentOk = treatmentGot === entry.expect
      if (controlOk) controlPassed++

      // Confirm before believing it. See lib/eval-sampling.ts for the run that made this
      // necessary: the same prompt regressed and did not regress minutes apart, against
      // byte-identical files, and `max_regressions: 0` failed the gate on the coin flip.
      if (controlOk && !treatmentOk) {
        const verdict = confirmRegression(() => {
          const again = ask(treatmentBody, entry)
          return again === null ? null : extractChoice(again, entry.choices) === entry.expect
        })
        if (verdict.confirmed) {
          regressions.push({ prompt: entry.prompt, expected: entry.expect, got: treatmentGot, ...verdict })
        } else {
          // The majority of samples were correct, so the arm's score is corrected too — otherwise
          // the headline number still reports the flake it was just decided not to believe.
          treatmentOk = true
          flakes.push({ prompt: entry.prompt, wrong: verdict.wrong, taken: verdict.taken })
        }
      }
      if (treatmentOk) treatmentPassed++

      const arm = controlOk === treatmentOk ? '=' : controlOk ? 'REGRESSION' : 'lift'
      const line = `  ${treatmentOk ? '✓' : '✗'} [${arm}] expected ${entry.expect}, control=${controlGot}, treatment=${treatmentGot} ← "${entry.prompt}"`
      if (treatmentOk) console.log(line)
      else console.error(line)
    }

    if (skipped === total) {
      fail('live eval scored zero prompts — every claude CLI invocation failed')
    } else {
      const control = controlPassed / total
      const treatment = treatmentPassed / total
      const lift = treatment - control
      // Absolute lift is reported but not gated on. It is a difference between two sampled arms,
      // and as base models improve the control arm rises until the largest lift the suite can
      // physically show approaches zero — a barrier expressed in absolute points becomes
      // unsatisfiable at exactly the moment the kit is still doing its job. What stays meaningful
      // is the share of control's mistakes the treatment arm fixes, which is undefined rather than
      // failing when control makes none.
      const controlErrors = total - controlPassed
      const treatmentErrors = total - treatmentPassed
      const minReduction = data.min_error_reduction ?? 0
      if (skipped > 0) {
        fail(
          `${skipped} of ${total} prompt(s) never reached the CLI — they score as a miss in both arms below. ` +
            'Fix the invocation and re-run; a partial suite is not a measurement of this suite'
        )
      }
      console.log(
        `\nControl   (no kit rules):   ${controlPassed}/${total} (${(control * 100).toFixed(0)}%)` +
          `\nTreatment (+ kit rules):    ${treatmentPassed}/${total} (${(treatment * 100).toFixed(0)}%)` +
          `\nLift attributable to the rules: ${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)} pts (reported, not gated)` +
          `\nDecisions control gets wrong: ${controlErrors} — the rules fix ${controlErrors - treatmentErrors} of them` +
          ` — threshold ${(data.pass_threshold * 100).toFixed(0)}% absolute, min error reduction ${(minReduction * 100).toFixed(0)}%`
      )
      // Printed with the numbers it belongs to — see routing-eval.ts for why. Here the digest
      // covers every prompt's wording and every rule file the treatment arm loaded, which is the
      // set that produced the one finding this suite has ever made: two files, correct alone.
      console.log(
        `\nRecord in eval/behavior-prompts.json → last_measured:` +
          `\n  "prompts": ${total}, "control_passed": ${controlPassed}, "treatment_passed": ${treatmentPassed},` +
          `\n  "context_digest": "${evalContextDigest('eval/behavior-prompts.json', REPO_ROOT)}"`
      )

      if (treatment < data.pass_threshold) {
        fail(`treatment arm scored ${(treatment * 100).toFixed(0)}%, below the ${(data.pass_threshold * 100).toFixed(0)}% threshold`)
      }
      if (controlErrors > 0) {
        const reduction = (controlErrors - treatmentErrors) / controlErrors
        if (reduction < minReduction) {
          fail(
            `the rules fixed ${(reduction * 100).toFixed(0)}% of the ${controlErrors} decision(s) the base model gets wrong ` +
              `(need ${(minReduction * 100).toFixed(0)}%). They are loaded into context to change these, so read the arm-by-arm ` +
              `lines above: a negative share means they are steering the model away from answers it reaches without them`
          )
        }
      }
      const maxRegressions = data.max_regressions ?? 0
      if (flakes.length > 0) {
        // Not a failure, but not nothing either: a prompt that answers both ways under identical
        // input sits on the model's decision boundary, and a rising count here is the signal that
        // the rule meant to settle it is not settling it.
        console.log(`\n  ${flakes.length} unconfirmed regression(s) — wrong once, right on re-sampling:`)
        for (const f of flakes) console.log(`    · ${f.prompt} — wrong in ${f.wrong} of ${f.taken} samples`)
      }
      if (regressions.length > 0) {
        console.error(`\n  ${regressions.length} decision(s) the base model gets right and the kit's rules break:`)
        for (const r of regressions) {
          console.error(`    ✗ ${r.prompt} — expected ${r.expected}, with rules said ${r.got} (wrong in ${r.wrong} of ${r.taken} samples)`)
        }
      }
      if (regressions.length > maxRegressions) {
        fail(`the kit's rules broke ${regressions.length} decision(s) the base model gets right (budget ${maxRegressions})`)
      }
    }
  } else if (exitCode === 0) {
    console.log(
      '\n(live A/B skipped — set RUN_BEHAVIOR_EVAL=1 with the claude CLI available. ' +
        'Until it runs, the static checks above prove only that the prompts and their context files are well-formed, ' +
        'not that any rule changes a decision.)'
    )
  }

  process.exit(exitCode)
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}
