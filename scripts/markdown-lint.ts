import { readFileSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { lint } from 'markdownlint/sync'
import type { Configuration } from 'markdownlint'
import { findMarkdownFiles, formatIssue } from './lib/markdown-files.ts'

// markdownlint-cli2 pulled `braces` in through globby and micromatch, every `braces` release is
// vulnerable (GHSA-vfj7-8cjw-p6xm) with no fix upstream, and `npm audit` failed the gate on a
// package that only ever expanded this repo's own globs. The lint engine below is the same
// markdownlint release cli2 bundled; lib/markdown-files.ts replaces only cli2's file discovery:
// every `*.md` outside node_modules/, .git/ and the root site/ worktree. cli2 globbed with dot
// files on, so .github/ and .claude-plugin/ markdown is linted here too.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const config = JSON.parse(readFileSync(join(REPO_ROOT, '.markdownlint.json'), 'utf8')) as Configuration
const files = findMarkdownFiles(REPO_ROOT)
const results = lint({ files, config })
const issues = files.flatMap(file => (results[file] ?? []).map(issue => formatIssue(relative(REPO_ROOT, file), issue)))
const filesWithIssues = files.filter(file => (results[file] ?? []).length > 0).length

console.log(`Linting: ${files.length} files`)
for (const issue of issues) console.error(issue)
console.log(`Summary: ${issues.length} issue(s) in ${filesWithIssues} file(s)`)
if (issues.length > 0) process.exit(1)
