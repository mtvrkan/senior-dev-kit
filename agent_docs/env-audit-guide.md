# Env Audit Guide

Reference for `/env-audit` skill — grep commands by language and .env.example templates.

---

## Grep commands to discover env vars

Node.js / TypeScript / JavaScript:

```bash
grep -r "process\.env\." --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . \
  | grep -v node_modules | grep -v ".next" | grep -v dist | grep -v ".git"
```

Python:

```bash
grep -r "os\.environ\|os\.getenv\|settings\." --include="*.py" . | grep -v __pycache__ | grep -v ".git"
```

Go:

```bash
grep -r "os\.Getenv\|os\.LookupEnv" --include="*.go" . | grep -v ".git"
```

Dart / Flutter:

```bash
grep -r "const String.fromEnvironment\|dotenv\." --include="*.dart" . | grep -v ".git"
```

Ruby / Rails:

```bash
grep -r "ENV\[" --include="*.rb" . | grep -v ".git"
```

PHP / Laravel:

```bash
grep -r "env(" --include="*.php" . | grep -v ".git"
```

Java / Kotlin (Spring):

```bash
grep -r "\${.*}" --include="*.java" --include="*.kt" --include="*.properties" --include="*.yml" . | grep -v ".git"
```

---

## .env.example entry format

`.env.example` holds only `KEY=placeholder` lines — no comment lines — grouped by concern with a
blank line between groups. A placeholder is a safe shape hint, never a real value.

```bash
JWT_SECRET=
DATABASE_URL=postgresql://

ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE

NODE_ENV=production
```

Everything a comment used to carry goes in one table in the project's README (or `docs/ENV.md`
when the list is long), one row per variable. The audit checks the table and `.env.example`
against each other: every key in one must appear in the other.

| Variable | Required | Purpose | Format / example |
| --- | --- | --- | --- |
| `JWT_SECRET` | Required | JWT signing secret for auth tokens | 64 random bytes as hex: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DATABASE_URL` | Required | PostgreSQL connection string | `postgresql://user:password@host:5432/dbname` |
| `ANTHROPIC_API_KEY` | Optional | Enables AI features; they degrade without it | `sk-ant-...` from <https://console.anthropic.com/> |
| `NODE_ENV` | Optional | Runtime mode | defaults to `development` if not set |

---

## Security exposure risk patterns

| Pattern | Risk | Fix |
| --- | --- | --- |
| `NEXT_PUBLIC_SECRET_KEY=...` | Exposed to browser bundle | Remove `NEXT_PUBLIC_` prefix; proxy via API route |
| `VITE_SECRET_KEY=...` | Exposed to browser bundle | Remove `VITE_` prefix; proxy via API route |
| `const API_KEY = "sk-abc..."` in source | Hardcoded secret in code | Move to env var |
| `console.log(process.env)` | Logs all secrets | Remove; log specific non-sensitive keys only |
| `.env` in git history | Secret exposure | `git rm --cached .env` + rotate all values |
| Same var across environments | No env isolation | Use per-environment values |

---

## Var classification table

| Category | Definition | Example |
| --- | --- | --- |
| REQUIRED | App crashes or refuses to start without it | `DATABASE_URL`, `JWT_SECRET` |
| OPTIONAL_DEFAULT | Hardcoded fallback exists; optional in .env | `PORT` (defaults to 3000) |
| OPTIONAL_FEATURE | App works without it; feature degrades | `OPENAI_API_KEY` |
| UNUSED | In .env.example but no code references it | Legacy vars from removed features |
| SECRET | Sensitive; never log, never expose to client | `*_SECRET`, `*_KEY`, `*_TOKEN`, `*_PASSWORD` |
