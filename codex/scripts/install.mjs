#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const BLOCK_BEGIN = '<!-- BEGIN senior-dev-kit -->'
const BLOCK_END = '<!-- END senior-dev-kit -->'
const BLOCK_NOTE =
  '<!-- Managed by senior-dev-kit. Edits between these markers are replaced on reinstall.\n' +
  '     Put your own instructions OUTSIDE the markers — those are preserved. -->'
const COMPONENTS = ['agents', 'command-rules', 'protocol']

const HELP = `senior-dev-kit installer for Codex

  node scripts/install.mjs [options]

Installs the parts of the kit a Codex plugin cannot carry.

Options:
  -n, --dry-run     Show exactly what would change; write nothing.
  -y, --yes         Skip the confirmation prompt.
      --target DIR  Install into DIR instead of ~/.codex (or $CODEX_HOME).
      --only LIST   Comma-separated subset of: ${COMPONENTS.join(',')}
                    agents        = custom agents in <target>/agents/*.toml
                    command-rules = <target>/rules/senior-dev-kit.rules (prompt before
                                    git push / gh pr create, forbid destructive commands)
                    protocol      = the kit protocol as a managed block in <target>/AGENTS.md
      --check       Report whether the installed copy matches this kit; exit 1 on drift.
      --uninstall   Remove what a previous run of this installer wrote.
  -h, --help        This message.

Nothing is overwritten without a backup. Your own content in AGENTS.md is preserved.
`

function parseArgs(argv) {
  const options = { dryRun: false, yes: false, check: false, uninstall: false, help: false, target: null, only: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-n' || arg === '--dry-run') options.dryRun = true
    else if (arg === '-y' || arg === '--yes') options.yes = true
    else if (arg === '--check') options.check = true
    else if (arg === '--uninstall') options.uninstall = true
    else if (arg === '-h' || arg === '--help') options.help = true
    else if (arg === '--target') options.target = argv[(i += 1)]
    else if (arg === '--only') options.only = String(argv[(i += 1)] ?? '').split(',').map(item => item.trim()).filter(Boolean)
    else throw new Error(`Unknown option: ${arg}`)
  }
  if (options.only) {
    const unknown = options.only.filter(item => !COMPONENTS.includes(item))
    if (unknown.length > 0) throw new Error(`Unknown component(s): ${unknown.join(', ')}. Valid: ${COMPONENTS.join(', ')}`)
  }
  return options
}

const sha = text => createHash('sha256').update(text).digest('hex')
const read = path => (existsSync(path) ? readFileSync(path, 'utf8') : null)

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function spliceBlock(existing, body) {
  const block = `${BLOCK_BEGIN}\n${BLOCK_NOTE}\n\n${body.trim()}\n${BLOCK_END}`
  if (existing === null || existing.trim() === '') return `${block}\n`
  const start = existing.indexOf(BLOCK_BEGIN)
  const end = existing.indexOf(BLOCK_END)
  if (start !== -1 && end > start) return existing.slice(0, start) + block + existing.slice(end + BLOCK_END.length)
  return `${existing.trimEnd()}\n\n${block}\n`
}

export function removeBlock(existing) {
  const start = existing.indexOf(BLOCK_BEGIN)
  const end = existing.indexOf(BLOCK_END)
  if (start === -1 || end < start) return existing
  const rest = (existing.slice(0, start).trimEnd() + '\n' + existing.slice(end + BLOCK_END.length).trimStart()).trim()
  return rest === '' ? '' : `${rest}\n`
}

function plan(kitRoot, target, components) {
  const files = []
  if (components.includes('agents')) {
    const dir = join(kitRoot, 'agents')
    for (const name of readdirSync(dir).filter(file => file.endsWith('.toml')).sort()) {
      const content = readFileSync(join(dir, name), 'utf8').split('KIT_ROOT/').join(`${kitRoot.replace(/\\/g, '/')}/`)
      files.push({ path: join('agents', name), content })
    }
  }
  if (components.includes('command-rules')) {
    files.push({ path: join('rules', 'senior-dev-kit.rules'), content: readFileSync(join(kitRoot, 'command-rules', 'senior-dev-kit.rules'), 'utf8') })
  }
  let protocol = null
  if (components.includes('protocol')) {
    const body = `${readFileSync(join(kitRoot, 'protocol.md'), 'utf8').trim()}\n\nKIT_ROOT = ${kitRoot.replace(/\\/g, '/')}`
    protocol = spliceBlock(read(join(target, 'AGENTS.md')), body)
  }
  return { files, protocol }
}

function confirm(question) {
  return new Promise(resolvePromise => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout })
    prompt.question(question, answer => {
      prompt.close()
      resolvePromise(/^y(es)?$/i.test(answer.trim()))
    })
  })
}

function backupDir(target) {
  return join(target, '.senior-dev-kit', 'backups', new Date().toISOString().replace(/[:.]/g, '-').replace('Z', ''))
}

function backup(target, dir, relPath) {
  const source = join(target, relPath)
  if (!existsSync(source)) return false
  const destination = join(dir, relPath)
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
  return true
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(HELP)
    return 0
  }
  const kitRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const target = options.target || process.env.CODEX_HOME || join(homedir(), '.codex')
  const manifestPath = join(target, '.senior-dev-kit', 'manifest.json')
  const manifest = readJson(manifestPath)
  const version = readJson(join(kitRoot, '.codex-plugin', 'plugin.json'))?.version ?? 'unknown'

  if (options.uninstall) {
    if (!manifest) {
      console.log(`No senior-dev-kit install found at ${target} — nothing to remove.`)
      return 0
    }
    const edited = manifest.files.filter(file => {
      const current = read(join(target, file.path))
      return current !== null && sha(current) !== file.sha
    })
    console.log(`Target: ${target}`)
    console.log(`Remove ${manifest.files.length - edited.length} file(s) this installer wrote, keep ${edited.length} you edited.`)
    if (manifest.protocol) console.log('Remove the kit protocol block from AGENTS.md (your content is kept).')
    if (options.dryRun) {
      console.log('Dry run — nothing was changed.')
      return 0
    }
    if (!options.yes && !(await confirm('Proceed? [y/N] '))) return 1
    const dir = backupDir(target)
    for (const file of manifest.files) {
      if (edited.includes(file)) continue
      if (backup(target, dir, file.path)) rmSync(join(target, file.path))
    }
    if (manifest.protocol) {
      const agentsMd = read(join(target, 'AGENTS.md'))
      if (agentsMd !== null) {
        backup(target, dir, 'AGENTS.md')
        const next = removeBlock(agentsMd)
        if (next === '') rmSync(join(target, 'AGENTS.md'))
        else writeFileSync(join(target, 'AGENTS.md'), next)
      }
    }
    rmSync(manifestPath)
    console.log(`Uninstalled. Backups: ${dir}`)
    return 0
  }

  const components = options.only ?? (options.check && manifest ? manifest.components : COMPONENTS)
  const { files, protocol } = plan(kitRoot, target, components)

  if (options.check) {
    if (!manifest) {
      console.log(`No senior-dev-kit install found at ${target} — nothing measured.`)
      return 0
    }
    const stale = files.filter(file => read(join(target, file.path)) !== file.content).map(file => file.path)
    if (protocol !== null && read(join(target, 'AGENTS.md')) !== protocol) stale.push('AGENTS.md (kit protocol block)')
    if (stale.length === 0) {
      console.log(`✓ ${target} matches this kit (${files.length} files, components: ${components.join(', ')}).`)
      return 0
    }
    console.log(`✗ ${target} is out of date with this kit.`)
    for (const path of stale) console.log(`    stale    ${path}`)
    console.log('\n  Fix: node scripts/install.mjs --yes')
    return 1
  }

  const owned = new Map((manifest?.files ?? []).map(file => [file.path, file.sha]))
  const fresh = []
  const overwrite = []
  const same = []
  for (const file of files) {
    const current = read(join(target, file.path))
    if (current === null) fresh.push(file)
    else if (current === file.content) same.push(file)
    else overwrite.push(file)
  }
  const retired = (manifest?.files ?? []).filter(file => {
    if (files.some(planned => planned.path === file.path)) return false
    if (!components.includes(file.component)) return false
    const current = read(join(target, file.path))
    return current !== null && sha(current) === file.sha
  })
  const protocolChanged = protocol !== null && read(join(target, 'AGENTS.md')) !== protocol

  console.log(`Target: ${target}`)
  console.log(`Kit:    ${kitRoot} (${version})`)
  console.log(`Files: ${fresh.length} new, ${overwrite.length} to overwrite (backed up first), ${same.length} already up to date`)
  for (const file of overwrite) {
    const mine = owned.has(file.path) ? '' : ' (yours)'
    console.log(`    overwrite${mine}  ${file.path}`)
  }
  for (const file of retired) console.log(`    remove  ${file.path}`)
  if (protocol !== null) {
    console.log(`Protocol: ${protocolChanged ? 'write' : 'keep'} the kit protocol block in AGENTS.md (your content is kept)`)
  }
  if (options.dryRun) {
    console.log('Dry run — nothing was changed.')
    return 0
  }
  if (!options.yes && !(await confirm('Proceed? [y/N] '))) {
    console.log('Aborted — nothing was changed.')
    return 1
  }

  const dir = backupDir(target)
  let backedUp = 0
  for (const file of [...fresh, ...overwrite]) {
    if (backup(target, dir, file.path)) backedUp += 1
    mkdirSync(dirname(join(target, file.path)), { recursive: true })
    writeFileSync(join(target, file.path), file.content)
  }
  for (const file of retired) {
    if (backup(target, dir, file.path)) backedUp += 1
    rmSync(join(target, file.path))
  }
  if (protocolChanged) {
    if (backup(target, dir, 'AGENTS.md')) backedUp += 1
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'AGENTS.md'), protocol)
  }
  const kept = (manifest?.files ?? []).filter(file => !components.includes(file.component) && !files.some(planned => planned.path === file.path))
  const componentOf = path => (path.startsWith('agents') ? 'agents' : 'command-rules')
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        version,
        kitRoot,
        installedAt: new Date().toISOString(),
        components: [...new Set([...(manifest?.components ?? []), ...components])].filter(item => COMPONENTS.includes(item)),
        protocol: protocol !== null || Boolean(manifest?.protocol),
        files: [...kept, ...files.map(file => ({ path: file.path, sha: sha(file.content), component: componentOf(file.path) }))],
      },
      null,
      2
    )}\n`
  )
  console.log(`Installed to ${target}`)
  if (backedUp > 0) console.log(`Backed up ${backedUp} existing file(s) to ${dir}`)
  console.log('Undo any time with: node scripts/install.mjs --uninstall')
  console.log('Start a new Codex session to pick up the changes.')
  return 0
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
  main().then(
    code => {
      process.exitCode = code
    },
    error => {
      console.error(error.message)
      process.exitCode = 2
    }
  )
}
