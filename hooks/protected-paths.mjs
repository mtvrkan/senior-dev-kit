#!/usr/bin/env node
// senior-dev-kit PreToolUse hook — deterministic enforcement of the kit's
// protected-area hard stops. CLAUDE.md asks the model to escalate before
// touching auth/DB/CI/secrets; this hook makes that a harness guarantee
// instead of a prompt convention: any Edit/Write/NotebookEdit into a
// protected path is downgraded to an explicit permission prompt ("ask"),
// naming the guard agent that should review the change first. Bash commands
// that reach a protected path via a redirect, sed -i, a PowerShell cmdlet, or
// cp/mv/git-checkout get the same treatment (see extractBashWriteTargets) —
// otherwise a shell one-liner bypasses the matcher entirely. A narrow
// content-guard also checks Edit/Write payload text for two high-precision
// patterns (dangerouslySetInnerHTML, subprocess shell=True) independent of
// the destination path.
//
// Wire-up (user scope — after the installer copies hooks/ to ~/.claude/hooks):
//   settings.json → "hooks": { "PreToolUse": [ { "matcher": "Edit|Write|NotebookEdit|Bash",
//     "hooks": [ { "type": "command", "command": "node \"$HOME/.claude/hooks/protected-paths.mjs\"" } ] } ] }
// Plugin scope: hooks/hooks.json wires this automatically via ${CLAUDE_PLUGIN_ROOT}.
//
// Escape hatch: set SDK_ALLOW_PROTECTED=1 in the environment to skip the
// prompt for a session where a guard plan has already been approved. Every
// bypass that would otherwise have prompted is logged as structured JSON on
// stderr (rules/700-observability.md: structured logging, no silent skips)
// so a consequential bypass is visible in the session transcript.
//
// Fail-open by design: if stdin is not the JSON shape this script expects
// (a future Claude Code format change), it exits 0 rather than bricking
// every edit — the prompt-level hard stops in CLAUDE.md remain the fallback.
//
// Known residual gap (accepted risk, documented in SECURITY.md): the Bash
// path-extraction below is a set of targeted regexes for the common,
// non-adversarial cases named above — it is not a shell parser. Command
// substitution (`$(...)`), variable indirection (`f=.env; echo x>$f`),
// base64/eval obfuscation, and chaining beyond a single redirect/cmdlet can
// still slip past it. The interpreter one-liner cases below (`python -c`,
// `node -e`, `ruby -e`, `php -r`) are matched for a handful of common call
// shapes (`open(...).write(...)`, `Path(...).write_text/write_bytes(...)`,
// `writeFileSync`/`appendFileSync`, `File.write`, `file_put_contents`) — any
// other write API in the same or another language (`os.write`, `csv.writer`,
// a variable, a helper function, or a multi-statement script) still isn't
// caught; this list grows only as concrete gaps are found, not exhaustively.
// The content-guard is similarly narrow by design: only
// two patterns, chosen for near-zero false positives, not full coverage of
// rules/000-security.md's passive-scan checklist (that remains the model's
// job — this hook is a deterministic backstop for a few concrete bypasses,
// not a replacement for the broader judgment-based review).

import { realpathSync } from 'fs'

// Patterns are written in lowercase and tested against a lowercased path:
// Windows and macOS filesystems are case-insensitive, so `Middleware.ts` or
// `DOCKERFILE.prod` must trigger the same prompt as their lowercase forms.
const CATEGORIES = [
  {
    name: 'secrets',
    guard: 'security-guard',
    patterns: [
      /(^|\/)\.env(\.(?!example$|sample$|template$)[^/]+)?$/,
      /\.(pem|key|p12)$/,
      /(^|\/)id_(rsa|ed25519)$/,
      /(^|\/)\.ssh\//,
      /firebase-adminsdk.*\.json$/,
      /serviceaccount.*\.json$/,
      /(^|\/)secrets\//,
      /(^|\/)config\/(credentials|secrets)\.json$/,
      /\.secrets\.baseline/,
    ],
  },
  {
    name: 'auth',
    guard: 'security-guard',
    patterns: [
      /(^|\/)middleware\.(ts|js)$/,
      /(^|\/)auth[^/]*\.(ts|js|py|go|rb|php)$/,
      /(^|\/)session[^/]*\.(ts|js|py|go|rb|php)$/,
      /(^|\/)jwt[^/]*\.(ts|js|py|go|rb|php)$/,
      /(^|\/)oauth[^/]*\.(ts|js|py|go|rb|php)$/,
      /(^|\/)(auth|authentication|authorization)\//,
      /securityconfig\.(java|kt)$/,
      /(^|\/)guards?\//,
    ],
  },
  {
    name: 'payment/billing',
    guard: 'security-guard',
    patterns: [/(^|\/)(payment|billing|checkout|stripe|iyzico)[^/]*\.(ts|js|py|go|rb|php)$/, /(^|\/)(payments?|billing)\//],
  },
  {
    name: 'DB schema/migration',
    guard: 'db-guard',
    patterns: [
      /(^|\/)migrations?\//,
      /(^|\/)migrate\//, // Rails convention: db/migrate/ (singular, no "s")
      /(^|\/)drizzle\//, // Drizzle's default migration output dir isn't named migrations/
      /(^|\/)alembic\/versions\//, // SQLAlchemy/Alembic revision files
      /\.prisma$/,
      /(^|\/)schema\.(sql|rb)$/,
      /drizzle\.config\./,
      /knexfile\./,
      /(^|\/)\d{4,}[_-][^/]+\.(sql|rb|py|ts|js)$/, // timestamped/numbered migration filenames outside any of the above dirs
    ],
  },
  {
    name: 'CI/CD & infrastructure',
    guard: 'devops-guard',
    patterns: [/(^|\/)\.github\/workflows\//, /(^|\/)dockerfile[^/]*$/, /\.tf$/, /(^|\/)\.gitlab-ci\.yml$/, /(^|\/)(k8s|kubernetes|helm)\//, /(railway|fly)\.toml$/],
  },
]

// Narrow content-guard: two high-precision patterns, checked against the text
// Edit/Write are about to write, independent of the destination path. Kept to
// exactly these two (not eval()/SQL-string-concat/etc.) because they're the
// rare case where a simple regex has a near-zero false-positive rate — see
// the header comment for why this isn't trying to be the full passive scan.
const CONTENT_GUARD_PATTERNS = [
  { name: 'dangerouslySetInnerHTML (XSS risk)', guard: 'security-guard', re: /dangerouslySetInnerHTML/ },
  { name: 'subprocess shell=True (shell injection risk)', guard: 'security-guard', re: /shell\s*=\s*True/ },
]

function matchCategory(normalizedPath) {
  for (const category of CATEGORIES) {
    if (category.patterns.some(re => re.test(normalizedPath))) return category
  }
  return null
}

// Bash commands can reach a protected path without going through Edit/Write —
// a redirect, sed -i, a PowerShell cmdlet, cp/mv, or `git checkout --` all
// write content from a shell string the Edit/Write matcher never sees. This
// extracts plausible write-target paths so they can be checked against the
// same CATEGORIES patterns above. Necessarily heuristic — see the residual-gap
// note in the header comment for what this intentionally doesn't try to catch.
function extractBashWriteTargets(command) {
  const targets = new Set()
  const stripQuotes = s => s.replace(/^["']|["']$/g, '')

  const addAllMatches = re => {
    let m
    while ((m = re.exec(command))) {
      if (m[1]) targets.add(stripQuotes(m[1]))
    }
  }

  // Shell redirects: `cmd > file`, `cmd >> file`, `cmd 2> file` — but not
  // `2>&1` (fd-to-fd redirect, not a file write).
  addAllMatches(/(?:^|\s)\d?>{1,2}\s*([^\s;&|><]+)/g)

  // sed -i (GNU: last arg is the file; BSD/macOS: `-i ''` or `-i.bak` first,
  // but the file is still the last token either way).
  if (/\bsed\b.*-i\b/.test(command)) {
    const parts = command.trim().split(/\s+/)
    const last = parts[parts.length - 1]
    if (last && !last.startsWith('-')) targets.add(stripQuotes(last))
  }

  // PowerShell: Set-Content / Add-Content / Out-File -Path|-FilePath <file>
  addAllMatches(/(?:Set-Content|Add-Content|Out-File)\b.*?-(?:Path|FilePath)\s+["']?([^\s"']+)/gi)

  // PowerShell: Copy-Item ... -Destination <file>
  addAllMatches(/Copy-Item\b.*?-Destination\s+["']?([^\s"']+)/gi)

  // git checkout [<ref>] -- <path>  (restores/overwrites a working-tree file)
  addAllMatches(/git\s+checkout\s+(?:\S+\s+)?--\s+([^\s;&|]+)/g)

  // cp/mv <src> <dest> — simple form, last non-flag token is the destination
  const cpMv = command.match(/^\s*(?:cp|mv)\s+(.+)$/)
  if (cpMv) {
    const args = cpMv[1].trim().split(/\s+/).filter(a => !a.startsWith('-'))
    if (args.length >= 2) targets.add(stripQuotes(args[args.length - 1]))
  }

  // Interpreter one-liners (`python -c`, `node -e`, `ruby -e`, `php -r`) can
  // write a file without any redirect/cmdlet the patterns above look for.
  // Covers the common single-call idioms, not arbitrary scripts — see the
  // residual-gap note in the header for what this still doesn't catch.
  addAllMatches(/open\(\s*["']([^"']+)["']\s*,\s*["'][^"']*["']\s*\)\.write/g) // Python: open('f','w').write(...)
  addAllMatches(/Path\(\s*["']([^"']+)["']\s*\)\.write_(?:text|bytes)/g) // Python: pathlib.Path('f').write_text(...)
  addAllMatches(/(?:writeFileSync|appendFileSync)\(\s*["']([^"']+)["']/g) // Node: fs.writeFileSync/appendFileSync('f', ...)
  addAllMatches(/File\.write\(\s*["']([^"']+)["']/g) // Ruby: File.write('f', ...)
  addAllMatches(/file_put_contents\(\s*["']([^"']+)["']/g) // PHP: file_put_contents('f', ...)

  return [...targets]
}

function readStdin() {
  return new Promise(resolve => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(''))
  })
}

function bypassAndExit(category, path) {
  console.error(
    JSON.stringify({
      level: 'WARN',
      action: 'hook.protected_path.bypassed',
      category: category.name,
      guard: category.guard,
      path,
    })
  )
  process.exit(0)
}

function askAndExit(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    })
  )
  process.exit(0)
}

// Resolve symlinks so an innocuous-looking alias (e.g. `config.json` symlinked
// to `.env`) can't reach a protected file without tripping the pattern match
// below — realpathSync resolves every path component, so a symlinked parent
// directory is covered too. Most edits are to files that don't exist yet
// (Write of a new file) or aren't symlinks, so ENOENT/EINVAL there just means
// "match on the literal path only", not a hook failure.
function checkPath(filePath) {
  const displayPath = filePath.replace(/\\/g, '/')
  const normalized = displayPath.toLowerCase()
  let resolvedNormalized = normalized
  try {
    resolvedNormalized = realpathSync(filePath).replace(/\\/g, '/').toLowerCase()
  } catch {
    // no-op: fall back to the literal path
  }
  const category = matchCategory(normalized) ?? matchCategory(resolvedNormalized)
  return category ? { category, displayPath } : null
}

const raw = await readStdin()

let toolName = ''
let toolInput = {}
try {
  const input = JSON.parse(raw)
  toolName = String(input?.tool_name ?? '')
  toolInput = input?.tool_input ?? {}
} catch {
  process.exit(0)
}

if (toolName === 'Bash') {
  const command = String(toolInput?.command ?? '')
  if (!command) process.exit(0)
  for (const target of extractBashWriteTargets(command)) {
    const hit = checkPath(target)
    if (!hit) continue
    if (process.env.SDK_ALLOW_PROTECTED === '1') bypassAndExit(hit.category, hit.displayPath)
    askAndExit(
      `senior-dev-kit protected path (${hit.category.name}): ${hit.displayPath} — ` +
        `ESCALATE TO: ${hit.category.guard}. Produce a plan and get explicit approval before editing. ` +
        `(Set SDK_ALLOW_PROTECTED=1 to skip this prompt for an approved session.)`
    )
  }
  process.exit(0)
}

const filePath = String(toolInput?.file_path ?? toolInput?.notebook_path ?? '')
if (!filePath) process.exit(0)

const pathHit = checkPath(filePath)
if (pathHit) {
  if (process.env.SDK_ALLOW_PROTECTED === '1') bypassAndExit(pathHit.category, pathHit.displayPath)
  askAndExit(
    `senior-dev-kit protected path (${pathHit.category.name}): ${pathHit.displayPath} — ` +
      `ESCALATE TO: ${pathHit.category.guard}. Produce a plan and get explicit approval before editing. ` +
      `(Set SDK_ALLOW_PROTECTED=1 to skip this prompt for an approved session.)`
  )
}

// Content-guard: only reached when the path itself wasn't already protected —
// a path-based hit is higher-confidence and shouldn't be diluted by a second
// prompt for the same edit.
const contentText = String(toolInput?.new_string ?? toolInput?.content ?? toolInput?.new_source ?? '')
if (contentText) {
  for (const pattern of CONTENT_GUARD_PATTERNS) {
    if (!pattern.re.test(contentText)) continue
    const displayPath = filePath.replace(/\\/g, '/')
    if (process.env.SDK_ALLOW_PROTECTED === '1') bypassAndExit({ name: pattern.name, guard: pattern.guard }, displayPath)
    askAndExit(
      `senior-dev-kit content-guard (${pattern.name}): ${displayPath} — ` +
        `ESCALATE TO: ${pattern.guard}. Review before writing this content. ` +
        `(Set SDK_ALLOW_PROTECTED=1 to skip this prompt for an approved session.)`
    )
  }
}
process.exit(0)
