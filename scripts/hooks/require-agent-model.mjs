#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const INHERITING_TYPES = new Set(['', 'general-purpose', 'explore', 'plan', 'claude'])

export const REASON =
  'MODEL ROUTING: this Agent call would silently inherit the main model. ' +
  'Re-issue it with an explicit `model`: ' +
  'haiku = pure lookup (where/who-calls/list/inventory, returns path:line + verbatim line); ' +
  'sonnet = bounded mechanical work against an exact written contract (bulk rename, boilerplate or tests ' +
  'following an existing pattern, string/translation files, run build/tests and report); ' +
  'opus = judgement (design, root-cause debugging, security/auth/payment/DB, UI taste, review, anything ' +
  'whose output you will not fully re-verify). If unsure, choose opus: quality is never traded for cost.'

export function decide(payload) {
  const toolInput = (payload && typeof payload === 'object' && payload.tool_input) || {}
  const agentType = String(toolInput.subagent_type ?? '').trim().toLowerCase()
  if (agentType === 'fork' || toolInput.model) return null
  if (!INHERITING_TYPES.has(agentType)) return null
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: REASON,
    },
  }
}

function main() {
  let payload
  try {
    payload = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return
  }
  const decision = decide(payload)
  if (decision) process.stdout.write(JSON.stringify(decision))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch {
    process.exitCode = 0
  }
}
