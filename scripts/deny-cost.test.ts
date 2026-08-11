// Unit tests for scripts/deny-cost.ts's pure matching logic.
// Run: node --experimental-strip-types --test scripts/deny-cost.test.ts
//
// This deliberately does NOT test against real ~/.claude/projects transcript
// history (deny-cost.ts's main() reads that live and is machine-specific) —
// it tests the same globToRegExp/buildRulesByTool/matchCommand functions main()
// calls, so a future regex or tool-namespace regression fails a fixture here
// instead of only being caught by someone eyeballing `npm run deny-cost`'s
// output once. Closes the "manual verification only" gap flagged in a prior
// audit round for both the PowerShell tool_use scanning and the
// PowerShell(Remove-Item ...) rule migration.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { globToRegExp, pathGlobToRegExp, buildRulesByTool, matchCommand, extractToolCommands, TOOLS } from './deny-cost.ts'

describe('globToRegExp', () => {
  test('matches a literal command with no wildcard', () => {
    assert.ok(globToRegExp('git push --force *').test('git push --force origin main'))
  })

  test('does not match a command missing the required prefix', () => {
    assert.ok(!globToRegExp('git push --force *').test('git push origin main'))
  })

  test('* matches an empty span (bare form is a prefix of the trailing-arg form)', () => {
    assert.ok(globToRegExp('Bash(rm -rf /*)'.slice(5, -1)).test('rm -rf /'))
  })

  test('* matches across newlines (commands are frequently multi-line)', () => {
    assert.ok(globToRegExp('eval *').test('eval "line one\nline two"'))
  })

  test('escapes regex metacharacters in the literal portion of the pattern', () => {
    const re = globToRegExp('base64 *.pem')
    assert.ok(re.test('base64 secret.pem'))
    assert.ok(!re.test('base64 secretXpem')) // '.' must stay literal, not match any char via an unescaped regex dot
  })

  test('anchors the match to the full command string, not a substring', () => {
    const re = globToRegExp('rm -rf /')
    assert.ok(!re.test('echo rm -rf / && echo done'), 'must not match when the pattern is only a substring of the command')
  })
})

// The path-shaped sibling. It had no tests while it existed as four hand-copied
// local helpers (2026-08 review) — check-consistency.ts's check 22 and three tests
// in validate-skills.test.ts each carried their own copy, so a regression in any
// one of them would have silently weakened a deny-coverage assertion rather than
// failing here. Now one implementation, one fixture set.
describe('pathGlobToRegExp', () => {
  test('`**` crosses directory separators', () => {
    assert.ok(pathGlobToRegExp('./**/*.pem').test('./project/nested/deep/key.pem'))
  })

  test('a single `*` does not cross a directory separator', () => {
    const re = pathGlobToRegExp('./*.pem')
    assert.ok(re.test('./key.pem'))
    assert.ok(!re.test('./nested/key.pem'), 'a single * must not span `/` — that is what makes this different from globToRegExp')
  })

  test('escapes regex metacharacters in the literal portion', () => {
    const re = pathGlobToRegExp('./**/.env')
    assert.ok(re.test('./apps/web/.env'))
    assert.ok(!re.test('./apps/web/Xenv'), "'.' must stay literal")
  })

  test('anchors to the whole path, not a substring', () => {
    assert.ok(!pathGlobToRegExp('./*.pem').test('./key.pem.bak'))
  })

  test('a literal `**` in the pattern is not left as an unbound sentinel', () => {
    // Regression guard for the placeholder-token implementations this replaced: each
    // swapped `**` for a marker string and swapped it back at the end, so a pattern
    // that happened to contain the marker (or a `*` produced by escaping) could round-trip
    // wrong. The single-pass version has no intermediate state to corrupt.
    const re = pathGlobToRegExp('./**/**/*.key')
    assert.ok(re.test('./a/b/c/private.key'))
    assert.ok(!re.source.includes('GLOBSTAR'))
  })
})

describe('buildRulesByTool', () => {
  test('splits Bash(...) and PowerShell(...) rules into separate tool namespaces', () => {
    const rulesByTool = buildRulesByTool(['Bash(base64 *.pem)', 'PowerShell(Get-Content *.pem)', 'Bash(rm -rf /)'])
    assert.strictEqual(rulesByTool.Bash.length, 2)
    assert.strictEqual(rulesByTool.PowerShell.length, 1)
    assert.strictEqual(rulesByTool.PowerShell[0].pattern, 'Get-Content *.pem')
  })

  test('ignores rules for tools outside TOOLS (e.g. Read(...))', () => {
    const rulesByTool = buildRulesByTool(['Read(./**/.env)', 'Bash(rm -rf /)'])
    assert.strictEqual(rulesByTool.Bash.length, 1)
    assert.strictEqual(rulesByTool.PowerShell.length, 0)
  })

  test('every entry in TOOLS gets an array, even with zero matching rules', () => {
    const rulesByTool = buildRulesByTool([])
    for (const tool of TOOLS) assert.deepStrictEqual(rulesByTool[tool], [])
  })
})

describe('matchCommand — tool-scoped isolation', () => {
  // The exact regression this repo shipped once: Bash(Get-Content ...) rules
  // that could never fire because Get-Content only exists as a PowerShell
  // cmdlet. Proves the fix holds: a PowerShell-only pattern must not match
  // when queried under the Bash tool, and vice versa.
  test('a PowerShell-only rule does not match when checked against the Bash tool', () => {
    const rulesByTool = buildRulesByTool(['PowerShell(Get-Content *.pem)'])
    assert.deepStrictEqual(matchCommand('Bash', 'Get-Content secret.pem', rulesByTool), [])
  })

  test('a Bash-only rule does not match when checked against the PowerShell tool', () => {
    const rulesByTool = buildRulesByTool(['Bash(base64 *.pem)'])
    assert.deepStrictEqual(matchCommand('PowerShell', 'base64 secret.pem', rulesByTool), [])
  })

  test('a PowerShell-only rule matches when checked against the PowerShell tool', () => {
    const rulesByTool = buildRulesByTool(['PowerShell(Get-Content *.pem)'])
    assert.deepStrictEqual(matchCommand('PowerShell', 'Get-Content secret.pem', rulesByTool), ['Get-Content *.pem'])
  })
})

describe('matchCommand — real settings-template.json rules', () => {
  // The fourth-wave migration this round's audit flagged as untested: the old
  // Bash(Remove-Item -Recurse -Force *) rule was dead (Remove-Item isn't a Git
  // Bash command, so it could never fire), moved to the PowerShell(...)
  // namespace. Proves the moved rule actually matches a real invocation
  // through the PowerShell tool instead of resting on a changelog claim alone.
  test('PowerShell(Remove-Item -Recurse -Force *) matches a real recursive delete', () => {
    const rulesByTool = buildRulesByTool(['PowerShell(Remove-Item -Recurse -Force *)'])
    assert.deepStrictEqual(matchCommand('PowerShell', 'Remove-Item -Recurse -Force C:\\temp\\build', rulesByTool), [
      'Remove-Item -Recurse -Force *',
    ])
  })

  test('PowerShell(Remove-Item * -Recurse -Force) matches the flag-order variant', () => {
    const rulesByTool = buildRulesByTool(['PowerShell(Remove-Item * -Recurse -Force)'])
    assert.deepStrictEqual(matchCommand('PowerShell', 'Remove-Item C:\\temp\\build -Recurse -Force', rulesByTool), [
      'Remove-Item * -Recurse -Force',
    ])
  })

  test('the old dead Bash(Remove-Item ...) shape would never have matched a PowerShell-tool call', () => {
    // Regression guard: if someone reverts the tool namespace back to Bash(...),
    // this proves the rule silently stops protecting anything.
    const rulesByTool = buildRulesByTool(['Bash(Remove-Item -Recurse -Force *)'])
    assert.deepStrictEqual(matchCommand('PowerShell', 'Remove-Item -Recurse -Force C:\\temp\\build', rulesByTool), [])
  })

  test('Bash(base64 *.pem) matches a base64 read of a .pem file', () => {
    const rulesByTool = buildRulesByTool(['Bash(base64 *.pem)'])
    assert.deepStrictEqual(matchCommand('Bash', 'base64 id_rsa.pem', rulesByTool), ['base64 *.pem'])
  })
})

describe('extractToolCommands — transcript-shape parsing', () => {
  // Real shape verified against ~/.claude/projects/**/*.jsonl (round-14 audit):
  // grepped a live PowerShell tool_use block and confirmed it puts the command
  // string under input.command, same key as Bash — this fixture mirrors that
  // exact structure instead of resting on the schema-docs assumption alone.
  test('extracts a PowerShell tool_use command from a real-shaped transcript entry', () => {
    const entry = {
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'PowerShell',
            input: { command: 'Get-Content secret.pem', description: 'read a file', timeout: 180000 },
          },
        ],
      },
    }
    assert.deepStrictEqual(extractToolCommands(entry), [{ tool: 'PowerShell', command: 'Get-Content secret.pem' }])
  })

  test('extracts a Bash tool_use command from a real-shaped transcript entry', () => {
    const entry = { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } }] } }
    assert.deepStrictEqual(extractToolCommands(entry), [{ tool: 'Bash', command: 'ls -la' }])
  })

  test('ignores tool_use blocks for tools outside TOOLS (e.g. Read)', () => {
    const entry = { message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/x' } }] } }
    assert.deepStrictEqual(extractToolCommands(entry), [])
  })

  test('ignores non-tool_use blocks and blocks with a non-string command', () => {
    const entry = {
      message: {
        content: [
          { type: 'text', text: 'hello' },
          { type: 'tool_use', name: 'Bash', input: { command: 42 } },
        ],
      },
    }
    assert.deepStrictEqual(extractToolCommands(entry), [])
  })

  test('returns an empty array when message.content is missing or not an array', () => {
    assert.deepStrictEqual(extractToolCommands({}), [])
    assert.deepStrictEqual(extractToolCommands({ message: {} }), [])
    assert.deepStrictEqual(extractToolCommands({ message: { content: 'not-an-array' } }), [])
  })
})

describe('matchCommand — dedup semantics (mirrors deny-cost.ts main()\'s deniedCommands counter)', () => {
  test('a command matching two rules returns both patterns (caller is responsible for counting the command once)', () => {
    const rulesByTool = buildRulesByTool(['Bash(rm -rf /)', 'Bash(rm -rf /*)'])
    const matched = matchCommand('Bash', 'rm -rf /', rulesByTool)
    assert.strictEqual(matched.length, 2, `expected both rules to match, got: ${JSON.stringify(matched)}`)
  })

  test('a command matching zero rules returns an empty array', () => {
    const rulesByTool = buildRulesByTool(['Bash(rm -rf /)'])
    assert.deepStrictEqual(matchCommand('Bash', 'ls -la', rulesByTool), [])
  })
})
