#!/usr/bin/env node
// Idempotently wires hooks/protected-paths.mjs into a Claude Code settings.json as a
// PreToolUse hook on Edit|Write|NotebookEdit. Used by install.sh/install.ps1 so the kit's
// one real harness-enforced guardrail is on by default instead of requiring a manual merge
// (see hooks/README.md). Never overwrites unrelated settings.json content.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const [, , settingsPath, hookScriptPath] = process.argv
if (!settingsPath || !hookScriptPath) {
  console.error('Usage: node wire-hook.mjs <settings.json path> <protected-paths.mjs path>')
  process.exit(1)
}

const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {}

settings.hooks ??= {}
settings.hooks.PreToolUse ??= []

const alreadyWired = settings.hooks.PreToolUse.some(
  entry =>
    entry.matcher === 'Edit|Write|NotebookEdit' &&
    entry.hooks?.some(h => typeof h.command === 'string' && h.command.includes('protected-paths.mjs'))
)

if (!alreadyWired) {
  settings.hooks.PreToolUse.push({
    matcher: 'Edit|Write|NotebookEdit',
    hooks: [{ type: 'command', command: `node ${JSON.stringify(hookScriptPath)}` }],
  })
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
