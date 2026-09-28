/**
 * Tests for the installer.
 *
 * The unit tests below pin the two behaviors that decide whether this
 * installer is safe to hand to a stranger: it must never destroy content in
 * `~/.claude/CLAUDE.md`, and it must never drop a key or a rule from
 * `~/.claude/settings.json`. The end-to-end block runs the real CLI against a
 * throwaway target directory and asserts the same two properties survive an
 * actual install/uninstall round trip.
 */
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  BLOCK_BEGIN,
  BLOCK_END,
  backupStamp,
  classifyFileAction,
  isEmptySkeleton,
  legacyCopyLine,
  mergeDenyRules,
  mergeHookGroups,
  mergeSettingsLeaves,
  parseArgs,
  pluginEnabled,
  protocolAnchor,
  removeManagedBlock,
  removeStaleDenyRules,
  resolveComponents,
  settingsLeaves,
  spliceManagedBlock,
  unmergeDenyRules,
  unmergeHookGroups,
  unmergeSettingsLeaves,
} from './lib/install-core.mjs'
import { decide as decideAgentModel } from './hooks/require-agent-model.mjs'
import { render as renderStatusLine } from './statusline.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INSTALLER = join(REPO_ROOT, 'scripts', 'install.mjs')

describe('spliceManagedBlock', () => {
  it('creates a file when none exists', () => {
    const { text, mode } = spliceManagedBlock(null, 'PROTOCOL BODY')
    strictEqual(mode, 'created')
    ok(text.includes(BLOCK_BEGIN))
    ok(text.includes('PROTOCOL BODY'))
    ok(text.includes(BLOCK_END))
  })

  it('treats a whitespace-only file as empty', () => {
    strictEqual(spliceManagedBlock('   \n\n', 'BODY').mode, 'created')
  })

  it('appends without destroying the user\'s existing instructions', () => {
    const existing = '# My own global rules\n\nAlways use tabs.\n'
    const { text, mode } = spliceManagedBlock(existing, 'PROTOCOL BODY')
    strictEqual(mode, 'appended')
    ok(text.includes('Always use tabs.'), 'user content must survive')
    ok(text.includes('PROTOCOL BODY'))
  })

  it('replaces only the managed region on reinstall, keeping text on both sides', () => {
    const first = spliceManagedBlock('BEFORE\n', 'V1 BODY').text + '\nAFTER\n'
    const { text, mode } = spliceManagedBlock(first, 'V2 BODY')
    strictEqual(mode, 'replaced')
    ok(text.includes('BEFORE'))
    ok(text.includes('AFTER'))
    ok(text.includes('V2 BODY'))
    ok(!text.includes('V1 BODY'), 'stale protocol must not linger')
    strictEqual(text.split(BLOCK_BEGIN).length - 1, 1, 'exactly one managed block')
  })

  it('is idempotent — reinstalling the same body twice changes nothing', () => {
    const once = spliceManagedBlock('USER\n', 'BODY').text
    strictEqual(spliceManagedBlock(once, 'BODY').text, once)
  })

  it('does not corrupt a file containing only the end marker', () => {
    const existing = `stray ${BLOCK_END} marker\n`
    const { text, mode } = spliceManagedBlock(existing, 'BODY')
    strictEqual(mode, 'appended')
    ok(text.includes('stray'))
  })
})

describe('legacy unmarked protocol copy', () => {
  // Everyone who installed the kit before the managed block existed followed
  // `cp global-CLAUDE.md ~/.claude/CLAUDE.md`. Appending to that file would load
  // the protocol twice, every turn, forever — and say nothing about it.
  const BODY = '# Global Claude Senior Protocol v4.0\n\nRULES HERE\n'

  it('derives the anchor from the body and drops the version token', () => {
    strictEqual(protocolAnchor(BODY), 'Global Claude Senior Protocol')
    strictEqual(protocolAnchor('# Some Title\n'), 'Some Title')
    strictEqual(protocolAnchor('no heading at all\n'), null)
  })

  it('flags an unmarked copy of the same protocol', () => {
    const { mode, legacyCopy } = spliceManagedBlock(BODY, BODY)
    strictEqual(mode, 'appended')
    strictEqual(legacyCopy, true)
  })

  it('flags an unmarked copy of an OLDER version of the protocol', () => {
    const older = '# Global Claude Senior Protocol v3.1\n\nOLD RULES\n'
    strictEqual(spliceManagedBlock(older, BODY).legacyCopy, true)
  })

  it('does not flag unrelated user instructions', () => {
    strictEqual(spliceManagedBlock('# My Own Notes\n\nbe concise\n', BODY).legacyCopy, false)
  })

  it('does not flag a file that already has the managed block', () => {
    const installed = spliceManagedBlock(null, BODY).text
    strictEqual(spliceManagedBlock(installed, BODY).legacyCopy, false)
  })

  it('reports the line the old copy starts on', () => {
    strictEqual(legacyCopyLine(`MY NOTES\n\n${BODY}`, BODY), 3)
    strictEqual(legacyCopyLine('unrelated\n', BODY), null)
  })

  it('parses the escape hatch flag', () => {
    strictEqual(parseArgs([]).allowDuplicateProtocol, false)
    strictEqual(parseArgs(['--allow-duplicate-protocol']).allowDuplicateProtocol, true)
    deepStrictEqual(parseArgs(['--allow-duplicate-protocol']).unknown, [])
  })
})

describe('removeManagedBlock', () => {
  it('removes the block and keeps surrounding user content', () => {
    const withBlock = spliceManagedBlock('MINE ABOVE\n', 'BODY').text + '\nMINE BELOW\n'
    const { text, removed } = removeManagedBlock(withBlock)
    strictEqual(removed, true)
    ok(text.includes('MINE ABOVE'))
    ok(text.includes('MINE BELOW'))
    ok(!text.includes('BODY'))
  })

  it('leaves a file with no managed block untouched', () => {
    const { text, removed } = removeManagedBlock('just mine\n')
    strictEqual(removed, false)
    strictEqual(text, 'just mine\n')
  })

  it('empties a file that was only the managed block', () => {
    const { text, removed } = removeManagedBlock(spliceManagedBlock(null, 'BODY').text)
    strictEqual(removed, true)
    strictEqual(text, '')
  })
})

describe('mergeDenyRules', () => {
  it('preserves every other settings key and the user\'s own permissions', () => {
    const existing = {
      model: 'opus',
      permissions: { allow: ['Bash(ls)'], ask: ['Bash(git push)'], deny: ['Read(./private/**)'] },
    }
    const { settings, added } = mergeDenyRules(existing, ['Read(./**/.env)', 'Read(./private/**)'])
    strictEqual(settings.model, 'opus')
    deepStrictEqual(settings.permissions.allow, ['Bash(ls)'])
    deepStrictEqual(settings.permissions.ask, ['Bash(git push)'])
    deepStrictEqual(added, ['Read(./**/.env)'], 'a rule the user already had is not re-added')
    deepStrictEqual(settings.permissions.deny, ['Read(./private/**)', 'Read(./**/.env)'])
  })

  it('does not mutate the input object', () => {
    const existing = { permissions: { deny: ['a'] } }
    mergeDenyRules(existing, ['b'])
    deepStrictEqual(existing.permissions.deny, ['a'])
  })

  it('handles a missing settings file', () => {
    const { settings, added } = mergeDenyRules(null, ['x', 'y'])
    deepStrictEqual(settings.permissions.deny, ['x', 'y'])
    deepStrictEqual(added, ['x', 'y'])
  })

  it('never duplicates a rule across repeated installs', () => {
    const first = mergeDenyRules(null, ['x']).settings
    const second = mergeDenyRules(first, ['x'])
    deepStrictEqual(second.settings.permissions.deny, ['x'])
    deepStrictEqual(second.added, [])
  })
})

describe('unmergeDenyRules', () => {
  it('removes only the rules the manifest says we added', () => {
    const settings = { permissions: { allow: ['Bash(ls)'], deny: ['mine', 'kit-a', 'kit-b'] } }
    const { settings: out, removed } = unmergeDenyRules(settings, ['kit-a', 'kit-b'])
    deepStrictEqual(out.permissions.deny, ['mine'])
    deepStrictEqual(out.permissions.allow, ['Bash(ls)'])
    deepStrictEqual(removed, ['kit-a', 'kit-b'])
  })
})

describe('classifyFileAction', () => {
  it('classifies the three states', () => {
    strictEqual(classifyFileAction({ exists: false, identical: false }), 'create')
    strictEqual(classifyFileAction({ exists: true, identical: true }), 'unchanged')
    strictEqual(classifyFileAction({ exists: true, identical: false }), 'overwrite')
  })
})

describe('parseArgs', () => {
  it('parses the documented flags', () => {
    const o = parseArgs(['--dry-run', '-y', '--target', '/tmp/x', '--only', 'rules,deny-rules'])
    strictEqual(o.dryRun, true)
    strictEqual(o.yes, true)
    strictEqual(o.target, '/tmp/x')
    deepStrictEqual(o.components, ['rules', 'deny-rules'])
    deepStrictEqual(o.unknown, [])
  })

  it('parses = forms', () => {
    const o = parseArgs(['--target=/tmp/y', '--only=agents'])
    strictEqual(o.target, '/tmp/y')
    deepStrictEqual(o.components, ['agents'])
  })

  it('--check implies --dry-run, so no flag combination lets the gate write', () => {
    const o = parseArgs(['--check', '--yes'])
    strictEqual(o.check, true)
    strictEqual(o.dryRun, true)
  })

  it('refuses a --target with no directory instead of falling back to ~/.claude', () => {
    deepStrictEqual(parseArgs(['--target']).unknown, ['--target (missing directory)'])
    const swallowed = parseArgs(['--target', '--yes'])
    strictEqual(swallowed.target, null)
    strictEqual(swallowed.yes, true)
    deepStrictEqual(parseArgs(['--target=']).unknown, ['--target= (missing directory)'])
  })

  it('reports a typo instead of silently doing a real install', () => {
    // The whole point of the installer is that nothing happens by surprise;
    // `--dryrun` must not fall through to a live write.
    const o = parseArgs(['--dryrun'])
    strictEqual(o.dryRun, false)
    deepStrictEqual(o.unknown, ['--dryrun'])
  })
})

describe('resolveComponents', () => {
  it('defaults to everything, in install order', () => {
    const { selected, invalid } = resolveComponents(null)
    deepStrictEqual(invalid, [])
    ok(selected.includes('rules') && selected.includes('deny-rules'))
  })

  it('rejects an unknown component', () => {
    deepStrictEqual(resolveComponents(['rules', 'nope']).invalid, ['nope'])
  })

  it('leaves the opt-in statusline out of the default set', () => {
    const { selected } = resolveComponents(null)
    ok(selected.includes('settings'))
    ok(!selected.includes('statusline'))
    deepStrictEqual(resolveComponents(['statusline']).selected, ['statusline'])
  })

  it('defaults a plugin user to the parts a plugin cannot carry', () => {
    deepStrictEqual(resolveComponents(null, { pluginEnabled: true }).selected, ['rules', 'deny-rules', 'settings'])
  })
})

describe('settings leaves', () => {
  const leaves = settingsLeaves({ attribution: { commit: '', pr: '', sessionUrl: false }, permissions: { deny: ['x'] } })

  it('reads only the attribution leaves from the template', () => {
    deepStrictEqual(
      leaves.map(l => l.path.join('.')),
      ['attribution.commit', 'attribution.pr', 'attribution.sessionUrl']
    )
  })

  it('sets absent leaves and never overwrites a value the user chose', () => {
    const { settings, added, conflicts } = mergeSettingsLeaves({ attribution: { pr: 'mine' }, model: 'opus' }, leaves)
    deepStrictEqual(settings.attribution, { pr: 'mine', commit: '', sessionUrl: false })
    strictEqual(settings.model, 'opus')
    deepStrictEqual(added.map(l => l.path.join('.')), ['attribution.commit', 'attribution.sessionUrl'])
    deepStrictEqual(conflicts, [{ path: ['attribution', 'pr'], current: 'mine' }])
  })

  it('treats attribution:false as the user already hiding it', () => {
    const { settings, added, conflicts } = mergeSettingsLeaves({ attribution: false }, leaves)
    strictEqual(settings.attribution, false)
    deepStrictEqual(added, [])
    strictEqual(conflicts.length, 3)
  })

  it('removes only leaves still holding the value the kit wrote, then empty parents', () => {
    const { settings } = mergeSettingsLeaves({}, leaves)
    settings.attribution.pr = 'changed by user'
    const { settings: after, removed } = unmergeSettingsLeaves(settings, leaves)
    deepStrictEqual(after, { attribution: { pr: 'changed by user' } })
    strictEqual(removed.length, 2)
    deepStrictEqual(unmergeSettingsLeaves(mergeSettingsLeaves({}, leaves).settings, leaves).settings, {})
  })
})

describe('hook groups', () => {
  const groups = [{ event: 'PreToolUse', group: { matcher: 'Agent|Task', hooks: [{ type: 'command', command: 'node "a.mjs"' }] } }]

  it('appends next to the user hooks and is idempotent', () => {
    const mine = { matcher: 'Bash', hooks: [{ type: 'command', command: 'mine' }] }
    const first = mergeHookGroups({ hooks: { PreToolUse: [mine] } }, groups)
    deepStrictEqual(first.settings.hooks.PreToolUse, [mine, groups[0].group])
    strictEqual(mergeHookGroups(first.settings, groups).added.length, 0)
  })

  it('removes only its own group and drops event keys it emptied', () => {
    const mine = { matcher: 'Bash', hooks: [{ type: 'command', command: 'mine' }] }
    const merged = mergeHookGroups({ hooks: { PreToolUse: [mine] } }, groups).settings
    deepStrictEqual(unmergeHookGroups(merged, groups).settings, { hooks: { PreToolUse: [mine] } })
    deepStrictEqual(unmergeHookGroups(mergeHookGroups({}, groups).settings, groups).settings, {})
  })

  it('refuses to merge into a hooks value that is not an object', () => {
    strictEqual(mergeHookGroups({ hooks: 'broken' }, groups).blocked, true)
  })
})

describe('upgrade reconciliation', () => {
  it('removes deny rules a previous install added that the template no longer ships', () => {
    const { settings, removed } = removeStaleDenyRules({ permissions: { deny: ['mine', 'old', 'kept'] } }, ['old', 'kept'], ['kept'])
    deepStrictEqual(settings.permissions.deny, ['mine', 'kept'])
    deepStrictEqual(removed, ['old'])
  })

  it('recognises the empty skeleton a created settings.json leaves behind', () => {
    ok(isEmptySkeleton({ permissions: { deny: [] } }))
    ok(isEmptySkeleton({}))
    ok(!isEmptySkeleton({ permissions: { deny: ['mine'] } }))
    ok(!isEmptySkeleton({ model: 'opus' }))
  })

  it('detects the plugin by name, not by marketplace', () => {
    ok(pluginEnabled({ enabledPlugins: { 'senior-dev-kit@any-market': true } }))
    ok(!pluginEnabled({ enabledPlugins: { 'senior-dev-kit@any-market': false } }))
    ok(!pluginEnabled({ enabledPlugins: { 'other@x': true } }))
  })
})

describe('require-agent-model hook', () => {
  it('denies an inheriting agent call with no model', () => {
    const decision = decideAgentModel({ tool_input: { subagent_type: 'Explore', prompt: 'x' } })
    strictEqual(decision.hookSpecificOutput.permissionDecision, 'deny')
    strictEqual(decision.hookSpecificOutput.hookEventName, 'PreToolUse')
    ok(decideAgentModel({ tool_input: { prompt: 'x' } }), 'omitted subagent_type is general-purpose')
  })

  it('stays silent when a model is named, for forks, and for custom agents', () => {
    strictEqual(decideAgentModel({ tool_input: { subagent_type: 'Explore', model: 'haiku' } }), null)
    strictEqual(decideAgentModel({ tool_input: { subagent_type: 'fork' } }), null)
    strictEqual(decideAgentModel({ tool_input: { subagent_type: 'db-guard' } }), null)
  })

  it('never throws on a malformed payload', () => {
    ok(decideAgentModel(null))
    ok(decideAgentModel({}))
  })
})

describe('statusline', () => {
  it('lights the active model family and shows folder, branch and context', () => {
    const line = renderStatusLine(
      { model: { id: 'claude-opus-5-5' }, workspace: { current_dir: '/work/kit' }, context_window: { used_percentage: 83.7 } },
      'main'
    )
    ok(line.includes('● Opus'))
    ok(line.includes('○ Haiku'))
    ok(line.includes('kit') && line.includes('main'))
    ok(line.includes('\u001b[31mctx 83%'))
  })

  it('omits the parts the status payload does not carry', () => {
    const line = renderStatusLine({ model: { id: 'x' } }, '')
    ok(!line.includes('ctx'))
    ok(!line.includes('|'))
  })
})

describe('backupStamp', () => {
  it('produces a path-safe stamp', () => {
    const stamp = backupStamp(new Date('2026-08-09T12:34:56.789Z'))
    strictEqual(stamp, '2026-08-09T12-34-56-789')
    ok(!/[:.]/.test(stamp), 'no characters Windows rejects in a directory name')
  })
})

describe('installer CLI (end to end)', () => {
  const targets = []
  const makeTarget = () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdk-install-'))
    targets.push(dir)
    return dir
  }
  after(() => {
    for (const dir of targets) rmSync(dir, { recursive: true, force: true })
  })

  const run = (args, target) =>
    spawnSync(process.execPath, [INSTALLER, '--target', target, ...args], { encoding: 'utf8' })

  it('--dry-run writes nothing', () => {
    const target = makeTarget()
    const res = run(['--dry-run'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(res.stdout.includes('Dry run'))
    ok(!existsSync(join(target, 'rules')), 'dry run must not create anything')
  })

  it('--check skips loudly when there is no install, rather than passing in silence', () => {
    const target = makeTarget()
    const res = run(['--check'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(res.stdout.includes('nothing measured'), res.stdout)
    ok(!existsSync(join(target, 'rules')), '--check must never write')
  })

  it('--check passes on a fresh install and fails once the install falls behind', () => {
    const target = makeTarget()
    strictEqual(run(['--yes'], target).status, 0)

    const clean = run(['--check'], target)
    strictEqual(clean.status, 0, clean.stderr)
    ok(clean.stdout.includes('matches this checkout'), clean.stdout)

    // Exactly the state the check exists to catch: the repo moved on (or the
    // installed copy was edited) and every session keeps loading the old bytes
    // while the repo's own gate stays green.
    const stalePath = join(target, 'rules', '000-security.md')
    writeFileSync(stalePath, 'stale content\n', 'utf8')
    const drifted = run(['--check'], target)
    strictEqual(drifted.status, 1, drifted.stdout)
    ok(drifted.stderr.includes('rules/000-security.md'), drifted.stderr)
    ok(drifted.stderr.includes('install.mjs --yes'), 'the report has to say how to fix it')
    strictEqual(readFileSync(stalePath, 'utf8'), 'stale content\n', '--check reports, never repairs')
  })

  it('--check only measures the components that were actually installed', () => {
    // A plugin user installs `--only rules,deny-rules` on purpose. Reporting the
    // absent agents/ and skills/ as drift would make the check noise they learn
    // to ignore, which is worse than not having it.
    const target = makeTarget()
    strictEqual(run(['--yes', '--only', 'rules,deny-rules'], target).status, 0)
    const res = run(['--check'], target)
    strictEqual(res.status, 0, `${res.stdout}${res.stderr}`)
    ok(!res.stderr.includes('agents/'), res.stderr)
  })

  it('rejects an unknown flag rather than installing', () => {
    const target = makeTarget()
    const res = run(['--dryrun'], target)
    strictEqual(res.status, 2)
    ok(!existsSync(join(target, 'rules')))
  })

  it('refuses to write without a TTY when --yes is absent, and exits non-zero', () => {
    const target = makeTarget()
    const res = run([], target)
    ok(res.stderr.includes('refusing to write'), res.stderr)
    // Not merely "no". A pipeline that cannot be asked has failed, and exiting
    // 0 here would let a CI step report a successful install that never ran.
    strictEqual(res.status, 1)
    ok(!existsSync(join(target, 'rules')))
  })

  it('refuses to double-install the protocol over an old unmarked copy', () => {
    const target = makeTarget()
    mkdirSync(target, { recursive: true })
    // Exactly what the kit's pre-2.2 install instructions produced.
    const legacy = readFileSync(join(REPO_ROOT, 'global-CLAUDE.md'), 'utf8')
    writeFileSync(join(target, 'CLAUDE.md'), legacy, 'utf8')

    const res = run(['--yes'], target)
    strictEqual(res.status, 2, res.stderr)
    ok(res.stderr.includes('unmarked copy'), res.stderr)
    strictEqual(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), legacy, 'refusal must not touch the file')
    ok(!existsSync(join(target, 'rules')), 'refusal happens before anything is written')

    // The documented escape hatches both work.
    const skipped = run(['--yes', '--only', 'rules,deny-rules'], target)
    strictEqual(skipped.status, 0, skipped.stderr)
    strictEqual(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), legacy, 'CLAUDE.md untouched when protocol is skipped')

    const forced = run(['--yes', '--allow-duplicate-protocol'], target)
    strictEqual(forced.status, 0, forced.stderr)
    ok(readFileSync(join(target, 'CLAUDE.md'), 'utf8').includes(BLOCK_BEGIN))
  })

  it('installs, preserves pre-existing user config, and uninstalls cleanly', () => {
    const target = makeTarget()
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'CLAUDE.md'), '# My global rules\n\nPrefer tabs.\n', 'utf8')
    writeFileSync(
      join(target, 'settings.json'),
      JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'], deny: ['Read(./private/**)'] } }, null, 2),
      'utf8'
    )

    const install = run(['--yes'], target)
    strictEqual(install.status, 0, install.stderr)

    ok(existsSync(join(target, 'rules', '000-security.md')), 'rules installed')
    ok(existsSync(join(target, 'agents', 'ROUTING.md')), 'agents installed')
    ok(existsSync(join(target, 'skills', 'bug-fix', 'SKILL.md')), 'nested skill dirs installed')

    const claudeMd = readFileSync(join(target, 'CLAUDE.md'), 'utf8')
    ok(claudeMd.includes('Prefer tabs.'), 'user CLAUDE.md content survived install')
    ok(claudeMd.includes('Global Claude Senior Protocol'), 'kit protocol installed')

    const settings = JSON.parse(readFileSync(join(target, 'settings.json'), 'utf8'))
    strictEqual(settings.model, 'opus', 'unrelated settings keys survived')
    deepStrictEqual(settings.permissions.allow, ['Bash(ls)'], 'allow list survived')
    ok(settings.permissions.deny.includes('Read(./private/**)'), 'user deny rule survived')
    const templateDeny = JSON.parse(readFileSync(join(REPO_ROOT, 'settings-template.json'), 'utf8')).permissions.deny
    for (const rule of templateDeny) ok(settings.permissions.deny.includes(rule), `kit deny rule merged: ${rule}`)

    // Reinstall is a no-op, not a duplicate-appending one.
    const again = run(['--yes'], target)
    strictEqual(again.status, 0, again.stderr)
    ok(again.stdout.includes('Already up to date'), again.stdout)
    strictEqual(readFileSync(join(target, 'CLAUDE.md'), 'utf8'), claudeMd)

    const uninstall = run(['--uninstall', '--yes'], target)
    strictEqual(uninstall.status, 0, uninstall.stderr)
    ok(!existsSync(join(target, 'rules')), 'kit rules removed')
    const afterMd = readFileSync(join(target, 'CLAUDE.md'), 'utf8')
    ok(afterMd.includes('Prefer tabs.'), 'user CLAUDE.md content survived uninstall')
    ok(!afterMd.includes('Global Claude Senior Protocol'), 'protocol block removed')
    const afterSettings = JSON.parse(readFileSync(join(target, 'settings.json'), 'utf8'))
    strictEqual(afterSettings.model, 'opus')
    deepStrictEqual(afterSettings.permissions.deny, ['Read(./private/**)'], 'only kit rules were removed')
  })

  it('backs up a file it overwrites, and puts it back on uninstall', () => {
    const target = makeTarget()
    mkdirSync(join(target, 'rules'), { recursive: true })
    writeFileSync(join(target, 'rules', '000-security.md'), 'MY OWN RULE FILE\n', 'utf8')

    const res = run(['--only', 'rules', '--yes'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(res.stdout.includes('Backed up'), res.stdout)
    const match = res.stdout.match(/Backed up \d+ existing file\(s\) to (.+)/)
    ok(match, 'backup directory reported')
    strictEqual(readFileSync(join(match[1].trim(), 'rules', '000-security.md'), 'utf8'), 'MY OWN RULE FILE\n')

    // "We backed it up" is only a promise if something ever restores it.
    // Without this, uninstall would delete the kit's copy and leave the user
    // permanently short a file they had before installing.
    const undo = run(['--uninstall', '--yes'], target)
    strictEqual(undo.status, 0, undo.stderr)
    strictEqual(readFileSync(join(target, 'rules', '000-security.md'), 'utf8'), 'MY OWN RULE FILE\n')
  })

  it('does not re-archive its own files when the kit is upgraded', () => {
    // Simulates an upgrade: install, then let a kit file change upstream and
    // reinstall. The displaced file is the kit's own previous version, not
    // anything the user wrote, so archiving it would bury the backups
    // directory in version noise on every update.
    const target = makeTarget()
    strictEqual(run(['--only', 'rules', '--yes'], target).status, 0)

    const installed = join(target, 'rules', '000-security.md')
    const pristine = readFileSync(installed, 'utf8')
    writeFileSync(installed, `${pristine}\n<!-- pretend upstream changed -->\n`, 'utf8')
    // Now on-disk content differs from source but MATCHES nothing in the
    // manifest either, so it counts as foreign and is archived...
    const foreign = run(['--only', 'rules', '--yes'], target)
    ok(foreign.stdout.includes('Backed up'), foreign.stdout)

    // ...whereas a reinstall over the kit's own recorded bytes archives nothing.
    writeFileSync(installed, 'stale kit version\n', 'utf8')
    const manifestPath = join(target, '.senior-dev-kit', 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const entry = manifest.files.find(f => f.path === 'rules/000-security.md')
    entry.sha = createHash('sha256').update(readFileSync(installed)).digest('hex')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    const upgrade = run(['--only', 'rules', '--yes'], target)
    strictEqual(upgrade.status, 0, upgrade.stderr)
    ok(!upgrade.stdout.includes('Backed up'), `kit-owned file must not be archived: ${upgrade.stdout}`)
    strictEqual(readFileSync(installed, 'utf8'), pristine, 'and it is still upgraded in place')
  })

  it('keeps a file you edited after install instead of restoring over it', () => {
    const target = makeTarget()
    mkdirSync(join(target, 'rules'), { recursive: true })
    writeFileSync(join(target, 'rules', '000-security.md'), 'ORIGINAL\n', 'utf8')
    strictEqual(run(['--only', 'rules', '--yes'], target).status, 0)

    writeFileSync(join(target, 'rules', '000-security.md'), 'I EDITED THIS AFTER INSTALL\n', 'utf8')
    const undo = run(['--uninstall', '--yes'], target)
    strictEqual(undo.status, 0, undo.stderr)
    strictEqual(
      readFileSync(join(target, 'rules', '000-security.md'), 'utf8'),
      'I EDITED THIS AFTER INSTALL\n',
      'a post-install edit outranks the backup — never silently revert the user'
    )
  })

  it('--only installs just the requested components', () => {
    const target = makeTarget()
    const res = run(['--only', 'rules', '--yes'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(existsSync(join(target, 'rules')))
    ok(!existsSync(join(target, 'agents')), 'unrequested components stay out')
    ok(!existsSync(join(target, 'CLAUDE.md')), 'protocol not installed unless requested')
  })

  it('skips the deny merge instead of clobbering an unparseable settings.json', () => {
    const target = makeTarget()
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'settings.json'), '{ not json', 'utf8')
    const res = run(['--only', 'deny-rules', '--dry-run'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(res.stdout.includes('not valid JSON'), res.stdout)
    strictEqual(readFileSync(join(target, 'settings.json'), 'utf8'), '{ not json')
  })

  it('settings: hides attribution, wires the model hook, and uninstall restores the file byte for byte', () => {
    const target = makeTarget()
    const original = `${JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'mine' }] }] } }, null, 2)}\n`
    writeFileSync(join(target, 'settings.json'), original, 'utf8')
    strictEqual(run(['--yes', '--only', 'settings'], target).status, 0)

    const installed = JSON.parse(readFileSync(join(target, 'settings.json'), 'utf8'))
    deepStrictEqual(installed.attribution, { commit: '', pr: '', sessionUrl: false })
    const hook = installed.hooks.PreToolUse[0]
    strictEqual(hook.matcher, 'Agent|Task')
    ok(hook.hooks[0].command.includes('scripts/senior-dev-kit/hooks/require-agent-model.mjs'), hook.hooks[0].command)
    ok(!hook.hooks[0].command.includes('\\'), 'forward slashes only, so the command runs under every shell')
    ok(existsSync(join(target, 'scripts', 'senior-dev-kit', 'hooks', 'require-agent-model.mjs')))
    deepStrictEqual(installed.hooks.Stop, [{ hooks: [{ type: 'command', command: 'mine' }] }])

    strictEqual(run(['--check'], target).status, 0)
    strictEqual(run(['--uninstall', '--yes'], target).status, 0)
    strictEqual(readFileSync(join(target, 'settings.json'), 'utf8'), original)
    ok(!existsSync(join(target, 'scripts')), 'the kit-created scripts directory is pruned')
  })

  it('settings: deletes a settings.json it created once nothing of the user is left in it', () => {
    const target = makeTarget()
    strictEqual(run(['--yes', '--only', 'deny-rules,settings'], target).status, 0)
    ok(existsSync(join(target, 'settings.json')))
    strictEqual(run(['--uninstall', '--yes'], target).status, 0)
    ok(!existsSync(join(target, 'settings.json')))
  })

  it('settings: a plugin user gets attribution but no second copy of the plugin hook', () => {
    const target = makeTarget()
    writeFileSync(join(target, 'settings.json'), JSON.stringify({ enabledPlugins: { 'senior-dev-kit@m': true } }), 'utf8')
    const res = run(['--yes'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(res.stdout.includes('plugin is enabled'), res.stdout)
    const installed = JSON.parse(readFileSync(join(target, 'settings.json'), 'utf8'))
    deepStrictEqual(installed.attribution, { commit: '', pr: '', sessionUrl: false })
    strictEqual(installed.hooks, undefined)
    ok(!existsSync(join(target, 'agents')), 'agents come from the plugin')
    ok(existsSync(join(target, 'rules', '000-security.md')))
  })

  it('statusline: opt-in, and never replaces a statusLine the user already has', () => {
    const target = makeTarget()
    const mine = { type: 'command', command: 'my-line' }
    writeFileSync(join(target, 'settings.json'), JSON.stringify({ statusLine: mine }), 'utf8')
    strictEqual(run(['--yes'], target).status, 0)
    ok(!existsSync(join(target, 'scripts', 'senior-dev-kit', 'statusline.mjs')), 'not part of the default set')

    const res = run(['--yes', '--only', 'statusline'], target)
    strictEqual(res.status, 0, res.stderr)
    ok(res.stdout.includes('yours wins'), res.stdout)
    deepStrictEqual(JSON.parse(readFileSync(join(target, 'settings.json'), 'utf8')).statusLine, mine)
  })

  it('upgrade: removes a file the kit stopped shipping, keeps one the user edited', () => {
    const target = makeTarget()
    strictEqual(run(['--yes', '--only', 'rules'], target).status, 0)
    const manifestPath = join(target, '.senior-dev-kit', 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const retiredBody = 'retired rule\n'
    const editedBody = 'edited by user\n'
    writeFileSync(join(target, 'rules', '999-retired.md'), retiredBody, 'utf8')
    writeFileSync(join(target, 'rules', '998-edited.md'), editedBody, 'utf8')
    manifest.files.push({ path: 'rules/999-retired.md', sha: createHash('sha256').update(retiredBody).digest('hex') })
    manifest.files.push({ path: 'rules/998-edited.md', sha: 'not-the-current-sha' })
    writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8')

    const drift = run(['--check'], target)
    strictEqual(drift.status, 1)
    ok(drift.stderr.includes('retired  rules/999-retired.md'), drift.stderr)

    strictEqual(run(['--yes', '--only', 'rules'], target).status, 0)
    ok(!existsSync(join(target, 'rules', '999-retired.md')))
    strictEqual(readFileSync(join(target, 'rules', '998-edited.md'), 'utf8'), editedBody)
    const after = JSON.parse(readFileSync(manifestPath, 'utf8'))
    ok(!after.files.some(f => f.path.startsWith('rules/99')), 'neither is the kit’s any more')
  })

  it('uninstall refuses rather than forgetting what it added when settings.json is broken', () => {
    const target = makeTarget()
    strictEqual(run(['--yes', '--only', 'deny-rules'], target).status, 0)
    writeFileSync(join(target, 'settings.json'), '{ broken', 'utf8')
    const res = run(['--uninstall', '--yes'], target)
    strictEqual(res.status, 1)
    ok(res.stderr.includes('not valid JSON'), res.stderr)
    ok(existsSync(join(target, '.senior-dev-kit', 'manifest.json')), 'the record of added rules survives')
  })
})
