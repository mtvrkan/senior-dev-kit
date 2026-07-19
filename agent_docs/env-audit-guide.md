# Env Audit Guide

Reference for `/env-audit` skill — grep commands by language and .env.example templates.

---

## Grep commands to discover env vars

```bash
# Node.js / TypeScript / JavaScript
grep -r "process\.env\." --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . \
  | grep -v node_modules | grep -v ".next" | grep -v dist | grep -v ".git"

# Python
grep -r "os\.environ\|os\.getenv\|settings\." --include="*.py" . | grep -v __pycache__ | grep -v ".git"

# Go
grep -r "os\.Getenv\|os\.LookupEnv" --include="*.go" . | grep -v ".git"

# Dart / Flutter
grep -r "const String.fromEnvironment\|dotenv\." --include="*.dart" . | grep -v ".git"

# Ruby / Rails
grep -r "ENV\[" --include="*.rb" . | grep -v ".git"

# PHP / Laravel
grep -r "env(" --include="*.php" . | grep -v ".git"

# Java / Kotlin (Spring)
grep -r "\${.*}" --include="*.java" --include="*.kt" --include="*.properties" --include="*.yml" . | grep -v ".git"
```

---

## .env.example entry format

```bash
# [Required|Optional] — [what this var controls]
# Example: [safe placeholder — never real value]
KEY_NAME=

# Required — JWT signing secret for auth tokens
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# Optional — enables AI features, degraded without it
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE

# Required — PostgreSQL connection string
# Format: postgresql://user:password@host:5432/dbname
DATABASE_URL=postgresql://

# Optional — defaults to "development" if not set
NODE_ENV=production
```

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
