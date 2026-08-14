import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractChoice, type BehaviorPrompt } from './behavior-eval.ts'
import { AB_SUITE_FILES, digestEvalInputs, evalContextDigest, evalTreatmentInputs } from './lib/eval-context.ts'
import { confirmRegression, REGRESSION_CONFIRM_SAMPLES } from './lib/eval-sampling.ts'

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

describe('confirmRegression', () => {
  // The run this was written for: the same design prompt regressed and did not regress minutes
  // apart against byte-identical files, and `max_regressions: 0` failed the gate on the coin flip.
  const sampler = (results: (boolean | null)[]) => {
    let i = 0
    return () => results[i++] ?? null
  }

  test('a regression that does not reproduce is not a regression', () => {
    const v = confirmRegression(sampler([true, true]))
    assert.equal(v.confirmed, false)
    assert.deepEqual([v.wrong, v.taken], [1, 3])
  })

  test('a regression that reproduces is confirmed', () => {
    const v = confirmRegression(sampler([false, false]))
    assert.equal(v.confirmed, true)
    assert.deepEqual([v.wrong, v.taken], [3, 3])
  })

  test('a bare majority confirms, a bare minority does not', () => {
    assert.equal(confirmRegression(sampler([false, true])).confirmed, true) // 2 of 3
    assert.equal(confirmRegression(sampler([true, false])).confirmed, true) // 2 of 3, other order
  })

  test('a failed re-sample is dropped rather than scored in either direction', () => {
    const v = confirmRegression(sampler([null, true]))
    assert.deepEqual([v.wrong, v.taken], [1, 2])
    assert.equal(v.confirmed, false, '1 wrong of 2 taken is not a majority')
  })

  test('when every re-sample fails, the original observation stands', () => {
    const v = confirmRegression(sampler([null, null]))
    assert.deepEqual([v.wrong, v.taken, v.confirmed], [1, 1, true])
  })

  test('takes no samples at all when the caller asks for none', () => {
    let calls = 0
    const v = confirmRegression(() => { calls++; return true }, 0)
    assert.equal(calls, 0, 'detection must stay one call per arm on a clean run')
    assert.equal(v.confirmed, true)
  })

  test('the shipped sample count is odd overall, so a majority always exists', () => {
    assert.equal((1 + REGRESSION_CONFIRM_SAMPLES) % 2, 1)
  })
})

describe('behavior suite covers every rule file', () => {
  // Four rule files — 200-api, 400-mobile, 800-llm-safety, 1000-i18n — shipped for two rounds
  // with no prompt naming them, while the suite reported a clean 14/14. The static check in
  // behavior-eval.ts now derives coverage from rules/ on disk; this pins the property itself, so
  // a rule file added tomorrow cannot arrive already exempt.
  const suite = JSON.parse(readFileSync(join(REPO_ROOT, 'eval', 'behavior-prompts.json'), 'utf8')) as {
    prompts: { context: string[] }[]
  }
  const named = new Set(suite.prompts.flatMap(p => p.context))

  test('every rules/*.md is named as treatment context by some prompt', () => {
    const uncovered = readdirSync(join(REPO_ROOT, 'rules'))
      .filter(n => n.endsWith('.md'))
      .map(n => `rules/${n}`)
      .filter(rel => !named.has(rel))
    assert.deepEqual(uncovered, [], 'a rule nothing measures can regress silently')
  })

  test('at least one prompt loads two rule files at once', () => {
    // The suite's only finding to date was a rule COMBINATION. A suite of single-file prompts
    // cannot reproduce it, however many prompts it has.
    const combinations = suite.prompts.filter(p => p.context.filter(c => c.startsWith('rules/')).length > 1)
    assert.ok(combinations.length > 0, 'no prompt exercises two rule files together')
  })
})

describe('extractChoice', () => {
  const choices = ['ask_for_direction', 'build_with_defaults']

  test('accepts the bare token, whitespace and case included', () => {
    assert.equal(extractChoice('  ASK_FOR_DIRECTION \n', choices), 'ask_for_direction')
  })

  test('accepts a token embedded in a chatty answer', () => {
    assert.equal(extractChoice('I would ask_for_direction first.', choices), 'ask_for_direction')
  })

  test('scores an answer naming both choices as a miss rather than taking the first', () => {
    // The failure this exists to prevent: "not build_with_defaults — ask_for_direction" and
    // "ask_for_direction, otherwise build_with_defaults" mean opposite things and would both
    // match a substring scan. An ambiguous answer is a miss.
    assert.equal(extractChoice('not build_with_defaults but ask_for_direction', choices), null)
  })

  test('does not match a choice that is only part of a longer token', () => {
    assert.equal(extractChoice('build_with_defaults_later', choices), null)
  })
})

describe('behavior-prompts.json', () => {
  const file = join(REPO_ROOT, 'eval', 'behavior-prompts.json')
  const data = JSON.parse(readFileSync(file, 'utf8')) as { prompts: BehaviorPrompt[] }

  test('every expectation is inside its own choice set, and every context file exists', () => {
    // The static half of `npm run behavior-eval` asserts the same things; duplicating it here
    // means a malformed prompt fails in the unit suite too, which is what a contributor runs
    // first and what the pre-push habit actually covers.
    for (const p of data.prompts) {
      assert.ok(p.choices.includes(p.expect), `"${p.prompt}" expects ${p.expect}, not among its choices`)
      assert.ok(p.choices.length >= 2, `"${p.prompt}" is not a choice at all`)
      for (const rel of p.context) {
        assert.ok(existsSync(join(REPO_ROOT, rel)), `"${p.prompt}" names missing context file ${rel}`)
      }
    }
  })

  test('no prompt can be answered correctly by picking the same token every time', () => {
    // A set where the right answer is always the first choice is scored by position, not by
    // judgement — the model can pass it without reading anything.
    const positions = new Set(data.prompts.map(p => p.choices.indexOf(p.expect)))
    assert.ok(positions.size > 1, 'every expected answer sits at the same index in its choice list')
  })
})

describe('eval context digest', () => {
  // check 34 compares a recorded digest against a freshly computed one, so the properties that
  // make that comparison meaningful are asserted here rather than left to the gate: a digest that
  // moves on its own produces a red gate nobody can fix, and one that ignores the treatment files
  // reintroduces exactly the hole it was written to close.

  test('covers ROUTING.md and every agent description for the routing suite', () => {
    const labels = evalTreatmentInputs('eval/golden-prompts.json', REPO_ROOT)!.map(p => p.label)
    assert.ok(labels.includes('agents/ROUTING.md'), 'routing digest ignores the document it measures')
    assert.ok(labels.some(l => l.startsWith('agent-description:')), 'routing digest ignores the control arm')
  })

  test('covers every file a behavior prompt names as context', () => {
    const labels = new Set(evalTreatmentInputs('eval/behavior-prompts.json', REPO_ROOT)!.map(p => p.label))
    const suite = JSON.parse(readFileSync(join(REPO_ROOT, 'eval', 'behavior-prompts.json'), 'utf8')) as {
      prompts: BehaviorPrompt[]
    }
    for (const p of suite.prompts) {
      for (const rel of p.context) assert.ok(labels.has(rel), `behavior digest ignores context file ${rel}`)
    }
  })

  test('changes when a treatment input changes', () => {
    const parts = evalTreatmentInputs('eval/golden-prompts.json', REPO_ROOT)!
    const edited = parts.map((p, i) => (i === parts.length - 1 ? { ...p, body: `${p.body}\nedited` } : p))
    assert.notEqual(digestEvalInputs(parts), digestEvalInputs(edited))
  })

  test('is stable across CRLF and LF checkouts', () => {
    // The digest is committed to a JSON file that both Windows and Linux read. If line endings
    // reached the hash, `npm run check` would be red on one platform and green on the other.
    const parts = evalTreatmentInputs('eval/behavior-prompts.json', REPO_ROOT)!
    const crlf = parts.map(p => ({ ...p, body: p.body.replace(/\n/g, '\r\n') }))
    // Bodies are normalised on read, so re-normalising a CRLF variant must land on the same value.
    assert.equal(digestEvalInputs(parts), digestEvalInputs(crlf.map(p => ({ ...p, body: p.body.replace(/\r\n/g, '\n') }))))
  })

  test('cannot collide by moving text across a part boundary', () => {
    // Length-prefixing is the reason: without it, a paragraph moved out of ROUTING.md and into an
    // agent description would digest identically to never having moved.
    const a = [{ label: 'x', body: 'ab' }, { label: 'y', body: 'c' }]
    const b = [{ label: 'x', body: 'a' }, { label: 'y', body: 'bc' }]
    assert.notEqual(digestEvalInputs(a), digestEvalInputs(b))
  })

  test('every A/B suite records the digest its files currently produce', () => {
    for (const suiteFile of AB_SUITE_FILES) {
      const recorded = JSON.parse(readFileSync(join(REPO_ROOT, suiteFile), 'utf8')).last_measured
      if (!recorded) continue
      assert.equal(recorded.context_digest, evalContextDigest(suiteFile, REPO_ROOT), `${suiteFile}: stale measurement`)
    }
  })
})
