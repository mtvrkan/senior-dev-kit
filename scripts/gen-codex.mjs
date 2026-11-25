#!/usr/bin/env node
/**
 * Generates the Codex plugin under `codex/` from the kit's Claude Code sources.
 *
 * The Claude files stay the single source of truth: agents, skills, commands, rules, agent_docs,
 * presets, global-CLAUDE.md and settings-template.json under `claude/` are read here and re-expressed in the
 * shapes Codex loads (skills with name+description frontmatter, custom agents as TOML, hooks,
 * execpolicy rules, a managed AGENTS.md block). Nothing under `codex/` is edited by hand — text
 * that has no mechanical translation lives in `scripts/codex/overrides/` and is spliced in here.
 *
 *   node scripts/gen-codex.mjs           write codex/ and .agents/plugins/marketplace.json
 *   node scripts/gen-codex.mjs --check   exit 1 if what is on disk differs from what would be written
 *   node scripts/gen-codex.mjs --lint    also list Claude-specific wording that survived translation
 *
 * Plain ESM JavaScript for the same reason as install.mjs: it has to run on Node 18+.
 */

import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = 'codex'
const SRC = join(ROOT, 'claude')
const OVERRIDES = join(ROOT, 'scripts', 'codex', 'overrides')
const RUNTIME = join(ROOT, 'scripts', 'codex', 'runtime')
// Codex saves a hook's context to disk past roughly 2,500 tokens and shows the model a preview
// only, so everything injected at session start is cut into parts below that.
const CONTEXT_PART_LIMIT = 8000

const read = path => readFileSync(join(SRC, path), 'utf8')
const posix = path => path.split(sep).join('/')

function walk(dir, base = SRC) {
  const found = []
  for (const name of readdirSync(join(base, dir)).sort()) {
    if (name === '.DS_Store') continue
    const path = join(dir, name)
    if (statSync(join(base, path)).isDirectory()) found.push(...walk(path, base))
    else found.push(posix(path))
  }
  return found
}

export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { data: {}, body: text }
  const data = {}
  let listKey = null
  for (const line of match[1].split('\n')) {
    if (/^\s*#/.test(line) || line.trim() === '') continue
    const item = /^\s+-\s+(.*)$/.exec(line)
    if (item && listKey) {
      data[listKey].push(unquote(item[1]))
      continue
    }
    const pair = /^([A-Za-z_-]+):\s*(.*)$/.exec(line)
    if (!pair) continue
    if (pair[2] === '') {
      listKey = pair[1]
      data[listKey] = []
    } else {
      listKey = null
      data[pair[1]] = unquote(pair[2])
    }
  }
  return { data, body: text.slice(match[0].length) }
}

function unquote(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return JSON.parse(trimmed)
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'")
  return trimmed
}

const yamlString = value => JSON.stringify(value)
const list = value => String(value ?? '').split(',').map(item => item.trim()).filter(Boolean)

const skillNames = readdirSync(join(SRC, 'skills')).filter(name => existsSync(join(SRC, 'skills', name, 'SKILL.md'))).sort()
const commandNames = readdirSync(join(SRC, 'commands')).filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)).sort()
const agentNames = readdirSync(join(SRC, 'agents')).filter(name => name.endsWith('.md') && name !== 'ROUTING.md').map(name => name.slice(0, -3)).sort()
const invocable = [...skillNames, ...commandNames].sort((a, b) => b.length - a.length)
const slashRef = new RegExp(`(?<![\\w./$-])/(${invocable.join('|')})(?![\\w/-]|\\.md)`, 'g')

// Ordered: the specific paths must be rewritten before the bare `~/.claude` and `CLAUDE.md` forms.
const REPLACEMENTS = [
  [/\$\{CLAUDE_PLUGIN_ROOT\}\//g, 'KIT_ROOT/'],
  [/\$\{CLAUDE_PLUGIN_ROOT\}/g, 'KIT_ROOT'],
  [/global-CLAUDE\.md/g, 'protocol.md'],
  [/~\/\.claude\/CLAUDE\.md/g, '~/.codex/AGENTS.md'],
  [/~\/\.claude\/rules\//g, 'KIT_ROOT/rules/'],
  [/~\/\.claude\/settings\.json/g, '~/.codex/config.toml'],
  [/~\/\.claude/g, '~/.codex'],
  [/\.\/\.claude\/CLAUDE\.md/g, './AGENTS.md'],
  [/\.claude\/CLAUDE\.md/g, 'AGENTS.md'],
  [/\bCLAUDE\.md\b/g, 'AGENTS.md'],
  [/Claude Code/g, 'Codex'],
  [slashRef, '$$$1'],
  [/(?<![\w./-])\/clear\b/g, '/new'],
]

// Wording with no mechanical translation. Each entry must still match its source: a miss means
// the Claude file changed underneath it, and the build fails instead of shipping stale text.
const PATCHES = JSON.parse(readFileSync(join(OVERRIDES, 'patches.json'), 'utf8'))
const usedPatches = new Set()

function translate(text, key) {
  let out = text
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement)
  for (const [index, patch] of (PATCHES[key] ?? []).entries()) {
    if (patch.from !== undefined) {
      const start = out.indexOf(patch.from)
      const end = start === -1 ? -1 : out.indexOf(patch.to, start + patch.from.length)
      if (end === -1) throw new Error(`patches.json: "${key}" entry ${index} no longer matches its source:\n  ${patch.from} … ${patch.to}`)
      out = out.slice(0, start) + patch.replace + out.slice(end + patch.to.length)
    } else {
      if (!out.includes(patch.find)) throw new Error(`patches.json: "${key}" entry ${index} no longer matches its source:\n  ${patch.find}`)
      out = out.split(patch.find).join(patch.replace)
    }
    usedPatches.add(`${key}#${index}`)
  }
  return out
}

const files = new Map()
const put = (path, content) => files.set(posix(join(OUT, path)), content)

function executionNote(data) {
  const notes = []
  if (data.context === 'fork') {
    notes.push(
      data.agent
        ? `Codex: run this skill in the \`${data.agent}\` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.`
        : 'Codex: run this skill in a fresh subagent so its reads stay out of the main context, and report its result; if subagents are unavailable, follow the steps inline.'
    )
  }
  const blocked = list(data['disallowed-tools'])
  if (blocked.includes('Edit') || blocked.includes('Write')) notes.push('Read-only: this skill never edits or creates files.')
  return notes
}

function skillFile(name, data, body) {
  const description = [data.description, data.when_to_use].filter(Boolean).join(' ')
  const notes = executionNote(data)
  const heading = /^# .*$/m.exec(body)
  let text = body.replace(/\$ARGUMENTS/g, '<the scope the user gave when invoking this skill; if none, the current change>')
  if (notes.length > 0) {
    const block = notes.map(note => `> ${note}`).join('\n>\n')
    text = heading ? text.replace(heading[0], `${heading[0]}\n\n${block}`) : `${block}\n\n${text}`
  }
  return `---\nname: ${name}\ndescription: ${yamlString(description)}\n---\n${text.startsWith('\n') ? '' : '\n'}${text}`
}

function emitSkill(name, sourcePath, isCommand) {
  const override = join(OVERRIDES, 'skills', name, 'SKILL.md')
  const { data, body } = parseFrontmatter(existsSync(override) ? readFileSync(override, 'utf8') : read(sourcePath))
  const source = parseFrontmatter(read(sourcePath)).data
  const translated = existsSync(override) ? body : translate(body, sourcePath)
  const content = skillFile(name, existsSync(override) ? data : source, isCommand ? translated.replace(`# $${name}`, `# ${name}`).replace(`# /${name}`, `# ${name}`) : translated)
  put(`skills/${name}/SKILL.md`, content)
  if (source['disable-model-invocation'] === 'true') {
    put(`skills/${name}/agents/openai.yaml`, 'policy:\n  allow_implicit_invocation: false\n')
  }
}

for (const name of skillNames) {
  emitSkill(name, `skills/${name}/SKILL.md`, false)
  for (const extra of walk(`skills/${name}`).filter(path => !path.endsWith('/SKILL.md'))) {
    put(extra, extra.endsWith('.md') ? translate(read(extra), extra) : readFileSync(join(SRC, extra)))
  }
}
for (const name of commandNames) emitSkill(name, `commands/${name}.md`, true)

const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh'])

function tomlString(value) {
  return `"""\n${value.replace(/\\/g, '\\\\').replace(/"""/g, '""\\"')}"""`
}

for (const name of agentNames) {
  const { data, body } = parseFrontmatter(read(`agents/${name}.md`))
  const tools = list(data.tools)
  const readOnly = !tools.includes('Edit') && !tools.includes('Write')
  const preface = []
  if (readOnly) preface.push('READ-ONLY AGENT — you never edit, create or delete files. You return a written plan or findings and stop.')
  if (Array.isArray(data.skills) && data.skills.length > 0) {
    preface.push(`Your procedures are the kit skills ${data.skills.map(skill => `\`$${skill}\``).join(', ')} — open the matching one and follow it instead of improvising.`)
  }
  const instructions = `${preface.join('\n')}${preface.length > 0 ? '\n\n' : ''}${translate(body, `agents/${name}.md`).trim()}\n`
  const lines = [`name = ${JSON.stringify(name)}`, `description = ${JSON.stringify(data.description)}`]
  if (EFFORTS.has(data.effort)) lines.push(`model_reasoning_effort = ${JSON.stringify(data.effort)}`)
  if (readOnly) lines.push('sandbox_mode = "read-only"')
  lines.push(`developer_instructions = ${tomlString(instructions)}`)
  put(`agents/${name}.toml`, `${lines.join('\n')}\n`)
}
put('agents/ROUTING.md', translate(read('agents/ROUTING.md'), 'agents/ROUTING.md'))

for (const path of walk('agent_docs')) put(path, translate(read(path), path))
for (const path of walk('presets')) {
  const target = path.replace(/\/CLAUDE\.md$/, '/AGENTS.md')
  put(target, path.endsWith('.md') ? translate(read(path), path) : readFileSync(join(SRC, path)))
}

const rules = []
const alwaysLoaded = []
for (const path of walk('rules')) {
  const { data, body } = parseFrontmatter(read(path))
  const file = path.slice('rules/'.length)
  const translated = translate(body, path)
  put(path, translated.replace(/^\n+/, ''))
  if (Array.isArray(data.paths) && data.paths.length > 0) {
    rules.push({ id: file.replace(/\.md$/, ''), file, description: String(data.description ?? '').split(' — ')[0], paths: data.paths })
  } else {
    alwaysLoaded.push({ file, text: translated.trim() })
  }
}

function replaceSection(text, heading, replacement) {
  const start = text.indexOf(`## ${heading}`)
  if (start === -1) throw new Error(`protocol: section "${heading}" not found`)
  const next = text.indexOf('\n## ', start + 1)
  const divider = text.lastIndexOf('\n---\n', next === -1 ? text.length : next)
  const end = next === -1 ? text.length : divider > start ? divider : next
  return `${text.slice(0, start)}${replacement.trim()}\n${text.slice(end)}`
}

let protocol = translate(read('global-CLAUDE.md'), 'global-CLAUDE.md')
for (const name of readdirSync(join(OVERRIDES, 'protocol')).sort()) {
  const section = readFileSync(join(OVERRIDES, 'protocol', name), 'utf8')
  const heading = /^## (.*)$/m.exec(section)
  if (!heading) throw new Error(`overrides/protocol/${name}: no "## " heading`)
  protocol = replaceSection(protocol, heading[1].split(' — ')[0], section)
}
put('protocol.md', protocol)

function splitParts(text, limit) {
  const pieces = text.split(/(?=^## )/m)
  const parts = []
  let current = ''
  for (const piece of pieces) {
    if (current !== '' && current.length + piece.length > limit) {
      parts.push(current)
      current = ''
    }
    current += piece
  }
  if (current !== '') parts.push(current)
  return parts
}

const context = []
for (const [index, part] of splitParts(protocol.trim(), CONTEXT_PART_LIMIT).entries()) {
  const file = `protocol-${index + 1}.md`
  put(`hooks/context/${file}`, `${part.trim()}\n`)
  context.push({ kind: 'protocol', file })
}
for (const rule of alwaysLoaded) {
  for (const [index, part] of splitParts(rule.text, CONTEXT_PART_LIMIT).entries()) {
    const file = `${rule.file.replace(/\.md$/, '')}-${index + 1}.md`
    put(`hooks/context/${file}`, `ALWAYS-LOADED KIT RULE ${rule.file} (part ${index + 1})\n\n${part.trim()}\n`)
    context.push({ kind: 'rule', file })
  }
}
put('hooks/context/index.json', `${JSON.stringify(context, null, 2)}\n`)

const sessionHooks = []
for (let part = 1; part <= context.length + 1; part += 1) {
  sessionHooks.push({ type: 'command', command: `node "\${PLUGIN_ROOT}/scripts/session-context.mjs" --part ${part}`, timeout: 10 })
}
put(
  'hooks/hooks.json',
  `${JSON.stringify(
    {
      hooks: {
        SessionStart: [{ hooks: sessionHooks }],
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node "${PLUGIN_ROOT}/scripts/guard.mjs"', timeout: 10 }] }],
      },
    },
    null,
    2
  )}\n`
)

const settings = JSON.parse(read('settings-template.json'))
const inner = (rule, tool) => rule.slice(tool.length + 1, -1)
const byTool = (entries, tool) => entries.filter(rule => rule.startsWith(`${tool}(`)).map(rule => inner(rule, tool))
const deny = settings.permissions.deny
const commandDeny = [...byTool(deny, 'Bash'), ...byTool(deny, 'PowerShell')]
put(
  'hooks/guard-data.json',
  `${JSON.stringify({ deny: { commands: commandDeny, read: byTool(deny, 'Read'), edit: byTool(deny, 'Edit') }, rules }, null, 2)}\n`
)

// A Claude `Bash(*git push --force *)` rule is a wildcard over the whole command line; an
// execpolicy prefix_rule matches leading argv words of each chained command. Only the patterns
// that are a plain run of words between the outer `*`s have an exact prefix form — the rest
// (pipes, substitutions, inner wildcards) stay enforced by hooks/guard-data.json alone.
function prefixOf(pattern) {
  const core = pattern.replace(/^\*/, '').replace(/\s?\*$/, '').trim()
  if (core === '' || /[*|<>()"'$`\\~]/.test(core)) return null
  const words = core.split(/\s+/)
  if (!/^[a-z][\w.-]*$/.test(words[0]) || words[0] === 'drop') return null
  if (words.some(word => word === '/' || word === '.' || word === './')) return null
  return words
}

function prefixRules(patterns, decision, justification) {
  const seen = new Set()
  const out = []
  for (const pattern of patterns) {
    const words = prefixOf(pattern)
    if (!words) continue
    const key = words.join(' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`prefix_rule(\n    pattern = ${JSON.stringify(words)},\n    decision = "${decision}",\n    justification = ${JSON.stringify(justification(key))},\n)`)
  }
  return out
}

const promptRules = prefixRules(byTool(settings.permissions.ask ?? [], 'Bash'), 'prompt', key => `Senior Dev Kit: \`${key}\` publishes work — confirm with the user first.`)
const forbiddenRules = prefixRules(byTool(deny, 'Bash'), 'forbidden', key => `Senior Dev Kit: \`${key}\` is on the kit's deny list. Tell the user what you wanted to do instead of retrying it another way.`)
put(
  'command-rules/senior-dev-kit.rules',
  `# Generated by scripts/gen-codex.mjs from settings-template.json. Do not edit.\n# Installed to ~/.codex/rules/ by scripts/install.mjs (\`$kit-setup\`).\n\n${[...promptRules, ...forbiddenRules].join('\n\n')}\n`
)

for (const name of readdirSync(RUNTIME).sort()) put(`scripts/${name}`, readFileSync(join(RUNTIME, name), 'utf8'))

const manifest = JSON.parse(read('.claude-plugin/plugin.json'))
const description = 'Guard agents, auto-triggered skills and path-scoped rules that make Codex behave like a senior engineering team.'
put(
  '.codex-plugin/plugin.json',
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description,
      author: manifest.author,
      homepage: manifest.homepage,
      repository: manifest.repository,
      license: manifest.license,
      keywords: manifest.keywords,
      skills: './skills/',
      hooks: './hooks/hooks.json',
      interface: {
        displayName: manifest.displayName,
        shortDescription: 'A senior engineering team for Codex',
        longDescription: description,
        developerName: manifest.author.name,
        category: 'Coding',
        capabilities: ['Interactive', 'Write'],
        websiteURL: manifest.homepage,
        defaultPrompt: ['Run $kit-setup to finish installing Senior Dev Kit', 'Use $codebase-overview to map this project'],
      },
    },
    null,
    2
  )}\n`
)
put('README.md', readFileSync(join(OVERRIDES, 'README.md'), 'utf8'))

files.set(
  '.agents/plugins/marketplace.json',
  `${JSON.stringify(
    {
      name: manifest.name,
      interface: { displayName: manifest.displayName },
      plugins: [
        {
          name: manifest.name,
          source: { source: 'local', path: `./${OUT}` },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          category: 'Coding',
        },
      ],
    },
    null,
    2
  )}\n`
)

for (const [key, patches] of Object.entries(PATCHES)) {
  patches.forEach((_, index) => {
    if (!usedPatches.has(`${key}#${index}`)) throw new Error(`patches.json: "${key}" entry ${index} was never applied — is the path right?`)
  })
}

const LEFTOVER = /claude|haiku|sonnet|opus\b|Agent\(|subagent_type|AskUserQuestion|NotebookEdit|Skill tool|settings\.json|allowed-tools|disallowed-tools|when_to_use|\$ARGUMENTS|reload-plugins/i
const ACCEPTED = /\.claude\/(TECH-DEBT|PROJECT-MEMORY|HANDOFF|codebase-overview)\.md|\.claude-plugin|CLAUDE_PLUGIN_ROOT/

function lint() {
  let count = 0
  for (const [path, content] of files) {
    if (typeof content !== 'string' || !/\.(md|toml|rules)$/.test(path)) continue
    content.split('\n').forEach((line, index) => {
      if (LEFTOVER.test(line.replace(new RegExp(ACCEPTED.source, 'g'), ''))) {
        count += 1
        console.log(`${path}:${index + 1}: ${line.trim().slice(0, 200)}`)
      }
    })
  }
  console.log(`\n${count} line(s) still carry Claude-specific wording.`)
}

function existing() {
  const found = []
  if (existsSync(join(ROOT, OUT))) found.push(...walk(OUT, ROOT))
  return found
}

const mode = process.argv[2]
if (mode === '--lint') {
  lint()
} else if (mode === '--check') {
  const drift = []
  for (const [path, content] of files) {
    const full = join(ROOT, path)
    if (!existsSync(full)) drift.push(`missing  ${path}`)
    else if (!readFileSync(full).equals(Buffer.from(content))) drift.push(`stale    ${path}`)
  }
  for (const path of existing()) if (!files.has(path)) drift.push(`extra    ${path}`)
  if (drift.length > 0) {
    console.log(`✗ codex/ is out of date with the Claude sources:\n  ${drift.join('\n  ')}\n\n  Fix: node scripts/gen-codex.mjs`)
    process.exitCode = 1
  } else {
    console.log(`✓ codex/ matches the Claude sources (${files.size} files).`)
  }
} else {
  for (const path of existing()) if (!files.has(path)) rmSync(join(ROOT, path))
  for (const [path, content] of files) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true })
    writeFileSync(join(ROOT, path), content)
  }
  console.log(`Wrote ${files.size} files: ${skillNames.length + commandNames.length} skills, ${agentNames.length} agents, ${rules.length + alwaysLoaded.length} rules, ${context.length + 1} session-context parts.`)
  console.log(`Prefix rules: ${promptRules.length} prompt, ${forbiddenRules.length} forbidden. Hook deny patterns: ${commandDeny.length} command, ${byTool(deny, 'Read').length} read, ${byTool(deny, 'Edit').length} edit.`)
  console.log(`Output: ${relative(process.cwd(), join(ROOT, OUT)) || '.'}`)
}
