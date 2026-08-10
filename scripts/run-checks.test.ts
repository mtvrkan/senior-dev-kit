import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { exitCodeFor, summarize, STEP_NOTES, CHECK_STEPS } from './run-checks.ts'

describe('run-checks aggregation', () => {
  test('exitCodeFor returns 0 when every step passed', () => {
    assert.equal(exitCodeFor([{ step: 'test', ok: true }, { step: 'lint', ok: true }]), 0)
  })

  test('exitCodeFor returns 1 when any step failed, even if others passed', () => {
    assert.equal(exitCodeFor([{ step: 'test', ok: false }, { step: 'lint', ok: true }]), 1)
  })

  test('exitCodeFor returns 1 when every step failed', () => {
    assert.equal(exitCodeFor([{ step: 'test', ok: false }, { step: 'lint', ok: false }]), 1)
  })

  test('summarize lists every step with a pass/fail marker, not just the first failure', () => {
    const out = summarize([
      { step: 'test', ok: false },
      { step: 'validate', ok: true },
      { step: 'consistency-check', ok: false },
    ])
    assert.match(out, /✗ test/)
    assert.match(out, /✓ validate/)
    assert.match(out, /✗ consistency-check/)
    assert.match(out, /2 step\(s\) failed: test, consistency-check/)
  })

  test('summarize reports "All steps passed" when nothing failed', () => {
    const out = summarize([{ step: 'test', ok: true }])
    assert.match(out, /All steps passed\./)
  })

  test('a passing step with a caveat carries it into the summary line', () => {
    const out = summarize([{ step: 'routing-eval', ok: true }])
    assert.match(out, /✓ routing-eval \(static only/)
  })

  test('a failing step shows the failure, not the caveat', () => {
    const out = summarize([{ step: 'routing-eval', ok: false }])
    assert.match(out, /✗ routing-eval$/m)
  })

  test('every annotated step is a real step — a renamed step must not silently lose its note', () => {
    for (const step of Object.keys(STEP_NOTES)) {
      assert.ok(CHECK_STEPS.includes(step), `STEP_NOTES names "${step}", which is not in CHECK_STEPS`)
    }
  })
})
