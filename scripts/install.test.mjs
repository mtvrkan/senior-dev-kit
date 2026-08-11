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
  legacyCopyLine,
  mergeDenyRules,
  parseArgs,
  protocolAnchor,
  removeManagedBlock,
  resolveComponents,
  spliceManagedBlock,
  unmergeDenyRules,
} from './lib/install-core.mjs'

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
})
