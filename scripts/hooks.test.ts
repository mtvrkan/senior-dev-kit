// Behavior tests for hooks/protected-paths.mjs — spawns the real script with
// a synthetic PreToolUse JSON payload on stdin and asserts on stdout/exit code.
// Run: node --experimental-strip-types --test scripts/hooks.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const HOOK = join(REPO_ROOT, 'hooks', 'protected-paths.mjs')

function runHook(payload: unknown, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, SDK_ALLOW_PROTECTED: '', ...env },
  })
}

function editPayload(filePath: string) {
  return { tool_name: 'Edit', tool_input: { file_path: filePath } }
}

describe('protected-paths hook', () => {
  const askCases: Array<[string, string]> = [
    ['.env', 'secrets'],
    ['src/.env.production', 'secrets'],
    ['config/certs/server.pem', 'secrets'],
    ['src/middleware.ts', 'auth'],
    ['app/auth/session.ts', 'auth'],
    ['src/main/java/com/x/SecurityConfig.java', 'auth'],
    ['services/billing/invoice.ts', 'payment/billing'],
    ['db/migrations/20260701_add_users.sql', 'DB schema/migration'],
    ['prisma/schema.prisma', 'DB schema/migration'],
    ['.github/workflows/ci.yml', 'CI/CD & infrastructure'],
    ['Dockerfile', 'CI/CD & infrastructure'],
    ['infra/main.tf', 'CI/CD & infrastructure'],
  ]

  for (const [file, category] of askCases) {
    test(`asks for ${file} (${category})`, () => {
      const r = runHook(editPayload(file))
      assert.strictEqual(r.status, 0)
      const out = JSON.parse(r.stdout)
      assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
      assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes(category))
    })
  }

  test('normalizes Windows backslash paths', () => {
    const r = runHook(editPayload('db\\migrations\\001_init.sql'))
    const out = JSON.parse(r.stdout)
    assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
  })

  test('names the right guard agent in the reason', () => {
    const r = runHook(editPayload('.github/workflows/ci.yml'))
    assert.ok(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason.includes('devops-guard'))
  })

  const allowCases = ['src/components/Button.tsx', 'README.md', 'scripts/build.ts', 'src/services/user.service.ts', '.env.example']

  for (const file of allowCases) {
    test(`allows ${file} silently`, () => {
      const r = runHook(editPayload(file))
      assert.strictEqual(r.status, 0)
      assert.strictEqual(r.stdout, '')
    })
  }

  test('SDK_ALLOW_PROTECTED=1 skips the prompt', () => {
    const r = runHook(editPayload('.env'), { SDK_ALLOW_PROTECTED: '1' })
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })

  test('fails open on malformed input', () => {
    const r = runHook('this is not json')
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })

  test('fails open on missing file_path', () => {
    const r = runHook({ tool_name: 'Edit', tool_input: {} })
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })
})
