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
// prompt for a session where a guard plan has already been approved.
//
// Fail-open by design: if stdin is not the JSON shape this script expects
// (a future Claude Code format change), it exits 0 rather than bricking
// every edit — the prompt-level hard stops in CLAUDE.md remain the fallback.

const CATEGORIES = [
  {
    name: 'secrets',
    guard: 'security-guard',
    patterns: [
      /(^|\/)\.env(\.(?!example$|sample$|template$)[^/]+)?$/i,
      /\.(pem|key|p12)$/i,
      /(^|\/)id_(rsa|ed25519)$/,
      /(^|\/)\.ssh\//,
      /firebase-adminsdk.*\.json$/i,
      /serviceaccount.*\.json$/i,
      /(^|\/)secrets\//,
    ],
  },
  {
    name: 'auth',
    guard: 'security-guard',
    patterns: [
      /(^|\/)middleware\.(ts|js)$/,
      /(^|\/)auth[^/]*\.(ts|js|py|go|rb|php)$/i,
      /(^|\/)(auth|authentication|authorization)\//i,
      /SecurityConfig\.(java|kt)$/,
      /(^|\/)guards?\//i,
    ],
  },
  {
    name: 'payment/billing',
    guard: 'security-guard',
    patterns: [/(^|\/)(payment|billing|checkout|stripe|iyzico)[^/]*\.(ts|js|py|go|rb|php)$/i, /(^|\/)(payments?|billing)\//i],
  },
  {
    name: 'DB schema/migration',
    guard: 'migration-guard',
    patterns: [/(^|\/)migrations?\//i, /\.prisma$/, /(^|\/)schema\.(sql|rb)$/, /drizzle\.config\./, /knexfile\./],
  },
  {
    name: 'CI/CD & infrastructure',
    guard: 'devops-guard',
    patterns: [/(^|\/)\.github\/workflows\//, /(^|\/)Dockerfile[^/]*$/, /\.tf$/, /(^|\/)\.gitlab-ci\.yml$/, /(^|\/)(k8s|kubernetes|helm)\//i, /(railway|fly)\.toml$/],
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
if (process.env.SDK_ALLOW_PROTECTED === '1') process.exit(0)

let filePath = ''
try {
  const input = JSON.parse(raw)
  filePath = String(input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '')
} catch {
  process.exit(0)
}
if (!filePath) process.exit(0)

const normalized = filePath.replace(/\\/g, '/')
for (const category of CATEGORIES) {
  if (category.patterns.some(re => re.test(normalized))) {
    const reason =
      `senior-dev-kit protected path (${category.name}): ${normalized} — ` +
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
