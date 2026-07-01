// Integration tests for install.sh / install.ps1 — runs each installer end-to-end
// against a throwaway HOME/USERPROFILE and asserts on what actually landed on disk.
// Run: node --experimental-strip-types --test scripts/install.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const REPO_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const COPIED_DIRS = ['rules', 'skills', 'commands', 'agents', 'agent_docs']

function hasCommand(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args)
  return r.error === undefined
}

const HAS_BASH = hasCommand('bash', ['--version'])
const PWSH = ['pwsh', 'powershell'].find(exe => hasCommand(exe, ['-NoProfile', '-Command', 'exit 0'])) ?? null

function runInstallSh(args: string[], home: string, input: string) {
  return spawnSync('bash', [join(REPO_ROOT, 'install.sh'), ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, HOME: home },
    input,
    encoding: 'utf8',
  })
}

function runInstallPs1(args: string[], userProfile: string, input: string) {
  return spawnSync(PWSH!, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(REPO_ROOT, 'install.ps1'), ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, USERPROFILE: userProfile },
    input,
    encoding: 'utf8',
  })
}

describe('install.sh', { skip: HAS_BASH ? false : 'bash not available in this environment' }, () => {
  test('copies rules/skills/commands/agents/agent_docs and installs global-CLAUDE.md on confirm', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallSh([], home, 'y\n')
    assert.strictEqual(result.status, 0, `install.sh failed: ${result.stderr}`)
    const claudeDir = join(home, '.claude')
    for (const dir of COPIED_DIRS) {
      assert.ok(existsSync(join(claudeDir, dir)), `expected ${dir}/ to be copied`)
      assert.ok(readdirSync(join(claudeDir, dir)).length > 0, `expected ${dir}/ to be non-empty`)
    }
    assert.ok(existsSync(join(claudeDir, 'CLAUDE.md')), 'expected global-CLAUDE.md installed as CLAUDE.md')
    rmSync(home, { recursive: true })
  })

  test('aborts without copying anything when confirmation is declined', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallSh([], home, 'n\n')
    assert.strictEqual(result.status, 0)
    assert.ok(result.stdout.includes('Aborted'), `expected "Aborted" in output, got: ${result.stdout}`)
    assert.ok(!existsSync(join(home, '.claude', 'rules')), 'nothing should be copied when the user declines')
    rmSync(home, { recursive: true })
  })

  test('--preset installs the matching preset CLAUDE.md byte-for-byte instead of global-CLAUDE.md', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallSh(['--preset=react-vite'], home, 'y\n')
    assert.strictEqual(result.status, 0, `install.sh failed: ${result.stderr}`)
    const installed = readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf8')
    const expected = readFileSync(join(REPO_ROOT, 'presets', 'web', 'react-vite', 'CLAUDE.md'), 'utf8')
    assert.strictEqual(installed, expected)
    rmSync(home, { recursive: true })
  })

  test('backs up an existing CLAUDE.md exactly once before a second install overwrites it', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    runInstallSh([], home, 'y\n')
    const second = runInstallSh(['--preset=react-vite'], home, 'y\n')
    assert.strictEqual(second.status, 0, `install.sh failed: ${second.stderr}`)
    const backups = readdirSync(join(home, '.claude')).filter(f => f.startsWith('CLAUDE.md.bak.'))
    assert.strictEqual(backups.length, 1, `expected exactly one backup file, found: ${backups.join(', ')}`)
    rmSync(home, { recursive: true })
  })

  test('backs up an edited skills/ file before a second install overwrites it', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    runInstallSh([], home, 'y\n')
    const editedFile = join(home, '.claude', 'skills', 'bug-fix', 'SKILL.md')
    writeFileSync(editedFile, 'user customization')
    const second = runInstallSh([], home, 'y\n')
    assert.strictEqual(second.status, 0, `install.sh failed: ${second.stderr}`)
    const backupDirs = readdirSync(join(home, '.claude')).filter(f => f.startsWith('skills.bak.'))
    assert.strictEqual(backupDirs.length, 1, `expected exactly one skills/ backup dir, found: ${backupDirs.join(', ')}`)
    const backedUpContent = readFileSync(join(home, '.claude', backupDirs[0], 'bug-fix', 'SKILL.md'), 'utf8')
    assert.strictEqual(backedUpContent, 'user customization', 'backup should preserve the pre-overwrite content')
    const liveContent = readFileSync(editedFile, 'utf8')
    assert.notStrictEqual(liveContent, 'user customization', 'live file should be overwritten by the reinstall')
    rmSync(home, { recursive: true })
  })

  test('rejects a --preset value containing invalid characters before touching the filesystem', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallSh(['--preset=Not_Valid!'], home, '')
    assert.notStrictEqual(result.status, 0)
    assert.ok(result.stderr.includes('invalid --preset value'), `expected error message, got: ${result.stderr}`)
    assert.ok(!existsSync(join(home, '.claude')), 'should exit before creating anything')
    rmSync(home, { recursive: true })
  })

  test('warns and lists available presets when --preset matches nothing, without writing CLAUDE.md', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallSh(['--preset=nonexistent-stack'], home, 'y\n')
    assert.strictEqual(result.status, 0)
    assert.ok(result.stdout.includes('not found'), `expected "not found" in output, got: ${result.stdout}`)
    assert.ok(existsSync(join(home, '.claude', 'rules')), 'rules/ etc. should still be copied')
    assert.ok(!existsSync(join(home, '.claude', 'CLAUDE.md')), 'no CLAUDE.md should be written for an unmatched preset')
    rmSync(home, { recursive: true })
  })
})

describe('install.ps1', { skip: PWSH ? false : 'no PowerShell (pwsh/powershell) available in this environment' }, () => {
  test('copies rules/skills/commands/agents/agent_docs and installs global-CLAUDE.md on confirm', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallPs1([], home, 'y\n')
    assert.strictEqual(result.status, 0, `install.ps1 failed: ${result.stderr}`)
    const claudeDir = join(home, '.claude')
    for (const dir of COPIED_DIRS) {
      assert.ok(existsSync(join(claudeDir, dir)), `expected ${dir}/ to be copied`)
      assert.ok(readdirSync(join(claudeDir, dir)).length > 0, `expected ${dir}/ to be non-empty`)
    }
    assert.ok(existsSync(join(claudeDir, 'CLAUDE.md')), 'expected global-CLAUDE.md installed as CLAUDE.md')
    rmSync(home, { recursive: true })
  })

  test('aborts without copying anything when confirmation is declined', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallPs1([], home, 'n\n')
    assert.strictEqual(result.status, 0)
    assert.ok(result.stdout.includes('Aborted'), `expected "Aborted" in output, got: ${result.stdout}`)
    assert.ok(!existsSync(join(home, '.claude', 'rules')), 'nothing should be copied when the user declines')
    rmSync(home, { recursive: true })
  })

  test('-Preset installs the matching preset CLAUDE.md byte-for-byte instead of global-CLAUDE.md', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallPs1(['-Preset', 'react-vite'], home, 'y\n')
    assert.strictEqual(result.status, 0, `install.ps1 failed: ${result.stderr}`)
    const installed = readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf8')
    const expected = readFileSync(join(REPO_ROOT, 'presets', 'web', 'react-vite', 'CLAUDE.md'), 'utf8')
    assert.strictEqual(installed, expected)
    rmSync(home, { recursive: true })
  })

  test('backs up an edited skills/ file before a second install overwrites it', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    runInstallPs1([], home, 'y\n')
    const editedFile = join(home, '.claude', 'skills', 'bug-fix', 'SKILL.md')
    writeFileSync(editedFile, 'user customization')
    const second = runInstallPs1([], home, 'y\n')
    assert.strictEqual(second.status, 0, `install.ps1 failed: ${second.stderr}`)
    const backupDirs = readdirSync(join(home, '.claude')).filter(f => f.startsWith('skills.bak.'))
    assert.strictEqual(backupDirs.length, 1, `expected exactly one skills/ backup dir, found: ${backupDirs.join(', ')}`)
    const backedUpContent = readFileSync(join(home, '.claude', backupDirs[0], 'bug-fix', 'SKILL.md'), 'utf8')
    assert.strictEqual(backedUpContent, 'user customization', 'backup should preserve the pre-overwrite content')
    const liveContent = readFileSync(editedFile, 'utf8')
    assert.notStrictEqual(liveContent, 'user customization', 'live file should be overwritten by the reinstall')
    rmSync(home, { recursive: true })
  })

  test('backs up an existing CLAUDE.md exactly once before a second install overwrites it', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    runInstallPs1([], home, 'y\n')
    const second = runInstallPs1(['-Preset', 'react-vite'], home, 'y\n')
    assert.strictEqual(second.status, 0, `install.ps1 failed: ${second.stderr}`)
    const backups = readdirSync(join(home, '.claude')).filter(f => f.startsWith('CLAUDE.md.bak.'))
    assert.strictEqual(backups.length, 1, `expected exactly one backup file, found: ${backups.join(', ')}`)
    rmSync(home, { recursive: true })
  })

  test('warns and lists available presets when -Preset matches nothing, without writing CLAUDE.md', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallPs1(['-Preset', 'nonexistent-stack'], home, 'y\n')
    assert.strictEqual(result.status, 0, `install.ps1 failed: ${result.stderr}`)
    assert.ok(result.stdout.includes('not found'), `expected "not found" in output, got: ${result.stdout}`)
    assert.ok(existsSync(join(home, '.claude', 'rules')), 'rules/ etc. should still be copied')
    assert.ok(!existsSync(join(home, '.claude', 'CLAUDE.md')), 'no CLAUDE.md should be written for an unmatched preset')
    rmSync(home, { recursive: true })
  })

  test('rejects a -Preset value containing invalid characters before touching the filesystem', () => {
    const home = mkdtempSync(join(tmpdir(), 'install-home-'))
    const result = runInstallPs1(['-Preset', 'Not_Valid!'], home, '')
    assert.notStrictEqual(result.status, 0)
    assert.ok(!existsSync(join(home, '.claude')), 'should exit before creating anything')
    rmSync(home, { recursive: true })
  })
})
