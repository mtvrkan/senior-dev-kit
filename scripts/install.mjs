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
 *   - `~/.claude/settings.json` gets the kit's deny rules, attribution and
 *     hook entries merged in; a key the user already set is never overwritten.
 *   - Any other file that would be overwritten is copied into
 *     `<target>/.senior-dev-kit/backups/<timestamp>/` first.
 *   - A manifest records exactly what was written, so `--uninstall` removes
 *     the kit's files and nothing else.
 *
 * Usage:
 *   node scripts/install.mjs [--dry-run] [--yes] [--target DIR] [--only a,b]
 *   node scripts/install.mjs --check
 *   node scripts/install.mjs --uninstall [--dry-run] [--yes]
 *
 * Plain JavaScript on purpose — see the note at the top of lib/install-core.mjs.
 */

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import {
  backupStamp,
  classifyFileAction,
  deepEqual,
  detectJsonStyle,
  formatJson,
  isEmptySkeleton,
  kitHookGroups,
  kitStatusLineLeaf,
  legacyCopyLine,
  mergeDenyRules,
  mergeHookGroups,
  mergeSettingsLeaves,
  parseArgs,
  permissionsShape,
  pluginEnabled,
  removeManagedBlock,
  removeStaleDenyRules,
  resolveComponents,
  settingsLeaves,
  spliceManagedBlock,
  substitutePluginRoot,
  tidyPermissions,
  unmergeDenyRules,
  unmergeHookGroups,
  unmergeSettingsLeaves,
} from './lib/install-core.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = '.senior-dev-kit'
const MANIFEST_NAME = 'manifest.json'

/** Directory components: repo source dir → target subdirectory. */
const DIR_COMPONENTS = {
  agents: { from: 'agents', to: 'agents', filter: name => name.endsWith('.md') },
  skills: { from: 'skills', to: 'skills', filter: rel => !rel.startsWith('kit-setup/') },
  commands: { from: 'commands', to: 'commands', filter: name => name.endsWith('.md') },
  rules: { from: 'rules', to: 'rules', filter: name => name.endsWith('.md') },
  agent_docs: { from: 'agent_docs', to: 'agent_docs', filter: name => name.endsWith('.md') },
  // Presets are not loaded by anything automatically (see presets/README.md) — they are copied
  // into a project's CLAUDE.md by hand or by the `from-scratch` skill. They ship here anyway
  // because a plugin install gets them for free (the plugin root IS a repo checkout), so leaving
  // them out made `presets/<category>/<stack>/CLAUDE.md` a path that resolved under one delivery
  // path and not the other — exactly the bug CLAUDE.md's dual-delivery rule exists to prevent.
  presets: { from: 'presets', to: 'presets', filter: name => name.endsWith('.md') },
  settings: { from: 'scripts/hooks', to: 'scripts/senior-dev-kit/hooks', filter: name => name.endsWith('.mjs') },
  statusline: { from: 'scripts', to: 'scripts/senior-dev-kit', filter: name => name === 'statusline.mjs' },
}

const HOOK_SCRIPT_REL = 'scripts/senior-dev-kit/hooks/require-agent-model.mjs'
const STATUSLINE_SCRIPT_REL = 'scripts/senior-dev-kit/statusline.mjs'
const SETTINGS_COMPONENTS = ['deny-rules', 'settings', 'statusline']
const PLUGIN_ROOT_COMPONENTS = ['agents', 'skills', 'commands']

function sourceContent(component, rel, from, target) {
  const bytes = readFileSync(from)
  if (!PLUGIN_ROOT_COMPONENTS.includes(component) || !rel.endsWith('.md')) return bytes
  return Buffer.from(substitutePluginRoot(bytes.toString('utf8'), target), 'utf8')
}

function ownerComponent(relPath) {
  let owner = null
  for (const [name, spec] of Object.entries(DIR_COMPONENTS)) {
    if (relPath.startsWith(`${spec.to}/`) && (!owner || spec.to.length > DIR_COMPONENTS[owner].to.length)) owner = name
  }
  return owner
}

const sameLeaf = (a, b) => deepEqual(a.path, b.path) && deepEqual(a.value, b.value)
const sameHook = (a, b) => a.event === b.event && deepEqual(a.group, b.group)

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
  if (opts.target) return resolve(opts.target)
  if (process.env.CLAUDE_CONFIG_DIR) return resolve(process.env.CLAUDE_CONFIG_DIR)
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
                    agents,skills,commands,rules,agent_docs,presets,protocol,
                    deny-rules,settings,statusline
                    settings   = hide Claude's commit/PR attribution + the hook that
                                 makes every Agent() call name its model
                    statusline = model/folder/branch/context-% status line
                                 (opt-in: never part of the default set, and never
                                 replaces a statusLine you already have)
      --check       Report whether the installed copy still matches this
                    checkout; exit 1 if it drifted. Writes nothing. Part of
                    \`npm run check\`; skips loudly when there is no install.
      --uninstall   Remove what a previous run of this installer wrote.
      --allow-duplicate-protocol
                    Install even if CLAUDE.md already holds an unmarked copy of
                    the protocol. Costs you the whole protocol twice per turn.
  -h, --help        This message.

Nothing is overwritten without a backup. Your own content in ~/.claude/CLAUDE.md
and your own entries in ~/.claude/settings.json are preserved.

If you installed the kit as a Claude Code plugin, the agents, skills, and
commands already come from the plugin — the installer detects that and
defaults to the subset a plugin cannot carry:
  node scripts/install.mjs --only rules,deny-rules,settings
`)
}

// --- plan building ----------------------------------------------------------

function readSettings(target) {
  const path = join(target, 'settings.json')
  const raw = readIfExists(path)
  if (raw === null) return { path, raw, parsed: null }
  try {
    return { path, raw, parsed: JSON.parse(raw) }
  } catch {
    return { path, raw, error: true }
  }
}

function planSettings(target, selected, manifest, current) {
  const wantsDeny = selected.includes('deny-rules')
  const wantsSettings = selected.includes('settings')
  const wantsStatusLine = selected.includes('statusline')
  if (!wantsDeny && !wantsSettings && !wantsStatusLine) return null
  if (current.error) return { error: current.path }

  const template = JSON.parse(readFileSync(join(REPO_ROOT, 'settings-template.json'), 'utf8'))
  const plugin = pluginEnabled(current.parsed)
  let settings = current.parsed ?? {}

  let denyAdded = []
  let denyRemoved = []
  const kitDeny = template.permissions?.deny ?? []
  if (wantsDeny) {
    const stale = removeStaleDenyRules(settings, manifest?.denyAdded, kitDeny)
    const merged = mergeDenyRules(stale.settings, kitDeny)
    settings = merged.settings
    denyAdded = merged.added
    denyRemoved = stale.removed
  }

  const desiredLeaves = []
  if (wantsSettings) desiredLeaves.push(...settingsLeaves(template).map(leaf => ({ ...leaf, component: 'settings' })))
  if (wantsStatusLine) desiredLeaves.push({ ...kitStatusLineLeaf(join(target, STATUSLINE_SCRIPT_REL)), component: 'statusline' })
  const ownedLeaves = manifest?.settingsLeaves ?? []
  const staleLeaves = ownedLeaves.filter(o => selected.includes(o.component) && !desiredLeaves.some(d => sameLeaf(o, d)))
  const unmergedLeaves = unmergeSettingsLeaves(settings, staleLeaves)
  const mergedLeaves = mergeSettingsLeaves(unmergedLeaves.settings, desiredLeaves)
  settings = mergedLeaves.settings
  const leavesAdded = mergedLeaves.added.map(leaf => ({
    ...leaf,
    component: desiredLeaves.find(d => deepEqual(d.path, leaf.path)).component,
  }))

  const desiredHooks = wantsSettings && !plugin ? kitHookGroups(join(target, HOOK_SCRIPT_REL)) : []
  const ownedHooks = manifest?.hookGroups ?? []
  const staleHooks = wantsSettings ? ownedHooks.filter(o => !desiredHooks.some(d => sameHook(o, d))) : []
  const unmergedHooks = unmergeHookGroups(settings, staleHooks)
  const mergedHooks = mergeHookGroups(unmergedHooks.settings, desiredHooks)
  settings = mergedHooks.settings

  const baseline = current.parsed ?? {}
  return {
    path: current.path,
    existed: current.raw !== null,
    style: detectJsonStyle(current.raw),
    permissionsBefore: permissionsShape(current.parsed),
    plugin,
    settings,
    changed: !deepEqual(settings, baseline) && !(current.raw === null && deepEqual(settings, {})),
    deny: wantsDeny ? { added: denyAdded, removed: denyRemoved, total: kitDeny.length } : null,
    leaves: { added: leavesAdded, removed: unmergedLeaves.removed, conflicts: mergedLeaves.conflicts },
    hooks: { added: mergedHooks.added, removed: unmergedHooks.removed, blocked: mergedHooks.blocked },
  }
}

function buildPlan(target, selected, manifest) {
  // What a previous run of this installer put there, keyed by relative path.
  // Used to tell "this file is the kit's own, from the last version" apart from
  // "this file is the user's, or something else's" — only the latter is worth
  // backing up. Without this, every routine kit upgrade would archive a full
  // copy of the previous version's ~60 files and the backups directory would
  // grow without bound while containing nothing the user ever wrote.
  const priorShas = new Map((manifest?.files ?? []).map(f => [f.path, f.sha]))
  const currentSettings = readSettings(target)
  const plugin = !currentSettings.error && pluginEnabled(currentSettings.parsed)
  const active = currentSettings.error ? selected.filter(name => !SETTINGS_COMPONENTS.includes(name)) : selected

  /** @type {{kind:'file',from:string,to:string,rel:string,content:Buffer,action:string,ours:boolean}[]} */
  const files = []
  for (const name of active) {
    const spec = DIR_COMPONENTS[name]
    if (!spec) continue
    if (name === 'settings' && plugin) continue
    const sourceDir = join(REPO_ROOT, spec.from)
    if (!existsSync(sourceDir)) continue
    for (const rel of walkFiles(sourceDir)) {
      if (spec.filter && !spec.filter(rel)) continue
      const from = join(sourceDir, rel)
      const to = join(target, spec.to, rel)
      const relKey = `${spec.to}/${rel}`
      const content = sourceContent(name, rel, from, target)
      const exists = existsSync(to)
      const currentSha = exists ? sha256(readFileSync(to)) : null
      const identical = exists && currentSha === sha256(content)
      files.push({
        kind: 'file',
        from,
        to,
        rel: relKey,
        content,
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

  const planned = new Set(files.map(f => f.rel))
  const orphans = []
  for (const entry of manifest?.files ?? []) {
    if (planned.has(entry.path)) continue
    const owner = ownerComponent(entry.path)
    if (!owner || !active.includes(owner)) continue
    const abs = join(target, entry.path)
    if (!existsSync(abs)) {
      orphans.push({ rel: entry.path, abs, action: 'gone' })
      continue
    }
    if (sha256(readFileSync(abs)) !== entry.sha) {
      orphans.push({ rel: entry.path, abs, action: 'keep' })
      continue
    }
    const displaced = (manifest?.restores ?? []).find(r => r.path === entry.path)
    const backupAbs = displaced ? join(target, displaced.backup) : null
    if (backupAbs && existsSync(backupAbs)) orphans.push({ rel: entry.path, abs, action: 'restore', from: backupAbs })
    else orphans.push({ rel: entry.path, abs, action: 'remove' })
  }

  return { files, protocol, orphans, settings: planSettings(target, selected, manifest, currentSettings) }
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
  const removable = plan.orphans.filter(o => o.action === 'remove')
  const restorable = plan.orphans.filter(o => o.action === 'restore')
  const kept = plan.orphans.filter(o => o.action === 'keep')
  if (removable.length > 0 || restorable.length > 0 || kept.length > 0) {
    lines.push(
      '',
      `Retired files: remove ${removable.length} the kit no longer ships, ` +
        `put back ${restorable.length} of yours they had displaced, keep ${kept.length} you edited`
    )
    const label = { remove: 'remove', restore: 'restore', keep: 'keep  ' }
    for (const o of [...removable, ...restorable, ...kept].slice(0, 10)) lines.push(`    ${label[o.action]}  ${o.rel}`)
  }

  const s = plan.settings
  if (s?.error) {
    lines.push('', `settings.json: SKIPPED — ${s.error} is not valid JSON; fix or move it and rerun`)
  } else if (s) {
    lines.push('')
    if (s.plugin) lines.push('settings.json: senior-dev-kit plugin is enabled — its hooks come from the plugin, not from here')
    if (s.deny) {
      lines.push(
        `Deny rules: add ${s.deny.added.length} of ${s.deny.total} to settings.json ` +
          `(${s.deny.total - s.deny.added.length} already present; your allow/ask rules untouched)` +
          (s.deny.removed.length > 0 ? `; remove ${s.deny.removed.length} the kit no longer ships` : '')
      )
    }
    for (const leaf of s.leaves.added) lines.push(`Setting: set ${leaf.path.join('.')} = ${JSON.stringify(leaf.value)}`)
    for (const leaf of s.leaves.removed) lines.push(`Setting: remove retired ${leaf.path.join('.')}`)
    for (const conflict of s.leaves.conflicts) {
      lines.push(`Setting: keep your ${conflict.path.join('.')} = ${JSON.stringify(conflict.current)} (the kit would set it; yours wins)`)
    }
    for (const hook of s.hooks.added) lines.push(`Hook: add ${hook.event} ${hook.group.matcher} → ${hook.group.hooks[0].command}`)
    for (const hook of s.hooks.removed) lines.push(`Hook: remove retired ${hook.event} ${hook.group.matcher}`)
    if (s.hooks.blocked) lines.push('Hook: SKIPPED — settings.json "hooks" is not an object')
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
    writeFileSync(f.to, f.content)
    written.push({ path: f.rel, sha: sha256(f.content) })
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

  const retired = []
  for (const o of plan.orphans) {
    if (o.action === 'remove') rmSync(o.abs, { force: true })
    if (o.action === 'restore') cpSync(o.from, o.abs)
    retired.push(o.rel)
  }
  if (retired.length > 0) {
    for (const { to } of Object.values(DIR_COMPONENTS)) pruneEmptyDirs(join(target, to))
  }

  const s = plan.settings
  let settingsCreated = false
  let settingsBackup = null
  if (s && !s.error && s.changed) {
    settingsBackup = backup(s.path)
    mkdirSync(dirname(s.path), { recursive: true })
    writeFileSync(s.path, formatJson(s.settings, s.style), 'utf8')
    settingsCreated = !s.existed
  }

  return {
    backupDir,
    backedUp,
    written,
    restores,
    retired,
    protocolInstalled,
    settingsCreated,
    settingsBackup,
    settings: s && !s.error ? s : null,
  }
}

function loadManifest(target) {
  const path = join(target, STATE_DIR, MANIFEST_NAME)
  if (!existsSync(path)) return { path, manifest: null, error: false }
  try {
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    const valid = manifest !== null && typeof manifest === 'object' && !Array.isArray(manifest)
    return valid ? { path, manifest, error: false } : { path, manifest: null, error: true }
  } catch {
    return { path, manifest: null, error: true }
  }
}

const readManifest = target => loadManifest(target).manifest

const ownsSettings = manifest =>
  Boolean(manifest?.denyAdded?.length || manifest?.settingsLeaves?.length || manifest?.hookGroups?.length)

function writeManifest(target, result, selected) {
  const version = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version
  const manifestPath = join(target, STATE_DIR, MANIFEST_NAME)
  // Merge with any previous manifest so a later `--only` run does not orphan
  // files an earlier full run installed (uninstall reads this list, and a lost
  // entry means a file left behind forever).
  const previous = readManifest(target)
  const byPath = new Map((previous?.files ?? []).map(f => [f.path, f]))
  for (const rel of result.retired) byPath.delete(rel)
  for (const f of result.written) byPath.set(f.path, f)
  const s = result.settings
  const denyRemoved = new Set(s?.deny?.removed ?? [])
  const denyAdded = [...new Set([...(previous?.denyAdded ?? []).filter(rule => !denyRemoved.has(rule)), ...(s?.deny?.added ?? [])])]
  const settingsLeavesOwned = [
    ...(previous?.settingsLeaves ?? []).filter(o => !(s?.leaves.removed ?? []).some(r => sameLeaf(o, r))),
    ...(s?.leaves.added ?? []),
  ]
  const hookGroupsOwned = [
    ...(previous?.hookGroups ?? []).filter(o => !(s?.hooks.removed ?? []).some(r => sameHook(o, r))),
    ...(s?.hooks.added ?? []),
  ]
  // First write wins, deliberately: the earliest backup of a path is the
  // user's genuine original. A later one would only ever be a kit version we
  // installed ourselves, so overwriting the entry would point uninstall at the
  // wrong file and silently "restore" the kit over the user's content.
  const restores = new Map((previous?.restores ?? []).map(r => [r.path, r]))
  for (const r of result.restores) if (!restores.has(r.path)) restores.set(r.path, r)
  for (const rel of result.retired) restores.delete(rel)
  const firstSettingsWrite = !ownsSettings(previous)
  const manifest = {
    version,
    installedAt: new Date().toISOString(),
    components: [...new Set([...(previous?.components ?? []), ...selected])],
    files: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    restores: [...restores.values()].sort((a, b) => a.path.localeCompare(b.path)),
    protocolBlock: result.protocolInstalled || Boolean(previous?.protocolBlock),
    denyAdded,
    settingsLeaves: settingsLeavesOwned,
    hookGroups: hookGroupsOwned,
    settingsCreated: result.settingsCreated || Boolean(previous?.settingsCreated),
    permissionsBefore: previous?.permissionsBefore ?? (firstSettingsWrite ? s?.permissionsBefore : undefined),
    settingsBackup: previous?.settingsBackup ?? (firstSettingsWrite ? result.settingsBackup ?? undefined : undefined),
    lastBackupDir: relative(target, result.backupDir).split(sep).join('/'),
  }
  mkdirSync(dirname(manifestPath), { recursive: true })
  const tempPath = `${manifestPath}.${process.pid}.tmp`
  writeFileSync(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  renameSync(tempPath, manifestPath)
  return manifest
}

// --- uninstall --------------------------------------------------------------

function originalSettingsBytes(target, manifest) {
  if (!manifest.settingsBackup) return null
  const raw = readIfExists(join(target, manifest.settingsBackup))
  if (raw === null) return null
  try {
    return { raw, parsed: JSON.parse(raw) }
  } catch {
    return null
  }
}

function planUninstall(target) {
  const { path: manifestPath, manifest } = loadManifest(target)
  if (!manifest) return { error: `no install manifest at ${manifestPath}` }
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
  let settings = null
  if (ownsSettings(manifest)) {
    const current = readSettings(target)
    if (current.error) return { error: `${current.path} is not valid JSON — fix it first, otherwise the kit's settings entries could never be removed` }
    if (current.raw !== null) {
      const deny = unmergeDenyRules(current.parsed, manifest.denyAdded ?? [])
      const leaves = unmergeSettingsLeaves(deny.settings, manifest.settingsLeaves ?? [])
      const hooks = unmergeHookGroups(leaves.settings, manifest.hookGroups ?? [])
      let next = hooks.settings
      if (manifest.permissionsBefore) next = tidyPermissions(next, manifest.permissionsBefore)
      else if (manifest.denyAdded?.length || manifest.settingsCreated) next = tidyPermissions(next)
      const original = originalSettingsBytes(target, manifest)
      const text = original && deepEqual(next, original.parsed) ? original.raw : formatJson(next, detectJsonStyle(current.raw))
      settings = {
        path: current.path,
        settings: next,
        text,
        deleteFile: Boolean(manifest.settingsCreated) && isEmptySkeleton(next),
        changed: !deepEqual(next, current.parsed),
        denyRemoved: deny.removed,
        leavesRemoved: leaves.removed,
        hooksRemoved: hooks.removed,
      }
    }
  }
  return { manifest, manifestPath, remove, modified, restore, claudeMdPath, claudeMd, settings }
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
  pruneEmptyDirs(join(target, 'scripts'))
  if (plan.claudeMd.removed) {
    if (plan.claudeMd.text === '') rmSync(plan.claudeMdPath, { force: true })
    else writeFileSync(plan.claudeMdPath, plan.claudeMd.text, 'utf8')
  }
  if (plan.settings?.deleteFile) rmSync(plan.settings.path, { force: true })
  else if (plan.settings?.changed) {
    writeFileSync(plan.settings.path, plan.settings.text, 'utf8')
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

// --- drift check ------------------------------------------------------------

/**
 * Report whether the installed copy under `target` still matches this checkout,
 * and set a non-zero exit code if it does not. Writes nothing.
 *
 * Why this is in the gate: every other check in `npm run check` verifies that
 * the repo agrees with itself. None of them can see `~/.claude`, so a whole
 * round of work can sit green in the repo while the installed kit — the one
 * that actually loads into sessions — is a version behind. That happened: the
 * design-direction machinery shipped, passed 11/11, and was still absent from
 * the maintainer's own install a day later, so every session kept falling back
 * to the default the work existed to replace.
 *
 * @param {string} target
 */
function reportDrift(target) {
  const manifest = readManifest(target)
  // A copy install is the only thing this can measure. Plugin installs have no
  // manifest (the plugin root IS the checkout), and CI machines have no install
  // at all — both land here. Say so out loud rather than printing a tick over an
  // empty scan; a check that silently measures nothing reads as a passing one.
  if (!manifest) {
    console.log(`No senior-dev-kit copy install found at ${target} — nothing measured.`)
    console.log('  (Expected on CI and for plugin installs. `node scripts/install.mjs` creates one.)')
    return
  }

  // Only the components this target actually installed. Someone who ran
  // `--only rules,deny-rules` — the subset the usage text recommends to plugin
  // users — has no agents/ or skills/ there on purpose, and reporting those as
  // drift would teach the reader to ignore the check.
  const { selected } = resolveComponents(manifest.components ?? null)
  const plan = buildPlan(target, selected, manifest)

  const stale = plan.files.filter(f => f.action !== 'unchanged')
  const retired = plan.orphans.filter(o => o.action === 'remove' || o.action === 'restore')
  const protocolStale = Boolean(plan.protocol?.changed)
  const settingsBroken = Boolean(plan.settings?.error)
  const s = plan.settings && !plan.settings.error ? plan.settings : null
  const denyMissing = s?.deny ? s.deny.added.length : 0
  const denyStale = s?.deny ? s.deny.removed.length : 0
  const settingsDrift = s ? s.leaves.added.length + s.leaves.removed.length + s.hooks.added.length + s.hooks.removed.length : 0

  if (
    stale.length === 0 &&
    retired.length === 0 &&
    !protocolStale &&
    !settingsBroken &&
    denyMissing === 0 &&
    denyStale === 0 &&
    settingsDrift === 0
  ) {
    console.log(`✓ ${target} matches this checkout (${plan.files.length} files, components: ${selected.join(', ')}).`)
    return
  }

  console.error(`✗ ${target} is out of date with this checkout — installed sessions are running older content.`)
  for (const f of stale.slice(0, 15)) console.error(`    ${f.action === 'create' ? 'missing  ' : 'stale    '}${f.rel}`)
  if (stale.length > 15) console.error(`    … and ${stale.length - 15} more`)
  for (const o of retired.slice(0, 10)) console.error(`    retired  ${o.rel}`)
  if (protocolStale) console.error('    stale    CLAUDE.md (kit protocol block)')
  if (settingsBroken) console.error(`    broken   ${plan.settings.error} is not valid JSON — the kit's deny rules and settings cannot be verified`)
  if (denyMissing > 0) console.error(`    missing  ${denyMissing} deny rule(s) in settings.json`)
  if (denyStale > 0) console.error(`    retired  ${denyStale} deny rule(s) still in settings.json`)
  if (settingsDrift > 0) console.error(`    stale    ${settingsDrift} kit setting/hook entr(y/ies) in settings.json`)
  console.error('\n  Fix: node scripts/install.mjs --yes')
  process.exitCode = 1
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

  const manifestState = loadManifest(target)
  if (manifestState.error) {
    console.error(
      `${manifestState.path} is not a valid install manifest. It is the only record of which files, deny rules ` +
        'and settings this installer wrote, so installing, uninstalling or checking without it would either ' +
        'forget those entries or report on nothing.\n' +
        'Restore it from a backup or fix the JSON, then rerun. Deleting it makes the installer treat the ' +
        'target as a fresh install: --uninstall could then no longer remove what the earlier install added.'
    )
    process.exitCode = 1
    return
  }

  if (opts.uninstall) {
    const plan = planUninstall(target)
    if (plan.error) {
      console.error(`Cannot uninstall: ${plan.error}`)
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
    if (plan.settings?.denyRemoved.length) console.log(`  remove ${plan.settings.denyRemoved.length} deny rule(s) this installer added`)
    for (const leaf of plan.settings?.leavesRemoved ?? []) console.log(`  remove setting ${leaf.path.join('.')} this installer set`)
    for (const hook of plan.settings?.hooksRemoved ?? []) console.log(`  remove ${hook.event} ${hook.group.matcher} hook this installer added`)
    if (plan.settings?.deleteFile) console.log('  delete settings.json (the installer created it and nothing of yours is in it)')
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

  if (opts.check) {
    reportDrift(target)
    return
  }

  const probe = readSettings(target)
  const pluginOn = !probe.error && pluginEnabled(probe.parsed)
  const { selected, invalid } = resolveComponents(opts.components, { pluginEnabled: pluginOn })
  if (invalid.length > 0) {
    console.error(`Unknown component(s) for --only: ${invalid.join(', ')}`)
    process.exitCode = 2
    return
  }
  if (pluginOn && !opts.components) {
    console.log(
      'The senior-dev-kit plugin is enabled, so its agents, skills, commands and protocol already load from it.\n' +
        `Installing only what a plugin cannot carry: ${selected.join(', ')}. Pass --only to override.\n`
    )
  }

  const plan = buildPlan(target, selected, manifestState.manifest)
  console.log(describePlan(plan, target))
  const skippedSettings = plan.settings?.error ? selected.filter(name => SETTINGS_COMPONENTS.includes(name)) : []
  const installed = selected.filter(name => !skippedSettings.includes(name))
  const failSkippedSettings = () => {
    if (skippedSettings.length === 0) return
    console.error(
      `\nNot installed: ${skippedSettings.join(', ')} — ${plan.settings.error} is not valid JSON. ` +
        'Fix or move it and rerun; everything else above was handled.'
    )
    process.exitCode = 1
  }

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
    plan.orphans.length > 0 ||
    plan.protocol?.changed ||
    (plan.settings && !plan.settings.error && plan.settings.changed)
  if (!hasWork && skippedSettings.length === 0) return console.log('\nAlready up to date — nothing to do.')
  if (opts.dryRun) return console.log('\nDry run — nothing was changed.')
  if (!hasWork) return failSkippedSettings()
  const answer = await confirm('\nProceed?', opts.yes)
  if (answer === NO_TTY) {
    process.exitCode = 1
    return
  }
  if (!answer) return console.log('Aborted.')

  const result = applyPlan(plan, target, backupStamp(new Date()))
  writeManifest(target, result, installed)
  console.log(`\n${skippedSettings.length > 0 ? 'Partly installed' : 'Installed'} to ${target}`)
  if (result.backedUp > 0) console.log(`Backed up ${result.backedUp} existing file(s) to ${result.backupDir}`)
  console.log('Undo any time with: node scripts/install.mjs --uninstall')
  console.log('Restart Claude Code (or run /reload-plugins) to pick up the changes.')
  failSkippedSettings()
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
