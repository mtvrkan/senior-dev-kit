import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { builtinModules } from 'module'
import { fileURLToPath } from 'url'
import { exitCodeFor, summarize, STEP_NOTES, CHECK_STEPS } from './run-checks.ts'

describe('run-checks aggregation', () => {
  test('exitCodeFor returns 0 when every step passed', () => {
    assert.equal(exitCodeFor([{ step: 'test', ok: true }, { step: 'lint', ok: true }]), 0)
  })

  test('exitCodeFor returns 1 when any step failed, even if others passed', () => {
    assert.equal(exitCodeFor([{ step: 'test', ok: false }, { step: 'lint', ok: true }]), 1)
  })

  test('exitCodeFor returns 1 when every step failed', () => {
    assert.equal(exitCodeFor([{ step: 'test', ok: false }, { step: 'lint', ok: false }]), 1)
  })

  test('summarize lists every step with a pass/fail marker, not just the first failure', () => {
    const out = summarize([
      { step: 'test', ok: false },
      { step: 'validate', ok: true },
      { step: 'consistency-check', ok: false },
    ])
    assert.match(out, /✗ test/)
    assert.match(out, /✓ validate/)
    assert.match(out, /✗ consistency-check/)
    assert.match(out, /2 step\(s\) failed: test, consistency-check/)
  })

  test('summarize reports "All steps passed" when nothing failed', () => {
    const out = summarize([{ step: 'test', ok: true }])
    assert.match(out, /All steps passed\./)
  })

  test('a passing step with a caveat carries it into the summary line', () => {
    const out = summarize([{ step: 'routing-eval', ok: true }])
    assert.match(out, /✓ routing-eval \(static only/)
  })

  test('a failing step shows the failure, not the caveat', () => {
    const out = summarize([{ step: 'routing-eval', ok: false }])
    assert.match(out, /✗ routing-eval$/m)
  })

  test('every annotated step is a real step — a renamed step must not silently lose its note', () => {
    for (const step of Object.keys(STEP_NOTES)) {
      assert.ok(CHECK_STEPS.includes(step), `STEP_NOTES names "${step}", which is not in CHECK_STEPS`)
    }
  })
})

// repo-ci.yml's unit-test and consistency jobs run `npm test` with no `npm ci`, so a test that
// reaches a package at runtime crashes at load there and passes on every machine that has
// node_modules. scripts/markdown-lint.test.ts shipped exactly that way. Type-only imports are
// erased by type stripping and are allowed.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUILTINS = new Set(builtinModules)
const IMPORT_RE = /^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

function runtimePackageImports(entryFiles: string[]): string[] {
  const seen = new Set<string>()
  const offenders: string[] = []
  const queue = [...entryFiles]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier))
      else if (!specifier.startsWith('node:') && !BUILTINS.has(specifier)) offenders.push(`${file.slice(REPO_ROOT.length + 1)} → ${specifier}`)
    }
  }
  return offenders
}

describe('unit tests run without node_modules', () => {
  test('nothing reachable from the npm test file list imports a package at runtime', () => {
    const testScript: string = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).scripts.test
    const entryFiles = testScript.split(/\s+/).filter(arg => /^scripts\/.*\.test\.(ts|mjs)$/.test(arg)).map(arg => join(REPO_ROOT, arg))

    const offenders = runtimePackageImports(entryFiles)

    assert.ok(entryFiles.length > 0, 'parsed no test files out of package.json scripts.test')
    assert.deepEqual(offenders, [])
  })
})
