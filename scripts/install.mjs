#!/usr/bin/env node
/**
 * senior-dev-kit installer.
 *
 * Installs the parts of the kit a Claude Code plugin cannot carry — `rules/`,
 * the deny list, and the global protocol — plus, optionally, the agents,
 * skills, commands, and reference docs for people who would rather not use the
 * plugin at all.
 *
 * Design rule: never destroy anything the user already had.
 *   - `~/.claude/CLAUDE.md` gets a marker-delimited managed block appended;
 *     content outside the markers is preserved verbatim.
 *   - `~/.claude/settings.json` gets the kit's deny rules merged in; every
 *     other key, and every deny rule the user wrote, is left alone.
 *   - Any other file that would be overwritten is copied into
 *     `<target>/.senior-dev-kit/backups/<timestamp>/` first.
 *   - A manifest records exactly what was written, so `--uninstall` removes
 *     the kit's files and nothing else.
 *
 * Usage:
 *   node scripts/install.mjs [--dry-run] [--yes] [--target DIR] [--only a,b]
 *   node scripts/install.mjs --uninstall [--dry-run] [--yes]
 *
 * Plain JavaScript on purpose — see the note at the top of lib/install-core.mjs.
 */

import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import {
  backupStamp,
  classifyFileAction,
  legacyCopyLine,
  mergeDenyRules,
  parseArgs,
  removeManagedBlock,
  resolveComponents,
  spliceManagedBlock,
  unmergeDenyRules,
} from './lib/install-core.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = '.senior-dev-kit'
const MANIFEST_NAME = 'manifest.json'

/** Directory components: repo source dir → target subdirectory. */
const DIR_COMPONENTS = {
  agents: { from: 'agents', to: 'agents', filter: name => name.endsWith('.md') },
  skills: { from: 'skills', to: 'skills', filter: null },
  commands: { from: 'commands', to: 'commands', filter: name => name.endsWith('.md') },
  rules: { from: 'rules', to: 'rules', filter: name => name.endsWith('.md') },
  agent_docs: { from: 'agent_docs', to: 'agent_docs', filter: name => name.endsWith('.md') },
  // Presets are not loaded by anything automatically (see presets/README.md) — they are copied
  // into a project's CLAUDE.md by hand or by the `from-scratch` skill. They ship here anyway
  // because a plugin install gets them for free (the plugin root IS a repo checkout), so leaving
  // them out made `presets/<category>/<stack>/CLAUDE.md` a path that resolved under one delivery
  // path and not the other — exactly the bug CLAUDE.md's dual-delivery rule exists to prevent.
  presets: { from: 'presets', to: 'presets', filter: name => name.endsWith('.md') },
}

const sha256 = buf => createHash('sha256').update(buf).digest('hex')
const readIfExists = path => (existsSync(path) ? readFileSync(path, 'utf8') : null)

function walkFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, base, out)
    else out.push(relative(base, full).split(sep).join('/'))
  }
  return out
}

function resolveTarget(opts) {
  if (opts.target) return opts.target
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR
  return join(homedir(), '.claude')
}

function usage() {
  console.log(`senior-dev-kit installer

  node scripts/install.mjs [options]

Options:
  -n, --dry-run     Show exactly what would change; write nothing.
  -y, --yes         Skip the confirmation prompt (for CI and scripted setups).
      --target DIR  Install into DIR instead of ~/.claude (or $CLAUDE_CONFIG_DIR).
      --only LIST   Comma-separated subset of:
                    agents,skills,commands,rules,agent_docs,presets,protocol,deny-rules
      --uninstall   Remove what a previous run of this installer wrote.
      --allow-duplicate-protocol
                    Install even if CLAUDE.md already holds an unmarked copy of
                    the protocol. Costs you the whole protocol twice per turn.
  -h, --help        This message.

Nothing is overwritten without a backup. Your own content in ~/.claude/CLAUDE.md
and your own entries in ~/.claude/settings.json are preserved.

If you installed the kit as a Claude Code plugin, the agents, skills, and
commands already come from the plugin — the useful subset here is:
  node scripts/install.mjs --only rules,deny-rules
`)
}

// --- plan building ----------------------------------------------------------

function buildPlan(target, selected, manifest) {
  // What a previous run of this installer put there, keyed by relative path.
  // Used to tell "this file is the kit's own, from the last version" apart from
  // "this file is the user's, or something else's" — only the latter is worth
  // backing up. Without this, every routine kit upgrade would archive a full
  // copy of the previous version's ~60 files and the backups directory would
  // grow without bound while containing nothing the user ever wrote.
  const priorShas = new Map((manifest?.files ?? []).map(f => [f.path, f.sha]))

  /** @type {{kind:'file',from:string,to:string,rel:string,action:string,ours:boolean}[]} */
  const files = []
  for (const name of selected) {
    const spec = DIR_COMPONENTS[name]
    if (!spec) continue
    const sourceDir = join(REPO_ROOT, spec.from)
    if (!existsSync(sourceDir)) continue
    for (const rel of walkFiles(sourceDir)) {
      if (spec.filter && !spec.filter(rel)) continue
      const from = join(sourceDir, rel)
      const to = join(target, spec.to, rel)
      const relKey = `${spec.to}/${rel}`
      const exists = existsSync(to)
      const currentSha = exists ? sha256(readFileSync(to)) : null
      const identical = exists && currentSha === sha256(readFileSync(from))
      files.push({
        kind: 'file',
        from,
        to,
        rel: relKey,
        action: classifyFileAction({ exists, identical }),
        ours: exists && priorShas.get(relKey) === currentSha,
      })
    }
  }

  let protocol = null
  if (selected.includes('protocol')) {
    const body = readFileSync(join(REPO_ROOT, 'global-CLAUDE.md'), 'utf8')
    const claudeMdPath = join(target, 'CLAUDE.md')
    const existing = readIfExists(claudeMdPath)
    const { text, mode, legacyCopy } = spliceManagedBlock(existing, body)
    protocol = {
      path: claudeMdPath,
      text,
      mode,
      changed: text !== existing,
      legacyCopy,
      legacyLine: legacyCopy ? legacyCopyLine(existing, body) : null,
    }
  }

  let deny = null
  if (selected.includes('deny-rules')) {
    const template = JSON.parse(readFileSync(join(REPO_ROOT, 'settings-template.json'), 'utf8'))
    const kitDeny = template.permissions?.deny ?? []
    const settingsPath = join(target, 'settings.json')
    const raw = readIfExists(settingsPath)
    let existing = null
    if (raw !== null) {
      try {
        existing = JSON.parse(raw)
      } catch {
        // A settings.json we cannot parse is the one case where merging is
        // impossible without guessing. Refuse rather than clobber it.
        return { files, protocol, deny: { error: settingsPath } }
      }
    }
    const { settings, added } = mergeDenyRules(existing, kitDeny)
    deny = { path: settingsPath, settings, added, total: kitDeny.length, existed: raw !== null }
  }

  return { files, protocol, deny }
}

function describePlan(plan, target) {
  const counts = { create: 0, overwrite: 0, unchanged: 0 }
  for (const f of plan.files) counts[f.action]++
  const foreign = plan.files.filter(f => f.action === 'overwrite' && !f.ours)
  const lines = [`Target: ${target}`, '']
  lines.push(
    `Files: ${counts.create} new, ${counts.overwrite} to overwrite ` +
      `(${foreign.length} not written by this installer — backed up and restorable on --uninstall), ` +
      `${counts.unchanged} already up to date`
  )
  for (const f of foreign.slice(0, 10)) lines.push(`    overwrite (yours)  ${f.rel}`)
  if (foreign.length > 10) lines.push(`    … and ${foreign.length - 10} more`)

  if (plan.protocol) {
    const verb = {
      created: 'create CLAUDE.md with the kit protocol block',
      appended: 'append the kit protocol block to your existing CLAUDE.md (your content is kept)',
      replaced: 'refresh the kit protocol block already in your CLAUDE.md (your content is kept)',
    }[plan.protocol.mode]
    lines.push('', `Protocol: ${plan.protocol.changed ? verb : 'CLAUDE.md protocol block already current'}`)
  }
  if (plan.deny) {
    if (plan.deny.error) {
      lines.push('', `Deny rules: SKIPPED — ${plan.deny.error} is not valid JSON; fix or move it and rerun`)
    } else {
      lines.push(
        '',
        `Deny rules: add ${plan.deny.added.length} of ${plan.deny.total} to settings.json ` +
          `(${plan.deny.total - plan.deny.added.length} already present; your allow/ask rules untouched)`
      )
    }
  }
  return lines.join('\n')
}

// --- apply ------------------------------------------------------------------

function applyPlan(plan, target, stamp) {
  const backupDir = join(target, STATE_DIR, 'backups', stamp)
  const written = []
  const restores = []
  let backedUp = 0

  const backup = path => {
    if (!existsSync(path)) return null
    const rel = relative(target, path).split(sep).join('/')
    const dest = join(backupDir, relative(target, path))
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(path, dest)
    backedUp++
    return `${STATE_DIR}/backups/${stamp}/${rel}`
  }

  for (const f of plan.files) {
    if (f.action === 'unchanged') {
      written.push({ path: f.rel, sha: sha256(readFileSync(f.to)) })
      continue
    }
    // Only archive a file this installer did not write. A file whose current
    // bytes match what the last install recorded is the kit's own previous
    // version — copying it aside on every upgrade would bury the one backup
    // that matters (the user's original) under version noise.
    if (f.action === 'overwrite' && !f.ours) {
      const backupPath = backup(f.to)
      if (backupPath) restores.push({ path: f.rel, backup: backupPath })
    }
    mkdirSync(dirname(f.to), { recursive: true })
    const content = readFileSync(f.from)
    writeFileSync(f.to, content)
    written.push({ path: f.rel, sha: sha256(content) })
  }

  let protocolInstalled = false
  if (plan.protocol && plan.protocol.changed) {
    backup(plan.protocol.path)
    mkdirSync(dirname(plan.protocol.path), { recursive: true })
    writeFileSync(plan.protocol.path, plan.protocol.text, 'utf8')
    protocolInstalled = true
  } else if (plan.protocol) {
    protocolInstalled = true
  }

  let denyAdded = []
  if (plan.deny && !plan.deny.error) {
    if (plan.deny.added.length > 0) {
      backup(plan.deny.path)
      mkdirSync(dirname(plan.deny.path), { recursive: true })
      writeFileSync(plan.deny.path, `${JSON.stringify(plan.deny.settings, null, 2)}\n`, 'utf8')
    }
    denyAdded = plan.deny.added
  }

  return { backupDir, backedUp, written, restores, protocolInstalled, denyAdded }
}

function readManifest(target) {
  const manifestPath = join(target, STATE_DIR, MANIFEST_NAME)
  if (!existsSync(manifestPath)) return null
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

function writeManifest(target, result, selected) {
  const version = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version
  const manifestPath = join(target, STATE_DIR, MANIFEST_NAME)
  // Merge with any previous manifest so a later `--only` run does not orphan
  // files an earlier full run installed (uninstall reads this list, and a lost
  // entry means a file left behind forever).
  const previous = readManifest(target)
  const byPath = new Map((previous?.files ?? []).map(f => [f.path, f]))
  for (const f of result.written) byPath.set(f.path, f)
  // First write wins, deliberately: the earliest backup of a path is the
  // user's genuine original. A later one would only ever be a kit version we
  // installed ourselves, so overwriting the entry would point uninstall at the
  // wrong file and silently "restore" the kit over the user's content.
  const restores = new Map((previous?.restores ?? []).map(r => [r.path, r]))
  for (const r of result.restores) if (!restores.has(r.path)) restores.set(r.path, r)
  const manifest = {
    version,
    installedAt: new Date().toISOString(),
    components: [...new Set([...(previous?.components ?? []), ...selected])],
    files: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    restores: [...restores.values()].sort((a, b) => a.path.localeCompare(b.path)),
    protocolBlock: result.protocolInstalled || Boolean(previous?.protocolBlock),
    denyAdded: [...new Set([...(previous?.denyAdded ?? []), ...result.denyAdded])],
    lastBackupDir: relative(target, result.backupDir).split(sep).join('/'),
  }
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

// --- uninstall --------------------------------------------------------------

function planUninstall(target) {
  const manifestPath = join(target, STATE_DIR, MANIFEST_NAME)
  if (!existsSync(manifestPath)) return { error: `no install manifest at ${manifestPath}` }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const remove = []
  const modified = []
  for (const entry of manifest.files) {
    const abs = join(target, entry.path)
    if (!existsSync(abs)) continue
    if (sha256(readFileSync(abs)) === entry.sha) remove.push(abs)
    else modified.push(entry.path)
  }
  // Files the installer displaced rather than created. Deleting the kit's copy
  // without putting these back would leave the user permanently short a file
  // they had before installing — the backup exists but nothing would ever use
  // it, which makes "we backed it up" a technicality rather than a promise.
  const restore = (manifest.restores ?? [])
    .filter(r => existsSync(join(target, r.backup)))
    .filter(r => !modified.includes(r.path))
    .map(r => ({ path: r.path, from: join(target, r.backup), to: join(target, r.path) }))
  const claudeMdPath = join(target, 'CLAUDE.md')
  const claudeMd = manifest.protocolBlock ? removeManagedBlock(readIfExists(claudeMdPath)) : { removed: false }
  const settingsPath = join(target, 'settings.json')
  let deny = null
  if (manifest.denyAdded?.length) {
    const raw = readIfExists(settingsPath)
    if (raw !== null) {
      try {
        deny = { path: settingsPath, ...unmergeDenyRules(JSON.parse(raw), manifest.denyAdded) }
      } catch {
        deny = { path: settingsPath, error: true }
      }
    }
  }
  return { manifest, manifestPath, remove, modified, restore, claudeMdPath, claudeMd, deny }
}

function applyUninstall(target, plan) {
  for (const abs of plan.remove) rmSync(abs, { force: true })
  // Restore before pruning: putting a file back into a directory we are about
  // to consider for deletion is the whole point, and pruneEmptyDirs only
  // removes directories that are genuinely empty afterwards.
  for (const r of plan.restore) {
    mkdirSync(dirname(r.to), { recursive: true })
    cpSync(r.from, r.to)
  }
  // Prune directories the kit created and left empty; leave anything the user
  // still has files in. Derived from DIR_COMPONENTS rather than re-listed: a
  // hand-typed copy of that list is how a newly added component ends up
  // installed but never pruned on uninstall.
  for (const { to } of Object.values(DIR_COMPONENTS)) {
    pruneEmptyDirs(join(target, to))
  }
  if (plan.claudeMd.removed) {
    if (plan.claudeMd.text === '') rmSync(plan.claudeMdPath, { force: true })
    else writeFileSync(plan.claudeMdPath, plan.claudeMd.text, 'utf8')
  }
  if (plan.deny && !plan.deny.error && plan.deny.removed.length > 0) {
    writeFileSync(plan.deny.path, `${JSON.stringify(plan.deny.settings, null, 2)}\n`, 'utf8')
  }
  rmSync(plan.manifestPath, { force: true })
}

function pruneEmptyDirs(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(dir, entry.name))
  }
  if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true })
}

// --- entry point ------------------------------------------------------------

const NO_TTY = Symbol('no-tty')

async function confirm(question, autoYes) {
  if (autoYes) return true
  // Distinguished from a plain "n": answering no is a successful run of the
  // tool, but being unable to ask at all is a failed one, and a CI job piping
  // this installer needs a non-zero exit to notice.
  if (!process.stdin.isTTY) {
    console.error('\nNot a TTY and --yes was not passed — refusing to write without confirmation.')
    return NO_TTY
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase()
  rl.close()
  return answer === 'y' || answer === 'yes'
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return usage()
  if (opts.unknown.length > 0) {
    console.error(`Unknown argument(s): ${opts.unknown.join(', ')}\n`)
    usage()
    process.exitCode = 2
    return
  }
  const target = resolveTarget(opts)

  if (opts.uninstall) {
    const plan = planUninstall(target)
    if (plan.error) {
      console.error(`Nothing to uninstall: ${plan.error}`)
      process.exitCode = 1
      return
    }
    console.log(`Uninstall from ${target}`)
    console.log(`  remove ${plan.remove.length} file(s) written by the installer`)
    if (plan.modified.length > 0) {
      console.log(`  keep   ${plan.modified.length} file(s) you edited after install:`)
      for (const p of plan.modified.slice(0, 10)) console.log(`           ${p}`)
    }
    if (plan.restore.length > 0) {
      console.log(`  restore ${plan.restore.length} file(s) of yours that the install displaced:`)
      for (const r of plan.restore.slice(0, 10)) console.log(`           ${r.path}`)
    }
    if (plan.claudeMd.removed) console.log('  remove the kit protocol block from CLAUDE.md (your content stays)')
    if (plan.deny?.removed?.length) console.log(`  remove ${plan.deny.removed.length} deny rule(s) this installer added`)
    if (opts.dryRun) return console.log('\nDry run — nothing was changed.')
    const answer = await confirm('\nProceed?', opts.yes)
    if (answer === NO_TTY) {
      process.exitCode = 1
      return
    }
    if (!answer) return console.log('Aborted.')
    applyUninstall(target, plan)
    console.log('Uninstalled. Backups from previous installs are kept under', join(target, STATE_DIR, 'backups'))
    return
  }

  const { selected, invalid } = resolveComponents(opts.components)
  if (invalid.length > 0) {
    console.error(`Unknown component(s) for --only: ${invalid.join(', ')}`)
    process.exitCode = 2
    return
  }

  const plan = buildPlan(target, selected, readManifest(target))
  console.log(describePlan(plan, target))

  // Refuse rather than warn. Appending the managed block next to an unmarked
  // copy left by the kit's old `cp global-CLAUDE.md ~/.claude/CLAUDE.md`
  // instructions loads the entire protocol twice on every turn, in every
  // project, forever — and nothing in the install output would ever say so.
  // Everyone who installed the kit before the managed block existed is in
  // exactly this state, so this is the common upgrade path, not an edge case.
  if (plan.protocol?.legacyCopy && !opts.allowDuplicateProtocol) {
    const where = plan.protocol.legacyLine ? ` (line ${plan.protocol.legacyLine})` : ''
    console.error(
      `\nRefusing to write ${plan.protocol.path}: it already contains an unmarked copy of the kit protocol${where}.\n` +
        'Installing would add a second, marked copy, and every session would load the protocol twice.\n\n' +
        'Fix by doing one of these, then rerunning:\n' +
        '  - delete the old unmarked copy from that file (keep anything you wrote yourself), or\n' +
        '  - delete the whole file if it is nothing but the old protocol — the installer recreates it, or\n' +
        '  - rerun with --only rules,deny-rules to skip the protocol entirely.\n\n' +
        'Pass --allow-duplicate-protocol to install anyway.'
    )
    process.exitCode = 2
    return
  }

  const hasWork =
    plan.files.some(f => f.action !== 'unchanged') ||
    plan.protocol?.changed ||
    (plan.deny && !plan.deny.error && plan.deny.added.length > 0)
  if (!hasWork) return console.log('\nAlready up to date — nothing to do.')
  if (opts.dryRun) return console.log('\nDry run — nothing was changed.')
  const answer = await confirm('\nProceed?', opts.yes)
  if (answer === NO_TTY) {
    process.exitCode = 1
    return
  }
  if (!answer) return console.log('Aborted.')

  const result = applyPlan(plan, target, backupStamp(new Date()))
  writeManifest(target, result, selected)
  console.log(`\nInstalled to ${target}`)
  if (result.backedUp > 0) console.log(`Backed up ${result.backedUp} existing file(s) to ${result.backupDir}`)
  console.log('Undo any time with: node scripts/install.mjs --uninstall')
  console.log('Restart Claude Code (or run /reload-plugins) to pick up the changes.')
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
