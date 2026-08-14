// One sample of a stochastic arm is not evidence, and both live evals were gating on one.
//
// Round 45, observed rather than reasoned about: the behavior suite ran twice, minutes apart,
// against identical files. Run one reported the design prompt as a REGRESSION — the base model
// answered `one_signature_moment`, the treatment arm with `agent_docs/design-directions.md`
// loaded answered `add_gradients_and_shadows`. Run two, same everything, scored 14/14 → 14/14
// with that prompt correct in both arms. `max_regressions: 0` had failed the gate on a coin flip.
//
// That is not a tuning problem to be solved by raising the budget to 1. A budget of 1 stops the
// gate failing on noise by also stopping it failing on one real regression, which is the whole
// thing the barrier exists to catch — the kit's single behavioral finding to date (two rule files,
// each correct alone, together producing a DROP-column migration) was exactly one regression.
// Zero tolerance is the right budget; single-sample evidence is the wrong evidence.
//
// So confirmation is separated from detection. Detection stays one call per arm per prompt, which
// keeps a clean run at exactly its old cost — the common case is no regressions, and this module
// is then never invoked. When the treatment arm does lose a route the control arm gets right, that
// prompt alone is re-sampled and the verdict is the majority. A real regression reproduces; a flake
// does not. Cost is proportional to how bad the news is, which is the right shape for a gate.
//
// Reported either way: a flake that keeps not-reproducing is still information (the prompt is
// closer to the model's decision boundary than the suite's binary scoring admits), and silently
// discarding it would be its own measurement bug.

/** Extra samples taken from the treatment arm when — and only when — a regression appears. */
export const REGRESSION_CONFIRM_SAMPLES = 2

export interface RegressionVerdict {
  /** How many samples, including the original, put the treatment arm on the wrong answer. */
  wrong: number
  /** How many samples were actually obtained (a failed CLI call is not counted). */
  taken: number
  /** True when the wrong answer holds a strict majority of the samples taken. */
  confirmed: boolean
}

/**
 * Decide whether an observed regression reproduces.
 *
 * @param resample Takes one more treatment-arm sample; returns whether it was CORRECT, or null
 *                 when the call failed. Called at most `extraSamples` times, lazily — a caller
 *                 with no regression never pays for it.
 *
 * A failed call is dropped rather than scored: counting an infrastructure failure as evidence in
 * either direction is how a network blip becomes a verdict about the kit's rules. If every extra
 * sample fails, the original observation stands alone (`taken: 1`) and is confirmed, because the
 * conservative reading of "we could not check" is to trust what was actually measured.
 */
export function confirmRegression(
  resample: () => boolean | null,
  extraSamples: number = REGRESSION_CONFIRM_SAMPLES
): RegressionVerdict {
  let wrong = 1 // the sample that raised the flag
  let taken = 1
  for (let i = 0; i < extraSamples; i++) {
    const correct = resample()
    if (correct === null) continue
    taken++
    if (!correct) wrong++
  }
  return { wrong, taken, confirmed: wrong * 2 > taken }
}
