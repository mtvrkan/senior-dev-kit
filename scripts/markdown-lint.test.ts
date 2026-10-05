import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, relative } from 'path'
import { tmpdir } from 'os'
import { findMarkdownFiles, lintMarkdown } from './markdown-lint.ts'

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'md-lint-'))
  const files: Record<string, string> = {
    'good.md': '# Title\n\nBody.\n',
    'bad.md': '# Title\n\n#missing space\n',
    '.github/template.md': '# Template\n',
    'docs/site/nested.md': '# Nested\n',
    'node_modules/pkg/README.md': '#ignored\n',
    'site/index.md': '#ignored\n',
    '.git/notes.md': '#ignored\n',
    'notes.txt': 'not markdown\n',
  }
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

describe('markdown-lint file discovery and linting', () => {
  test('finds markdown in dot directories and nested site/, skips node_modules, .git and the root site/', () => {
    const root = fixture()
    const found = findMarkdownFiles(root).map(file => relative(root, file).replaceAll('\\', '/')).sort()
    rmSync(root, { recursive: true })
    assert.deepEqual(found, ['.github/template.md', 'bad.md', 'docs/site/nested.md', 'good.md'])
  })

  test('reports a rule violation with file, line and rule name, and nothing for clean files', () => {
    const root = fixture()
    const { fileCount, issuesByFile } = lintMarkdown(root, { default: true })
    rmSync(root, { recursive: true })
    assert.equal(fileCount, 4)
    assert.equal(issuesByFile.size, 1)
    const [issue] = [...issuesByFile.values()].flat()
    assert.match(issue, /^bad\.md:3 MD018\/no-missing-space-atx /)
  })

  test('honours the config: a disabled rule reports nothing', () => {
    const root = fixture()
    const { issuesByFile } = lintMarkdown(root, { default: true, MD018: false })
    rmSync(root, { recursive: true })
    assert.equal(issuesByFile.size, 0)
  })
})
