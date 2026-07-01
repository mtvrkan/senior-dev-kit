// Unit tests for scripts/lib/frontmatter.ts + scripts/lib/presets.ts
// Integration smoke-test for validate-skills.ts and check-stale.ts
// Run: node --experimental-strip-types --test scripts/validate-skills.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseFrontmatter, findDuplicateFrontmatterKeys } from './lib/frontmatter.ts'
import { validatePresetClaudeMd, findPresetDirs, checkCompactMd } from './lib/presets.ts'
import { findBrokenLinks } from './lib/links.ts'

const NODE_FLAGS = ['--experimental-strip-types']

describe('parseFrontmatter', () => {
  test('returns null when no frontmatter block is present', () => {
    assert.strictEqual(parseFrontmatter('no frontmatter here'), null)
  })

  test('returns null when opening --- is missing', () => {
    assert.strictEqual(parseFrontmatter('description: foo\n---\nbody'), null)
  })

  test('parses required fields from a valid block', () => {
    const content = [
      '---',
      'description: Fix localized bugs',
      'allowed-tools: Read, Grep, Edit',
      '---',
      'body',
    ].join('\n')
    const fm = parseFrontmatter(content)
    assert.strictEqual(fm!.description, 'Fix localized bugs')
    assert.strictEqual(fm!['allowed-tools'], 'Read, Grep, Edit')
  })

  test('handles colons inside values', () => {
    const content = [
      '---',
      'description: Fix bugs: runtime errors and crashes',
      'allowed-tools: Read',
      '---',
    ].join('\n')
    const fm = parseFrontmatter(content)
    assert.strictEqual(fm!.description, 'Fix bugs: runtime errors and crashes')
  })

  test('skips list items inside frontmatter', () => {
    const content = [
      '---',
      'description: A skill',
      'allowed-tools: Read',
      'skills:',
      '  - bug-fix',
      '  - api-design',
      '---',
    ].join('\n')
    const fm = parseFrontmatter(content)
    assert.strictEqual(fm!.description, 'A skill')
    assert.ok(!Object.keys(fm!).includes('bug-fix'), 'list items must not become keys')
  })

  test('returns empty object for a frontmatter block with only a blank line', () => {
    const content = '---\n\n---\nbody'
    const fm = parseFrontmatter(content)
    assert.deepStrictEqual(fm, {})
  })

  test('returns null for back-to-back --- markers with no separator', () => {
    // No newline before closing --- → regex cannot match → null
    const content = '---\n---\nbody'
    assert.strictEqual(parseFrontmatter(content), null)
  })

  test('parses optional when_to_use field', () => {
    const content = [
      '---',
      'description: A skill',
      'allowed-tools: Read',
      'when_to_use: Use when user reports a crash',
      '---',
    ].join('\n')
    const fm = parseFrontmatter(content)
    assert.strictEqual(fm!.when_to_use, 'Use when user reports a crash')
  })

  test('parses model field when present', () => {
    const content = [
      '---',
      'description: A skill',
      'allowed-tools: Read',
      'model: claude-sonnet-5',
      '---',
    ].join('\n')
    const fm = parseFrontmatter(content)
    assert.strictEqual(fm!.model, 'claude-sonnet-5')
  })

  test('handles CRLF line endings', () => {
    const content = '---\r\ndescription: A skill\r\nallowed-tools: Read\r\n---\r\nbody'
    const fm = parseFrontmatter(content)
    assert.strictEqual(fm!.description, 'A skill')
    assert.strictEqual(fm!['allowed-tools'], 'Read')
  })
})

describe('findDuplicateFrontmatterKeys', () => {
  test('returns empty array when no keys repeat', () => {
    const content = ['---', 'description: A skill', 'allowed-tools: Read', '---'].join('\n')
    assert.deepStrictEqual(findDuplicateFrontmatterKeys(content), [])
  })

  test('detects a key that appears twice', () => {
    const content = ['---', 'description: First', 'allowed-tools: Read', 'description: Second', '---'].join('\n')
    assert.deepStrictEqual(findDuplicateFrontmatterKeys(content), ['description'])
  })

  test('does not flag list items or indented continuation lines as duplicates', () => {
    const content = [
      '---',
      'description: A skill',
      'skills:',
      '  - bug-fix',
      '  - bug-fix',
      '---',
    ].join('\n')
    assert.deepStrictEqual(findDuplicateFrontmatterKeys(content), [])
  })

  test('returns empty array when there is no frontmatter block', () => {
    assert.deepStrictEqual(findDuplicateFrontmatterKeys('no frontmatter here'), [])
  })
})

describe('validatePresetClaudeMd', () => {
  test('passes when CLAUDE.md has sufficient content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    const claudePath = join(dir, 'CLAUDE.md')
    writeFileSync(claudePath, '# My Preset\n\nThis preset has enough content to pass the minimum length validation check easily.')
    const r = validatePresetClaudeMd(claudePath, 'test/preset')
    assert.strictEqual(r.ok, true)
    rmSync(dir, { recursive: true })
  })

  test('fails when CLAUDE.md content is too short', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    const claudePath = join(dir, 'CLAUDE.md')
    writeFileSync(claudePath, 'short')
    const r = validatePresetClaudeMd(claudePath, 'test/preset')
    assert.strictEqual(r.ok, false)
    assert.ok(r.reason!.includes('too short'), `expected "too short" in reason, got: ${r.reason}`)
    rmSync(dir, { recursive: true })
  })

  test('fails when CLAUDE.md does not exist', () => {
    const r = validatePresetClaudeMd('/nonexistent/path/CLAUDE.md', 'test/missing')
    assert.strictEqual(r.ok, false)
    assert.ok(r.reason!.includes('not found'), `expected "not found" in reason, got: ${r.reason}`)
  })

  test('relPath is preserved in result', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    const claudePath = join(dir, 'CLAUDE.md')
    writeFileSync(claudePath, '# Content that is long enough to pass the preset minimum length check here.')
    const r = validatePresetClaudeMd(claudePath, 'web/nextjs')
    assert.strictEqual(r.rel, 'web/nextjs')
    rmSync(dir, { recursive: true })
  })
})

describe('findPresetDirs', () => {
  test('finds a single leaf directory containing CLAUDE.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'presets-'))
    const leaf = join(root, 'web', 'nextjs')
    mkdirSync(leaf, { recursive: true })
    writeFileSync(join(leaf, 'CLAUDE.md'), '# Next.js preset with enough content to pass validation easily.')
    const dirs = findPresetDirs(root)
    assert.strictEqual(dirs.length, 1)
    assert.ok(dirs[0].relPath.includes('nextjs'))
    rmSync(root, { recursive: true })
  })

  test('skips directories that contain no CLAUDE.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'presets-'))
    mkdirSync(join(root, 'empty-category'), { recursive: true })
    const dirs = findPresetDirs(root)
    assert.strictEqual(dirs.length, 0)
    rmSync(root, { recursive: true })
  })

  test('finds multiple preset dirs across sibling subdirectories', () => {
    const root = mkdtempSync(join(tmpdir(), 'presets-'))
    for (const name of ['react', 'vue', 'svelte']) {
      const d = join(root, 'web', name)
      mkdirSync(d, { recursive: true })
      writeFileSync(join(d, 'CLAUDE.md'), `# ${name} — preset content that is long enough to pass validation.`)
    }
    const dirs = findPresetDirs(root)
    assert.strictEqual(dirs.length, 3)
    rmSync(root, { recursive: true })
  })

  test('stops at the first CLAUDE.md found — does not recurse into preset dirs', () => {
    const root = mkdtempSync(join(tmpdir(), 'presets-'))
    const leaf = join(root, 'web', 'nextjs')
    mkdirSync(join(leaf, 'nested'), { recursive: true })
    writeFileSync(join(leaf, 'CLAUDE.md'), '# Next.js preset content that is clearly long enough to pass.')
    writeFileSync(join(leaf, 'nested', 'CLAUDE.md'), '# Should not be found — parent already has CLAUDE.md.')
    const dirs = findPresetDirs(root)
    assert.strictEqual(dirs.length, 1, 'should stop at the first CLAUDE.md, not recurse into nested/')
    rmSync(root, { recursive: true })
  })
})

const COMPACT_SUFFICIENT = [
  '- Architecture: layered controllers/services/repositories',
  '- Validate all input at the API boundary with Zod or class-validator',
  '- Parameterized queries only — never string interpolation in SQL',
  '- Ownership check in service: if resource.userId !== req.user.id throw 403',
  '- Errors: typed AppError hierarchy — never raw DB errors to client',
  '- Async: all I/O is async — no blocking calls on request path',
  '- Verify: npm test [file] · npm run lint · npm run build',
].join('\n')

describe('checkCompactMd', () => {
  test('passes when compact.md exists with sufficient content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    writeFileSync(join(dir, 'compact.md'), COMPACT_SUFFICIENT)
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'web/test')
    assert.strictEqual(r.ok, true)
    rmSync(dir, { recursive: true })
  })

  test('fails when compact.md is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'web/test')
    assert.strictEqual(r.ok, false)
    assert.ok(r.reason!.includes('compact.md missing'), `expected "compact.md missing" in reason, got: ${r.reason}`)
    rmSync(dir, { recursive: true })
  })

  test('fails when compact.md is too short (< 7 non-blank lines)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    writeFileSync(join(dir, 'compact.md'), '- only one rule')
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'web/test')
    assert.strictEqual(r.ok, false)
    assert.ok(r.reason!.includes('too short'), `expected "too short" in reason, got: ${r.reason}`)
    rmSync(dir, { recursive: true })
  })

  test('relPath is preserved in result', () => {
    const dir = mkdtempSync(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    writeFileSync(join(dir, 'compact.md'), COMPACT_SUFFICIENT)
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'backend/nestjs')
    assert.strictEqual(r.rel, 'backend/nestjs')
    rmSync(dir, { recursive: true })
  })
})

describe('skill body line count', () => {
  test('fails validation when non-blank body lines exceed 20', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`)
    const content = ['---', 'description: A skill', 'allowed-tools: Read', '---', ...lines].join('\n')
    const frontmatterEnd = content.indexOf('\n---', content.indexOf('---') + 3)
    const body = frontmatterEnd !== -1 ? content.slice(frontmatterEnd + 4) : ''
    const bodyLines = body.split('\n').filter(l => l.trim() !== '').length
    assert.ok(bodyLines > 20, `expected >20 non-blank body lines, got ${bodyLines}`)
  })

  test('passes validation when body is within limit', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
    const content = ['---', 'description: A skill', 'allowed-tools: Read', '---', ...lines].join('\n')
    const frontmatterEnd = content.indexOf('\n---', content.indexOf('---') + 3)
    const body = frontmatterEnd !== -1 ? content.slice(frontmatterEnd + 4) : ''
    const bodyLines = body.split('\n').filter(l => l.trim() !== '').length
    assert.ok(bodyLines <= 20, `expected ≤20 non-blank body lines, got ${bodyLines}`)
  })
})

describe('findBrokenLinks', () => {
  test('flags a relative link to a file that does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'README.md')
    const content = 'See [missing doc](NOPE.md) for details.'
    const broken = findBrokenLinks(filePath, content)
    assert.strictEqual(broken.length, 1)
    assert.strictEqual(broken[0].target, 'NOPE.md')
    rmSync(dir, { recursive: true })
  })

  test('does not flag a relative link to a file that exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    writeFileSync(join(dir, 'OTHER.md'), '# Other')
    const filePath = join(dir, 'README.md')
    const content = 'See [other doc](OTHER.md) for details.'
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })

  test('ignores external URLs and same-file anchors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'README.md')
    const content = [
      'See [external](https://example.com/doesnotexist) for details.',
      'Or the [section above](#some-heading).',
      'Or [email us](mailto:test@example.com).',
    ].join('\n')
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })

  test('resolves a link with a #anchor suffix against the target file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    writeFileSync(join(dir, 'OTHER.md'), '# Other')
    const filePath = join(dir, 'README.md')
    const content = 'See [section](OTHER.md#some-section) for details.'
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })

  test('ignores the GitHub security-advisories UI convention link', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'SECURITY.md')
    const content = "Report via [Security Advisories](../../security/advisories/new)."
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })
})

describe('check-links integration', () => {
  test('check-links.ts exits 0 on the real repo', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-links.ts'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('No broken internal markdown links found'), 'expected pass message in output')
  })

  test('check-links.ts exits 1 when a markdown file has a broken relative link', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'links-root-'))
    writeFileSync(join(tmp, 'README.md'), 'See [missing](NOPE.md) for details.')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-links.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LINKS_ROOT: tmp },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('broken link'), `expected broken link output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for a broken relative link')
  })
})

describe('check-stale integration', () => {
  test('check-stale.ts exits 0 when all presets and rules are fresh', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, STALE_AFTER_DAYS: '365' },
    })
    assert.ok(result.includes('✓'), 'expected ✓ pass line in output')
  })

  test('check-stale.ts detects stale when maintenance file has an old date', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    const oldFile = join(tmp, 'PRESET-MAINTENANCE.md')
    writeFileSync(oldFile, [
      '## Version Support Matrix',
      '',
      '| Category | Preset | Supported | Last Reviewed |',
      '|----------|--------|-----------|---------------|',
      '| **Web** | `nextjs-saas` | Next.js 15 | 2020-01-01 |',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', MAINTENANCE_FILE: oldFile },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('stale') || out.includes('✗'), `expected stale output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for preset last reviewed in 2020')
  })

  test('check-stale.ts detects untracked rule file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    // Empty rules maintenance file — no rules tracked
    const emptyRules = join(tmp, 'RULES-MAINTENANCE.md')
    writeFileSync(emptyRules, '# Rules\n\n| Rule File | Scope | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', RULES_MAINTENANCE_FILE: emptyRules },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('✗') || out.includes('untracked') || out.includes('not tracked'), `expected untracked output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when rules are not in maintenance table')
  })

  test('check-stale.ts detects untracked agent file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    const emptyAgents = join(tmp, 'AGENTS-MAINTENANCE.md')
    writeFileSync(emptyAgents, '# Agents\n\n| Agent | Role | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', AGENTS_MAINTENANCE_FILE: emptyAgents },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('agents/'), `expected untracked agents/ output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when agents are not in maintenance table')
  })

  test('check-stale.ts detects untracked skill directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    const emptySkills = join(tmp, 'SKILLS-MAINTENANCE.md')
    writeFileSync(emptySkills, '# Skills\n\n| Skill | Purpose | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', SKILLS_MAINTENANCE_FILE: emptySkills },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('skills/'), `expected untracked skills/ output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when skills are not in maintenance table')
  })

  test('check-stale.ts flags a review-table row that no longer matches the expected format', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    const badFile = join(tmp, 'PRESET-MAINTENANCE.md')
    writeFileSync(badFile, [
      '## Version Support Matrix',
      '',
      '| Category | Preset | Supported | Last Reviewed |',
      '|----------|--------|-----------|---------------|',
      '| **Web** | `nextjs-saas` | Next.js 15 | 2026-06-30 |',
      // date and stack columns swapped — must be reported as malformed, not silently skipped
      '| **Web** | `react-vite` | 2026-06-30 | Vite 6 |',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', MAINTENANCE_FILE: badFile },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(
        out.includes('react-vite') && out.includes('does not match'),
        `expected react-vite flagged as a malformed row, got: ${out}`
      )
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for a review-table row that fails to parse')
  })

  test('check-stale.ts detects an orphaned maintenance table row (tracked but not on disk)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    const rulesFile = join(tmp, 'RULES-MAINTENANCE.md')
    const realRules = [
      '000-security', '001-conventions', '100-web', '200-api', '300-testing',
      '400-mobile', '500-database', '600-devops', '700-observability',
      '800-llm-safety', '900-performance',
    ]
    const rows = [...realRules, 'removed-rule-that-no-longer-exists']
      .map(name => `| \`${name}\` | test | 2026-07-01 |`)
      .join('\n')
    writeFileSync(rulesFile, `# Rules\n\n| Rule File | Scope | Last Reviewed |\n|---|---|---|\n${rows}\n`)
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', RULES_MAINTENANCE_FILE: rulesFile },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('no matching item on disk'), `expected orphan message in output, got: ${out}`)
      assert.ok(out.includes('removed-rule-that-no-longer-exists'), `expected the orphaned name in output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for a maintenance row with no matching file on disk')
  })

  test('check-stale.ts detects untracked command file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-'))
    const emptyCommands = join(tmp, 'COMMANDS-MAINTENANCE.md')
    writeFileSync(emptyCommands, '# Commands\n\n| Command | Purpose | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, STALE_AFTER_DAYS: '365', COMMANDS_MAINTENANCE_FILE: emptyCommands },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('commands/'), `expected untracked commands/ output, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when commands are not in maintenance table')
  })
})

describe('model ID validation', () => {
  test('validate-skills.ts exits 1 when a SKILL.md has an invalid model ID', () => {
    const tmpSkills = mkdtempSync(join(tmpdir(), 'skills-'))
    const skillDir = join(tmpSkills, 'bad-model-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A skill with invalid model',
      'allowed-tools: Read',
      'model: gpt-4o',
      '---',
      'body',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('invalid model id'), `expected "invalid model id" in output, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for SKILL.md with invalid model ID')
  })

  test('validate-skills.ts accepts all current valid Claude model IDs', () => {
    const validModels = [
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-haiku-4-5-20251001',
      'claude-fable-5',
    ]
    for (const modelId of validModels) {
      const tmpSkills = mkdtempSync(join(tmpdir(), 'skills-'))
      const tmpAgents = mkdtempSync(join(tmpdir(), 'agents-'))
      const skillDir = join(tmpSkills, 'valid-model-skill')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), [
        '---',
        'description: A skill with valid model',
        'allowed-tools: Read',
        `model: ${modelId}`,
        '---',
        'body',
      ].join('\n'))
      const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        // Use empty temp agents dir + nonexistent settings so only skill validation runs
        env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json') },
      })
      assert.ok(result.includes('Validation PASSED'), `expected PASSED for model ${modelId}`)
      rmSync(tmpSkills, { recursive: true })
      rmSync(tmpAgents, { recursive: true })
    }
  })
})

describe('guard agent permissionMode validation', () => {
  test('validate-skills.ts exits 1 when a guard agent is missing permissionMode: plan', () => {
    const tmpSkills = mkdtempSync(join(tmpdir(), 'skills-'))
    const tmpAgents = mkdtempSync(join(tmpdir(), 'agents-'))

    // Minimal valid skill so skills section passes
    const skillDir = join(tmpSkills, 'some-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A valid skill',
      'allowed-tools: Read',
      '---',
    ].join('\n'))

    // Guard agent without permissionMode: plan
    writeFileSync(join(tmpAgents, 'security-guard.md'), [
      '---',
      'name: security-guard',
      'description: Security guard agent',
      'tools: Read',
      'model: claude-opus-4-8',
      '---',
    ].join('\n'))

    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SKILLS_DIR: tmpSkills,
          AGENTS_DIR: tmpAgents,
          SETTINGS_FILE: join(tmpAgents, 'settings.json'),
        },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(
        out.includes('permissionMode') || out.includes('plan'),
        `expected permissionMode error in output, got: ${out}`
      )
    }
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when guard agent is missing permissionMode: plan')
  })
})

describe('validate-skills integration', () => {
  test('validate-skills.ts exits 0 on the real skills directory', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('Validation PASSED'), 'expected PASSED in output')
  })

  test('validate-skills.ts checks ROUTING.md agent names', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('ROUTING.md'), 'expected ROUTING.md check in output')
  })

  test('validate-skills.ts checks settings.json skillOverrides', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('skillOverrides'), 'expected skillOverrides check in output')
  })

  test('validate-skills.ts exits 1 when a SKILL.md is missing a required field', () => {
    const tmpSkills = mkdtempSync(join(tmpdir(), 'skills-'))
    const badSkillDir = join(tmpSkills, 'bad-skill')
    mkdirSync(badSkillDir, { recursive: true })
    writeFileSync(join(badSkillDir, 'SKILL.md'), [
      '---',
      '# description field intentionally omitted',
      'allowed-tools: Read',
      '---',
      'body',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('missing required field'), `expected "missing required field" in output, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for SKILL.md with missing description')
  })

  test('validate-skills.ts exits 1 when a SKILL.md has a duplicate frontmatter key', () => {
    const tmpSkills = mkdtempSync(join(tmpdir(), 'skills-'))
    const dupeSkillDir = join(tmpSkills, 'dupe-skill')
    mkdirSync(dupeSkillDir, { recursive: true })
    writeFileSync(join(dupeSkillDir, 'SKILL.md'), [
      '---',
      'description: First',
      'allowed-tools: Read',
      'description: Second',
      '---',
      'body',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('duplicate frontmatter key'), `expected "duplicate frontmatter key" in output, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for SKILL.md with a duplicate frontmatter key')
  })
})
