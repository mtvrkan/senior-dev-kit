#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ESC = '\u001b['
const DIM = `${ESC}2m`
const ACTIVE = `${ESC}1;32m`
const RESET = `${ESC}0m`
const DOT_ON = '●'
const DOT_OFF = '○'

export const MODEL_FAMILIES = [
  ['Fable', 'fable'],
  ['Opus', 'opus'],
  ['Sonnet', 'sonnet'],
  ['Haiku', 'haiku'],
]

export function contextColor(percent) {
  if (percent < 50) return `${ESC}32m`
  if (percent < 80) return `${ESC}33m`
  return `${ESC}31m`
}

function currentBranch(cwd) {
  if (!cwd || !existsSync(cwd)) return ''
  try {
    return execFileSync('git', ['--no-optional-locks', 'rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    }).trim()
  } catch {
    return ''
  }
}

export function render(status, branch) {
  const modelId = String(status?.model?.id ?? '').toLowerCase()
  const models = MODEL_FAMILIES.map(([label, key]) =>
    modelId.includes(key) ? `${ACTIVE}${DOT_ON} ${label}${RESET}` : `${DIM}${DOT_OFF} ${label}${RESET}`
  ).join(' ')

  const separator = `${DIM}${DOT_ON}${RESET}`
  const cwd = status?.workspace?.current_dir ?? ''
  const parts = [models]
  if (cwd) parts.push(` ${DIM}|${RESET} ${DIM}${basename(cwd)}${RESET}`)
  if (branch) parts.push(` ${separator} ${DIM}${branch}${RESET}`)

  const used = status?.context_window?.used_percentage
  if (typeof used === 'number') {
    const percent = Math.floor(used)
    parts.push(` ${separator} ${contextColor(percent)}ctx ${percent}%${RESET}`)
  }
  return parts.join('')
}

function main() {
  const raw = readFileSync(0, 'utf8')
  if (!raw.trim()) return
  const status = JSON.parse(raw)
  process.stdout.write(render(status, currentBranch(status?.workspace?.current_dir)))
}

function invokedDirectly() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  try {
    main()
  } catch {
    process.exitCode = 0
  }
}
