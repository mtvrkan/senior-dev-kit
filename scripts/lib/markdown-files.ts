import { readdirSync } from 'fs'
import { join } from 'path'
import type { LintError } from 'markdownlint'

// Kept free of runtime imports from node_modules: the unit-test job in repo-ci.yml runs without
// `npm ci`, so a test that imported markdownlint itself crashed at load there while passing on
// any machine with the package installed. Only the type import below touches markdownlint, and
// type stripping erases it.
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

export function formatIssue(file: string, issue: Pick<LintError, 'lineNumber' | 'ruleNames' | 'ruleDescription' | 'errorDetail'>): string {
  const detail = issue.errorDetail ? ` [${issue.errorDetail}]` : ''
  return `${file}:${issue.lineNumber} ${issue.ruleNames.join('/')} ${issue.ruleDescription}${detail}`
}
