// Shared frontmatter-value validators used by every scripts/lib/validate-*.ts
// module (skills, agents currently; more may reuse these later) — split out of
// scripts/validate-skills.ts round-17 audit so no single validator file owns
// every artifact type's rules (see scripts/validate-skills.ts's own >300-line
// god-file threshold, which the pre-split file was 2.4x over).

export interface Counts {
  errors: number
  warnings: number
}

// Generic model aliases are the recommended default — they track Anthropic's current
// snapshot for that tier so agent/skill files don't go stale when a new dated model
// ships. `inherit` runs the subagent on the parent conversation's model.
export const ALIAS_MODELS = new Set(['opus', 'sonnet', 'haiku', 'fable', 'inherit'])
// Full dated IDs stay valid for deliberate pinning (e.g. reproducibility). Update
// this set whenever Anthropic releases new model IDs.
export const VALID_MODELS = new Set([
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
  'claude-fable-5',
])
// A model ID not in VALID_MODELS but matching this shape is treated as a warning,
// not an error, so a newly released Claude model doesn't hard-break CI before
// anyone updates the set above. Anything else (typos, non-Claude IDs) stays an error.
export const CLAUDE_MODEL_ID_RE = /^claude-[a-z0-9][a-z0-9.-]*$/

export function checkModelId(rel: string, model: string, counts: Counts): 'ok' | 'warn' | 'error' {
  if (ALIAS_MODELS.has(model)) return 'ok'
  if (VALID_MODELS.has(model)) return 'ok'
  if (CLAUDE_MODEL_ID_RE.test(model)) {
    console.warn(`  ⚠ ${rel} — unrecognised model id: '${model}' (if this is a newly released model, add it to VALID_MODELS in scripts/lib/validate-common.ts)`)
    counts.warnings++
    return 'warn'
  }
  console.error(`  ✗ ${rel} — invalid model id: '${model}' (use a generic alias — opus | sonnet | haiku | fable | inherit — or a full model id, e.g. claude-sonnet-5)`)
  counts.errors++
  return 'error'
}

// Hard rule: agent/skill frontmatter `effort:` is capped at high — xhigh/max are
// session-level /effort overrides for the *user's own* main-loop work, not values
// an agent or skill definition should ship with. No exceptions, no pinning comment
// escape hatch (unlike model IDs) — always fix to `high` and flag it.
export const VALID_EFFORTS = new Set(['low', 'medium', 'high'])

export function checkEffort(rel: string, effort: string, counts: Counts): void {
  if (VALID_EFFORTS.has(effort)) return
  if (effort === 'xhigh' || effort === 'max') {
    console.error(`  ✗ ${rel} — effort: ${effort} is not allowed in agent/skill frontmatter (cap is 'high' — xhigh/max are session-level /effort overrides, not definition defaults)`)
    counts.errors++
    return
  }
  console.error(`  ✗ ${rel} — invalid effort: '${effort}' (use low | medium | high)`)
  counts.errors++
}

// Tool names as they appear in `allowed-tools:` (skills) / `tools:` (agents) — comma-separated,
// not a YAML list. Catches copy/paste typos (e.g. "Wrte") that would otherwise silently
// pass since these fields are free-text as far as the frontmatter parser is concerned.
// Update this set when Claude Code adds or renames tools.
export const VALID_TOOLS = new Set(['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'Agent', 'WebFetch', 'WebSearch'])

export function validateToolList(rel: string, source: string, value: string, counts: Counts): void {
  for (const tool of value.split(',').map(t => t.trim()).filter(Boolean)) {
    if (!VALID_TOOLS.has(tool)) {
      console.error(`  ✗ ${rel} — unknown tool '${tool}' in ${source} (valid: ${[...VALID_TOOLS].join(', ')})`)
      counts.errors++
    }
  }
}

export function missingRequiredFields(fm: Record<string, string>, fields: readonly string[]): string[] {
  return fields.filter(field => !fm[field] || fm[field].trim() === '')
}
