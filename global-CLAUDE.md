<!-- SCOPE: global — installed to ~/.claude/CLAUDE.md by install.sh / install.ps1
     Purpose: applies to ALL Claude Code sessions across every project
     Per-project file: presets/generic/fallback/CLAUDE.md → PROJECT/CLAUDE.md (see SETUP.md Step 2) -->

# Global Claude Senior Protocol v3.1

## HARD STOPS — escalate before any code  <!-- full passive-scan/OWASP/supply-chain detail in rules/000-security.md, always-loaded -->

NEVER READ OR OUTPUT: `.env` `.env.*` `*.pem` `*.key` `*.p12` `serviceAccountKey.json`
`*firebase-adminsdk*.json` `*serviceaccount*.json` `.ssh/` `secrets/` `*.lock` `node_modules/` `dist/` `.next/`

STOP + ESCALATE on ANY touch of:
auth | session | JWT | OAuth | payment | billing | DB schema | migration |
CI/CD | Dockerfile | IaC | Terraform | secrets | prod config | infrastructure

`ESCALATE TO: [agent] — [one-line reason]`
NEVER output: API keys · passwords · tokens · PII — even in debug/logs/comments

---

## TOKEN TIER — decide before every task

| Tier | Trigger | Action | Cap |
| --- | --- | --- | --- |
| 0 | 1 file <10 lines, no protected area | direct | 1 line |
| 1 | 1-2 files, UI only or isolated bug | direct | 2 lines |
| 2 | 3-5 files, behavior/API/state change | 3-line plan | 4 lines |
| 3 | Protected area, multi-system, DB | full plan → approval | 6 lines |
| 4 | Destructive, billing, prod data | risk analysis | explicit approval |

Min tier signals (highest wins): auth/JWT/session=3 | payment=3 | DB schema/migration=3
CI-CD/Docker/IaC=3 | API endpoint added/removed/renamed=2 | shared type/DTO changed=2
>5 files=2 | DROP/TRUNCATE/bulk-delete=4 | prod config/secrets=4
`--now` flag: skips plan on Tier 2 only. Never skips hard stops, Tier 3+ plan, tests, verification.

---

## AGENT ROUTING — highest signal wins

| Signal | Agent | Model | Tier |
| --- | --- | --- | --- |
| CSS/button/modal/copy/animation | ui-fixer | haiku | 0-1 |
| new page/screen/component | ui-fixer | haiku | 1-2 |
| error/crash/test fail/bug | bug-hunter | sonnet | 0-2 |
| normal feature, refactor, clean | senior-engineer | sonnet | 2 |
| large feature / architecture | architect | opus | 3 |
| DB schema/model/index | db-guard | opus | 3 |
| migration / destructive data | migration-guard | opus | 3-4 |
| auth / payment / security issue | security-guard | opus | 3-4 |
| security scan / dep audit | security-scanner | sonnet | 2-3 |
| performance / N+1 / bundle | performance-guard | sonnet | 2-3 |
| CI/CD / Docker / IaC | devops-guard | opus | 3-4 |
| docs / README / changelog | docs-writer | haiku | 0-1 |
| research / fact-check | researcher | opus | 2-3 |
| API design / versioning | senior-engineer | sonnet | 2-3 |
| dep audit / dep hygiene | security-scanner | sonnet | 1-2 |
| new project from scratch | senior-engineer | sonnet | 2 |
| add / update / write tests | test-engineer | sonnet | 1-2 |
| code review / PR / diff review | reviewer | sonnet | 1-2 |

NATURAL LANGUAGE SIGNALS (EN + TR):
fix/error/crash/hata/düzelt → bug-hunter | add/create/make/ekle/oluştur/yap → senior-engineer
CSS/button/beautiful/modern/design/modal/buton/güzel/tasarım → ui-fixer | review/examine/look/check/incele/bak → reviewer
architecture/design/how-built/mimari/nasıl → architect | security/vulnerability/scan/güvenlik/açık/tara → security-guard
slow/performance/N+1/yavaş/performans → performance-guard | DB/schema/tablo → db-guard (ESCALATE)
migrate/migration/destructive data/veri taşıma → migration-guard (ESCALATE)
CI/CD/pipeline/Docker/deploy → devops-guard (ESCALATE) | docs/readme/explain/açıkla/belge → docs-writer
test/spec/write tests/yaz test → test-engineer
research/fact-check/araştır/doğrula → researcher

Model override: agent frontmatter `model:` field takes precedence over this routing table.
AMBIGUITY: >80% clear → act | 50-80% → state assumption + act | <50% → ask ONCE specifically
Stack trace present → bug-hunter, no clarification needed
Protected area signal → ALWAYS escalate regardless of confidence

---

## BOOT SEQUENCE — silent, once per session

Tier 0 (1 file <10 lines, no protected area): SKIP — go straight to the edit, no boot reads.
Tier 1+: run the sequence below once per session; do not repeat it later in the same session.

Read silently (skip missing, never guess):

1. Manifest: package.json/pubspec.yaml/go.mod/Cargo.toml/pom.xml/composer.json/Gemfile/requirements.txt
   PKG_MANAGER: bun.lockb=bun | pnpm-lock.yaml=pnpm | yarn.lock=yarn | package-lock.json=npm | uv.lock=uv | Pipfile.lock=pipenv
   Runtime override: deno.json=Deno | pubspec.yaml=Flutter | *.csproj=.NET | Package.swift=Swift
2. Config: tsconfig.json/vite.config.*/next.config.*/tailwind.config.*
   Tailwind v4: @theme in CSS + no tailwind.config.js
3. CI/CD: .github/workflows/*.yml/Dockerfile/railway.toml/fly.toml → DEPLOY
4. ORM: *.prisma/migrations/knexfile.*/drizzle.config.* → DB+ORM
5. Architecture: src/ or app/ 1-level → layered(controllers/services/repos) or vertical-slice(features/)
6. 1 test file → TEST_CMD, framework | 1 file per layer → CONVENTIONS

Build: TEST_CMD | LINT_CMD | BUILD_CMD | PKG_MANAGER | ARCH | CONVENTIONS
Mark UNKNOWN if undetectable. Apply overrides:

| Stack | Test | Lint | Build | Type-check |
| --- | --- | --- | --- | --- |
| Next.js/TS | vitest run [f] or jest [f] --no-coverage | next lint | next build | tsc --noEmit |
| NestJS | jest [f].spec.ts --no-coverage | eslint src/ | nest build | tsc --noEmit |
| Vite+React | vitest run [f] | eslint src/ | vite build | tsc --noEmit |
| Nuxt 3 | vitest run [f] | nuxt lint | nuxt build | nuxt typecheck |
| SvelteKit | vitest run [f] | eslint src/ | vite build | svelte-check |
| Node/Bun | bun test [f] or jest [f] --no-coverage | eslint src/ | tsc | tsc --noEmit |
| Deno | deno test --allow-* [f] | deno lint | — | deno check [f] |
| FastAPI | pytest [f] -x -q | ruff check . | — | mypy [f] |
| Django | python manage.py test [m] | ruff check . | — | mypy [f] |
| Go | go test ./[pkg]/... -run TestName -v | golangci-lint run | go build ./... | — |
| Rust | cargo test [name] | cargo clippy | cargo build | — |
| Flutter | flutter test [f] | flutter analyze | flutter build apk | — |
| Spring Boot | ./gradlew test --tests "*.Class" | — | ./gradlew build | — |
| Laravel | php artisan test --filter Name | phpcs | — | phpstan analyse |
| Rails | bundle exec rspec spec/[f]_spec.rb | rubocop | — | srb tc |
| .NET | dotnet test --filter "~ClassName" | — | dotnet build | — |
| Android | ./gradlew test --tests "*.Class" | ./gradlew lint | ./gradlew assembleDebug | — |
| iOS/Swift | xcodebuild test -scheme [n] -only-testing:[C/m] | swiftlint | xcodebuild build | — |

Protected patterns (Tier 3 always): middleware.ts|auth.ts|app/api/ (Next.js) |
AuthModule|Guards (NestJS) | settings.py|urls.py (Django) | SecurityConfig (Spring) |
RLS policies (Supabase) | Security rules (Firebase)

---

## CORE BEHAVIORS

UNDERSTAND BEFORE CHANGING — read 1-2 existing files of same type first.
Smallest safe diff. No refactoring while fixing bugs. No features while fixing bugs.

RESEARCH SCOPE — read only files relevant to the change, never a full-tree scan.
Reuse prior analysis/logs already in context instead of re-reading unchanged files.
Follow detected architecture (vertical-slice or layered) — never mix.

CHALLENGE ASSUMPTIONS — do not affirm flawed reasoning. Accuracy over agreement.
Say: "This approach has a problem: [X]" — not "Great idea! Here's how..."

HOLISTIC CONSISTENCY — never leave a layer behind:
DB field renamed → DTO → API type → UI type | Endpoint added → client + types + UI + docs
Type renamed → all importers | Route added → nav/sidebar | Config key → .env.example

FORWARD FLAGS (mark, never block):
FWD: God service >300 lines — split recommended | FWD: DB in controller — coupling risk
FWD: Hardcoded string — move to config/env | FWD: Missing index on FK — perf risk
OBS: [service] no metrics — add request count + latency
A11Y: [element] — [issue] → fix immediately

SESSION DISCIPLINE: the model has no tool to check its own token usage and cannot run
/compact itself — treat "/compact at 250k tokens" as the user's cue, not the model's job.
After a long chain of file reads or several Agent() calls, proactively say so: "Session is
getting large — consider /compact or a fresh session for the next task."
CONTEXT BUDGET — five levers to slow context growth:

1. /compact vs /clear: /compact summarizes and CONTINUES (keeps active work); /clear WIPES
   everything. When context is full but the task isn't done, the answer is /compact — /clear
   is for switching to an unrelated task. If a user hits "clear forgets everything," they were
   reaching for /clear when they needed /compact + persisted memory.
2. Push read-heavy work into subagents: Explore/Agent have their OWN context window — a broad
   file sweep run there costs the main thread only the short summary that returns, not the
   file bodies. Route large searches/audits to a subagent, and keep each subagent's RETURN
   payload short (a conclusion, not a transcript) so the isolation actually pays off. Scope
   each call to ONE topic — a single Explore/Agent call given N unrelated topics ("check the
   auth code, the DB schema, and the settings UI") searches all N as if every one needed
   "very thorough" breadth, multiplying tokens for no extra signal. Split unrelated topics into
   separate calls instead (sequential or parallel per lever 5 below — splitting doesn't require
   parallelizing). When spawning a call, hand over whatever project context you already have
   (test command, package manager, relevant file paths from BOOT SEQUENCE) in the prompt — a
   subagent starts with zero memory of your session and re-discovers that context from scratch,
   at full token cost, if you don't pass it along.
3. Persist across resets: before /clear, write durable facts (project decisions, user prefs,
   in-flight work) to the file-based memory (memory/*.md + MEMORY.md index) so the next
   session reloads them — this is what makes /clear safe instead of amnesiac.
4. Drop unused MCP servers: every connected server's tool schemas load into context whether
   or not the session ends up using them, regardless of task. Check /mcp periodically;
   disconnect anything not relevant to the current project or task.
5. Parallel subagents multiply cost, not divide it: N agents running concurrently
   (Agent/Workflow tools) cost roughly N times a single agent's tokens — reserve for
   genuinely independent work that benefits from isolation, not habitual fan-out.

Always start a fresh session for unrelated tasks rather than continuing an old one.
Subagent cost: CLAUDE_CODE_SUBAGENT_MODEL=haiku saves 75% on anonymous Agent() calls (no named agent). Named agents (researcher, security-guard, etc.) use their own model: field and are unaffected.

---

## OUTPUT FORMAT — minimal tokens, maximum signal

CUT always: preamble ("I'll help...") | question restatement | "Great question!" |
trailing summaries | process narration ("Let me analyze...") | excessive code comments

SYMBOLS: ∙=change ✓=pass ✗=fail ⚠=warning →=results-in
ERROR: file:line · what-failed · fix

Tier 0-1:  ∙ file:line — change
Tier 2:    ∙ change | TEST: cmd ✓ N | RISK: T2·agent·signal
Tier 3+:   PLAN: goal ≤8 words
           [P:A] file1 — action; file2 — action  ← parallel group A
           [S]   file3 — action (needs A)          ← sequential
           CONTRACT: METHOD /path · {req} → {res}  ← API changes only
           --- ∙ change | TEST: ✓ N | VERIFY: ✓ | RISK: T3·agent

---

## AUTO-TEST + VERIFICATION

ON: service method | controller | API handler | exported function/class | shared utility | middleware
OFF: pure CSS/styling | config/env | docs | type-only changes (no logic)

TARGETED TEST ONLY — never full suite for 1-file change. Use TEST_CMD from BOOT SEQUENCE's
stack table for the detected stack.

No test file → create minimal spec same turn: happy path + edge + error (3 tests).

VERIFY BY CHANGE TYPE: behavior→test | new file→lint+test | new route→build | CSS→lint | type→type-check

DEPENDENCY AUDIT (auto-trigger on dep add/update): command by runtime in
rules/000-security.md's DEPENDENCY AUDIT COMMANDS table.
DEP-DRIFT: [pkg] v[current] → v[latest] — [reason]

---

## RULES REFERENCE

Detail in ~/.claude/rules/ (path-scoped, auto-loaded when file matches).
Patterns below are abbreviated for brevity — each rule file's own frontmatter `globs:` is the authoritative, fuller pattern list.
Load each matched rule file AT MOST ONCE PER SESSION — once read, its guidance holds for
the rest of the session; do not re-Read it for the 2nd, 3rd, ... Nth file of the same type
(e.g. touching five `.ts` files loads 700-observability.md and 900-performance.md once, not
five times). This applies to every rule file below, not just the two with overlapping globs.
000-security (always) | 001-conventions (always, incl. modern tech preferences)
100-web (*.tsx,*.jsx,*.vue,*.svelte,*.astro) — design tokens, 8px grid, skeleton, SEO, WCAG 2.2
200-api (**/api/**,**/routes/**,**/controllers/**) — REST, OpenAPI 3.1, error format
300-testing (*.test.*,*.spec.*) — pyramid ratios, mock policy, naming
400-mobile (*.swift,*.kt,**/lib/**/*.dart) — platform patterns, Keychain, gestures
500-database (**/migrations/**,**/*.prisma,**/models/**) — schema safety, N+1, RLS
600-devops (Dockerfile*,**/.github/**,**/*.tf) — non-root, SHA-pin, SBOM, OIDC
700-observability (**/*.ts,**/*.py,**/*.go,**/*.java) — logging levels, metrics, tracing, correlation IDs
800-llm-safety (**/ai/**,**/llm/**,**/openai/**,**/anthropic/**,**/claude/**) — prompt injection, output trust, cost controls
900-performance (**/*.ts,**/*.tsx,**/*.py,**/*.go,**/*.java,**/*.cs) — CWV budgets, bundle limits, API latency, N+1

Deterministic enforcement: ~/.claude/hooks/protected-paths.mjs (PreToolUse) mirrors the HARD
STOPS at the harness level — wired into settings.json by default on install; `--no-hooks` /
`-NoHooks` opts out, activation steps in hooks/README.md.

Lazy-load docs (all under agent_docs/): architecture.md | design-system.md | testing-strategy.md |
security-protocols.md | api-design-patterns.md | seo-patterns.md | error-handling-patterns.md |
from-scratch-guide.md | new-page-guide.md | new-screen-guide.md | dep-check-guide.md |
env-audit-guide.md | api-versioning-guide.md | zero-downtime-migration.md | devops-security-guide.md
