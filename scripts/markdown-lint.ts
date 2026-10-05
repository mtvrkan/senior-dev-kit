import { readFileSync, readdirSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { lint } from 'markdownlint/sync'
import type { Configuration, LintError } from 'markdownlint'

// markdownlint-cli2 pulled `braces` in through globby and micromatch, every `braces` release is
// vulnerable (GHSA-vfj7-8cjw-p6xm) with no fix upstream, and `npm audit` failed the gate on a
// package that only ever expanded this repo's own globs. The lint engine below is the same
// markdownlint release cli2 bundled; this file replaces only cli2's file discovery: every `*.md`
// outside node_modules/, .git/ and the root site/ worktree. cli2 globbed with dot files on, so
// .github/ and .claude-plugin/ markdown is linted here too.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function findMarkdownFiles(root: string, dir = root): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      if (dir === root && entry.name === 'site') continue
      found.push(...findMarkdownFiles(root, path))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      found.push(path)
    }
  }
  return found
}

export function formatIssue(file: string, issue: LintError): string {
  const detail = issue.errorDetail ? ` [${issue.errorDetail}]` : ''
  return `${file}:${issue.lineNumber} ${issue.ruleNames.join('/')} ${issue.ruleDescription}${detail}`
}

export function lintMarkdown(root: string, config: Configuration): { fileCount: number; issuesByFile: Map<string, string[]> } {
  const files = findMarkdownFiles(root)
  const results = lint({ files, config })
  const issuesByFile = new Map<string, string[]>()
  for (const file of files) {
    const issues = results[file] ?? []
    if (issues.length > 0) issuesByFile.set(file, issues.map(issue => formatIssue(relative(root, file), issue)))
  }
  return { fileCount: files.length, issuesByFile }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = JSON.parse(readFileSync(join(REPO_ROOT, '.markdownlint.json'), 'utf8')) as Configuration
  const { fileCount, issuesByFile } = lintMarkdown(REPO_ROOT, config)
  const issues = [...issuesByFile.values()].flat()
  console.log(`Linting: ${fileCount} files`)
  for (const issue of issues) console.error(issue)
  console.log(`Summary: ${issues.length} issue(s) in ${issuesByFile.size} file(s)`)
  if (issues.length > 0) process.exit(1)
}
