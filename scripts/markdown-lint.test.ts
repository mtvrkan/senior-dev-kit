import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, relative } from 'path'
import { tmpdir } from 'os'
import { findMarkdownFiles, formatIssue } from './lib/markdown-files.ts'

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'md-lint-'))
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

describe('markdown-lint file discovery and issue format', () => {
  test('finds markdown in dot directories and nested site/, skips node_modules, .git and the root site/', () => {
    const root = fixture({
      'good.md': '# Title\n',
      '.github/template.md': '# Template\n',
      'docs/site/nested.md': '# Nested\n',
      'node_modules/pkg/README.md': '# Ignored\n',
      'site/index.md': '# Ignored\n',
      '.git/notes.md': '# Ignored\n',
      'notes.txt': 'not markdown\n',
    })

    const found = findMarkdownFiles(root).map(file => relative(root, file).replaceAll('\\', '/')).sort()

    rmSync(root, { recursive: true })
    assert.deepEqual(found, ['.github/template.md', 'docs/site/nested.md', 'good.md'])
  })

  test('returns nothing for a tree with no markdown files', () => {
    const root = fixture({ 'src/index.ts': 'export {}\n' })

    const found = findMarkdownFiles(root)

    rmSync(root, { recursive: true })
    assert.deepEqual(found, [])
  })

  test('formats an issue as file:line rule description, with detail only when present', () => {
    const issue = { lineNumber: 3, ruleNames: ['MD018', 'no-missing-space-atx'], ruleDescription: 'No space after hash on atx style heading', errorDetail: null }

    const plain = formatIssue('bad.md', issue)
    const detailed = formatIssue('bad.md', { ...issue, errorDetail: 'Expected: 1' })

    assert.equal(plain, 'bad.md:3 MD018/no-missing-space-atx No space after hash on atx style heading')
    assert.equal(detailed, `${plain} [Expected: 1]`)
  })
})
