// rules/ frontmatter validation, split out of scripts/validate-skills.ts
// (round-17 audit). The entire lazy-load mechanism hinges on a well-formed
// `paths:` glob list, but until round 9 nothing validated it — a `path:` typo
// (singular), an empty `paths:` block, or a missing `paths:` key on a rule
// that isn't one of the two documented always-loaded files would silently
// make that rule never load and still pass `npm run check`.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { parseFrontmatter, findDuplicateFrontmatterKeys, getFrontmatterList, stripBom } from './frontmatter.ts'

const ALWAYS_LOADED_RULE_NAMES = new Set(['000-security', '001-conventions'])

export interface RuleValidationResult {
  errors: number
  checked: number
}

export function validateRules(rulesDir: string): RuleValidationResult {
  const result: RuleValidationResult = { errors: 0, checked: 0 }
  if (!existsSync(rulesDir)) return result

  console.log('\nValidating rules/ frontmatter...\n')
  for (const file of readdirSync(rulesDir)) {
    if (!file.endsWith('.md')) continue
    const ruleName = file.replace(/\.md$/, '')
    const content = readFileSync(join(rulesDir, file), 'utf8')
    const fm = parseFrontmatter(content)
    result.checked++
    if (!fm) {
      console.error(`  ✗ rules/${file} — missing frontmatter (--- block required)`)
      result.errors++
      continue
    }
    let ruleOk = true
    if (!fm.description || fm.description.trim() === '') {
      console.error(`  ✗ rules/${file} — missing required field: description`)
      result.errors++
      ruleOk = false
    }

    const fmBlockMatch = stripBom(content).match(/^---\r?\n([\s\S]*?)\r?\n---/)
    const fmBlockText = fmBlockMatch ? fmBlockMatch[1] : ''
    const hasPathsKey = /^paths:/m.test(fmBlockText)
    const hasPathTypo = /^path:/m.test(fmBlockText)
    const pathsList = getFrontmatterList(content, 'paths')

    if (ALWAYS_LOADED_RULE_NAMES.has(ruleName)) {
      if (hasPathsKey) {
        console.error(`  ✗ rules/${file} — has 'paths:' frontmatter but is documented as always-loaded (no paths: scoping expected); remove 'paths:' or drop it from ALWAYS_LOADED_RULE_NAMES if it's meant to lazy-load now`)
        result.errors++
        ruleOk = false
      }
    } else if (hasPathTypo && !hasPathsKey) {
      console.error(`  ✗ rules/${file} — found 'path:' (singular) instead of 'paths:' — this rule would never lazy-load`)
      result.errors++
      ruleOk = false
    } else if (!hasPathsKey) {
      console.error(`  ✗ rules/${file} — missing 'paths:' frontmatter (required for lazy-loaded rules; only ${[...ALWAYS_LOADED_RULE_NAMES].join(', ')} load unconditionally)`)
      result.errors++
      ruleOk = false
    } else if (!pathsList || pathsList.length === 0) {
      console.error(`  ✗ rules/${file} — 'paths:' is present but has no glob entries (must be a non-empty YAML list of quoted glob strings)`)
      result.errors++
      ruleOk = false
    } else {
      for (const glob of pathsList) {
        if (!glob) {
          console.error(`  ✗ rules/${file} — 'paths:' contains an empty glob entry`)
          result.errors++
          ruleOk = false
          break
        }
      }
    }

    for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
      console.error(`  ✗ rules/${file} — duplicate frontmatter key: '${dupeKey}'`)
      result.errors++
      ruleOk = false
    }

    if (ruleOk) console.log(`  ✓ rules/${ruleName}`)
  }
  console.log(`\n${result.checked} rules frontmatter validated — ${result.errors} error(s)`)
  return result
}
