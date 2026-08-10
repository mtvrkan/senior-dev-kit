#!/usr/bin/env node
// Runs every `npm run check` step even if an earlier one fails, so a red gate
// always reports every broken step instead of masking everything after the
// first failure — an `&&` chain previously stopped at `npm test` and hid an
// independent `consistency-check` regression until each step was run by hand.

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { realpathSync } from 'fs'

// 'audit' is last on purpose: it is the only step that needs the network, so an
// offline contributor still gets every other result before it fails. It is in
// the gate at all because the dep-audit CI job was red for three transitive
// advisories with nothing local reporting it — a CI job with no local
// counterpart is a check you find out about after pushing.
export const CHECK_STEPS = ['test', 'validate', 'link-check', 'consistency-check', 'docs-check', 'routing-eval', 'check-plugin', 'typecheck', 'lint', 'markdown-lint', 'audit']

// A step whose green tick means less than it looks like says so in the summary. `routing-eval`
// runs its static checks unconditionally but skips live routing scoring unless the `claude` CLI
// and RUN_ROUTING_EVAL=1 are both present — a bare `✓ routing-eval` reads as "routing behavior
// verified", which is the same class of quiet over-claim this file was written to end.
export const STEP_NOTES: Record<string, string> = {
  'routing-eval': 'static only — live scoring needs RUN_ROUTING_EVAL=1 and the claude CLI',
}

export interface StepResult {
  step: string
  ok: boolean
}

// Pure aggregation, isolated from spawning real processes so it's directly
// unit-testable: any failed step fails the whole gate.
export function exitCodeFor(results: StepResult[]): number {
  return results.some(r => !r.ok) ? 1 : 0
}

export function summarize(results: StepResult[]): string {
  const lines = results.map(({ step, ok }) => {
    const note = ok ? STEP_NOTES[step] : undefined
    return `${ok ? '✓' : '✗'} ${step}${note ? ` (${note})` : ''}`
  })
  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    lines.push('', `${failed.length} step(s) failed: ${failed.map(f => f.step).join(', ')}`)
  } else {
    lines.push('', 'All steps passed.')
  }
  return lines.join('\n')
}

function main(): void {
  const results: StepResult[] = []
  for (const step of CHECK_STEPS) {
    console.log(`\n▶ npm run ${step}`)
    const res = spawnSync('npm', ['run', step], { stdio: 'inherit', shell: true })
    results.push({ step, ok: res.status === 0 })
  }
  console.log('\n--- check summary ---')
  console.log(summarize(results))
  process.exit(exitCodeFor(results))
}

// Entry-point guard (same pattern as deny-cost.ts/routing-eval.ts) — importing
// this module for its pure functions must not trigger a real run of every step.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}
