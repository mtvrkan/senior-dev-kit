#!/usr/bin/env node
// Generates docs/reference.md from the frontmatter of every agent, skill, rule
// and command on disk.
//
// Why generate rather than hand-write: a reference page listing "these are the
// 7 agents and what each one does" is exactly the shape of artefact this repo
// has had to repair in five separate audit rounds — a hand-copied list with no
// link to its source of truth, correct on the day it was written and quietly
// wrong three commits later. The counts in README.md are already re-derived by
// check-consistency.ts; this does the same for the prose reference a stranger
// actually reads.
//
// Usage:
//   node --experimental-strip-types scripts/gen-docs.ts            # write
//   node --experimental-strip-types scripts/gen-docs.ts --check    # verify, exit 1 on drift
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseFrontmatter, getFrontmatterList } from './lib/frontmatter.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_FILE = join(ROOT, 'docs', 'reference.md')

const BANNER =
  '<!-- GENERATED FILE — do not edit by hand.\n' +
  '     Source of truth: the frontmatter of agents/*.md, skills/*/SKILL.md, rules/*.md and\n' +
  '     commands/*.md. Regenerate with `npm run gen-docs`; `npm run docs-check` fails the\n' +
  '     gate when this file and that frontmatter disagree. -->'

// A table cell cannot contain a raw pipe or a line break.
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ').trim()
}

function mdFiles(dir: string, exclude: string[] = []): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && !exclude.includes(f))
    .sort()
}

// Skills Claude Code will never auto-invoke. Everywhere they are named, they are
// named in slash form — see the note in skillsSection() and the check in
// scripts/lib/validate-skills.ts that enforces it across every user-facing doc.
function manualOnlySkills(): Set<string> {
  const dir = join(ROOT, 'skills')
  const manual = new Set<string>()
  if (!existsSync(dir)) return manual
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'SKILL.md')
    if (!existsSync(file)) continue
    const fm = parseFrontmatter(readFileSync(file, 'utf8'))
    if (fm?.['disable-model-invocation']?.trim() === 'true') manual.add(name)
  }
  return manual
}

function skillRef(name: string, manual: Set<string>): string {
  return manual.has(name) ? `\`/${name}\`` : `\`${name}\``
}

// Claude Code strips permissionMode from plugin-shipped agents, so the plan-mode line has to say
// which install path it holds for. SECURITY.md carries the same caveat; if one moves, move both.
const PLAN_MODE_CAVEAT =
  ' — plans first instead of acting. Claude Code strips `permissionMode` from plugin-shipped' +
  ' agents, so this holds for `~/.claude` installs; the tool grant above is what holds in both'

function agentsSection(): string {
  const dir = join(ROOT, 'agents')
  const manual = manualOnlySkills()
  const rows: string[] = []
  const detail: string[] = []
  for (const file of mdFiles(dir, ['ROUTING.md', 'README.md'])) {
    const content = readFileSync(join(dir, file), 'utf8')
    const fm = parseFrontmatter(content) ?? {}
    const name = fm.name ?? file.replace(/\.md$/, '')
    const tools = (fm.tools ?? '').split(',').map(t => t.trim()).filter(Boolean)
    const writes = tools.some(t => t === 'Edit' || t === 'Write')
    const skills = getFrontmatterList(content, 'skills') ?? []
    rows.push(
      `| \`${name}\` | ${fm.model ?? '—'} | ${writes ? 'read + write' : '**read-only**'} | ${cell(skills.map(s => skillRef(s, manual)).join(', ') || '—')} |`
    )
    detail.push(
      `### \`${name}\`\n\n` +
        `${cell(fm.description ?? '')}\n\n` +
        `- **Tools:** ${tools.map(t => `\`${t}\``).join(', ') || '—'}\n` +
        `- **Model / effort:** ${fm.model ?? '—'} · ${fm.effort ?? '—'}\n` +
        `- **Permission mode:** \`${fm.permissionMode ?? 'default'}\`${fm.permissionMode === 'plan' ? PLAN_MODE_CAVEAT : ''}\n` +
        `- **Turn budget:** ${fm.maxTurns ?? '—'}\n` +
        `- **Definition:** [\`agents/${file}\`](../agents/${file})`
    )
  }
  return (
    `## Agents\n\n` +
    `An agent is *who* handles a request: a persona with its own tool grant, model tier and turn\n` +
    `budget. Guards carry no \`Edit\` or \`Write\` tool, so "it will write a plan first" is a property\n` +
    `of the configuration rather than a promise the model has to keep. They do keep \`Bash\` for\n` +
    `read-only investigation, which means their write-prevention is exactly as strong as the deny\n` +
    `rules in [\`SECURITY.md\`](../SECURITY.md) — strong, but not a sandbox.\n\n` +
    `| Agent | Model | Access | Bound skills |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n` +
    `Routing between them is decided by [\`agents/ROUTING.md\`](../agents/ROUTING.md).\n\n` +
    `${detail.join('\n\n')}`
  )
}

function skillsSection(): string {
  const dir = join(ROOT, 'skills')
  if (!existsSync(dir)) return ''
  const manualSet = manualOnlySkills()
  const auto: string[] = []
  const manual: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name, 'SKILL.md')
    if (!existsSync(file)) continue
    const fm = parseFrontmatter(readFileSync(file, 'utf8')) ?? {}
    const manualOnly = manualSet.has(name)
    const bound = fm.agent ? `\`${fm.agent}\`` : 'main loop'
    // Manual-only skills are always written in slash form: they are something
    // you type, never somewhere routing sends you. validate-skills.ts enforces
    // this across every user-facing doc, this generated page included.
    const row = `| ${skillRef(name, manualSet)} | ${cell(fm.when_to_use ?? fm.description ?? '')} | ${bound} |`
    ;(manualOnly ? manual : auto).push(row)
  }
  return (
    `## Skills\n\n` +
    `A skill is *how* a task gets done: a written procedure any agent can follow. Most fire on\n` +
    `their own when the request matches their shape — you never type their name.\n\n` +
    `### Auto-triggered\n\n` +
    `| Skill | Fires when | Runs in |\n| --- | --- | --- |\n${auto.join('\n')}\n\n` +
    `### Manual only\n\n` +
    `These set \`disable-model-invocation: true\`. Claude Code will **never** trigger them on its\n` +
    `own however well a request matches — they run only when you type the slash command.\n\n` +
    `| Command | Use it when | Runs in |\n| --- | --- | --- |\n${manual.join('\n')}`
  )
}

function rulesSection(): string {
  const dir = join(ROOT, 'rules')
  const rows: string[] = []
  for (const file of mdFiles(dir)) {
    const content = readFileSync(join(dir, file), 'utf8')
    const fm = parseFrontmatter(content) ?? {}
    const paths = getFrontmatterList(content, 'paths')
    const when = paths?.length
      ? paths.map(p => `\`${p}\``).join(' · ')
      : '**every session** — no `paths:` field'
    const desc = (fm.description ?? '').replace(/^"|"$/g, '')
    rows.push(`| [\`${file}\`](../rules/${file}) | ${cell(when)} | ${cell(desc)} |`)
  }
  return (
    `## Rules\n\n` +
    `Rules are house style, injected automatically. Two load on every turn in every project; the\n` +
    `rest load only once you open a file their \`paths:\` globs match, so a Flutter project never\n` +
    `pays for the REST-API rules.\n\n` +
    `| Rule | Loads when | Governs |\n| --- | --- | --- |\n${rows.join('\n')}`
  )
}

function commandsSection(): string {
  const dir = join(ROOT, 'commands')
  const rows: string[] = []
  for (const file of mdFiles(dir)) {
    const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8')) ?? {}
    const name = file.replace(/\.md$/, '')
    rows.push(`| \`/${name}\` | ${cell(fm.description ?? '')} | ${cell(fm['argument-hint'] ?? '—')} |`)
  }
  return (
    `## Slash commands\n\n` +
    `| Command | What it does | Takes |\n| --- | --- | --- |\n${rows.join('\n')}\n\n` +
    `The manual-only skills listed above are invoked the same way, by typing their name.`
  )
}

export function render(): string {
  return [
    BANNER,
    '',
    '# Reference',
    '',
    'Every component this kit installs, derived from its own frontmatter each time',
    '`npm run gen-docs` runs. If something here disagrees with the files on disk, the gate fails —',
    'so this page cannot quietly go stale the way a hand-written list does.',
    '',
    'New here? Start with [install](install.md), then [usage](usage.md).',
    '',
    '---',
    '',
    agentsSection(),
    '',
    '---',
    '',
    skillsSection(),
    '',
    '---',
    '',
    rulesSection(),
    '',
    '---',
    '',
    commandsSection(),
    '',
  ].join('\n')
}

function main(): void {
  const generated = render()
  const checkMode = process.argv.includes('--check')

  if (checkMode) {
    if (!existsSync(OUT_FILE)) {
      console.error(`  ✗ docs/reference.md is missing — run \`npm run gen-docs\``)
      process.exit(1)
    }
    // Normalise line endings before comparing: a Windows checkout with
    // core.autocrlf=true would otherwise fail on every line.
    const onDisk = readFileSync(OUT_FILE, 'utf8').replace(/\r\n/g, '\n')
    if (onDisk !== generated) {
      console.error(
        '  ✗ docs/reference.md is out of date with the frontmatter it is generated from — run `npm run gen-docs` and commit the result'
      )
      process.exit(1)
    }
    console.log('  ✓ docs/reference.md matches the agent/skill/rule/command frontmatter on disk')
    process.exit(0)
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, generated)
  console.log('  ✓ wrote docs/reference.md')
}

main()
