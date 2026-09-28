/**
 * Tests for the plugin's SessionStart hook.
 *
 * Two properties matter and neither is visible without running it: the hook
 * must emit the protocol as valid `additionalContext` JSON, and it must stay
 * quiet when the same protocol is already installed in the user's
 * `~/.claude/CLAUDE.md` — otherwise a user with both install paths pays for
 * ~180 lines of duplicated context on every single turn.
 */
import { ok, strictEqual } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { BLOCK_BEGIN } from './lib/install-core.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOOK = join(REPO_ROOT, 'scripts', 'session-context.mjs')

const dirs = []
const makeConfigDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'sdk-cfg-'))
  dirs.push(dir)
  return dir
}

const runHook = (configDir, pluginRoot = REPO_ROOT) =>
  spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: pluginRoot },
  })

describe('SessionStart hook', () => {
  after(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })

  it('emits the protocol as SessionStart additionalContext', () => {
    const res = runHook(makeConfigDir())
    strictEqual(res.status, 0, res.stderr)
    const parsed = JSON.parse(res.stdout)
    strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart')
    const context = parsed.hookSpecificOutput.additionalContext
    ok(context.includes('Global Claude Senior Protocol'), 'protocol body injected')
    ok(context.includes('KIT_ROOT ='), 'kit root stated so bundled doc paths resolve')
  })

  it('tells the user how to install rules when they are missing', () => {
    const context = JSON.parse(runHook(makeConfigDir()).stdout).hookSpecificOutput.additionalContext
    ok(context.includes('/kit-setup'), 'points at the one-time setup skill')
  })

  it('stays silent when the protocol is already in the user CLAUDE.md', () => {
    const configDir = makeConfigDir()
    writeFileSync(join(configDir, 'CLAUDE.md'), `${BLOCK_BEGIN}\nprotocol here\n`, 'utf8')
    const res = runHook(configDir)
    strictEqual(res.status, 0, res.stderr)
    strictEqual(res.stdout, '', 'no duplicate injection when already installed')
  })

  // The three cases below are one property split by which half is missing. Until round 45 the
  // hook probed the rules directory only and treated it as proof that `/kit-setup` had run —
  // but `/kit-setup` advertises `--only rules`, so a user could hold every rule file and none
  // of the deny list, which SECURITY.md calls the kit's only tool-layer secret protection, with
  // nothing anywhere saying so.
  const installRules = (configDir) => {
    mkdirSync(join(configDir, 'rules'), { recursive: true })
    writeFileSync(join(configDir, 'rules', '000-security.md'), '# rules\n', 'utf8')
  }
  const installDenyRules = (configDir) => {
    const shipped = JSON.parse(readFileSync(join(REPO_ROOT, 'settings-template.json'), 'utf8'))
    writeFileSync(
      join(configDir, 'settings.json'),
      JSON.stringify({ attribution: shipped.attribution, permissions: { deny: shipped.permissions.deny } }),
      'utf8'
    )
  }

  it('still nudges when the rules are installed but the deny rules are not', () => {
    const configDir = makeConfigDir()
    installRules(configDir)
    const context = JSON.parse(runHook(configDir).stdout).hookSpecificOutput.additionalContext
    ok(context.includes('/kit-setup'), 'half an install is not an install')
    ok(context.includes('deny rules'), 'names the half that is missing, not just "run setup"')
  })

  it('still nudges when the deny rules are installed but the rules are not', () => {
    const configDir = makeConfigDir()
    installDenyRules(configDir)
    const context = JSON.parse(runHook(configDir).stdout).hookSpecificOutput.additionalContext
    ok(context.includes('/kit-setup'), 'the other half, same property')
    ok(context.includes('rule files'), 'names the missing half')
  })

  it('omits the notice once both halves are installed', () => {
    const configDir = makeConfigDir()
    installRules(configDir)
    installDenyRules(configDir)
    const context = JSON.parse(runHook(configDir).stdout).hookSpecificOutput.additionalContext
    ok(!context.includes('/kit-setup'), 'no nudge once setup has genuinely run')
  })

  it('names the missing attribution setting on its own', () => {
    const configDir = makeConfigDir()
    installRules(configDir)
    const shipped = JSON.parse(readFileSync(join(REPO_ROOT, 'settings-template.json'), 'utf8'))
    writeFileSync(join(configDir, 'settings.json'), JSON.stringify({ permissions: { deny: shipped.permissions.deny } }), 'utf8')
    const context = JSON.parse(runHook(configDir).stdout).hookSpecificOutput.additionalContext
    ok(context.includes('`attribution` setting'), context)
  })

  it('does not stack the protocol on an unmarked older copy in the user CLAUDE.md', () => {
    const configDir = makeConfigDir()
    writeFileSync(join(configDir, 'CLAUDE.md'), '# Global Claude Senior Protocol v3.9\nold body\n', 'utf8')
    const context = JSON.parse(runHook(configDir).stdout).hookSpecificOutput.additionalContext
    ok(!context.includes('## HARD STOPS'), 'the protocol body is not injected a second time')
    ok(context.includes('older, unmarked copy'), context)
  })

  it('says when /kit-setup ran for an older kit version than the plugin', () => {
    const configDir = makeConfigDir()
    installRules(configDir)
    installDenyRules(configDir)
    mkdirSync(join(configDir, '.senior-dev-kit'), { recursive: true })
    writeFileSync(join(configDir, '.senior-dev-kit', 'manifest.json'), JSON.stringify({ version: '0.0.1' }), 'utf8')
    const context = JSON.parse(runHook(configDir).stdout).hookSpecificOutput.additionalContext
    ok(context.includes('from kit 0.0.1'), context)
  })

  it('exits quietly instead of failing the session when the kit is missing', () => {
    const res = runHook(makeConfigDir(), join(tmpdir(), 'definitely-not-the-kit'))
    strictEqual(res.status, 0, 'a SessionStart hook must never block startup')
    strictEqual(res.stdout, '')
  })
})
