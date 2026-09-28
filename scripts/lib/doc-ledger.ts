import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DatedClaim {
  file: string
  date: string
  note: string
}

export interface ForbiddenExampleShape {
  source: string
  pattern: string
  reason: string
}

export interface DocLedger {
  reviewed: DatedClaim[]
  upstreamAssumptions: DatedClaim[]
  toolchainPins: { file: string; reviewed: string; digest: string }
  neverLogFields: { source: string; fields: string[] }
  forbiddenInExamples: ForbiddenExampleShape[]
}

export const LEDGER_PATH = 'scripts/lib/doc-ledger.json'

const DATE = /^(\d{4})-(\d{2})$/

export function monthsSince(date: string, now: Date): number {
  const match = date.match(DATE)
  if (!match) return Number.NaN
  return (now.getFullYear() - Number(match[1])) * 12 + (now.getMonth() + 1 - Number(match[2]))
}

export function loadLedger(root: string): { ledger: DocLedger | null; errors: string[] } {
  const path = join(root, LEDGER_PATH)
  if (!existsSync(path)) return { ledger: null, errors: [`${LEDGER_PATH} is missing — the freshness, pin and example checks have nothing to read`] }
  let ledger: DocLedger
  try {
    ledger = JSON.parse(readFileSync(path, 'utf8')) as DocLedger
  } catch (error) {
    return { ledger: null, errors: [`${LEDGER_PATH} is not valid JSON: ${(error as Error).message}`] }
  }
  const errors: string[] = []
  const claims = [...(ledger.reviewed ?? []), ...(ledger.upstreamAssumptions ?? [])]
  for (const claim of claims) {
    if (!existsSync(join(root, claim.file))) errors.push(`${LEDGER_PATH} dates ${claim.file}, which does not exist — drop or move the entry`)
    if (!DATE.test(claim.date)) errors.push(`${LEDGER_PATH} entry for ${claim.file} has date "${claim.date}", expected YYYY-MM`)
    if (!claim.note?.trim()) errors.push(`${LEDGER_PATH} entry for ${claim.file} has no note — say what was re-checked, or the date vouches for everything`)
  }
  for (const source of [ledger.toolchainPins?.file, ledger.neverLogFields?.source, ...(ledger.forbiddenInExamples ?? []).map(s => s.source)]) {
    if (source && !existsSync(join(root, source))) errors.push(`${LEDGER_PATH} names ${source} as a source, which does not exist`)
  }
  return { ledger, errors }
}
