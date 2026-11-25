#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  READ_VERBS,
  WRITE_VERBS,
  commandPatternToRegExp,
  compilePathPatterns,
  matchPath,
  patchPaths,
  pathForms,
  pathTokens,
  redirectTargets,
  splitSegments,
  tokenize,
  verbOf,
} from './lib.mjs'

const SHELL_TOOLS = new Set(['bash', 'shell', 'exec_command', 'local_shell', 'unified_exec', 'powershell'])
const PATCH_TOOLS = new Set(['apply_patch', 'edit', 'write'])

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Senior Dev Kit guard: ${reason.replace(/\.$/, "")}`,
    },
  }
}

export function checkCommand(command, cwd, data, home = homedir()) {
  for (const pattern of data.commands) {
    if (commandPatternToRegExp(pattern).test(command)) {
      return `this command matches the kit's deny rule \`${pattern}\`. Do not retry it in another form; tell the user what you wanted to do and why.`
    }
  }
  const read = compilePathPatterns(data.read, home)
  const edit = compilePathPatterns(data.edit, home)
  for (const segment of splitSegments(command)) {
    const tokens = tokenize(segment)
    const { verb, rest } = verbOf(tokens)
    if (READ_VERBS.has(verb)) {
      for (const token of pathTokens(rest)) {
        const hit = matchPath(read, pathForms(token, cwd, home))
        if (hit) return `reading \`${token}\` is blocked by the kit's deny rule \`${hit}\` (credentials, lockfiles and build output are never read).`
      }
    }
    const writes = redirectTargets(tokens)
    if (WRITE_VERBS.has(verb)) writes.push(...pathTokens(rest))
    for (const token of writes) {
      const hit = matchPath(edit, pathForms(token, cwd, home))
      if (hit) return `writing \`${token}\` is blocked by the kit's deny rule \`${hit}\`.`
    }
  }
  return null
}

export function checkPatch(patch, cwd, data, home = homedir()) {
  const edit = compilePathPatterns(data.edit, home)
  for (const path of patchPaths(patch)) {
    const hit = matchPath(edit, pathForms(path, cwd, home))
    if (hit) return `editing \`${path}\` is blocked by the kit's deny rule \`${hit}\`.`
  }
  return null
}

export function candidatePaths(toolName, command) {
  if (PATCH_TOOLS.has(toolName)) return patchPaths(command)
  const found = []
  for (const segment of splitSegments(command)) {
    for (const token of pathTokens(tokenize(segment)).slice(1)) {
      if (/[./]/.test(token) && !/^[a-z]+:\/\//i.test(token)) found.push(token)
    }
  }
  return found
}

export function matchingRules(paths, cwd, rules, home = homedir()) {
  const hits = []
  for (const rule of rules) {
    const compiled = compilePathPatterns(rule.paths, home)
    const path = paths.find(candidate => matchPath(compiled, pathForms(candidate, cwd, home)) !== null)
    if (path !== undefined) hits.push({ rule, path })
  }
  return hits
}

function statePath(sessionId) {
  const dir = join(tmpdir(), 'senior-dev-kit-codex')
  mkdirSync(dir, { recursive: true })
  return join(dir, `${String(sessionId || 'session').replace(/[^A-Za-z0-9_-]/g, '_')}.json`)
}

function loadState(path) {
  try {
    return new Set(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return new Set()
  }
}

export function decide(payload, data, kitRoot, home = homedir()) {
  const toolName = String(payload?.tool_name ?? '').toLowerCase()
  const input = payload?.tool_input ?? {}
  const command = typeof input.command === 'string' ? input.command : Array.isArray(input.command) ? input.command.join(' ') : ''
  if (command === '') return null
  const cwd = payload?.cwd || process.cwd()
  const isPatch = PATCH_TOOLS.has(toolName)
  if (!isPatch && !SHELL_TOOLS.has(toolName)) return null

  const reason = isPatch ? checkPatch(command, cwd, data.deny, home) : checkCommand(command, cwd, data.deny, home)
  if (reason) return deny(reason)

  const hits = matchingRules(candidatePaths(toolName, command), cwd, data.rules, home)
  if (hits.length === 0) return null
  const file = statePath(payload?.session_id)
  const seen = loadState(file)
  const fresh = hits.filter(hit => !seen.has(hit.rule.id))
  if (fresh.length === 0) return null
  for (const hit of fresh) seen.add(hit.rule.id)
  try {
    writeFileSync(file, JSON.stringify([...seen]))
  } catch {
    return null
  }
  const lines = fresh.map(
    hit => `- ${hit.rule.id} (${hit.rule.description}) — matched \`${hit.path}\` → read ${join(kitRoot, 'rules', hit.rule.file)}`
  )
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        'Senior Dev Kit path-scoped rules now apply. Read each file below once, now, before the next edit, ' +
        'follow it for every file of that kind for the rest of the session, and re-check the change you just made against it:\n' +
        lines.join('\n'),
    },
  }
}

function main() {
  const kitRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const dataPath = join(kitRoot, 'hooks', 'guard-data.json')
  if (!existsSync(dataPath)) return
  const data = JSON.parse(readFileSync(dataPath, 'utf8'))
  const payload = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const decision = decide(payload, data, kitRoot)
  if (decision) process.stdout.write(JSON.stringify(decision))
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
