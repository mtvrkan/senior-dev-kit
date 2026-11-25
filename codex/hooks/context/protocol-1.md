# Global Senior Protocol for Codex v4.1

## HARD STOPS — escalate before any code

STOP + ESCALATE on ANY touch of:
auth | session | JWT | OAuth | payment | billing | DB schema | migration |
CI/CD | Dockerfile | IaC | Terraform | secrets | prod config | infrastructure

`ESCALATE TO: [agent] — [one-line reason]`

Escalating is not a step you complete by printing that line. Until the guard has returned a plan
and the user has approved it, that line IS the turn's output — no migration or schema edit, no
auth/payment/CI code, no "here is how you would do it" snippet. A rule file's procedures describe
what the guard applies AFTER approval, never a way to satisfy the request without asking.

NEVER output: secrets or PII — even in debug/logs/comments

---

## TOKEN TIER — decide before every task

| Tier | Trigger | Action | Cap |
| --- | --- | --- | --- |
| 0 | 1 file <10 lines, no protected area | direct | 1 line |
| 1 | 1-2 files, UI only or isolated bug | direct | 2 lines |
| 2 | 3-5 files, behavior/API/state change | 3-line plan | 4 lines |
| 3 | Protected area, multi-system, DB | plan mode → approval | 6 lines |
| 4 | Destructive, billing, prod data | risk analysis | explicit approval |

Min tier signals (highest wins): auth/JWT/session=3 | payment=3 | DB schema/migration=3
CI-CD/Docker/IaC=3 | API endpoint added/removed/renamed=2 | shared type/DTO changed=2
>5 files=2 | DROP/TRUNCATE/bulk-delete=4 | prod config/secrets=4
Tier 3+: use native plan mode (read-only) for the plan — edits begin only after explicit approval.
`--now` flag: skips plan on Tier 2 only. Never skips hard stops, Tier 3+ plan, tests, verification.

---

## AGENT ROUTING

Escalation signals ALWAYS route to their guard:
DB schema/model/index/migration/destructive data → db-guard
auth / payment / security → security-guard | CI-CD / Docker / IaC → devops-guard
large feature / architecture → `feature-plan` skill in native plan mode (plan only, no code)
Architecture-scale scope spanning a guarded area (e.g. redesign the whole checkout flow) →
plan first via `feature-plan`, matching guards review its plan slices (see ROUTING.md).
live-incident language (prod down, outage, "users can't...") → `incident-response` skill first (ROUTING.md Step 0).

Everything else: delegate by agent description — each agent's description states its scope. Full decision tree, tier map, and EN+TR trigger phrases:
`agents/ROUTING.md` under KIT ROOT (read on demand, not preloaded).

AMBIGUITY: >80% clear → act | 50-80% → state assumption + act | <50% → ask ONCE specifically
Stack trace present → bug-hunter, no clarification needed.
Protected area signal → ALWAYS escalate regardless of confidence.

---

## MODEL ROUTING + DELEGATION — cheap lookup, expensive judgment

The main loop keeps the model and reasoning effort the user chose. Kit agents carry their own
`model_reasoning_effort` (`~/.codex/agents/<name>.toml`); a built-in subagent inherits the main
model and effort, so every spawn states which tier the work is.

| Tier | Only for |
| --- | --- |
| lookup (low effort) | pure lookup: where X lives, who calls X, inventories — returns `path:line` + the verbatim line, never a judgement |
| mechanical (medium effort) | bounded mechanical work against an exact written contract: bulk rename, boilerplate/tests copying a pattern, string files, run build/tests and report |
| judgement (high effort) | judgement: design, architecture, unknown-root-cause debugging, security/auth/payment/DB, UI taste, review, anything not fully re-verified |

Unsure which tier → judgement; quality is never traded for cost. Scout = the built-in read-only
`explorer` subagent. A cheaper tier's
result that becomes a production edit is re-read here first; wrong or ambiguous once → redo it
here, never retry on the cheaper tier. Line numbers go stale after any write — re-grep.
DON'T DELEGATE: file already known · one grep answers it · <3 files · Tier 0-1 · needs taste.
Protected areas, release gates and final verification are never delegated. Scout prompt template
and the full ladder: `agent_docs/delegation-policy.md`.

---

## BOOT SEQUENCE — silent, once per session

Tier 0 (1 file <10 lines, no protected area): SKIP — go straight to the edit, no boot reads.
Tier 1+: run once per session (skip missing, never guess):

1. Manifest: package.json/pubspec.yaml/go.mod/Cargo.toml/pom.xml/build.gradle{,.kts}/*.csproj/*.sln/
   composer.json/Gemfile/requirements.txt/pyproject.toml/CMakeLists.txt/Makefile
   PKG_MANAGER + runtime overrides (lockfile → manager, Kotlin JVM vs mobile): `agent_docs/stack-commands.md` § DETECTION
2. Config: tsconfig.json/vite.config.*/next.config.*/tailwind.config.* (Tailwind v4: @theme in CSS, no tailwind.config.js)
3. CI/CD: .github/workflows/*.yml/Dockerfile/railway.toml/fly.toml/wrangler.toml/vercel.json → DEPLOY
   Edge runtime (wrangler.toml, `export const runtime = 'edge'`): no Node built-ins, no fs, no
   long-lived connections — a Node-only dep in an edge route fails at deploy, not at lint
4. ORM/migrations: *.prisma/drizzle.config.*/knexfile.*/alembic.ini/supabase/config.toml/schema.rb/
   Data/*DbContext.cs, mongoose/typeorm in the manifest, or a migrations/ (Django, Laravel, EF),
   migrate/ (Rails), migration/ (Flyway) or changelog/ (Liquibase) dir → DB+ORM
5. Architecture: turbo.json/nx.json/pnpm-workspace.yaml → MONOREPO: detect per package, not repo-wide
   else src/ or app/ 1-level → layered(controllers/services/repos) or vertical-slice(features/)
6. 1 test file → TEST_CMD, framework | 1 file per layer → CONVENTIONS

Build: TEST_CMD | LINT_CMD | BUILD_CMD | PKG_MANAGER | ARCH | CONVENTIONS. Mark UNKNOWN if undetectable.
Stack detected but project has no AGENTS.md → offer once to seed it from the matching
`presets/<category>/<stack>/` under KIT ROOT (several stacks → concatenate their `compact.md`s).
Offer, don't write: the project's own conventions win over any preset.
Exact per-stack test/lint/build/type-check commands (26 stacks, targeted-test flags):
read `agent_docs/stack-commands.md` the first time a command is actually needed.

Protected patterns (Tier 3 always): middleware.ts|proxy.ts|auth.ts|app/api/ (Next.js) |
AuthModule|Guards (NestJS) | settings.py|urls.py (Django) | SecurityConfig|WebSecurity (Spring) |
Program.cs|Startup.cs|appsettings*.json (ASP.NET) | config/auth.php|Middleware/ (Laravel) |
AndroidManifest.xml|Info.plist (mobile) | RLS policies (Supabase) | Security rules (Firebase)

---
