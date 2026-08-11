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

const BLOCK_BEGIN = '<!-- BEGIN senior-dev-kit -->'

function main() {
  // CLAUDE_PLUGIN_ROOT is exported to hook processes by Claude Code. Falling
  // back to the script's own location keeps `node scripts/session-context.mjs`
  // testable from a clone.
  const kitRoot = process.env.CLAUDE_PLUGIN_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..')
  const protocolPath = join(kitRoot, 'global-CLAUDE.md')
  if (!existsSync(protocolPath)) return

  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
  const userClaudeMd = join(configDir, 'CLAUDE.md')
  if (existsSync(userClaudeMd) && readFileSync(userClaudeMd, 'utf8').includes(BLOCK_BEGIN)) {
    return // already loaded from ~/.claude/CLAUDE.md — do not duplicate it
  }

  const protocol = readFileSync(protocolPath, 'utf8')
  const parts = [
    `Senior Dev Kit is active as a plugin. KIT_ROOT = ${kitRoot}`,
    '',
    'Paths written as `agent_docs/<name>.md`, `agents/ROUTING.md` or `rules/<nnn>-<topic>.md`' +
      ' in this kit\'s agents, skills and commands are relative to KIT_ROOT above — read them' +
      ' from there, never from the current project.',
  ]

  // Path-scoped rules cannot be delivered by a plugin: Claude Code only
  // auto-loads `rules/*.md` from a settings directory. Say so once, with the
  // exact command, rather than letting the user wonder why 100-web never fires.
  if (!existsSync(join(configDir, 'rules', '000-security.md'))) {
    parts.push(
      '',
      'The kit\'s path-scoped rule files are NOT installed. Rules only auto-load from' +
        ` ${join(configDir, 'rules')}, which a plugin cannot write to. Tell the user they can` +
        ' install them with `/kit-setup` (one-time, backs up anything it touches).'
    )
  }

  parts.push('', '---', '', protocol.trim())

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: parts.join('\n'),
      },
    })
  )
}

try {
  main()
} catch {
  // Intentionally silent: a SessionStart hook that prints a stack trace turns
  // every new session into a warning banner for no user benefit.
}
