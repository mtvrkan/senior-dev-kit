// Escalation-target resolution (round-27 fix). Agent bodies and rule files
// carry free-text `ESCALATE TO: <target>` handoff templates that no validator
// resolved against the current roster — performance-guard kept escalating to
// `architect` for a full round after that agent was deleted (984db38), passing
// `npm run validate`, routing-eval, and every consistency check, because all
// existing checks validate frontmatter, ROUTING.md table cells, or `skills:`
// lists — never free-text escalation targets. Closed structurally, not by
// enumerating known targets: ANY `ESCALATE TO:` occurrence in the scanned
// roots must name a live agent (agents/*.md), a live skill (skills/*/), or a
// bracketed format placeholder like `[agent]`.
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, relative, basename } from 'path'

export interface EscalationCheckResult {
  errors: number
  targetsChecked: number
}

export interface EscalationScanRoot {
  // A directory (scanned recursively for *.md) or a single .md file.
  root: string
  label: string
  // Cross-domain roots (rules/, global-CLAUDE.md) reference the REAL agent
  // roster; when a test fixture overrides AGENTS_DIR/SKILLS_DIR, checking the
  // real rules/ against a fixture roster produces spurious dangling targets —
  // same fixture-isolation hazard checkOrphanSkills already guards against.
  // Roots marked crossDomain are skipped when the caller says dirs are
  // overridden (unless the dedicated tests force the check on).
  crossDomain?: boolean
}

// Captures the rest of the LINE, not one `\S+` token (round-29 fix, three defects
// in the old single-token capture):
//   1. `\s*` crossed newlines, so prose ending a line with "ESCALATE TO:" validated
//      whatever word happened to start the next line;
//   2. comma-separated multi-targets ("db-guard, security-guard") only validated the
//      first — the capture stopped at the whitespace after the comma, so the second
//      target was never seen (same only-the-first-segment class round 28 closed for `/`);
//   3. `<agent>`-style placeholders (the style this file's own header comment uses)
//      reduced to '' and produced a spurious "malformed template" error while
//      `[agent]` was exempted.
const ESCALATE_RE = /ESCALATE TO:([^\r\n]*)/g

function collectMarkdownFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collectMarkdownFiles(full, out)
    else if (entry.name.endsWith('.md')) out.push(full)
  }
}

export function validateEscalationTargets(
  scanRoots: EscalationScanRoot[],
  agentNames: Set<string>,
  validSkills: Set<string>,
  opts: { dirsOverridden: boolean; forced: boolean }
): EscalationCheckResult {
  const result: EscalationCheckResult = { errors: 0, targetsChecked: 0 }
  console.log('\nValidating ESCALATE TO: targets...\n')
  let broken = 0
  for (const { root, label, crossDomain } of scanRoots) {
    if (!existsSync(root)) continue
    if (crossDomain && opts.dirsOverridden && !opts.forced) continue
    const files: string[] = []
    if (statSync(root).isDirectory()) collectMarkdownFiles(root, files)
    else files.push(root)
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      const rel =
        statSync(root).isDirectory()
          ? `${label}/${relative(root, file).replace(/\\/g, '/')}`
          : basename(file)
      for (const m of content.matchAll(ESCALATE_RE)) {
        // Leading quotes/parens would otherwise make the trailing-punctuation
        // strip below reduce the whole token to '' and skip it silently
        // (round-28 fix: `ESCALATE TO: "ghost"` passed unchecked).
        // The reason clause is set off by an em/en dash or a spaced hyphen
        // ("ESCALATE TO: [agent] — [reason]") — cut it BEFORE splitting on
        // commas, so a comma inside the reason ("— schema, index changes")
        // can't read as a second target. A spaced hyphen only, since agent
        // names themselves contain hyphens (db-guard).
        const token = m[1]
          .replace(/[`*]/g, '')
          .trim()
          .split(/—|–|\s-\s/)[0]
          .trim()
          .replace(/^["'(]+/, '')
        // Bracketed tokens are format templates ("ESCALATE TO: [agent] — …",
        // "ESCALATE TO: <target>"), not concrete targets.
        if (token.startsWith('[') || token.startsWith('<')) continue
        // `a/b` and `a, b` name multiple candidate targets — validate every
        // segment, not just the first (round-28 fix for `/`; round-29 for `,`).
        // Trailing punctuation (sentence period, glued colon, …) is stripped
        // per segment.
        const targets = token
          .split(/[/,]/)
          .map((seg) => seg.trim().replace(/[^A-Za-z0-9-].*$/, ''))
          .filter((t) => t !== '')
        if (targets.length === 0) {
          // A concrete-looking token that reduces to nothing is a malformed
          // template, not something to skip silently.
          console.error(`  ✗ ${rel} — malformed 'ESCALATE TO: ${m[1]}' — no resolvable target token`)
          broken++
          result.errors++
          continue
        }
        for (const target of targets) {
          result.targetsChecked++
          if (!agentNames.has(target) && !validSkills.has(target)) {
            console.error(
              `  ✗ ${rel} — 'ESCALATE TO: ${target}' names neither a live agent (agents/*.md) nor a live skill (skills/*/)`
            )
            broken++
            result.errors++
          }
        }
      }
    }
  }
  console.log(`${result.targetsChecked} escalation target(s) checked — ${broken} broken`)
  return result
}
