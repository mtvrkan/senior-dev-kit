// Command-frontmatter validation, split out of scripts/validate-skills.ts
// (round-17 audit).

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { parseFrontmatter, findDuplicateFrontmatterKeys } from './frontmatter.ts'
import { missingRequiredFields, type Counts } from './validate-common.ts'
import { TRIGGER_TEXT_BUDGET_CHARS } from './counts.ts'

export interface CommandValidationResult extends Counts {
  checked: number
}

// description required; argument-hint recommended when the body substitutes
// $ARGUMENTS (it's what the / autocomplete shows users).
export function validateCommands(commandsDir: string): CommandValidationResult {
  const result: CommandValidationResult = { errors: 0, warnings: 0, checked: 0 }
  if (!existsSync(commandsDir)) return result

  console.log('\nValidating command frontmatter...\n')
  for (const file of readdirSync(commandsDir)) {
    if (!file.endsWith('.md')) continue
    const content = readFileSync(join(commandsDir, file), 'utf8')
    const fm = parseFrontmatter(content)
    result.checked++
    if (!fm) {
      console.error(`  ✗ commands/${file} — missing frontmatter (--- block with description: required)`)
      result.errors++
      continue
    }
    let cmdOk = true
    for (const field of missingRequiredFields(fm, ['description'])) {
      console.error(`  ✗ commands/${file} — missing required field: ${field}`)
      result.errors++
      cmdOk = false
    }
    // A command's frontmatter is trigger text, same as a skill's: the harness lists every
    // installed command before the first user turn so `/` autocomplete can offer it. The
    // body is what loads on invocation and is where detail belongs.
    const triggerChars = Object.entries(fm).reduce((sum, [k, v]) => sum + k.length + v.length, 0)
    if (triggerChars > TRIGGER_TEXT_BUDGET_CHARS) {
      console.error(`  ✗ commands/${file} — frontmatter is ${triggerChars} chars (required ≤${TRIGGER_TEXT_BUDGET_CHARS}); it loads into every session — move detail into the body`)
      result.errors++
      cmdOk = false
    }
    if (content.includes('$ARGUMENTS') && (!fm['argument-hint'] || fm['argument-hint'].trim() === '')) {
      console.warn(`  ⚠ commands/${file} — uses $ARGUMENTS but has no argument-hint`)
      result.warnings++
    }
    if (!content.includes('$ARGUMENTS') && fm['argument-hint'] && fm['argument-hint'].trim() !== '') {
      console.warn(`  ⚠ commands/${file} — declares argument-hint but the body never substitutes $ARGUMENTS`)
      result.warnings++
    }
    for (const dupeKey of findDuplicateFrontmatterKeys(content)) {
      console.error(`  ✗ commands/${file} — duplicate frontmatter key: '${dupeKey}'`)
      result.errors++
      cmdOk = false
    }
    if (cmdOk) console.log(`  ✓ commands/${file.replace(/\.md$/, '')}`)
  }
  console.log(`\n${result.checked} commands validated — ${result.errors} error(s)`)
  return result
}
