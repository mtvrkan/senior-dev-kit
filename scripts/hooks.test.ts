// Behavior tests for hooks/protected-paths.mjs — spawns the real script with
// a synthetic PreToolUse JSON payload on stdin and asserts on stdout/exit code.
// Run: node --experimental-strip-types --test scripts/hooks.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'child_process'
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
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

function bashPayload(command: string) {
  return { tool_name: 'Bash', tool_input: { command } }
}

describe('protected-paths hook', () => {
  const askCases: Array<[string, string]> = [
    ['.env', 'secrets'],
    ['src/.env.production', 'secrets'],
    ['config/certs/server.pem', 'secrets'],
    ['config/credentials.json', 'secrets'],
    ['config/secrets.json', 'secrets'],
    ['.secrets.baseline', 'secrets'],
    ['src/middleware.ts', 'auth'],
    ['app/auth/session.ts', 'auth'],
    ['src/session.ts', 'auth'], // standalone session file outside any auth/ dir
    ['src/jwt.ts', 'auth'],
    ['lib/oauth.ts', 'auth'],
    ['src/main/java/com/x/SecurityConfig.java', 'auth'],
    ['services/billing/invoice.ts', 'payment/billing'],
    ['db/migrations/20260701_add_users.sql', 'DB schema/migration'],
    ['prisma/schema.prisma', 'DB schema/migration'],
    ['db/migrate/20260701120000_add_users.rb', 'DB schema/migration'], // Rails: db/migrate/ (singular)
    ['drizzle/0001_snowy_avengers.sql', 'DB schema/migration'], // Drizzle default output dir, not migrations/
    ['alembic/versions/ae1027a6acf.py', 'DB schema/migration'], // SQLAlchemy/Alembic
    ['db/20260701120000_create_users.sql', 'DB schema/migration'], // timestamped filename outside any migrations dir
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

  // Case-insensitive filesystems (Windows, macOS) treat Middleware.ts and
  // middleware.ts as the same file — alternate casing must not bypass the prompt.
  const caseBypassCases: Array<[string, string]> = [
    ['src/Middleware.ts', 'auth'],
    ['src/main/java/com/x/securityconfig.java', 'auth'],
    ['prisma/Schema.PRISMA', 'DB schema/migration'],
    ['DRIZZLE.config.ts', 'DB schema/migration'],
    ['KNEXFILE.js', 'DB schema/migration'],
    ['.GitHub/Workflows/ci.yml', 'CI/CD & infrastructure'],
    ['dockerfile.prod', 'CI/CD & infrastructure'],
    ['infra/Main.TF', 'CI/CD & infrastructure'],
    ['.GITLAB-CI.YML', 'CI/CD & infrastructure'],
    ['ID_RSA', 'secrets'],
  ]

  for (const [file, category] of caseBypassCases) {
    test(`asks for ${file} despite alternate casing (${category})`, () => {
      const r = runHook(editPayload(file))
      assert.strictEqual(r.status, 0)
      const out = JSON.parse(r.stdout)
      assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
      assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes(category))
    })
  }

  test('reason message keeps the original casing of the path', () => {
    const r = runHook(editPayload('src/Middleware.ts'))
    assert.ok(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason.includes('src/Middleware.ts'))
  })

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

  test('SDK_ALLOW_PROTECTED=1 skips the prompt and logs an audit line to stderr', () => {
    const r = runHook(editPayload('.env'), { SDK_ALLOW_PROTECTED: '1' })
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
    const audit = JSON.parse(r.stderr)
    assert.strictEqual(audit.action, 'hook.protected_path.bypassed')
    assert.strictEqual(audit.category, 'secrets')
    assert.strictEqual(audit.guard, 'security-guard')
    assert.strictEqual(audit.path, '.env')
  })

  test('SDK_ALLOW_PROTECTED=1 on a non-protected path stays silent (no audit noise)', () => {
    const r = runHook(editPayload('src/components/Button.tsx'), { SDK_ALLOW_PROTECTED: '1' })
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
    assert.strictEqual(r.stderr, '')
  })

  test('resolves symlinks so an alias name cannot reach a protected file', t => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'sdk-hook-'))
    const target = join(tmpDir, '.env')
    const alias = join(tmpDir, 'config.json')
    writeFileSync(target, 'SECRET=1')
    try {
      symlinkSync(target, alias)
    } catch {
      // Creating symlinks needs elevated privileges/Developer Mode on some
      // Windows setups — skip rather than fail the suite on those machines.
      t.skip('symlink creation not permitted on this machine')
      rmSync(tmpDir, { recursive: true, force: true })
      return
    }
    const r = runHook(editPayload(alias))
    const out = JSON.parse(r.stdout)
    assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
    assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes('secrets'))
    rmSync(tmpDir, { recursive: true, force: true })
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

  // Edit/Write are not the only tools that can reach a protected path — a Bash
  // command with a redirect, sed -i, or a PowerShell/cp/git equivalent bypasses
  // the matcher entirely if the hook only inspects Edit/Write/NotebookEdit.
  describe('Bash bypass detection', () => {
    const bashAskCases: Array<[string, string]> = [
      ['echo "SECRET=1" >> .env', 'secrets'],
      ['echo "SECRET=1" > .env', 'secrets'],
      ['Set-Content -Path .env -Value "SECRET=1"', 'secrets'],
      ["Add-Content -Path config/secrets.json -Value '{}'", 'secrets'],
      ["sed -i 's/foo/bar/' .env", 'secrets'],
      ["sed -i '' 's/foo/bar/' .env", 'secrets'], // BSD/macOS sed requires the empty backup-suffix arg
      ['git checkout -- .env', 'secrets'],
      ['git checkout HEAD -- src/middleware.ts', 'auth'],
      ['Copy-Item -Path foo.txt -Destination .env', 'secrets'],
      ['cp foo.txt .env', 'secrets'],
      ['mv foo.txt db/migrations/001_init.sql', 'DB schema/migration'],
    ]

    for (const [command, category] of bashAskCases) {
      test(`asks for Bash: ${command} (${category})`, () => {
        const r = runHook(bashPayload(command))
        assert.strictEqual(r.status, 0)
        const out = JSON.parse(r.stdout)
        assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
        assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes(category))
      })
    }

    const bashAllowCases = [
      'git status',
      'ls -la',
      'npm test',
      'cat .env', // read-only — no write target
      'echo "hello" > /tmp/scratch.txt',
      'git checkout -- src/components/Button.tsx',
    ]

    for (const command of bashAllowCases) {
      test(`allows Bash: ${command}`, () => {
        const r = runHook(bashPayload(command))
        assert.strictEqual(r.status, 0)
        assert.strictEqual(r.stdout, '')
      })
    }
  })

  // Content-guard: a narrow, high-precision check on the text Edit/Write are
  // about to write, independent of the destination path. Scoped to exactly
  // two patterns (dangerouslySetInnerHTML, subprocess shell=True) to keep the
  // false-positive rate near zero — see rules/000-security.md's passive scan
  // for the broader (model-judgment) checklist this doesn't try to replace.
  describe('content-guard', () => {
    test('asks when Write content contains dangerouslySetInnerHTML', () => {
      const r = runHook({
        tool_name: 'Write',
        tool_input: { file_path: 'src/components/Preview.tsx', content: 'export const X = () => <div dangerouslySetInnerHTML={{ __html: raw }} />' },
      })
      const out = JSON.parse(r.stdout)
      assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
      assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes('security-guard'))
    })

    test('asks when Edit new_string contains subprocess shell=True', () => {
      const r = runHook({
        tool_name: 'Edit',
        tool_input: { file_path: 'scripts/deploy.py', old_string: 'pass', new_string: 'subprocess.run(cmd, shell=True)' },
      })
      const out = JSON.parse(r.stdout)
      assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
      assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes('security-guard'))
    })

    test('allows Write content with neither pattern', () => {
      const r = runHook({
        tool_name: 'Write',
        tool_input: { file_path: 'src/components/Button.tsx', content: 'export const Button = () => <button>Click</button>' },
      })
      assert.strictEqual(r.status, 0)
      assert.strictEqual(r.stdout, '')
    })

    test('path-based category still wins when both path and content match', () => {
      const r = runHook({
        tool_name: 'Edit',
        tool_input: { file_path: 'src/middleware.ts', old_string: 'x', new_string: 'subprocess.run(cmd, shell=True)' },
      })
      const out = JSON.parse(r.stdout)
      assert.strictEqual(out.hookSpecificOutput.permissionDecision, 'ask')
      assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes('auth'))
    })
  })
})
