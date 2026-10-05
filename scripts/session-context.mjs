#!/usr/bin/env node
/**
 * SessionStart hook for the plugin install path.
 *
 * Claude Code does not load a `CLAUDE.md` that ships inside a plugin — plugins
 * contribute context through skills, agents and hooks only. This hook is how
 * the kit's always-loaded protocol (`global-CLAUDE.md`) reaches a plugin
 * install, by emitting it as `hookSpecificOutput.additionalContext`.
 *
 * Two things it deliberately does NOT do:
 *   - It never injects when the same protocol is already present in the user's
 *     `~/.claude/CLAUDE.md` (installed by `scripts/install.mjs`). Paying for
 *     ~180 lines of identical context twice per session is the whole reason
 *     this check exists.
 *   - It never fails the session. Any error exits 0 with no output; a broken
 *     hook must not be able to stop Claude Code from starting.
 *
 * Plain JavaScript for the same reason as the installer: it runs on the user's
 * Node, not a contributor's.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BLOCK_BEGIN, protocolAnchor, splitProtocol } from './lib/install-core.mjs'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function attributionHidden(configDir) {
  const settings = readJson(join(configDir, 'settings.json'))
  if (settings === null) return false
  const attribution = settings.attribution
  if (attribution === false) return true
  if (settings.includeCoAuthoredBy === false && attribution === undefined) return true
  return attribution !== null && typeof attribution === 'object' && attribution.commit === '' && attribution.pr === ''
}

function staleSetup(kitRoot, configDir) {
  const manifest = readJson(join(configDir, '.senior-dev-kit', 'manifest.json'))
  const kit = readJson(join(kitRoot, 'package.json'))
  if (!manifest?.version || !kit?.version) return null
  return manifest.version === kit.version ? null : { installed: manifest.version, current: kit.version }
}

/**
 * Has the kit's deny list been merged into the user's settings.json?
 *
 * Answered against the template the plugin actually ships rather than a sentinel string
 * hard-coded here: a rule this file names by hand is a rule that can be renamed out from
 * under it, and the failure would be silent — the probe would report "installed" forever.
 * A sample of the template's rules is enough; the question is "was the merge ever run",
 * not "is every rule still present", which is `/kit-doctor`'s job and needs no hook.
 *
 * Errors resolve to `true` (say nothing): a hook that cannot read the template must not
 * tell the user their protection is missing on the strength of its own failure.
 */
function denyRulesInstalled(kitRoot, configDir) {
  try {
    const template = JSON.parse(readFileSync(join(kitRoot, 'settings-template.json'), 'utf8'))
    const shipped = template?.permissions?.deny ?? []
    if (shipped.length === 0) return true
    const settingsPath = join(configDir, 'settings.json')
    if (!existsSync(settingsPath)) return false
    const installed = new Set(JSON.parse(readFileSync(settingsPath, 'utf8'))?.permissions?.deny ?? [])
    return shipped.some((rule) => installed.has(rule))
  } catch {
    return true
  }
}

function requestedPart(argv) {
  const index = argv.indexOf('--part')
  const part = index === -1 ? NaN : Number(argv[index + 1])
  return Number.isInteger(part) && part > 0 ? part : null
}

function emit(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    })
  )
}

function main() {
  const part = requestedPart(process.argv.slice(2))
  if (part === null) return
  // CLAUDE_PLUGIN_ROOT is exported to hook processes by Claude Code. Falling
  // back to the script's own location keeps `node scripts/session-context.mjs`
  // testable from a clone.
  const kitRoot = process.env.CLAUDE_PLUGIN_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..')
  const protocolPath = join(kitRoot, 'global-CLAUDE.md')
  if (!existsSync(protocolPath)) return

  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  const userClaudeMd = join(configDir, 'CLAUDE.md')
  const protocol = readFileSync(protocolPath, 'utf8')
  const userInstructions = existsSync(userClaudeMd) ? readFileSync(userClaudeMd, 'utf8') : ''
  if (userInstructions.includes(BLOCK_BEGIN)) {
    return // already loaded from ~/.claude/CLAUDE.md — do not duplicate it
  }
  const chunks = splitProtocol(protocol.trim())
  const noticePart = chunks.length + 1
  if (part > noticePart) return
  const anchor = protocolAnchor(protocol)
  if (anchor && userInstructions.includes(anchor)) {
    if (part !== noticePart) return
    emit(
      `Senior Dev Kit is active as a plugin. KIT_ROOT = ${kitRoot}\n\n` +
        `The user's ${userClaudeMd} holds an older, unmarked copy of the kit protocol, so this ` +
        'plugin did not inject the current one on top of it. Tell the user once: delete that old ' +
        'copy (keep anything they wrote themselves) so the current protocol loads.'
    )
    return
  }
  if (part < noticePart) {
    emit(chunks[part - 1])
    return
  }
  const parts = [
    `Senior Dev Kit is active as a plugin. KIT_ROOT = ${kitRoot}`,
    '',
    'Paths written as `agent_docs/<name>.md`, `agents/ROUTING.md` or `rules/<nnn>-<topic>.md`' +
      ' in this kit\'s agents, skills and commands are relative to KIT_ROOT above — read them' +
      ' from there, never from the current project.',
  ]

  // `/kit-setup` installs two things a plugin cannot carry, and until round 45 this hook
  // probed only the first. Rules present was treated as "setup done" — but `/kit-setup`
  // advertises `--only rules`, and the deny list is what SECURITY.md calls the kit's only
  // tool-layer secret protection. A user could have every rule file and none of that, with
  // nothing anywhere saying so. Probe the thing, not a proxy for it.
  //
  // Path-scoped rules cannot be delivered by a plugin: Claude Code only auto-loads
  // `rules/*.md` from a settings directory. Say so once, with the exact command, rather
  // than letting the user wonder why 100-web never fires.
  const missing = []
  if (!existsSync(join(configDir, 'rules', '000-security.md'))) {
    missing.push(`the path-scoped rule files (rules only auto-load from ${join(configDir, 'rules')})`)
  }
  if (!denyRulesInstalled(kitRoot, configDir)) {
    missing.push('the deny rules (the kit\'s only tool-layer block on reading credential files)')
  }
  if (!attributionHidden(configDir)) {
    missing.push('the `attribution` setting (without it Claude Code adds a Co-Authored-By trailer to every commit)')
  }
  if (missing.length > 0) {
    parts.push(
      '',
      `NOT installed: ${missing.join(' · ')}. A plugin cannot write these into the user's` +
        ' settings directory. Tell the user they can install them with `/kit-setup`' +
        ' (one-time, backs up anything it touches).'
    )
  }
  const stale = staleSetup(kitRoot, configDir)
  if (stale) {
    parts.push(
      '',
      `The rules and settings /kit-setup installed are from kit ${stale.installed}; the plugin is now ` +
        `${stale.current}. Tell the user to rerun \`/kit-setup\` so they match.`
    )
  }

  emit(parts.join('\n'))
}

try {
  main()
} catch {
  // Intentionally silent: a SessionStart hook that prints a stack trace turns
  // every new session into a warning banner for no user benefit.
}
