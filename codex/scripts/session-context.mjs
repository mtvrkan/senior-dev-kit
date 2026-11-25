#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BLOCK_BEGIN = '<!-- BEGIN senior-dev-kit -->'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function emit(additionalContext) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }))
}

export function notice(kitRoot, codexHome, protocolInstalled) {
  const lines = [
    `Senior Dev Kit is active as a Codex plugin. KIT_ROOT = ${kitRoot}`,
    '',
    'Paths written as `KIT_ROOT/...`, `agent_docs/<name>.md`, `agents/ROUTING.md`, `rules/<nnn>-<topic>.md` or' +
      ' `presets/...` in this kit\'s agents and skills are relative to KIT_ROOT above — read them from there,' +
      ' never from the current project.',
  ]
  const manifest = readJson(join(codexHome, '.senior-dev-kit', 'manifest.json'))
  const kit = readJson(join(kitRoot, '.codex-plugin', 'plugin.json'))
  const missing = []
  if (!existsSync(join(codexHome, 'agents', 'security-guard.toml'))) {
    missing.push('the kit\'s custom agents (a plugin cannot carry `~/.codex/agents/*.toml`)')
  }
  if (!existsSync(join(codexHome, 'rules', 'senior-dev-kit.rules'))) {
    missing.push('the command rules that prompt before `git push` / `gh pr create` and forbid destructive commands')
  }
  if (!protocolInstalled) {
    missing.push('the protocol block in AGENTS.md (it is injected by this hook instead, which costs a hook run every session)')
  }
  if (missing.length > 0) {
    lines.push(
      '',
      `NOT installed: ${missing.join(' · ')}. Tell the user once that \`$kit-setup\` installs them` +
        ' (one-time, backs up anything it touches).'
    )
  }
  if (manifest && kit && (manifest.version !== kit.version || manifest.kitRoot !== kitRoot)) {
    lines.push(
      '',
      `The agents and rules \`$kit-setup\` installed came from ${manifest.kitRoot} (kit ${manifest.version});` +
        ` the plugin is now ${kit.version} at ${kitRoot}. Tell the user to rerun \`$kit-setup\` so they match.`
    )
  }
  return lines.join('\n')
}

function main() {
  const index = process.argv.indexOf('--part')
  const part = index === -1 ? NaN : Number(process.argv[index + 1])
  if (!Number.isInteger(part) || part < 1) return
  const kitRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const parts = readJson(join(kitRoot, 'hooks', 'context', 'index.json'))
  if (!Array.isArray(parts)) return
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex')
  const instructions = ['AGENTS.override.md', 'AGENTS.md']
    .map(name => join(codexHome, name))
    .filter(path => existsSync(path))
    .map(path => readFileSync(path, 'utf8'))
    .join('\n')
  const protocolInstalled = instructions.includes(BLOCK_BEGIN)
  if (part === parts.length + 1) {
    emit(notice(kitRoot, codexHome, protocolInstalled))
    return
  }
  const entry = parts[part - 1]
  if (!entry) return
  if (entry.kind === 'protocol' && protocolInstalled) return
  emit(readFileSync(join(kitRoot, 'hooks', 'context', entry.file), 'utf8'))
}

try {
  main()
} catch {
  process.exitCode = 0
}
