<!-- SCOPE: global — installed to ~/.claude/CLAUDE.md (plugin install or SETUP.md)
     Purpose: applies to ALL Claude Code sessions across every project
     Per-project file: presets/generic/fallback/CLAUDE.md → PROJECT/CLAUDE.md (see SETUP.md Step 2) -->

# Global Claude Senior Protocol v4.0

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
| 3 | Protected area, multi-system, DB | plan mode → approval | 6 lines |
| 4 | Destructive, billing, prod data | risk analysis | explicit approval |

Min tier signals (highest wins): auth/JWT/session=3 | payment=3 | DB schema/migration=3
CI-CD/Docker/IaC=3 | API endpoint added/removed/renamed=2 | shared type/DTO changed=2
>5 files=2 | DROP/TRUNCATE/bulk-delete=4 | prod config/secrets=4
Tier 3+: use native plan mode (read-only) for the plan — edits begin only after explicit approval.
`--now` flag: skips plan on Tier 2 only. Never skips hard stops, Tier 3+ plan, tests, verification.

---

## AGENT ROUTING

Escalation signals ALWAYS route to their guard (mirrored by the protected-paths hook):
DB schema/model/index/migration/destructive data → db-guard
auth / payment / security → security-guard | CI-CD / Docker / IaC → devops-guard
large feature / architecture → architect (plan-only)

Everything else: delegate by agent description — each agent's frontmatter states its scope and
model tier. Full decision tree, tier map, and EN+TR trigger phrases:
`~/.claude/agents/ROUTING.md` (read on demand, not preloaded).

AMBIGUITY: >80% clear → act | 50-80% → state assumption + act | <50% → ask ONCE specifically
Stack trace present → bug-hunter, no clarification needed.
Protected area signal → ALWAYS escalate regardless of confidence.

---

## BOOT SEQUENCE — silent, once per session

Tier 0 (1 file <10 lines, no protected area): SKIP — go straight to the edit, no boot reads.
Tier 1+: run once per session (skip missing, never guess):

1. Manifest: package.json/pubspec.yaml/go.mod/Cargo.toml/pom.xml/composer.json/Gemfile/requirements.txt
   PKG_MANAGER: bun.lockb=bun | pnpm-lock.yaml=pnpm | yarn.lock=yarn | package-lock.json=npm | uv.lock=uv | Pipfile.lock=pipenv
   Runtime override: deno.json=Deno | pubspec.yaml=Flutter | *.csproj=.NET | Package.swift=Swift
2. Config: tsconfig.json/vite.config.*/next.config.*/tailwind.config.* (Tailwind v4: @theme in CSS, no tailwind.config.js)
3. CI/CD: .github/workflows/*.yml/Dockerfile/railway.toml/fly.toml → DEPLOY
4. ORM: *.prisma/migrations/knexfile.*/drizzle.config.* → DB+ORM
5. Architecture: src/ or app/ 1-level → layered(controllers/services/repos) or vertical-slice(features/)
6. 1 test file → TEST_CMD, framework | 1 file per layer → CONVENTIONS

Build: TEST_CMD | LINT_CMD | BUILD_CMD | PKG_MANAGER | ARCH | CONVENTIONS. Mark UNKNOWN if undetectable.
Exact per-stack test/lint/build/type-check commands (18 stacks, targeted-test flags):
read `~/.claude/agent_docs/stack-commands.md` the first time a command is actually needed.

Protected patterns (Tier 3 always): middleware.ts|auth.ts|app/api/ (Next.js) |
AuthModule|Guards (NestJS) | settings.py|urls.py (Django) | SecurityConfig (Spring) |
RLS policies (Supabase) | Security rules (Firebase)

---

## CORE BEHAVIORS

UNDERSTAND BEFORE CHANGING — read 1-2 existing files of same type first.
Smallest safe diff. No refactoring while fixing bugs. No features while fixing bugs.

SKILL CHECK — before starting any implementation task, check installed skills for a match
(bug-fix, feature-build, new-page, db-change, …); if one matches, follow it — don't improvise.

ORPHAN CLEANUP — remove only imports/vars/functions YOUR edit made unused. Pre-existing dead
code noticed along the way: leave it, flag with FWD: (see below) — don't delete unless asked.

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

CONTEXT DISCIPLINE:

- The model cannot see its own token count or run /compact — after long read chains or several
  Agent() calls, say: "Session is getting large — consider /compact or a fresh session."
- /compact summarizes and CONTINUES; /clear WIPES. Task unfinished + context full → /compact.
  Before /clear: persist durable facts to memory/*.md + MEMORY.md so the next session reloads them.
- Push read-heavy sweeps into subagents (own context window; only the summary returns). ONE topic
  per call; pass known project context (TEST_CMD, paths) in the prompt — subagents start blank.
  Keep subagent RETURN payloads short: a conclusion, not a transcript.
- N parallel subagents cost ~N× tokens — reserve for genuinely independent work.
- Unused MCP servers still load their tool schemas — check /mcp, disconnect what's irrelevant.
- Fresh session for unrelated tasks; never continue an old one out of convenience.

CLAUDE_CODE_SUBAGENT_MODEL overrides EVERY subagent's model (higher precedence than agent
frontmatter) — never set it globally; it silently downgrades opus-tier guards. For cost control
pass `model` per Agent() call instead.

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

TARGETED TEST ONLY — never full suite for 1-file change. Exact command per stack:
`~/.claude/agent_docs/stack-commands.md`.
No test file → create minimal spec same turn: happy path + edge + error (3 tests).
VERIFY BY CHANGE TYPE: behavior→test | new file→lint+test | new route→build | CSS→lint | type→type-check

DEPENDENCY AUDIT (auto-trigger on dep add/update): command by runtime in
rules/000-security.md's DEPENDENCY AUDIT COMMANDS table.
DEP-DRIFT: [pkg] v[current] → v[latest] — [reason]

---

## RULES REFERENCE

Rules live in ~/.claude/rules/ — the harness injects each automatically when a file matching its
frontmatter `paths:` globs is read; 000/001 have no `paths:` and load every session. Never
manually Read a rule file to "load" it: injection is automatic, once per session. Topics:
000-security (always) | 001-conventions (always, incl. modern tech preferences)
100-web — design tokens, 8px grid, skeleton/empty/error states, motion, SEO, WCAG 2.2
200-api — REST, OpenAPI 3.2, RFC 9457 errors, auth checklist, rate limiting
300-testing — pyramid ratios, mock policy, naming, targeted commands
400-mobile — iOS/Android/Flutter/RN platform patterns, Keychain, a11y
500-database — schema safety, migrations escalate, N+1, RLS
600-devops — non-root Docker, SHA-pin Actions, OIDC, SBOM, IaC
700-observability — log levels, metrics, tracing, correlation IDs
800-llm-safety — prompt injection, output trust, cost controls
900-performance — CWV budgets, bundle limits, API latency, N+1

Deterministic enforcement (independent of these instructions): `settings.json`'s
`permissions.deny` blocks Read of the NEVER READ OR OUTPUT list above;
`~/.claude/hooks/protected-paths.mjs` (PreToolUse) turns Edit/Write/NotebookEdit into the
STOP + ESCALATE list into an explicit approval prompt naming the guard agent.
Activation and opt-out steps: hooks/README.md.

Lazy-load docs (all under agent_docs/, read on demand): architecture | design-system |
testing-strategy | security-protocols | api-design-patterns | seo-patterns |
error-handling-patterns | from-scratch-guide | new-page-guide | new-screen-guide |
dep-check-guide | env-audit-guide | api-versioning-guide | zero-downtime-migration |
devops-security-guide | stack-commands
