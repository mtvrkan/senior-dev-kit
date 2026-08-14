// The exact inputs a live A/B consumed, reduced to one digest.
//
// Round 42 bound a recorded score to the READMEs that quote it (check 31). Round 43 bound it to
// the suite it lives in (check 34, prompt count). Neither bound it to the thing the measurement
// is actually about: the kit files fed to the treatment arm. Edit `agents/ROUTING.md`, change no
// prompt, and `last_measured` keeps vouching for a routing document that no longer exists — the
// gate stays green because every check is looking at a different variable.
//
// That is not hypothetical. Round 41 broke two routes by editing ROUTING.md, and the only reason
// round 42 caught it was that the same round also added a prompt, which tripped the count check.
// Had it edited ROUTING.md alone, the recording would still read 26/26 today.
//
// So this module answers one question — "what did the recorded run actually read?" — and answers
// it identically for the gate (which compares) and the eval scripts (which print the fresh value
// after a live run). One derivation, two readers, same reason as lib/counts.ts.
//
// Scope is deliberately the *treatment inputs*, not the repo: an agent's prose body, a preset, a
// script change must not invalidate a routing measurement it cannot affect. What goes in is what
// the eval literally puts in the model's context window — for routing, each agent's frontmatter
// `description` plus ROUTING.md; for behavior, each prompt's forced choice plus the full text of
// every file it names as context.
import { createHash } from 'crypto'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parseFrontmatter, stripBom } from './frontmatter.ts'

export interface EvalInputPart {
  label: string
  body: string
}

/** Repo-relative paths of the suites that carry a `last_measured` recording. */
// `readonly string[]`, not `as const`: the literal-tuple type propagates through callers' `.filter`
// and silently breaks their type predicates. Callers want "the list of suites", not two literals.
export const AB_SUITE_FILES: readonly string[] = ['eval/golden-prompts.json', 'eval/behavior-prompts.json']

const readText = (root: string, rel: string): string =>
  // Normalised before hashing: a CRLF checkout and an LF checkout feed the model the same context,
  // so they must not produce different digests. (The kit has lost a file to a PowerShell round-trip
  // before — a digest that moves with the line endings would fail the gate on Windows only.)
  stripBom(readFileSync(join(root, rel), 'utf8')).replace(/\r\n/g, '\n')

function routingInputs(root: string): EvalInputPart[] {
  const agentsDir = join(root, 'agents')
  const names = readdirSync(agentsDir)
    .filter(f => f.endsWith('.md') && f !== 'ROUTING.md' && f !== 'README.md')
    .map(f => f.replace(/\.md$/, ''))
    .sort()
  // Descriptions only, not whole agent files: the control arm is built from exactly these lines
  // (routing-eval.ts), and hashing the bodies would invalidate a valid measurement every time an
  // agent's prose changed — the false positive that gets a check disabled.
  const parts: EvalInputPart[] = names.map(name => ({
    label: `agent-description:${name}`,
    body: parseFrontmatter(readText(root, `agents/${name}.md`))?.description ?? '',
  }))
  parts.push({ label: 'agents/ROUTING.md', body: readText(root, 'agents/ROUTING.md') })
  return parts
}

function behaviorInputs(root: string): EvalInputPart[] {
  const suite = JSON.parse(readText(root, 'eval/behavior-prompts.json')) as {
    prompts: Array<{ prompt: string; choices: string[]; expect: string; context: string[] }>
  }
  const parts: EvalInputPart[] = suite.prompts.map((p, i) => ({
    // The prompt text and its choice set are inputs too: reword a prompt and the recorded score
    // describes a question that was never asked. The count check cannot see that.
    label: `prompt:${i}`,
    body: `${p.prompt}\n${[...p.choices].join('|')}\n${p.expect}`,
  }))
  const contextFiles = [...new Set(suite.prompts.flatMap(p => p.context))].sort()
  for (const rel of contextFiles) parts.push({ label: rel, body: readText(root, rel) })
  return parts
}

/**
 * Everything the live A/B for `suiteFile` reads, in a stable order.
 * Returns null for a file that is not one of the two A/B suites.
 */
export function evalTreatmentInputs(suiteFile: string, root: string): EvalInputPart[] | null {
  if (suiteFile === 'eval/golden-prompts.json') return routingInputs(root)
  if (suiteFile === 'eval/behavior-prompts.json') return behaviorInputs(root)
  return null
}

/**
 * One short digest over the treatment inputs. Length-prefixed per part so that moving text across
 * a boundary — a paragraph from ROUTING.md into an agent description — cannot collide.
 */
export function digestEvalInputs(parts: EvalInputPart[]): string {
  const h = createHash('sha256')
  for (const { label, body } of parts) h.update(`${label}\n${body.length}\n${body}\n`)
  return h.digest('hex').slice(0, 16)
}

/** Convenience for the two callers that always want both steps. */
export function evalContextDigest(suiteFile: string, root: string): string | null {
  const parts = evalTreatmentInputs(suiteFile, root)
  return parts ? digestEvalInputs(parts) : null
}
