// Unit tests for scripts/lib/frontmatter.ts + scripts/lib/presets.ts
// Integration smoke-test for validate-skills.ts and check-stale.ts
// Run: node --experimental-strip-types --test scripts/validate-skills.test.ts
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { parseFrontmatter, findDuplicateFrontmatterKeys } from './lib/frontmatter.ts'
import { validatePresetClaudeMd, findPresetDirs, checkCompactMd } from './lib/presets.ts'
import { findBrokenLinks, extractAnchors, extractLinks, slugifyHeading } from './lib/links.ts'
import { extractRoutedAgent, significantWords } from './routing-eval.ts'

// Temp dirs are tracked and force-removed after the suite — the rmSync at the
// end of a test never runs when an assertion throws, which would leak the dir.
const TEMP_DIRS: string[] = []
after(() => { for (const d of TEMP_DIRS) rmSync(d, { recursive: true, force: true }) })
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(prefix)
  TEMP_DIRS.push(dir)
  return dir
}

const NODE_FLAGS = ['--experimental-strip-types']
// fileURLToPath handles Windows drive letters natively — no manual /C:/ fixups.
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('parseFrontmatter', () => {
  test('returns null when no frontmatter block is present', () => {
    assert.strictEqual(parseFrontmatter('no frontmatter here'), null)
  })

  test('returns null when opening --- is missing', () => {
    assert.strictEqual(parseFrontmatter('description: foo\n---\nbody'), null)
  })

  test('tolerates a UTF-8 BOM before the opening ---', () => {
    const bom = String.fromCharCode(0xfeff)
    const fm = parseFrontmatter(bom + '---\ndescription: BOM file\nallowed-tools: Read\n---\nbody')
    assert.strictEqual(fm!.description, 'BOM file')
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
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
    const claudePath = join(dir, 'CLAUDE.md')
    writeFileSync(claudePath, '# My Preset\n\nThis preset has enough content to pass the minimum length validation check easily.')
    const r = validatePresetClaudeMd(claudePath, 'test/preset')
    assert.strictEqual(r.ok, true)
    rmSync(dir, { recursive: true })
  })

  test('fails when CLAUDE.md content is too short', () => {
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
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
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
    const claudePath = join(dir, 'CLAUDE.md')
    writeFileSync(claudePath, '# Content that is long enough to pass the preset minimum length check here.')
    const r = validatePresetClaudeMd(claudePath, 'web/nextjs')
    assert.strictEqual(r.rel, 'web/nextjs')
    rmSync(dir, { recursive: true })
  })
})

describe('findPresetDirs', () => {
  test('finds a single leaf directory containing CLAUDE.md', () => {
    const root = makeTempDir(join(tmpdir(), 'presets-'))
    const leaf = join(root, 'web', 'nextjs')
    mkdirSync(leaf, { recursive: true })
    writeFileSync(join(leaf, 'CLAUDE.md'), '# Next.js preset with enough content to pass validation easily.')
    const dirs = findPresetDirs(root)
    assert.strictEqual(dirs.length, 1)
    assert.ok(dirs[0].relPath.includes('nextjs'))
    rmSync(root, { recursive: true })
  })

  test('skips directories that contain no CLAUDE.md', () => {
    const root = makeTempDir(join(tmpdir(), 'presets-'))
    mkdirSync(join(root, 'empty-category'), { recursive: true })
    const dirs = findPresetDirs(root)
    assert.strictEqual(dirs.length, 0)
    rmSync(root, { recursive: true })
  })

  test('finds multiple preset dirs across sibling subdirectories', () => {
    const root = makeTempDir(join(tmpdir(), 'presets-'))
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
    const root = makeTempDir(join(tmpdir(), 'presets-'))
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
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    writeFileSync(join(dir, 'compact.md'), COMPACT_SUFFICIENT)
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'web/test')
    assert.strictEqual(r.ok, true)
    rmSync(dir, { recursive: true })
  })

  test('fails when compact.md is absent', () => {
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'web/test')
    assert.strictEqual(r.ok, false)
    assert.ok(r.reason!.includes('compact.md missing'), `expected "compact.md missing" in reason, got: ${r.reason}`)
    rmSync(dir, { recursive: true })
  })

  test('fails when compact.md is too short (< 7 non-blank lines)', () => {
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
    writeFileSync(join(dir, 'CLAUDE.md'), '# preset')
    writeFileSync(join(dir, 'compact.md'), '- only one rule')
    const r = checkCompactMd(join(dir, 'CLAUDE.md'), 'web/test')
    assert.strictEqual(r.ok, false)
    assert.ok(r.reason!.includes('too short'), `expected "too short" in reason, got: ${r.reason}`)
    rmSync(dir, { recursive: true })
  })

  test('relPath is preserved in result', () => {
    const dir = makeTempDir(join(tmpdir(), 'preset-'))
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
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'README.md')
    const content = 'See [missing doc](NOPE.md) for details.'
    const broken = findBrokenLinks(filePath, content)
    assert.strictEqual(broken.length, 1)
    assert.strictEqual(broken[0].target, 'NOPE.md')
    rmSync(dir, { recursive: true })
  })

  test('does not flag a relative link to a file that exists', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    writeFileSync(join(dir, 'OTHER.md'), '# Other')
    const filePath = join(dir, 'README.md')
    const content = 'See [other doc](OTHER.md) for details.'
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })

  test('ignores external URLs and validates same-file anchors', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'README.md')
    const content = [
      '# Some Heading',
      'See [external](https://example.com/doesnotexist) for details.',
      'Or the [section above](#some-heading).',
      'Or [email us](mailto:test@example.com).',
    ].join('\n')
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })

  test('flags a same-file anchor with no matching heading', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'README.md')
    const broken = findBrokenLinks(filePath, '# Real Heading\n\nSee [above](#not-a-heading).')
    assert.strictEqual(broken.length, 1)
    assert.strictEqual(broken[0].reason, 'missing-anchor')
    rmSync(dir, { recursive: true })
  })

  test('resolves a link with a #anchor suffix against the target file headings', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    writeFileSync(join(dir, 'OTHER.md'), '# Other\n\n## Some Section\n')
    const filePath = join(dir, 'README.md')
    const content = 'See [section](OTHER.md#some-section) for details.'
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })

  test('flags a cross-file anchor with no matching heading in the target', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    writeFileSync(join(dir, 'OTHER.md'), '# Other')
    const filePath = join(dir, 'README.md')
    const broken = findBrokenLinks(filePath, 'See [section](OTHER.md#some-section).')
    assert.strictEqual(broken.length, 1)
    assert.strictEqual(broken[0].reason, 'missing-anchor')
    assert.strictEqual(broken[0].target, 'OTHER.md#some-section')
    rmSync(dir, { recursive: true })
  })

  test('ignores the GitHub security-advisories UI convention link', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    const filePath = join(dir, 'SECURITY.md')
    const content = "Report via [Security Advisories](../../security/advisories/new)."
    assert.deepStrictEqual(findBrokenLinks(filePath, content), [])
    rmSync(dir, { recursive: true })
  })
})

describe('slugifyHeading / extractAnchors', () => {
  test('slugifies markup, punctuation, and case the way GitHub does', () => {
    assert.strictEqual(slugifyHeading('Hello, World!'), 'hello-world')
    assert.strictEqual(slugifyHeading('`code` & *bold* stuff'), 'code--bold-stuff')
    assert.strictEqual(slugifyHeading('Türkçe Başlık'), 'türkçe-başlık')
  })

  test('suffixes duplicate headings with -1, -2', () => {
    const anchors = extractAnchors('# Setup\n\n## Setup\n\n### Setup\n')
    assert.ok(anchors.has('setup'))
    assert.ok(anchors.has('setup-1'))
    assert.ok(anchors.has('setup-2'))
  })

  test('includes explicit <a id> / <a name> HTML anchors', () => {
    const anchors = extractAnchors('<a id="Custom-Target"></a>\n\n# Real Heading\n')
    assert.ok(anchors.has('custom-target'))
    assert.ok(anchors.has('real-heading'))
  })

  test('ignores headings inside fenced code blocks', () => {
    const anchors = extractAnchors('```\n# not a heading\n```\n\n# Real Heading\n')
    assert.ok(!anchors.has('not-a-heading'))
    assert.ok(anchors.has('real-heading'))
  })

  test('ignores headings inside HTML comments', () => {
    const anchors = extractAnchors('<!--\n# commented out\n-->\n\n# Real Heading\n')
    assert.ok(!anchors.has('commented-out'))
    assert.ok(anchors.has('real-heading'))
  })

  test('does not extract links inside HTML comments', () => {
    const links = extractLinks('<!-- [dead](GONE.md) -->\n\nSee [live](README.md).\n')
    assert.strictEqual(links.length, 1)
    assert.strictEqual(links[0].target, 'README.md')
  })

  test('flags an anchor with malformed percent-encoding as missing instead of crashing', () => {
    const dir = makeTempDir(join(tmpdir(), 'links-'))
    const broken = findBrokenLinks(join(dir, 'README.md'), '# Real Heading\n\nSee [bad](#foo%).')
    assert.strictEqual(broken.length, 1)
    assert.strictEqual(broken[0].reason, 'missing-anchor')
    rmSync(dir, { recursive: true })
  })
})

describe('check-links integration', () => {
  test('check-links.ts exits 0 on the real repo', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-links.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('No broken internal markdown links found'), 'expected pass message in output')
  })

  test('check-links.ts exits 1 when a markdown file has a broken relative link', () => {
    const tmp = makeTempDir(join(tmpdir(), 'links-root-'))
    writeFileSync(join(tmp, 'README.md'), 'See [missing](NOPE.md) for details.')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-links.ts'], {
        cwd: REPO_ROOT,
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
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, STALE_AFTER_DAYS: '365' },
    })
    assert.ok(result.includes('✓'), 'expected ✓ pass line in output')
  })

  test('check-stale.ts detects stale when maintenance file has an old date', () => {
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
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
        cwd: REPO_ROOT,
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
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
    // Empty rules maintenance file — no rules tracked
    const emptyRules = join(tmp, 'RULES-MAINTENANCE.md')
    writeFileSync(emptyRules, '# Rules\n\n| Rule File | Scope | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: REPO_ROOT,
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
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
    const emptyAgents = join(tmp, 'AGENTS-MAINTENANCE.md')
    writeFileSync(emptyAgents, '# Agents\n\n| Agent | Role | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: REPO_ROOT,
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
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
    const emptySkills = join(tmp, 'SKILLS-MAINTENANCE.md')
    writeFileSync(emptySkills, '# Skills\n\n| Skill | Purpose | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: REPO_ROOT,
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
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
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
        cwd: REPO_ROOT,
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
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
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
        cwd: REPO_ROOT,
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
    const tmp = makeTempDir(join(tmpdir(), 'stale-'))
    const emptyCommands = join(tmp, 'COMMANDS-MAINTENANCE.md')
    writeFileSync(emptyCommands, '# Commands\n\n| Command | Purpose | Last Reviewed |\n|---|---|---|\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
        cwd: REPO_ROOT,
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
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
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
        cwd: REPO_ROOT,
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
      const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
      const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
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
        cwd: REPO_ROOT,
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        // Use empty temp agents dir + nonexistent settings/global file so only skill validation runs
        env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
      })
      assert.ok(result.includes('Validation PASSED'), `expected PASSED for model ${modelId}`)
      rmSync(tmpSkills, { recursive: true })
      rmSync(tmpAgents, { recursive: true })
    }
  })

  test('validate-skills.ts accepts all generic model aliases', () => {
    const aliasModels = ['opus', 'sonnet', 'haiku', 'fable', 'inherit']
    for (const modelId of aliasModels) {
      const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
      const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
      const skillDir = join(tmpSkills, 'alias-model-skill')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), [
        '---',
        'description: A skill with an alias model',
        'allowed-tools: Read',
        `model: ${modelId}`,
        '---',
        'body',
      ].join('\n'))
      const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
      })
      assert.ok(result.includes('Validation PASSED'), `expected PASSED for model alias ${modelId}`)
      rmSync(tmpSkills, { recursive: true })
      rmSync(tmpAgents, { recursive: true })
    }
  })

  test('validate-skills.ts warns (but passes) for a well-formed unknown Claude model ID', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const skillDir = join(tmpSkills, 'future-model-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A skill referencing a Claude model newer than the validator list',
      'allowed-tools: Read',
      // when_to_use present so the only warning counted is the model-ID one
      'when_to_use: testing future model ids',
      'model: claude-sonnet-6',
      '---',
      'body',
    ].join('\n'))
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
    })
    assert.ok(result.includes('Validation PASSED'), `expected PASSED for unknown-but-well-formed model, got: ${result}`)
    // The warning text itself goes to stderr; the stdout summary line counts it.
    assert.ok(result.includes('1 warning(s)'), `expected 1 warning counted in summary, got: ${result}`)
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
  })
})

describe('malformed model ID validation', () => {
  test('validate-skills.ts exits 1 for a malformed Claude model ID (not warn)', () => {
    for (const badModel of ['claude-', 'anthropic-sonnet-5']) {
      const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
      const skillDir = join(tmpSkills, 'malformed-model-skill')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), [
        '---',
        'description: A skill with a malformed model id',
        'allowed-tools: Read',
        `model: ${badModel}`,
        '---',
        'body',
      ].join('\n'))
      let threw = false
      try {
        execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, SKILLS_DIR: tmpSkills },
        })
      } catch (err) {
        threw = true
        const e = err as { stderr?: string; stdout?: string }
        const out = (e.stderr ?? '') + (e.stdout ?? '')
        assert.ok(out.includes('invalid model id'), `expected "invalid model id" for '${badModel}', got: ${out}`)
      }
      rmSync(tmpSkills, { recursive: true })
      assert.ok(threw, `expected non-zero exit for malformed model ID '${badModel}'`)
    }
  })
})

describe('effort validation', () => {
  test('validate-skills.ts accepts low, medium, and high effort in a skill', () => {
    for (const effort of ['low', 'medium', 'high']) {
      const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
      const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
      const skillDir = join(tmpSkills, 'valid-effort-skill')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), [
        '---',
        'description: A skill with valid effort',
        'allowed-tools: Read',
        `effort: ${effort}`,
        '---',
        'body',
      ].join('\n'))
      const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
      })
      assert.ok(result.includes('Validation PASSED'), `expected PASSED for effort ${effort}`)
      rmSync(tmpSkills, { recursive: true })
      rmSync(tmpAgents, { recursive: true })
    }
  })

  test('validate-skills.ts exits 1 for effort: xhigh or max in a skill (hard rule, no exceptions)', () => {
    for (const badEffort of ['xhigh', 'max']) {
      const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
      const skillDir = join(tmpSkills, 'bad-effort-skill')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), [
        '---',
        'description: A skill with disallowed effort',
        'allowed-tools: Read',
        `effort: ${badEffort}`,
        '---',
        'body',
      ].join('\n'))
      let threw = false
      try {
        execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, SKILLS_DIR: tmpSkills },
        })
      } catch (err) {
        threw = true
        const e = err as { stderr?: string; stdout?: string }
        const out = (e.stderr ?? '') + (e.stdout ?? '')
        assert.ok(out.includes('not allowed in agent/skill frontmatter'), `expected the hard-rule message for '${badEffort}', got: ${out}`)
      }
      rmSync(tmpSkills, { recursive: true })
      assert.ok(threw, `expected non-zero exit for effort: ${badEffort}`)
    }
  })

  test('validate-skills.ts exits 1 for effort: xhigh in an agent file too', () => {
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    writeFileSync(join(tmpAgents, 'my-agent.md'), [
      '---',
      'name: my-agent',
      'description: An agent with disallowed effort',
      'tools: Read',
      'model: sonnet',
      'effort: xhigh',
      '---',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, AGENTS_DIR: tmpAgents },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('not allowed in agent/skill frontmatter'), `expected the hard-rule message, got: ${out}`)
    }
    rmSync(tmpAgents, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for agent effort: xhigh')
  })
})

describe('skill agent: cross-reference (context: fork)', () => {
  test('validate-skills.ts exits 1 when agent: references a non-existent agent', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const skillDir = join(tmpSkills, 'forked-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A forked skill',
      'allowed-tools: Read',
      'context: fork',
      'agent: ghost-agent',
      '---',
      'body',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes("references non-existent agent: 'ghost-agent'"), `expected ghost-agent flagged, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when agent: points to a non-existent agent')
  })

  test('validate-skills.ts passes when agent: references a real agent file', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    writeFileSync(join(tmpAgents, 'real-agent.md'), [
      '---',
      'name: real-agent',
      'description: A real agent',
      'tools: Read',
      'model: sonnet',
      '---',
    ].join('\n'))
    const skillDir = join(tmpSkills, 'forked-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A forked skill',
      'allowed-tools: Read',
      'context: fork',
      'agent: real-agent',
      '---',
      'body',
    ].join('\n'))
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
    })
    assert.ok(result.includes('Validation PASSED'), `expected PASSED for a valid agent: reference, got: ${result}`)
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
  })
})

describe('skill/agent tool-capability binding (round-14 fix)', () => {
  test('validate-skills.ts exits 1 when a skill requires a tool its bound agent lacks', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    writeFileSync(join(tmpAgents, 'readonly-agent.md'), [
      '---',
      'name: readonly-agent',
      'description: A read-only agent',
      'tools: Read, Grep, Glob, Bash',
      'model: sonnet',
      '---',
    ].join('\n'))
    const skillDir = join(tmpSkills, 'forked-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A forked skill that writes files',
      'allowed-tools: Read, Grep, Glob, Bash, Write',
      'context: fork',
      'agent: readonly-agent',
      '---',
      'body',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(
        out.includes("requires tool(s) [Write] not granted to bound agent 'readonly-agent'"),
        `expected capability-mismatch flagged, got: ${out}`
      )
    }
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when a skill requires a tool its bound agent lacks')
  })

  test('validate-skills.ts passes when a skill\'s allowed-tools is a subset of its bound agent\'s tools', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    writeFileSync(join(tmpAgents, 'write-agent.md'), [
      '---',
      'name: write-agent',
      'description: A write-capable agent',
      'tools: Read, Grep, Glob, Bash, Edit, Write',
      'model: sonnet',
      '---',
    ].join('\n'))
    const skillDir = join(tmpSkills, 'forked-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: A forked skill that writes files',
      'allowed-tools: Read, Grep, Glob, Bash, Write',
      'context: fork',
      'agent: write-agent',
      '---',
      'body',
    ].join('\n'))
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
    })
    assert.ok(result.includes('Validation PASSED'), `expected PASSED for a subset tool grant, got: ${result}`)
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
  })
})

describe('command frontmatter validation', () => {
  test('validate-skills.ts exits 1 when a command file has no frontmatter', () => {
    const tmpCommands = makeTempDir(join(tmpdir(), 'commands-'))
    writeFileSync(join(tmpCommands, 'bare.md'), '# /bare\n\nDo the thing: $ARGUMENTS\n')
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, COMMANDS_DIR: tmpCommands },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('missing frontmatter'), `expected "missing frontmatter" in output, got: ${out}`)
    }
    rmSync(tmpCommands, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for a command file without frontmatter')
  })

  test('validate-skills.ts warns (but passes) when $ARGUMENTS is used without argument-hint', () => {
    const tmpCommands = makeTempDir(join(tmpdir(), 'commands-'))
    writeFileSync(join(tmpCommands, 'hintless.md'), [
      '---',
      'description: A command that takes arguments but declares no hint.',
      '---',
      '',
      '# /hintless',
      '',
      'Do the thing: $ARGUMENTS',
    ].join('\n'))
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, COMMANDS_DIR: tmpCommands },
    })
    assert.ok(result.includes('Validation PASSED'), `expected PASSED for a hintless command, got: ${result}`)
    rmSync(tmpCommands, { recursive: true })
  })

  test('validate-skills.ts warns (but passes) when argument-hint is declared without $ARGUMENTS', () => {
    const tmpCommands = makeTempDir(join(tmpdir(), 'commands-'))
    writeFileSync(join(tmpCommands, 'stale-hint.md'), [
      '---',
      'description: A command whose hint outlived its $ARGUMENTS placeholder.',
      'argument-hint: "[target]"',
      '---',
      '',
      '# /stale-hint',
      '',
      'Do the thing with no substitution.',
    ].join('\n'))
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, COMMANDS_DIR: tmpCommands },
    })
    assert.ok(result.includes('Validation PASSED'), `expected PASSED for a stale-hint command, got: ${result}`)
    rmSync(tmpCommands, { recursive: true })
  })
})

describe('global-CLAUDE.md routing target validation', () => {
  // The AGENT ROUTING section is prose with "signal → agent" arrows. This
  // fixture mirrors that real shape (NOT a table) so the test exercises the
  // parser the shipped file actually hits — the earlier table-format fixture
  // passed while the real prose section silently validated zero targets.
  test('validate-skills.ts exits 1 when a routing arrow points to a non-existent agent', () => {
    const tmp = makeTempDir(join(tmpdir(), 'routing-'))
    const tmpAgents = join(tmp, 'agents')
    mkdirSync(tmpAgents, { recursive: true })
    writeFileSync(join(tmpAgents, 'bug-hunter.md'), [
      '---',
      'name: bug-hunter',
      'description: Bug hunting agent',
      'tools: Read',
      'model: claude-sonnet-5',
      '---',
    ].join('\n'))
    writeFileSync(join(tmpAgents, 'ROUTING.md'), 'bug-hunter — errors and crashes\n')
    const globalFile = join(tmp, 'global-CLAUDE.md')
    writeFileSync(globalFile, [
      '## AGENT ROUTING',
      '',
      'Escalation signals ALWAYS route to their guard:',
      'DB schema/migration → bug-hunter', // real agent (present) — must be counted, not flagged
      'auth / payment → ghost-guard', // dangling hyphenated reference — must be flagged
      '',
      'AMBIGUITY: >80% clear → act | 50-80% → state assumption | <50% → ask ONCE', // prose arrows — must NOT be flagged
      '',
      '---',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, AGENTS_DIR: tmpAgents, GLOBAL_CLAUDE_FILE: globalFile },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes("'ghost-guard'"), `expected dangling hyphenated agent flagged, got: ${out}`)
      assert.ok(!out.includes("'act'"), `prose arrow "→ act" must not be parsed as an agent, got: ${out}`)
      assert.ok(!out.includes("'ask'"), `prose arrow "→ ask" must not be parsed as an agent, got: ${out}`)
      assert.ok(!out.includes("'state'"), `prose arrow "→ state" must not be parsed as an agent, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when a routing arrow has no agent file')
  })

  // A backticked token after the arrow (e.g. "→ `incident-response` skill")
  // used to be invisible to this parser entirely — the regex required
  // `[a-z]` immediately after the arrow's whitespace, and a backtick sits in
  // between, so the match simply never started. That meant a backticked
  // DANGLING agent reference (a typo, or a since-renamed agent) silently
  // passed with no error, while a backticked SKILL reference happened to
  // "work" only by accident (never being checked at all). Assert both: a
  // backticked reference to a real skill is not flagged, and a backticked
  // reference to a non-existent hyphenated name IS now flagged.
  test('validate-skills.ts sees through backticks around a routing arrow target', () => {
    const tmp = makeTempDir(join(tmpdir(), 'routing-backtick-'))
    const tmpAgents = join(tmp, 'agents')
    mkdirSync(tmpAgents, { recursive: true })
    writeFileSync(join(tmpAgents, 'bug-hunter.md'), [
      '---',
      'name: bug-hunter',
      'description: Bug hunting agent',
      'tools: Read',
      'model: claude-sonnet-5',
      '---',
    ].join('\n'))
    writeFileSync(join(tmpAgents, 'ROUTING.md'), 'bug-hunter — errors and crashes\n')
    const globalFile = join(tmp, 'global-CLAUDE.md')
    writeFileSync(globalFile, [
      '## AGENT ROUTING',
      '',
      'Escalation signals ALWAYS route to their guard:',
      'DB schema/migration → bug-hunter',
      'live-incident language → `incident-response` skill first', // real skill, backticked — must NOT be flagged
      'auth / payment → `ghost-guard`', // dangling hyphenated reference, backticked — must be flagged
      '',
      '---',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, AGENTS_DIR: tmpAgents, GLOBAL_CLAUDE_FILE: globalFile },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes("'ghost-guard'"), `expected backticked dangling agent flagged, got: ${out}`)
      assert.ok(!out.includes("'incident-response'"), `backticked reference to a real skill must not be flagged, got: ${out}`)
    }
    rmSync(tmp, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when a backticked routing arrow has no agent file')
  })

  // Dogfood guard against silent parser drift: run the validator against the
  // REAL shipped global-CLAUDE.md + agents/ and assert it extracts a non-empty
  // set of real guards. If the section format changes again and the parser
  // stops understanding it, this fails instead of silently checking zero.
  test('validate-skills.ts extracts real routing guards from the shipped global-CLAUDE.md', () => {
    const out = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const guard of ['db-guard', 'security-guard', 'devops-guard', 'architect']) {
      assert.ok(out.includes(`global-CLAUDE.md → ${guard}`), `expected shipped global-CLAUDE.md to route to ${guard}, got: ${out}`)
    }
    assert.ok(!/0 routing targets checked/.test(out), `parser extracted zero targets from the real file — it has gone stale, got: ${out}`)
  })
})

describe('guard agent permissionMode validation', () => {
  test('validate-skills.ts exits 1 when a guard agent is missing permissionMode: plan', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))

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
        cwd: REPO_ROOT,
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SKILLS_DIR: tmpSkills,
          AGENTS_DIR: tmpAgents,
          SETTINGS_FILE: join(tmpAgents, 'settings.json'),
          GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md'),
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

  // Round-9 fix: enforcement is by NAME PATTERN (endsWith('-guard')), not a
  // hardcoded set of the original three guards — this proves a newly-named
  // `*-guard` agent (not security-guard/db-guard/devops-guard) is caught too,
  // the exact gap that let performance-guard ship with permissionMode: plan
  // but unvalidated.
  test('validate-skills.ts enforces permissionMode: plan on ANY *-guard agent, not just the original three', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))

    const skillDir = join(tmpSkills, 'some-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), ['---', 'description: A valid skill', 'allowed-tools: Read', '---'].join('\n'))

    writeFileSync(join(tmpAgents, 'performance-guard.md'), [
      '---',
      'name: performance-guard',
      'description: Performance guard agent',
      'tools: Read',
      'model: claude-opus-4-8',
      '---',
    ].join('\n'))

    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SKILLS_DIR: tmpSkills,
          AGENTS_DIR: tmpAgents,
          SETTINGS_FILE: join(tmpAgents, 'settings.json'),
          GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md'),
        },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('performance-guard') && out.includes('permissionMode'), `expected performance-guard permissionMode error, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    assert.ok(threw, 'expected non-zero exit when a non-hardcoded *-guard agent is missing permissionMode: plan')
  })
})

describe('validator output format contract', () => {
  // Pins the summary-line shapes other tooling (CI grep, this test file's own
  // assertions) relies on — a reworded summary must be a deliberate change here,
  // not an accident.
  test('validate-skills.ts summary lines keep their machine-greppable shape', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const contracts = [
      /\d+ skills checked — \d+ error\(s\), \d+ warning\(s\)/,
      /\d+ agents cross-referenced — \d+ broken reference\(s\)/,
      /\d+ agents checked against ROUTING\.md — \d+ missing/,
      /\d+ agents frontmatter validated — \d+ error\(s\)/,
      /\d+ commands validated — \d+ error\(s\)/,
      /\d+ routing targets checked — \d+ missing agent file\(s\)/,
      /\d+ hand-off reference\(s\) checked — \d+ broken/,
      /✓ settings-template\.json parses/,
      /\d+ presets checked — \d+ error\(s\)/,
      /Validation PASSED\./,
    ]
    for (const re of contracts) {
      assert.match(result, re, `expected summary line matching ${re} in validator output`)
    }
  })

  test('check-stale.ts and check-links.ts pass lines keep their shape', () => {
    const stale = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-stale.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, STALE_AFTER_DAYS: '365' },
    })
    assert.match(stale, /✓ All \d+ presets reviewed within the last \d+ days\./)
    assert.match(stale, /✓ README\.md count claims match disk\./)
    const links = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-links.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.match(links, /Checking internal markdown links across \d+ files\.\.\./)
    assert.match(links, /✓ No broken internal markdown links found\./)
  })
})

describe('skill hand-off chain validation', () => {
  test('validate-skills.ts exits 1 when a skill hands off to a non-existent skill', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const skillDir = join(tmpSkills, 'orphan-handoff')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), [
      '---',
      'description: Design phase — hand off to `nonexistent-skill` once ready.',
      'allowed-tools: Read',
      '---',
      'body',
    ].join('\n'))
    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes("hands off to non-existent skill: 'nonexistent-skill'"), `expected broken hand-off flagged, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for a skill handing off to a non-existent skill')
  })

  test('validate-skills.ts passes when a skill hands off to a real skill', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const targetDir = join(tmpSkills, 'real-target')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'SKILL.md'), ['---', 'description: The real target.', 'allowed-tools: Read', '---', 'body'].join('\n'))
    const sourceDir = join(tmpSkills, 'source-skill')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, 'SKILL.md'), [
      '---',
      'description: Design phase — hand off to `real-target` once ready.',
      'allowed-tools: Read',
      '---',
      'body',
    ].join('\n'))
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SKILLS_DIR: tmpSkills, AGENTS_DIR: tmpAgents, SETTINGS_FILE: join(tmpAgents, 'settings.json'), GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md') },
    })
    assert.ok(result.includes('1 hand-off reference(s) checked — 0 broken'), `expected the hand-off counted clean, got: ${result}`)
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
  })
})

describe('validate-skills integration', () => {
  test('validate-skills.ts exits 0 on the real skills directory', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('Validation PASSED'), 'expected PASSED in output')
  })

  test('validate-skills.ts checks ROUTING.md agent names', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('ROUTING.md'), 'expected ROUTING.md check in output')
  })

  test('validate-skills.ts checks settings-template.json parseability', () => {
    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.ok(result.includes('settings-template.json parses'), 'expected settings-template.json parse check in output')
  })

  test('validate-skills.ts exits 1 when a SKILL.md is missing a required field', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
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
        cwd: REPO_ROOT,
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
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
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
        cwd: REPO_ROOT,
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

describe('orphan skill detection (round-9 fix)', () => {
  test('validate-skills.ts exits 1 for a skill referenced nowhere', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const orphanDir = join(tmpSkills, 'totally-unreferenced-skill')
    mkdirSync(orphanDir, { recursive: true })
    writeFileSync(join(orphanDir, 'SKILL.md'), ['---', 'description: Never wired up anywhere', 'allowed-tools: Read', '---', 'body'].join('\n'))

    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SKILLS_DIR: tmpSkills, ORPHAN_CHECK: '1' },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('totally-unreferenced-skill') && out.includes('not referenced'), `expected orphan-skill error, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    assert.ok(threw, 'expected non-zero exit for an unreferenced skill')
  })

  test('validate-skills.ts does NOT flag a skill marked disable-model-invocation: true', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const manualDir = join(tmpSkills, 'manual-only-skill')
    mkdirSync(manualDir, { recursive: true })
    writeFileSync(join(manualDir, 'SKILL.md'), [
      '---',
      'description: Manual-only, slash-command-driven',
      'allowed-tools: Read',
      'disable-model-invocation: true',
      '---',
      'body',
    ].join('\n'))

    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SKILLS_DIR: tmpSkills,
        AGENTS_DIR: tmpAgents,
        SETTINGS_FILE: join(tmpAgents, 'settings.json'),
        GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md'),
        ORPHAN_CHECK: '1',
      },
    })
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    assert.ok(result.includes('Validation PASSED'), `expected manual-only skill to pass, got: ${result}`)
    assert.ok(!result.includes('not referenced'), `manual-only skill should not be flagged as orphaned, got: ${result}`)
  })

  test('validate-skills.ts does NOT flag a skill mentioned in global-CLAUDE.md', () => {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    // Deliberately NOT inside tmpAgents — the agent-frontmatter validator
    // treats every *.md file in AGENTS_DIR as an agent definition, so a
    // global-CLAUDE.md fixture placed there would get (incorrectly) validated
    // as one.
    const tmpGlobalClaudeDir = makeTempDir(join(tmpdir(), 'global-claude-'))
    const mentionedDir = join(tmpSkills, 'mentioned-in-global-claude')
    mkdirSync(mentionedDir, { recursive: true })
    writeFileSync(join(mentionedDir, 'SKILL.md'), ['---', 'description: Wired via global-CLAUDE.md prose only', 'allowed-tools: Read', '---', 'body'].join('\n'))
    const tmpGlobalClaude = join(tmpGlobalClaudeDir, 'global-CLAUDE.md')
    writeFileSync(tmpGlobalClaude, 'SKILL CHECK — for a matching task, use the `mentioned-in-global-claude` skill.\n\n## AGENT ROUTING\n\nEverything else: delegate by agent description.\n')

    const result = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SKILLS_DIR: tmpSkills,
        AGENTS_DIR: tmpAgents,
        SETTINGS_FILE: join(tmpAgents, 'settings.json'),
        GLOBAL_CLAUDE_FILE: tmpGlobalClaude,
        ORPHAN_CHECK: '1',
      },
    })
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    rmSync(tmpGlobalClaudeDir, { recursive: true })
    assert.ok(result.includes('Validation PASSED'), `expected globally-mentioned skill to pass, got: ${result}`)
  })

  test('round-11: a "NAME-guide" doc filename does NOT satisfy the reference check for skill NAME', () => {
    // The real bug this locks in: global-CLAUDE.md's lazy-load docs list once
    // mentioned "from-scratch-guide", and a bare `\bfrom-scratch\b` regex
    // matched inside that unrelated filename — the `from-scratch` skill
    // passed the orphan check for the wrong reason (an accidental substring)
    // while genuinely being absent from every agent's `skills:` list and
    // ROUTING.md. `\bNAME\b(?!-)` must reject this and still flag the skill.
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const tmpGlobalClaudeDir = makeTempDir(join(tmpdir(), 'global-claude-'))
    const targetDir = join(tmpSkills, 'from-scratch')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'SKILL.md'), ['---', 'description: Starting a new project from scratch', 'allowed-tools: Read', '---', 'body'].join('\n'))
    const tmpGlobalClaude = join(tmpGlobalClaudeDir, 'global-CLAUDE.md')
    writeFileSync(tmpGlobalClaude, 'Lazy-load docs: architecture | from-scratch-guide | new-page-guide\n\n## AGENT ROUTING\n\nEverything else: delegate by agent description.\n')

    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SKILLS_DIR: tmpSkills,
          AGENTS_DIR: tmpAgents,
          SETTINGS_FILE: join(tmpAgents, 'settings.json'),
          GLOBAL_CLAUDE_FILE: tmpGlobalClaude,
          ORPHAN_CHECK: '1',
        },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('from-scratch') && out.includes('not referenced'), `expected from-scratch to still be flagged as orphaned, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    rmSync(tmpGlobalClaudeDir, { recursive: true })
    assert.ok(threw, 'expected non-zero exit — a "-guide" suffix must not count as a genuine reference')
  })

  test('symmetric case: a skill name that is the SUFFIX of an unrelated hyphenated word does NOT satisfy the reference check', () => {
    // The mirror image of the round-11 fix above: that fix added `(?!-)` to
    // reject the skill name as a PREFIX of a longer word. `\b` alone still
    // matches at a '-'→word-char transition, so without a matching `(?<!-)`
    // lookbehind, a skill named `page` would pass this check merely because
    // some unrelated mention of `new-page` exists — the same false-pass class,
    // just on the other side of the hyphen.
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const tmpGlobalClaudeDir = makeTempDir(join(tmpdir(), 'global-claude-'))
    const tmpCommands = makeTempDir(join(tmpdir(), 'commands-')) // isolated + empty: real commands/*.md has unrelated bare "page" mentions (e.g. seo-check.md) that would mask this test
    const targetDir = join(tmpSkills, 'page')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'SKILL.md'), ['---', 'description: Unrelated to new-page', 'allowed-tools: Read', '---', 'body'].join('\n'))
    const tmpGlobalClaude = join(tmpGlobalClaudeDir, 'global-CLAUDE.md')
    writeFileSync(tmpGlobalClaude, 'Use the `new-page` skill for admin panel pages.\n\n## AGENT ROUTING\n\nEverything else: delegate by agent description.\n')

    let threw = false
    try {
      execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SKILLS_DIR: tmpSkills,
          AGENTS_DIR: tmpAgents,
          SETTINGS_FILE: join(tmpAgents, 'settings.json'),
          GLOBAL_CLAUDE_FILE: tmpGlobalClaude,
          COMMANDS_DIR: tmpCommands,
          ORPHAN_CHECK: '1',
        },
      })
    } catch (err) {
      threw = true
      const e = err as { stderr?: string; stdout?: string }
      const out = (e.stderr ?? '') + (e.stdout ?? '')
      assert.ok(out.includes('page') && out.includes('not referenced'), `expected 'page' to still be flagged as orphaned, got: ${out}`)
    }
    rmSync(tmpSkills, { recursive: true })
    rmSync(tmpAgents, { recursive: true })
    rmSync(tmpGlobalClaudeDir, { recursive: true })
    rmSync(tmpCommands, { recursive: true })
    assert.ok(threw, 'expected non-zero exit — being the suffix of an unrelated hyphenated word must not count as a genuine reference')
  })
})

describe('rules/ frontmatter validation', () => {
  // Round-13 fix: this validation existed (round 9) but shipped with zero
  // fixture coverage — it only ever ran against the real rules/ directory,
  // so a regression in the check itself (or a reintroduction of the bug class
  // it catches) would only be caught by eyeballing `npm run validate`'s output.
  function writeRule(dir: string, name: string, frontmatterLines: string[]): void {
    writeFileSync(join(dir, `${name}.md`), ['---', ...frontmatterLines, '---', '', 'body'].join('\n'))
  }

  function runValidate(rulesDir: string): { code: number; out: string } {
    const tmpSkills = makeTempDir(join(tmpdir(), 'skills-'))
    const tmpAgents = makeTempDir(join(tmpdir(), 'agents-'))
    const skillDir = join(tmpSkills, 'some-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), ['---', 'description: A valid skill', 'allowed-tools: Read', '---'].join('\n'))
    try {
      const out = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/validate-skills.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SKILLS_DIR: tmpSkills,
          AGENTS_DIR: tmpAgents,
          SETTINGS_FILE: join(tmpAgents, 'settings.json'),
          GLOBAL_CLAUDE_FILE: join(tmpAgents, 'global-CLAUDE.md'),
          RULES_DIR: rulesDir,
        },
      })
      return { code: 0, out }
    } catch (err) {
      const e = err as { status?: number; stderr?: string; stdout?: string }
      return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
    } finally {
      rmSync(tmpSkills, { recursive: true, force: true })
      rmSync(tmpAgents, { recursive: true, force: true })
    }
  }

  test('passes for a well-formed lazy-loaded rule and a well-formed always-loaded rule', () => {
    const tmpRules = makeTempDir(join(tmpdir(), 'rules-'))
    writeRule(tmpRules, '000-security', ['description: Security rules'])
    writeRule(tmpRules, '100-web', ['description: Web rules', 'paths:', '  - "**/*.tsx"'])
    const { code, out } = runValidate(tmpRules)
    rmSync(tmpRules, { recursive: true, force: true })
    assert.strictEqual(code, 0, `expected exit 0, got: ${out}`)
    assert.match(out, /2 rules frontmatter validated — 0 error\(s\)/)
  })

  test('exits 1 when a lazy-loaded rule is missing paths: entirely', () => {
    const tmpRules = makeTempDir(join(tmpdir(), 'rules-'))
    writeRule(tmpRules, '100-web', ['description: Web rules'])
    const { code, out } = runValidate(tmpRules)
    rmSync(tmpRules, { recursive: true, force: true })
    assert.strictEqual(code, 1)
    assert.ok(out.includes("100-web.md — missing 'paths:' frontmatter"), `got: ${out}`)
  })

  test('exits 1 when a rule has the singular path: typo instead of paths:', () => {
    const tmpRules = makeTempDir(join(tmpdir(), 'rules-'))
    writeRule(tmpRules, '100-web', ['description: Web rules', 'path: "**/*.tsx"'])
    const { code, out } = runValidate(tmpRules)
    rmSync(tmpRules, { recursive: true, force: true })
    assert.strictEqual(code, 1)
    assert.ok(out.includes("100-web.md — found 'path:' (singular)"), `got: ${out}`)
  })

  test('exits 1 when paths: is present but has no glob entries', () => {
    const tmpRules = makeTempDir(join(tmpdir(), 'rules-'))
    writeFileSync(join(tmpRules, '100-web.md'), ['---', 'description: Web rules', 'paths:', '---', '', 'body'].join('\n'))
    const { code, out } = runValidate(tmpRules)
    rmSync(tmpRules, { recursive: true, force: true })
    assert.strictEqual(code, 1)
    assert.ok(out.includes("100-web.md — 'paths:' is present but has no glob entries"), `got: ${out}`)
  })

  test('exits 1 when an always-loaded rule (000-security/001-conventions) wrongly carries paths:', () => {
    const tmpRules = makeTempDir(join(tmpdir(), 'rules-'))
    writeRule(tmpRules, '000-security', ['description: Security rules', 'paths:', '  - "**/*.ts"'])
    const { code, out } = runValidate(tmpRules)
    rmSync(tmpRules, { recursive: true, force: true })
    assert.strictEqual(code, 1)
    assert.ok(out.includes("000-security.md — has 'paths:' frontmatter but is documented as always-loaded"), `got: ${out}`)
  })

  test('exits 1 when a rule is missing frontmatter entirely', () => {
    const tmpRules = makeTempDir(join(tmpdir(), 'rules-'))
    writeFileSync(join(tmpRules, '100-web.md'), 'no frontmatter here\n')
    const { code, out } = runValidate(tmpRules)
    rmSync(tmpRules, { recursive: true, force: true })
    assert.strictEqual(code, 1)
    assert.ok(out.includes('100-web.md — missing frontmatter'), `got: ${out}`)
  })
})

describe('extractRoutedAgent (routing-eval live-scoring rule)', () => {
  const agents = new Set(['bug-hunter', 'security-guard', 'db-guard', 'senior-engineer'])

  test('returns the exact name when the answer is only an agent name', () => {
    assert.strictEqual(extractRoutedAgent('bug-hunter', agents), 'bug-hunter')
  })

  test('extracts a single token-bounded agent from a chatty answer', () => {
    assert.strictEqual(extractRoutedAgent('route this to bug-hunter please', agents), 'bug-hunter')
  })

  test('matches a hyphenated name as one token', () => {
    assert.strictEqual(extractRoutedAgent('answer: senior-engineer', agents), 'senior-engineer')
  })

  test('returns null when the answer names more than one agent (ambiguous → miss)', () => {
    assert.strictEqual(extractRoutedAgent('bug-hunter, not security-guard', agents), null)
  })

  test('does not match an agent name embedded in a larger word (guards against substring scoring)', () => {
    // "db-guardian" must NOT score as "db-guard" — this is the exact bug an
    // un-token-bounded substring match would introduce.
    assert.strictEqual(extractRoutedAgent('use the db-guardian helper', agents), null)
  })

  test('returns null when no known agent appears', () => {
    assert.strictEqual(extractRoutedAgent('not sure which one fits here', agents), null)
  })
})

describe('significantWords (routing-eval expectedSkill drift lint)', () => {
  test('lowercases and keeps only words of 4+ characters', () => {
    const words = significantWords('Fix the API bug now')
    assert.ok(words.has('now') === false, 'a 3-letter word must be excluded')
    assert.ok([...words].every(w => w === w.toLowerCase()), 'every word must be lowercased')
  })

  test('drops stopwords even when 4+ characters', () => {
    const words = significantWords('this need about their')
    assert.strictEqual(words.size, 0)
  })

  test('keeps Turkish characters intact (no mangling to ASCII)', () => {
    const words = significantWords('şemayı değiştir')
    assert.ok(words.has('şemayı'), `expected 'şemayı' in ${[...words]}`)
  })

  test('two texts about the same topic share at least one significant word', () => {
    const prompt = significantWords('bundle 2MB olmuş, neden bu kadar yavaş açılıyor site')
    const skill = significantWords('Use for slow code, slow queries, bundle size, caching, N+1, render loops, memory, and latency issues.')
    const overlap = [...prompt].some(w => skill.has(w))
    assert.ok(overlap, 'expected "bundle" to overlap between the prompt and the skill description')
  })
})

describe('check-consistency.ts drift detection', () => {
  // Builds an isolated CONSISTENCY_ROOT fixture with every file the script reads,
  // all values consistent by default; each test overrides exactly one to prove
  // that drift is actually caught (and not merely that the clean repo passes).
  function buildConsistencyFixture(
    overrides: {
      pkgVersion?: string
      pluginVersion?: string
      promptCount?: number
      readmeClaim?: number
      nodeVersions?: [string, string]
      alwaysLoadedLines?: number
      pkgTestScript?: string
      ciTestCommand?: string
    } = {}
  ): string {
    const root = makeTempDir(join(tmpdir(), 'consistency-'))
    const pkgVersion = overrides.pkgVersion ?? '9.9.9'
    const pluginVersion = overrides.pluginVersion ?? '9.9.9'
    const promptCount = overrides.promptCount ?? 3
    const readmeClaim = overrides.readmeClaim ?? promptCount
    const [nodeA, nodeB] = overrides.nodeVersions ?? ['24', '24']
    const alwaysLoadedLines = overrides.alwaysLoadedLines ?? 5
    const pkgTestScript = overrides.pkgTestScript ?? 'node --experimental-strip-types --test scripts/validate-skills.test.ts'
    const ciTestCommand = overrides.ciTestCommand ?? pkgTestScript

    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: pkgVersion, scripts: { test: pkgTestScript } }))
    mkdirSync(join(root, '.claude-plugin'), { recursive: true })
    writeFileSync(join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: pluginVersion }))
    mkdirSync(join(root, 'eval'), { recursive: true })
    writeFileSync(
      join(root, 'eval', 'golden-prompts.json'),
      JSON.stringify({ prompts: Array.from({ length: promptCount }, (_, i) => ({ prompt: `p${i}`, expect: 'bug-hunter' })) })
    )
    writeFileSync(join(root, 'README.md'), `The eval pins ${readmeClaim} realistic requests.\n`)
    writeFileSync(join(root, 'README.tr.md'), `Değerlendirme ${promptCount} gerçekçi isteği sabitler.\n`)
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      join(root, '.github', 'workflows', 'ci.yml'),
      `steps:\n  - with:\n      node-version: '${nodeA}'\n  - name: Run unit tests\n    run: ${ciTestCommand}\n`
    )
    mkdirSync(join(root, 'security', 'workflows'), { recursive: true })
    writeFileSync(join(root, 'security', 'workflows', 'audit.yml'), `steps:\n  - with:\n      node-version: '${nodeB}'\n`)
    mkdirSync(join(root, 'rules'), { recursive: true })
    const alwaysLoadedBody = Array.from({ length: alwaysLoadedLines }, (_, i) => `line ${i}`).join('\n')
    writeFileSync(join(root, 'global-CLAUDE.md'), alwaysLoadedBody)
    writeFileSync(join(root, 'rules', '000-security.md'), alwaysLoadedBody)
    writeFileSync(join(root, 'rules', '001-conventions.md'), alwaysLoadedBody)
    return root
  }

  function runConsistency(root: string): { code: number; out: string } {
    try {
      const stdout = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-consistency.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CONSISTENCY_ROOT: root },
      })
      return { code: 0, out: stdout }
    } catch (err) {
      const e = err as { status?: number; stderr?: string; stdout?: string }
      return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
    }
  }

  test('passes when all cross-file values are consistent', () => {
    const { code, out } = runConsistency(buildConsistencyFixture())
    assert.strictEqual(code, 0, `expected exit 0, got: ${out}`)
    assert.match(out, /Version fields match \(9\.9\.9\)/)
    assert.match(out, /Golden-prompt count claims match disk \(3\)/)
  })

  test('exits 1 when package.json and plugin.json versions differ', () => {
    const { code, out } = runConsistency(buildConsistencyFixture({ pluginVersion: '9.9.8' }))
    assert.strictEqual(code, 1)
    assert.ok(out.includes('package.json version (9.9.9) != .claude-plugin/plugin.json version (9.9.8)'), `got: ${out}`)
  })

  test('exits 1 when a README overstates the golden-prompt count', () => {
    const { code, out } = runConsistency(buildConsistencyFixture({ promptCount: 3, readmeClaim: 5 }))
    assert.strictEqual(code, 1)
    assert.ok(out.includes('README.md claims 5 golden prompts'), `got: ${out}`)
  })

  test('exits 1 when node-version differs across workflow files', () => {
    const { code, out } = runConsistency(buildConsistencyFixture({ nodeVersions: ['24', '22'] }))
    assert.strictEqual(code, 1)
    assert.ok(out.includes('node-version differs across workflow files'), `got: ${out}`)
  })

  test('exits 1 when an always-loaded file exceeds the line budget', () => {
    const { code, out } = runConsistency(buildConsistencyFixture({ alwaysLoadedLines: 300 }))
    assert.strictEqual(code, 1)
    assert.ok(out.includes('over the 250-line always-loaded budget'), `got: ${out}`)
  })

  test('exits 1 when the combined always-loaded budget is exceeded even though each file passes its own cap', () => {
    // 200 lines/file passes the 250-line per-file cap individually, but 3 × 200 = 600
    // exceeds the 500-line combined cap — this is exactly the blind spot a per-file-only
    // check has by construction.
    const { code, out } = runConsistency(buildConsistencyFixture({ alwaysLoadedLines: 200 }))
    assert.strictEqual(code, 1)
    assert.ok(!out.includes('over the 250-line always-loaded budget'), `should not trip the per-file cap, got: ${out}`)
    assert.ok(out.includes('over the 500-line combined always-loaded budget'), `got: ${out}`)
  })

  test('exits 1 when the CI unit-test command diverges from package.json\'s test script', () => {
    const { code, out } = runConsistency(
      buildConsistencyFixture({
        pkgTestScript: 'node --experimental-strip-types --test scripts/validate-skills.test.ts',
        ciTestCommand: 'node --experimental-strip-types --test scripts/validate-skills.test.ts scripts/hooks.test.ts',
      })
    )
    assert.strictEqual(code, 1)
    assert.ok(out.includes('"Run unit tests" step'), `got: ${out}`)
    assert.ok(out.includes('!= package.json\'s "test" script'), `got: ${out}`)
  })

  // README's "(N suites — ...)" prose lives right next to the "N/N passing"
  // claim check-consistency already covered, but is separate free text the
  // pass-count regex never touched — found stale by hand (claimed 24 suites,
  // actual 25) precisely because nothing checked it before this guard. Stubs
  // pkgTestScript to a one-liner that prints a controlled TAP summary instead
  // of actually running scripts/validate-skills.test.ts against the fixture
  // root (which has no real tests to run) — check 6/7 only care about the
  // "# pass N" / "# suites N" lines in stdout, not a real test run.
  test('exits 1 when a README overstates the suite count', () => {
    const root = buildConsistencyFixture({ pkgTestScript: `node -e "console.log('# pass 1'); console.log('# suites 1')"` })
    writeFileSync(join(root, 'README.md'), 'The eval pins 3 realistic requests.\n**1/1 passing** (99 suites — some claim)\n')
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 1)
    assert.ok(out.includes('(99 suites'), `got: ${out}`)
    assert.ok(out.includes('actually reports # suites 1'), `got: ${out}`)
  })

  // SECURITY.md's deny-rule count is typed by hand and nothing re-derived it
  // from settings-template.json itself — same drift class as the suite/pass
  // count claims above, for a different pair of files.
  test('exits 1 when SECURITY.md overstates the deny-rule count', () => {
    const root = buildConsistencyFixture()
    writeFileSync(join(root, 'settings-template.json'), JSON.stringify({ permissions: { deny: ['Read(./**/.env)', 'Bash(rm -rf *)'] } }))
    writeFileSync(join(root, 'SECURITY.md'), 'The kit ships **999 Read/Bash/PowerShell deny rules** for safety.\n')
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 1)
    assert.ok(out.includes('SECURITY.md claims "**999 Read/Bash/PowerShell deny rules**"'), `got: ${out}`)
    assert.ok(out.includes('actually has 2 deny rules'), `got: ${out}`)
  })

  test('passes when settings-template.json/SECURITY.md are absent from the fixture root', () => {
    // Every other test in this describe block relies on this: CONSISTENCY_ROOT
    // fixtures never create these two files, so check 7 must no-op rather than
    // crash the whole script on a missing-file read.
    const { code, out } = runConsistency(buildConsistencyFixture())
    assert.strictEqual(code, 0, `expected exit 0, got: ${out}`)
  })

  // Same drift class as checks 6/7, for skills/ specifically — found stale by
  // hand in SETUP.md's install-list intro, its verification table, and
  // TROUBLESHOOTING.md's diagnostic heading (all said 23 while skills/ had
  // grown to 25).
  function buildSkillsFixture(
    skillCount: number,
    setupClaims: { intro: number; table: number },
    troubleshootingClaim: number
  ): string {
    const root = buildConsistencyFixture()
    mkdirSync(join(root, 'skills'), { recursive: true })
    for (let i = 0; i < skillCount; i++) mkdirSync(join(root, 'skills', `skill-${i}`), { recursive: true })
    writeFileSync(
      join(root, 'SETUP.md'),
      `Read the following ${setupClaims.intro} subdirectories from \`KIT/skills/\` and write to \`PROJECT/.claude/skills/\`.\n\n| Directory | Expected count |\n| --- | --- |\n| \`skills/\` | ${setupClaims.table} |\n`
    )
    writeFileSync(join(root, 'TROUBLESHOOTING.md'), `### FAIL — skill count is less than ${troubleshootingClaim}\n`)
    return root
  }

  test('passes when SETUP.md/TROUBLESHOOTING.md skill counts match skills/ on disk', () => {
    const root = buildSkillsFixture(25, { intro: 25, table: 25 }, 25)
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 0, `expected exit 0, got: ${out}`)
    assert.match(out, /skill-count claims match skills\/ \(25\)/)
  })

  test('exits 1 when SETUP.md\'s skill-copy intro understates the skill count', () => {
    const root = buildSkillsFixture(25, { intro: 23, table: 25 }, 25)
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 1)
    assert.ok(out.includes('skill-copy intro claims 23 subdirectories but skills/ actually has 25'), `got: ${out}`)
  })

  test('exits 1 when SETUP.md\'s verification table understates the skill count', () => {
    const root = buildSkillsFixture(25, { intro: 25, table: 23 }, 25)
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 1)
    assert.ok(out.includes('verification table claims skills/ has 23 files but it actually has 25'), `got: ${out}`)
  })

  test('exits 1 when TROUBLESHOOTING.md\'s skill-count threshold is stale', () => {
    const root = buildSkillsFixture(25, { intro: 25, table: 25 }, 23)
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 1)
    assert.ok(out.includes('"skill count is less than 23" should reference 25'), `got: ${out}`)
  })

  // Root-cause fix for a real slip: two separate audit-round summaries in
  // CHANGELOG.md's [Unreleased] section both introduced themselves as "Fifth
  // wave —". This guard closes that class so it can't silently recur.
  test('exits 1 when the Unreleased section repeats a wave label', () => {
    const root = buildConsistencyFixture()
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      [
        '## [Unreleased]',
        '',
        'Second wave — first summary:',
        '',
        '- fix one',
        '',
        'Fifth wave — a summary:',
        '',
        '- fix two',
        '',
        'Fifth wave — a different summary reusing the same label:',
        '',
        '- fix three',
        '',
        '## [1.0.0] — 2026-01-01',
        '',
        'Fifth wave — an older release section may reuse ordinal words freely.',
        '',
      ].join('\n')
    )
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 1)
    assert.ok(out.includes('"Fifth wave" more than once'), `got: ${out}`)
  })

  test('passes when every wave label in Unreleased is unique', () => {
    const root = buildConsistencyFixture()
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      ['## [Unreleased]', '', 'Second wave — a summary:', '', '- fix one', '', 'Third wave — another summary:', '', '- fix two', ''].join('\n')
    )
    const { code, out } = runConsistency(root)
    assert.strictEqual(code, 0, `expected exit 0, got: ${out}`)
    assert.match(out, /CHANGELOG\.md's \[Unreleased\] wave labels are unique\./)
  })
})

describe('check-links markdown-file-count guard', () => {
  // The READMEs advertise the markdown-file count as a reproducible number.
  // check-links owns the real count (its own walk), so it guards the claim.
  function buildLinksFixture(claimedCount: number, actualMdFiles: number): string {
    const root = makeTempDir(join(tmpdir(), 'links-'))
    writeFileSync(join(root, 'README.md'), `The repo has ${claimedCount} markdown files, 0 broken links.\n`)
    for (let i = 1; i < actualMdFiles; i++) writeFileSync(join(root, `doc${i}.md`), '# doc\n') // README.md is the first
    return root
  }

  function runLinks(root: string): { code: number; out: string } {
    try {
      const out = execFileSync(process.execPath, [...NODE_FLAGS, 'scripts/check-links.ts'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LINKS_ROOT: root },
      })
      return { code: 0, out }
    } catch (err) {
      const e = err as { status?: number; stderr?: string; stdout?: string }
      return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
    }
  }

  test('passes when the README markdown-file count matches disk', () => {
    const { code, out } = runLinks(buildLinksFixture(3, 3)) // README.md + doc1 + doc2
    assert.strictEqual(code, 0, out)
    assert.match(out, /README markdown-file count matches disk \(3\)/)
  })

  test('exits 1 when the README overstates the markdown-file count', () => {
    const { code, out } = runLinks(buildLinksFixture(99, 3))
    assert.strictEqual(code, 1)
    assert.ok(out.includes('claims 99 markdown files'), `got: ${out}`)
  })
})
