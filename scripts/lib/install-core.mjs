/**
 * Pure logic behind `scripts/install.mjs`, kept free of filesystem and process
 * access so every decision the installer makes is unit-testable.
 *
 * Written as plain ESM JavaScript rather than TypeScript on purpose: the
 * installer is the first thing a new user runs, and `node scripts/install.mjs`
 * has to work on whatever Node they already have (18+). The rest of
 * `scripts/` is TypeScript because it only ever runs on a contributor's
 * machine, where the repo's Node 24 floor applies.
 *
 * The two operations that can destroy user data — writing `~/.claude/CLAUDE.md`
 * and writing `~/.claude/settings.json` — are both implemented here as pure
 * functions that take the existing content and return the new content, so
 * "does this preserve what the user already had" is a test, not a hope.
 */

/** Markers delimiting the region of `~/.claude/CLAUDE.md` this kit owns. */
export const BLOCK_BEGIN = '<!-- BEGIN senior-dev-kit -->'
export const BLOCK_END = '<!-- END senior-dev-kit -->'

const BLOCK_NOTE =
  '<!-- Managed by senior-dev-kit. Edits between these markers are replaced on reinstall.\n' +
  '     Put your own instructions OUTSIDE the markers — those are preserved. -->'

/**
 * Wrap the kit's global protocol in its managed-block markers.
 *
 * @param {string} body Contents of the repo's `global-CLAUDE.md`.
 * @returns {string}
 */
export function buildManagedBlock(body) {
  return `${BLOCK_BEGIN}\n${BLOCK_NOTE}\n\n${body.trim()}\n${BLOCK_END}`
}

/**
 * The kit protocol's own title, with any trailing version token dropped, used
 * to recognise an unmarked copy of an *older* release of the same document.
 * Derived from the body rather than hardcoded so bumping "v4.0" cannot quietly
 * turn the detection off.
 *
 * @param {string} body Contents of the repo's `global-CLAUDE.md`.
 * @returns {string | null}
 */
export function protocolAnchor(body) {
  const heading = body.split('\n').find(line => /^#\s+\S/.test(line))
  if (!heading) return null
  const title = heading
    .replace(/^#\s+/, '')
    .replace(/\s+v\d[\w.]*\s*$/i, '')
    .trim()
  return title === '' ? null : title
}

/**
 * Splice the kit's managed block into a user's existing `CLAUDE.md`.
 *
 * Three cases, and the reason this function exists at all: the kit's previous
 * install instructions were `cp global-CLAUDE.md ~/.claude/CLAUDE.md`, which
 * silently destroyed whatever global instructions the user already had. A
 * marker-delimited block makes reinstalling idempotent and leaves everything
 * the user wrote outside the markers untouched.
 *
 * `legacyCopy` covers the other half of that history: everyone who followed the
 * old `cp` instructions has an unmarked copy of the protocol sitting in
 * `CLAUDE.md`. Appending the managed block to it would load the whole protocol
 * twice on every turn of every session — the single most expensive silent
 * regression this kit can inflict, and invisible in a diff of the install
 * output. Detected here; refused by the caller.
 *
 * @param {string | null | undefined} existing Current file contents, or null if absent.
 * @param {string} body Contents of the repo's `global-CLAUDE.md`.
 * @returns {{ text: string, mode: 'created' | 'replaced' | 'appended', legacyCopy: boolean }}
 */
export function spliceManagedBlock(existing, body) {
  const block = buildManagedBlock(body)
  if (existing === null || existing === undefined || existing.trim() === '') {
    return { text: `${block}\n`, mode: 'created', legacyCopy: false }
  }
  const start = existing.indexOf(BLOCK_BEGIN)
  const end = existing.indexOf(BLOCK_END)
  // Only treat it as a managed block when both markers are present AND ordered.
  // A file containing just BLOCK_END (say, pasted out of context) would
  // otherwise produce a negative-length slice and corrupt the user's file.
  if (start !== -1 && end !== -1 && end > start) {
    const text = existing.slice(0, start) + block + existing.slice(end + BLOCK_END.length)
    return { text, mode: 'replaced', legacyCopy: false }
  }
  const anchor = protocolAnchor(body)
  return {
    text: `${existing.trimEnd()}\n\n${block}\n`,
    mode: 'appended',
    legacyCopy: Boolean(anchor) && existing.includes(anchor),
  }
}

/**
 * 1-based line number of the unmarked protocol copy `spliceManagedBlock`
 * flagged, so the refusal can point at it instead of describing it.
 *
 * @param {string} existing
 * @param {string} body
 * @returns {number | null}
 */
export function legacyCopyLine(existing, body) {
  const anchor = protocolAnchor(body)
  if (!anchor || !existing) return null
  const index = existing.split('\n').findIndex(line => line.includes(anchor))
  return index === -1 ? null : index + 1
}

/**
 * Remove the kit's managed block, leaving the user's own content intact.
 *
 * @param {string | null | undefined} existing
 * @returns {{ text: string, removed: boolean }}
 */
export function removeManagedBlock(existing) {
  if (!existing) return { text: '', removed: false }
  const start = existing.indexOf(BLOCK_BEGIN)
  const end = existing.indexOf(BLOCK_END)
  if (start === -1 || end === -1 || end < start) return { text: existing, removed: false }
  const text = (existing.slice(0, start).trimEnd() + '\n' + existing.slice(end + BLOCK_END.length).trimStart()).trim()
  return { text: text === '' ? '' : `${text}\n`, removed: true }
}

/**
 * Merge the kit's deny rules into a user's existing settings object.
 *
 * Union, never replacement: the user's own deny rules and every other settings
 * key (`allow`, `ask`, `env`, `hooks`, `model`, …) survive untouched. Order is
 * existing-first so a diff of the file reads as pure additions.
 *
 * @param {Record<string, unknown> | null | undefined} existing Parsed `~/.claude/settings.json`.
 * @param {string[]} kitDenyRules `permissions.deny` from `settings-template.json`.
 * @returns {{ settings: Record<string, unknown>, added: string[] }}
 */
export function mergeDenyRules(existing, kitDenyRules) {
  const settings = existing && typeof existing === 'object' ? structuredClone(existing) : {}
  const permissions =
    settings.permissions && typeof settings.permissions === 'object' ? { ...settings.permissions } : {}
  const currentDeny = Array.isArray(permissions.deny) ? permissions.deny : []
  const seen = new Set(currentDeny)
  const added = kitDenyRules.filter(rule => !seen.has(rule))
  permissions.deny = [...currentDeny, ...added]
  settings.permissions = permissions
  return { settings, added }
}

/**
 * Drop exactly the deny rules a previous install added, leaving the user's own
 * rules — including any that happen to be identical to a kit rule they had
 * written themselves before installing — alone. That distinction is why
 * uninstall reads the recorded `added` list instead of subtracting the current
 * template: the template is what we *could* have added, the manifest is what we
 * actually did.
 *
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {string[]} addedRules Rules recorded in the install manifest.
 * @returns {{ settings: Record<string, unknown>, removed: string[] }}
 */
export function unmergeDenyRules(existing, addedRules) {
  const settings = existing && typeof existing === 'object' ? structuredClone(existing) : {}
  const permissions =
    settings.permissions && typeof settings.permissions === 'object' ? { ...settings.permissions } : {}
  const currentDeny = Array.isArray(permissions.deny) ? permissions.deny : []
  const toRemove = new Set(addedRules)
  const removed = currentDeny.filter(rule => toRemove.has(rule))
  permissions.deny = currentDeny.filter(rule => !toRemove.has(rule))
  settings.permissions = permissions
  return { settings, removed }
}

/**
 * Classify what installing a file would do, so `--dry-run` can report it and
 * the confirmation prompt can show a truthful count.
 *
 * @param {{ exists: boolean, identical: boolean }} state
 * @returns {'create' | 'unchanged' | 'overwrite'}
 */
export function classifyFileAction(state) {
  if (!state.exists) return 'create'
  return state.identical ? 'unchanged' : 'overwrite'
}

/**
 * Filesystem-safe timestamp for a backup directory name. Takes the clock as an
 * argument so tests are deterministic.
 *
 * @param {Date} now
 * @returns {string}
 */
export function backupStamp(now) {
  return now.toISOString().replace(/[:.]/g, '-').replace('Z', '')
}

/**
 * Parse argv into the installer's options. Unknown flags are collected rather
 * than ignored — a typo'd `--dryrun` silently running a real install is the
 * exact failure mode this installer exists to prevent.
 *
 * @param {string[]} argv
 * @returns {{ dryRun: boolean, yes: boolean, uninstall: boolean, help: boolean, allowDuplicateProtocol: boolean, target: string | null, components: string[] | null, unknown: string[] }}
 */
export function parseArgs(argv) {
  const opts = {
    dryRun: false,
    yes: false,
    uninstall: false,
    check: false,
    help: false,
    allowDuplicateProtocol: false,
    /** @type {string | null} */ target: null,
    /** @type {string[] | null} */ components: null,
    /** @type {string[]} */ unknown: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run' || arg === '-n') opts.dryRun = true
    else if (arg === '--yes' || arg === '-y') opts.yes = true
    else if (arg === '--uninstall') opts.uninstall = true
    // Read-only drift report for the gate: implies --dry-run so no combination of
    // flags can make a check step write to the user's ~/.claude.
    else if (arg === '--check') {
      opts.check = true
      opts.dryRun = true
    }
    else if (arg === '--allow-duplicate-protocol') opts.allowDuplicateProtocol = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--target') opts.target = argv[++i] ?? null
    else if (arg.startsWith('--target=')) opts.target = arg.slice('--target='.length)
    else if (arg === '--only') opts.components = (argv[++i] ?? '').split(',').filter(Boolean)
    else if (arg.startsWith('--only=')) opts.components = arg.slice('--only='.length).split(',').filter(Boolean)
    else opts.unknown.push(arg)
  }
  return opts
}

/** Component names accepted by `--only`, in install order. */
export const COMPONENTS = ['agents', 'skills', 'commands', 'rules', 'agent_docs', 'presets', 'protocol', 'deny-rules']

/**
 * @param {string[] | null} requested
 * @returns {{ selected: string[], invalid: string[] }}
 */
export function resolveComponents(requested) {
  if (!requested) return { selected: [...COMPONENTS], invalid: [] }
  const invalid = requested.filter(c => !COMPONENTS.includes(c))
  return { selected: COMPONENTS.filter(c => requested.includes(c)), invalid }
}
