#!/usr/bin/env node
// senior-dev-kit CLI — thin cross-platform wrapper around the tested installers,
// so the kit installs with a single command instead of a manual clone+run:
//   npx senior-dev-kit [--detect | --preset=<name>]        (once published)
//   npx github:<owner>/senior-dev-kit --detect             (straight from git)
//
// All real logic (backups, copy verification, preset resolution) lives in
// install.sh / install.ps1 — this wrapper only picks the right one for the
// platform and forwards arguments, keeping a single source of truth.
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { join } from 'path'

const KIT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`senior-dev-kit installer

Usage:
  senior-dev-kit                  install the full kit to ~/.claude/
  senior-dev-kit --detect         detect the stack from the current directory and pick a preset
  senior-dev-kit --preset=<name>  install with a specific preset (e.g. nextjs-saas)
  senior-dev-kit --help           show this help

Docs: README.md · INSTALL.md · TROUBLESHOOTING.md in the kit root.`)
  process.exit(0)
}

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: process.cwd() })
  if (r.error) return null
  return r.status ?? 1
}

let status = null
if (process.platform === 'win32') {
  // install.ps1 takes -Detect / -Preset <name>; translate the unix-style flags.
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(KIT_ROOT, 'install.ps1')]
  for (const a of args) {
    if (a === '--detect') psArgs.push('-Detect')
    else if (a.startsWith('--preset=')) psArgs.push('-Preset', a.slice('--preset='.length))
    else psArgs.push(a)
  }
  status = run('powershell', psArgs) ?? run('pwsh', psArgs)
  if (status === null) {
    console.error('senior-dev-kit: neither powershell nor pwsh found on PATH.')
    process.exit(1)
  }
} else {
  status = run('bash', [join(KIT_ROOT, 'install.sh'), ...args])
  if (status === null) {
    console.error('senior-dev-kit: bash not found on PATH — run install.sh manually or see INSTALL.md.')
    process.exit(1)
  }
}
process.exit(status)
