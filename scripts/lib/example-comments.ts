export interface ExampleComment {
  line: number
  text: string
}

type Syntax = { full: RegExp[]; trailing: RegExp[] }

const SLASH: Syntax = { full: [/^\/\//, /^\/\*/, /^\*(?:\s+[^\s{,]|\s*$|\/)/, /^\{\s*\/\*/], trailing: [/\s\/\/\s/, /\s\/\/$/, /\s\/\*.*\*\//, /\{\s*\/\*.*\*\/\s*\}/] }
const HASH: Syntax = { full: [/^#(?:\s|$)/], trailing: [/\s#\s/] }
const SQL: Syntax = { full: [/^--\s/, /^--$/, /^\/\*/], trailing: [/\s--\s/] }
const MARKUP: Syntax = { full: [/^<!--/], trailing: [/<!--.*-->/] }
const CSS: Syntax = { full: [/^\/\*/, /^\*(?:\s+[^\s{,]|\s*$|\/)/], trailing: [/\s\/\*.*\*\//] }

const SYNTAX_BY_LANG: Record<string, Syntax[]> = {}
const register = (langs: string[], syntaxes: Syntax[]) => {
  for (const lang of langs) SYNTAX_BY_LANG[lang] = syntaxes
}
register(['ts', 'typescript', 'js', 'javascript', 'mjs', 'cjs', 'java', 'kotlin', 'kt', 'kts', 'swift', 'go', 'rust', 'rs', 'c', 'cpp', 'c++', 'cs', 'csharp', 'dart', 'scala', 'groovy', 'gradle', 'jsonc', 'json5', 'prisma', 'proto'], [SLASH])
register(['tsx', 'jsx', 'vue', 'svelte', 'astro'], [SLASH, MARKUP])
register(['php'], [SLASH, HASH])
register(['scss', 'sass', 'less'], [SLASH])
register(['css'], [CSS])
register(['graphql', 'gql', 'bash', 'sh', 'shell', 'zsh', 'console', 'powershell', 'ps1', 'pwsh', 'python', 'py', 'ruby', 'rb', 'yaml', 'yml', 'toml', 'dockerfile', 'docker', 'makefile', 'make', 'r', 'perl', 'elixir', 'ex', 'nginx', 'dotenv', 'env', 'ini', 'properties', 'conf', 'gitignore'], [HASH])
register(['hcl', 'terraform', 'tf'], [HASH, SLASH])
register(['sql', 'psql', 'mysql', 'plpgsql'], [SQL])
register(['html', 'xml', 'svg', 'markdown', 'md'], [MARKUP])

const UNLABELLED: Syntax = {
  full: [/^\/\//, /^\/\*/, /^<!--/, /^#\s/, /^--\s/],
  trailing: [/\s\/\/\s/, /<!--.*-->/],
}

const SKIP_LANGS = new Set(['text', 'txt', 'plaintext', 'diff', 'http', 'json', 'csv', 'mermaid', 'output', 'log'])

const DIRECTIVES = [
  /^\/\/\s*SAFETY:/,
  /^#!/,
  /^#\[/,
  /^#(?:include|define|if|ifdef|ifndef|endif|else|elif|pragma|region|endregion|undef)\b/,
  /^#\s*syntax=/,
  /^#\s*(?:frozen_string_literal|encoding|-\*-)/,
  /^\/\/go:/,
  /^\/\/\s*swift-tools-version/,
  /^\/\/\/\s*<reference/,
  /^\/\/\s*@ts-(?:expect-error|ignore|nocheck|check)/,
  /^\/\/\s*eslint-disable/,
  /^\/\/\s*prettier-ignore/,
  /^#\s*(?:noqa|type:\s*ignore|pragma)/,
  /^--\s*\+goose/,
  /^--\s*migrate:/,
]

function stripStrings(line: string): string {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, 'URL')
}

function isDirective(trimmed: string): boolean {
  return DIRECTIVES.some(pattern => pattern.test(trimmed))
}

function syntaxesFor(info: string): Syntax[] | null {
  const lang = info.trim().split(/[\s{]/)[0].toLowerCase()
  if (lang === '') return [UNLABELLED]
  if (SKIP_LANGS.has(lang)) return null
  return SYNTAX_BY_LANG[lang] ?? null
}

export function findExampleComments(markdown: string): ExampleComment[] {
  const found: ExampleComment[] = []
  let fence: { marker: string; syntaxes: Syntax[] | null } | null = null
  markdown.split(/\r?\n/).forEach((raw, index) => {
    const opener = raw.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (opener) {
      if (!fence) {
        fence = { marker: opener[1], syntaxes: syntaxesFor(opener[2]) }
        return
      }
      if (opener[1].startsWith(fence.marker) && opener[2].trim() === '') {
        fence = null
        return
      }
    }
    if (!fence || !fence.syntaxes) return
    const trimmed = raw.trim()
    if (trimmed === '' || isDirective(trimmed)) return
    const bare = stripStrings(trimmed)
    const hit = fence.syntaxes.some(
      syntax => syntax.full.some(pattern => pattern.test(bare)) || syntax.trailing.some(pattern => pattern.test(bare))
    )
    if (hit) found.push({ line: index + 1, text: trimmed })
  })
  return found
}

const VERDICT = /^\s*(?:[-*]\s+)?(?:\*\*|__)?\s*(WRONG|BAD|ANTI-?PATTERN|INSECURE|VULNERABLE|RIGHT|GOOD|CORRECT|REQUIRED|ALWAYS|SAFE)\b/i

export function proseVerdict(line: string): 'positive' | 'negative' | null {
  const match = line.match(VERDICT)
  if (!match) return null
  return /^(?:RIGHT|GOOD|CORRECT|REQUIRED|ALWAYS|SAFE)$/i.test(match[1]) ? 'positive' : 'negative'
}
