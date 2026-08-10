#!/usr/bin/env node
/**
 * Validates the Claude Code plugin and marketplace manifests against the
 * components actually on disk.
 *
 * The failure mode this exists to prevent is silent: a plugin manifest that
 * lists component paths explicitly (as this one must, to keep the frontmatter-
 * less `agents/ROUTING.md` out of the agent scan) stops mentioning a component
 * the moment someone adds a file and forgets the manifest. Nothing breaks in
 * the repo, `npm run validate` still passes, and the component simply never
 * loads for anyone who installed the kit as a plugin. Every check below is
 * derived from disk rather than hand-maintained, in the same spirit as
 * check-consistency.ts.
 *
 * Usage: node --experimental-strip-types scripts/check-plugin.ts
 */
import { existsSync, readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { parseFrontmatter } from './lib/frontmatter.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.PLUGIN_ROOT ?? join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const errors: string[] = []
const notes: string[] = []

// Reserved by Anthropic for official marketplaces; a marketplace registered
// under one of these stops loading entirely rather than failing loudly at add
// time, so catching it here is the only cheap signal.
const RESERVED_MARKETPLACE_NAMES = new Set([
  'claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official',
  'claude-plugins-community', 'claude-community', 'anthropic-marketplace',
  'anthropic-plugins', 'agent-skills', 'anthropic-agent-skills',
  'knowledge-work-plugins', 'life-sciences', 'claude-for-legal',
  'claude-for-financial-services', 'financial-services-plugins',
  'first-party-plugins', 'healthcare',
])

/** Claude Code strips these from plugin-shipped agents for security reasons. */
const STRIPPED_AGENT_FIELDS = ['permissionMode', 'hooks', 'mcpServers']

interface PluginManifest {
  name?: string
  version?: string
  agents?: string | string[]
  commands?: string | string[]
  skills?: string | string[]
  hooks?: string | string[] | Record<string, unknown>
  [key: string]: unknown
}

function readJson<T>(rel: string): T | null {
  if (!existsSync(join(ROOT, rel))) {
    errors.push(`${rel} is missing — the plugin cannot be installed without it`)
    return null
  }
  try {
    return JSON.parse(read(rel)) as T
  } catch (e) {
    errors.push(`${rel} is not valid JSON: ${(e as Error).message}`)
    return null
  }
}

const pkgVersion: string = existsSync(join(ROOT, 'package.json'))
  ? (JSON.parse(read('package.json')).version ?? '')
  : ''

// --- 1. plugin.json ---------------------------------------------------------
const plugin = readJson<PluginManifest>('.claude-plugin/plugin.json')
if (plugin) {
  if (!plugin.name) {
    errors.push('.claude-plugin/plugin.json has no "name" — the only required manifest field')
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name)) {
    errors.push(`.claude-plugin/plugin.json name "${plugin.name}" is not kebab-case`)
  }

  // Version drift: package.json is where a release gets bumped, but the value
  // users actually see in /plugin comes from these manifests. Three copies of
  // one number with nothing comparing them is exactly the class check-
  // consistency.ts was built for.
  if (pkgVersion && plugin.version && plugin.version !== pkgVersion) {
    errors.push(`.claude-plugin/plugin.json version "${plugin.version}" != package.json version "${pkgVersion}"`)
  }

  // Every declared component path must start with "./" and exist. An absolute
  // path or a "../" escape makes the plugin fail to load at install time, on
  // the user's machine, with an error they cannot act on.
  const pathFields: [string, unknown][] = [
    ['agents', plugin.agents],
    ['commands', plugin.commands],
    ['skills', plugin.skills],
    ['hooks', typeof plugin.hooks === 'string' || Array.isArray(plugin.hooks) ? plugin.hooks : undefined],
    ['outputStyles', plugin.outputStyles],
    ['mcpServers', typeof plugin.mcpServers === 'string' ? plugin.mcpServers : undefined],
  ]
  for (const [field, value] of pathFields) {
    if (value === undefined || value === null) continue
    for (const p of Array.isArray(value) ? value : [value]) {
      if (typeof p !== 'string') continue
      if (!p.startsWith('./') && p !== '.') {
        errors.push(`.claude-plugin/plugin.json "${field}" path "${p}" must be relative and start with "./"`)
        continue
      }
      if (!existsSync(join(ROOT, p))) {
        errors.push(`.claude-plugin/plugin.json "${field}" path "${p}" does not exist on disk`)
      }
    }
  }

  // --- 2. the agents list is complete -------------------------------------
  // `agents` REPLACES the default `agents/` scan, which is why it is declared
  // at all: ROUTING.md lives in that directory and has no frontmatter, so a
  // default scan would try to load it as an agent. The cost of opting out is
  // that the list is now hand-maintained — this check re-derives it.
  if (plugin.agents) {
    const declared = new Set(
      (Array.isArray(plugin.agents) ? plugin.agents : [plugin.agents]).map(p => p.replace(/^\.\//, ''))
    )
    const onDisk = existsSync(join(ROOT, 'agents'))
      ? readdirSync(join(ROOT, 'agents'))
          .filter(f => f.endsWith('.md'))
          .filter(f => parseFrontmatter(read(`agents/${f}`))?.name)
          .map(f => `agents/${f}`)
      : []
    for (const file of onDisk) {
      if (!declared.has(file)) {
        errors.push(
          `agents/ contains "${file}" but .claude-plugin/plugin.json does not list it — ` +
            `it would silently never load for plugin users (the "agents" field replaces the default scan)`
        )
      }
    }
    for (const file of declared) {
      if (!onDisk.includes(file)) {
        errors.push(`.claude-plugin/plugin.json lists "${file}", which is not an agent file with frontmatter on disk`)
      }
    }
    // ROUTING.md is the reason this field exists; assert it stays excluded.
    if (declared.has('agents/ROUTING.md')) {
      errors.push('.claude-plugin/plugin.json lists agents/ROUTING.md — it has no frontmatter and is not an agent')
    }
  }

  // --- 3. hooks resolve ----------------------------------------------------
  const hooksPath = typeof plugin.hooks === 'string' ? plugin.hooks : null
  if (hooksPath && existsSync(join(ROOT, hooksPath))) {
    try {
      const hooksConfig = JSON.parse(read(hooksPath)) as { hooks?: Record<string, unknown[]> }
      const commands = JSON.stringify(hooksConfig).match(/\$\{CLAUDE_PLUGIN_ROOT\}\/[^"\\ ]+/g) ?? []
      for (const ref of commands) {
        const rel = ref.replace('${CLAUDE_PLUGIN_ROOT}/', '')
        if (!existsSync(join(ROOT, rel))) {
          errors.push(`${hooksPath} references "${ref}" but ${rel} does not exist`)
        }
      }
      if (!hooksConfig.hooks || Object.keys(hooksConfig.hooks).length === 0) {
        errors.push(`${hooksPath} has no "hooks" object — the file would load but register nothing`)
      }
    } catch (e) {
      errors.push(`${hooksPath} is not valid JSON: ${(e as Error).message}`)
    }
  }
}

// --- 4. agents that claim plan mode must actually be read-only --------------
// `permissionMode` is one of the fields Claude Code strips from plugin-shipped
// agents, so for anyone installing via the marketplace it is decoration. The
// property that still holds under a plugin install is the tool grant. Any agent
// documented as a read-only planner therefore has to earn that with its tools,
// not with a field that will be discarded — SECURITY.md makes exactly this
// claim, and this check is what keeps it true.
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit']
if (existsSync(join(ROOT, 'agents'))) {
  for (const file of readdirSync(join(ROOT, 'agents')).filter(f => f.endsWith('.md'))) {
    const fm = parseFrontmatter(read(`agents/${file}`))
    if (!fm?.name) continue
    if (fm.permissionMode?.trim() === 'plan') {
      const tools = (fm.tools ?? '').split(',').map(t => t.trim())
      const writeGrants = tools.filter(t => WRITE_TOOLS.includes(t))
      if (writeGrants.length > 0) {
        errors.push(
          `agents/${file} declares permissionMode: plan but grants write tool(s) [${writeGrants.join(', ')}] — ` +
            `Claude Code strips permissionMode from plugin-shipped agents, so the tool grant is the only ` +
            `thing enforcing read-only. Remove the write tools or drop the plan-mode claim.`
        )
      }
    }
    for (const field of STRIPPED_AGENT_FIELDS) {
      if (field !== 'permissionMode' && fm[field] !== undefined) {
        errors.push(
          `agents/${file} sets "${field}", which Claude Code strips from plugin-shipped agents — ` +
            `it would work in a ~/.claude install and silently not in a plugin install`
        )
      }
    }
  }
}

// --- 4b. the shipped version has a CHANGELOG entry --------------------------
// A plugin's `version` is what pins updates: users receive a new build only
// when this string changes. Bumping it is therefore a release, and a release
// with no changelog heading leaves every installed user with a silent update
// and no way to find out what moved. Cheap to state, easy to forget.
if (pkgVersion && existsSync(join(ROOT, 'CHANGELOG.md'))) {
  const changelog = read('CHANGELOG.md')
  const escaped = pkgVersion.replace(/\./g, '\\.')
  if (!new RegExp(`^##\\s*\\[?${escaped}\\]?`, 'm').test(changelog)) {
    errors.push(
      `CHANGELOG.md has no "## [${pkgVersion}]" heading, but that is the version the plugin manifests ship — ` +
        `either add the entry or leave the version at the last released one`
    )
  }
}

// --- 5. marketplace.json ----------------------------------------------------
interface MarketplaceEntry {
  name?: string
  source?: unknown
  version?: string
  [key: string]: unknown
}
const marketplace = readJson<{
  name?: string
  owner?: { name?: string }
  plugins?: MarketplaceEntry[]
}>('.claude-plugin/marketplace.json')
if (marketplace) {
  if (!marketplace.name) errors.push('.claude-plugin/marketplace.json has no "name"')
  else if (RESERVED_MARKETPLACE_NAMES.has(marketplace.name)) {
    errors.push(`.claude-plugin/marketplace.json name "${marketplace.name}" is reserved for Anthropic and will not load`)
  }
  if (!marketplace.owner?.name) errors.push('.claude-plugin/marketplace.json has no "owner.name" (required)')
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    errors.push('.claude-plugin/marketplace.json has no "plugins" entries')
  } else {
    for (const entry of marketplace.plugins) {
      if (!entry.name) {
        errors.push('.claude-plugin/marketplace.json has a plugin entry with no "name"')
        continue
      }
      if (entry.source === undefined) {
        errors.push(`marketplace entry "${entry.name}" has no "source"`)
      } else if (typeof entry.source === 'string') {
        if (!entry.source.startsWith('./')) {
          errors.push(`marketplace entry "${entry.name}" source "${entry.source}" must start with "./"`)
        } else if (!existsSync(join(ROOT, entry.source))) {
          errors.push(`marketplace entry "${entry.name}" source "${entry.source}" does not exist`)
        }
      }
      if (pkgVersion && entry.version && entry.version !== pkgVersion) {
        errors.push(`marketplace entry "${entry.name}" version "${entry.version}" != package.json version "${pkgVersion}"`)
      }
      // The marketplace entry name — not plugin.json's — is what keys
      // `enabledPlugins` and what users type. Keeping them identical is the
      // only way `/plugin install <name>@<marketplace>` matches the docs.
      if (plugin?.name && entry.source === './' && entry.name !== plugin.name) {
        errors.push(
          `marketplace entry "${entry.name}" points at the marketplace root but plugin.json is named ` +
            `"${plugin.name}" — the marketplace name wins at install time, so the two must match`
        )
      }
    }
  }
}

// --- 6. skills and commands are discoverable by the default scan ------------
// Neither is declared in plugin.json, so both rely on Claude Code's default
// directory scan. That is fine — but a skill directory with no SKILL.md, or a
// commands/ file that is not Markdown, is invisible in a way nothing else here
// reports for the plugin path specifically.
if (existsSync(join(ROOT, 'skills'))) {
  const skillDirs = readdirSync(join(ROOT, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory())
  for (const dir of skillDirs) {
    if (!existsSync(join(ROOT, 'skills', dir.name, 'SKILL.md'))) {
      errors.push(`skills/${dir.name}/ has no SKILL.md — it will not load as a plugin skill`)
    }
  }
  notes.push(`${skillDirs.length} skills discoverable by the default skills/ scan`)
}
if (existsSync(join(ROOT, 'commands'))) {
  const cmds = readdirSync(join(ROOT, 'commands')).filter(f => f.endsWith('.md'))
  notes.push(`${cmds.length} commands discoverable by the default commands/ scan`)
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} plugin manifest issue(s) found:\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ .claude-plugin/plugin.json valid (name: ${plugin?.name}, version: ${plugin?.version}).`)
console.log(`✓ .claude-plugin/marketplace.json valid (marketplace: ${marketplace?.name}).`)
console.log(`✓ Manifest versions match package.json (${pkgVersion}).`)
console.log(`✓ Declared agent paths match the agent files on disk.`)
console.log(`✓ No agent relies on a frontmatter field that plugin installs strip.`)
for (const n of notes) console.log(`✓ ${n}.`)
process.exit(0)
