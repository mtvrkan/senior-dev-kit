#!/usr/bin/env node
// senior-dev-kit PreToolUse hook — deterministic enforcement of the kit's
// protected-area hard stops. CLAUDE.md asks the model to escalate before
// touching auth/DB/CI/secrets; this hook makes that a harness guarantee
// instead of a prompt convention: any Edit/Write/NotebookEdit into a
// protected path is downgraded to an explicit permission prompt ("ask"),
// naming the guard agent that should review the change first.
//
// Wire-up (user scope — after the installer copies hooks/ to ~/.claude/hooks):
//   settings.json → "hooks": { "PreToolUse": [ { "matcher": "Edit|Write|NotebookEdit",
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
    ],
  },
  {
    name: 'auth',
    guard: 'security-guard',
    patterns: [
      /(^|\/)middleware\.(ts|js)$/,
      /(^|\/)auth[^/]*\.(ts|js|py|go|rb|php)$/,
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
    guard: 'migration-guard',
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

function readStdin() {
  return new Promise(resolve => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(''))
  })
}

const raw = await readStdin()

let filePath = ''
try {
  const input = JSON.parse(raw)
  filePath = String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '')
} catch {
  process.exit(0)
}
if (!filePath) process.exit(0)

const displayPath = filePath.replace(/\\/g, '/')
const normalized = displayPath.toLowerCase()
for (const category of CATEGORIES) {
  if (category.patterns.some(re => re.test(normalized))) {
    if (process.env.SDK_ALLOW_PROTECTED === '1') {
      console.error(
        JSON.stringify({
          level: 'WARN',
          action: 'hook.protected_path.bypassed',
          category: category.name,
          guard: category.guard,
          path: displayPath,
        })
      )
      process.exit(0)
    }
    const reason =
      `senior-dev-kit protected path (${category.name}): ${displayPath} — ` +
      `ESCALATE TO: ${category.guard}. Produce a plan and get explicit approval before editing. ` +
      `(Set SDK_ALLOW_PROTECTED=1 to skip this prompt for an approved session.)`
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
}
process.exit(0)
