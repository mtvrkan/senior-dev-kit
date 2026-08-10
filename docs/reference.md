<!-- GENERATED FILE — do not edit by hand.
     Source of truth: the frontmatter of agents/*.md, skills/*/SKILL.md, rules/*.md and
     commands/*.md. Regenerate with `npm run gen-docs`; `npm run docs-check` fails the
     gate when this file and that frontmatter disagree. -->

# Reference

Every component this kit installs, derived from its own frontmatter each time
`npm run gen-docs` runs. If something here disagrees with the files on disk, the gate fails —
so this page cannot quietly go stale the way a hand-written list does.

New here? Start with [install](install.md), then [usage](usage.md).

---

## Agents

An agent is *who* handles a request: a persona with its own tool grant, model tier and turn
budget. Guards carry no `Edit` or `Write` tool, so "it will write a plan first" is a property
of the configuration rather than a promise the model has to keep. They do keep `Bash` for
read-only investigation, which means their write-prevention is exactly as strong as the deny
rules in [`SECURITY.md`](../SECURITY.md) — strong, but not a sandbox.

| Agent | Model | Access | Bound skills |
| --- | --- | --- | --- |
| `bug-hunter` | sonnet | read + write | `bug-fix` |
| `db-guard` | opus | **read-only** | `db-change`, `migration-review` |
| `devops-guard` | opus | **read-only** | `release-gate`, `security-scan`, `/env-audit` |
| `performance-guard` | sonnet | **read-only** | `performance-check` |
| `security-guard` | opus | **read-only** | `security-review`, `security-scan` |
| `senior-engineer` | sonnet | read + write | `feature-build`, `refactor-safe`, `test-writer`, `codebase-overview`, `api-design`, `from-scratch`, `project-memory` |
| `ui-fixer` | sonnet | read + write | `ui-change`, `new-page`, `new-screen` |

Routing between them is decided by [`agents/ROUTING.md`](../agents/ROUTING.md).

### `bug-hunter`

Use for localized bugs, runtime errors, failing tests, console errors, regressions, or broken behavior where root cause can be isolated. Escalate protected areas.

- **Tools:** `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`
- **Model / effort:** sonnet · medium
- **Permission mode:** `default`
- **Turn budget:** 8
- **Definition:** [`agents/bug-hunter.md`](../agents/bug-hunter.md)

### `db-guard`

Use for database schema changes, data modeling, ORM queries, indexes, constraints, transactions, and migration deployment safety (destructive changes, rollback, backward compatibility, production risk, deployment order, backups). Read-only — produces a plan, waits for approval; never executes migrations.

- **Tools:** `Read`, `Grep`, `Glob`, `Bash`
- **Model / effort:** opus · high
- **Permission mode:** `plan` — plans first instead of acting. Claude Code strips `permissionMode` from plugin-shipped agents, so this holds for `~/.claude` installs; the tool grant above is what holds in both
- **Turn budget:** 10
- **Definition:** [`agents/db-guard.md`](../agents/db-guard.md)

### `devops-guard`

CI/CD, Docker, Terraform, Kubernetes, and infrastructure change guardian — plans first, requires explicit approval for destructive or production-affecting changes. Use for: GitHub Actions, GitLab CI, K8s manifests, Helm charts, docker-compose, deployment scripts.

- **Tools:** `Read`, `Grep`, `Glob`, `Bash`
- **Model / effort:** opus · high
- **Permission mode:** `plan` — plans first instead of acting. Claude Code strips `permissionMode` from plugin-shipped agents, so this holds for `~/.claude` installs; the tool grant above is what holds in both
- **Turn budget:** 8
- **Definition:** [`agents/devops-guard.md`](../agents/devops-guard.md)

### `performance-guard`

Use for slow queries, N+1, bundle size, caching, render loops, memory leaks, latency, and expensive computations.

- **Tools:** `Read`, `Grep`, `Glob`, `Bash`
- **Model / effort:** sonnet · high
- **Permission mode:** `plan` — plans first instead of acting. Claude Code strips `permissionMode` from plugin-shipped agents, so this holds for `~/.claude` installs; the tool grant above is what holds in both
- **Turn budget:** 10
- **Definition:** [`agents/performance-guard.md`](../agents/performance-guard.md)

### `security-guard`

Use for auth, authorization, payment, billing, input validation, secrets, injection risks, session/token handling, rate limiting, sensitive data, and security reviews — plus tool-driven dependency, secret, SAST, and container/filesystem scans. Read-only by default — delegates implementation to senior-engineer.

- **Tools:** `Read`, `Grep`, `Glob`, `Bash`
- **Model / effort:** opus · high
- **Permission mode:** `plan` — plans first instead of acting. Claude Code strips `permissionMode` from plugin-shipped agents, so this holds for `~/.claude` installs; the tool grant above is what holds in both
- **Turn budget:** 10
- **Definition:** [`agents/security-guard.md`](../agents/security-guard.md)

### `senior-engineer`

Use for scoped medium feature implementation or safe refactors requiring multiple files, tests, and existing project patterns. Do not use for critical protected changes without a plan.

- **Tools:** `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`, `Agent`
- **Model / effort:** sonnet · medium
- **Permission mode:** `default`
- **Turn budget:** 10
- **Definition:** [`agents/senior-engineer.md`](../agents/senior-engineer.md)

### `ui-fixer`

Use for low-risk frontend-only UI changes — modals, buttons, layout, responsive styling, Tailwind/CSS, component polish, new pages, new screens. Do not use for backend, auth, payment, database, migrations, secrets, or CI.

- **Tools:** `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`
- **Model / effort:** sonnet · low
- **Permission mode:** `default`
- **Turn budget:** 6
- **Definition:** [`agents/ui-fixer.md`](../agents/ui-fixer.md)

---

## Skills

A skill is *how* a task gets done: a written procedure any agent can follow. Most fire on
their own when the request matches their shape — you never type their name.

### Auto-triggered

| Skill | Fires when | Runs in |
| --- | --- | --- |
| `api-design` | Use automatically before any new API endpoint, when API shape is unclear, or when a change breaks existing clients (removed/renamed field, new required field, error-format/auth change). | main loop |
| `bug-fix` | Use automatically when something that worked is now broken and the cause is localizable. | main loop |
| `code-review` | Use automatically after meaningful changes or when the user asks for review. | main loop |
| `codebase-overview` | Use when starting on an unfamiliar codebase, when no overview exists yet, or after structural change since the last one was written. | `senior-engineer` |
| `db-change` | Use automatically when schema, models, queries, indexes, constraints, or data shape change — or when modeling entities for a new feature. | main loop |
| `docs-update` | Use automatically for documentation-only changes. | main loop |
| `feature-build` | Use automatically once risk is low/medium and scope is clear — no plan phase needed. | main loop |
| `feature-plan` | Use automatically before any code when scope is large, unclear, or risky. | main loop |
| `from-scratch` | Use when user says "new project", "start from scratch", "build X from zero", or when no existing codebase is present. | `senior-engineer` |
| `incident-response` | Use automatically on live-incident language — "prod is down," "P1," "outage," "5xx spike" — not for routine bug reports with no urgency signal. | main loop |
| `migration-review` | Use automatically for migrations, destructive DB changes, backfills, rollback, and production data risk. | `db-guard` |
| `new-page` | Use automatically when the task is to create a new page, route, or screen in the admin panel from scratch. | main loop |
| `new-screen` | Use automatically when the task is to create a new screen or major UI section in a mobile app from scratch. | main loop |
| `performance-check` | Use automatically on any slowness or resource-bloat complaint about existing code. | `performance-guard` |
| `project-memory` | Use automatically before /clear when unresolved context matters, after a confirmed architecture decision, or on "remember this." Invoke /project-memory to review the file directly. | main loop |
| `refactor-safe` | Use automatically only when the change must leave behavior identical. | main loop |
| `release-gate` | Use automatically for pre-release safety review, or invoke via /release-gate right before deploy. Do not deploy. | `devops-guard` |
| `security-review` | Use automatically whenever a change touches any security-sensitive area in the description's list. | `security-guard` |
| `security-scan` | Auto-trigger on dep add/update, auth/payment/DB/API/secrets/CI/release changes, or explicit user request. | `security-guard` |
| `test-writer` | Use automatically when behavior changes, or manually when the user asks for tests — including adding coverage to existing untested/legacy code with no behavior change. | `senior-engineer` |
| `ui-change` | Use automatically only for small frontend UI edits. Avoid backend, auth, DB, payment, migrations, secrets, and CI. | main loop |

### Manual only

These set `disable-model-invocation: true`. Claude Code will **never** trigger them on its
own however well a request matches — they run only when you type the slash command.

| Command | Use it when | Runs in |
| --- | --- | --- |
| `/deep-research` | Manually invoke for multi-source factual research, competitive analysis, technology comparison, or market research. | main loop |
| `/env-audit` | Manually invoke when setting up a new environment, debugging "undefined env var" errors, onboarding, or before a production deployment. | `devops-guard` |
| `/kit-doctor` | Manually invoke when the kit misbehaves after an install or upgrade — verifies what is actually on disk instead of guessing. | main loop |
| `/kit-setup` | Run once after installing the plugin, or when /kit-doctor reports the rules are missing. | main loop |

---

## Rules

Rules are house style, injected automatically. Two load on every turn in every project; the
rest load only once you open a file their `paths:` globs match, so a Flutter project never
pays for the REST-API rules.

| Rule | Loads when | Governs |
| --- | --- | --- |
| [`000-security.md`](../rules/000-security.md) | **every session** — no `paths:` field | Core security rules — passive scan on every change, OWASP 2025, supply chain, protected files. No paths field: loads unconditionally every session. |
| [`001-conventions.md`](../rules/001-conventions.md) | **every session** — no `paths:` field | Core development conventions — architecture patterns, holistic consistency, modern tech preferences. No paths field: loads unconditionally every session. |
| [`100-web.md`](../rules/100-web.md) | `**/*.{tsx,jsx,vue,svelte,astro,html,css,scss}` · `**/*.blade.php` · `**/*.erb` · `**/*.component.ts` | Web UI rules — design tokens, 8px grid, skeleton loading, motion, SEO, WCAG 2.2, Tailwind v4. Auto-loads for React/Vue/Svelte/Astro/Angular/Blade/ERB/plain HTML. |
| [`200-api.md`](../rules/200-api.md) | `**/api/**` · `**/routes/**` · `**/controllers/**` · `**/handler/**` · `**/handlers/**` · `**/endpoints/**` · `**/*.controller.*` · `**/*.routes.*` · `**/Controllers/**` · `**/*Controller.{java,kt,cs,php}` · `**/*Resource.java` · `**/*Endpoint.{java,kt,cs}` · `**/routers/**` · `**/{views,viewsets,urls}.py` | API design rules — REST conventions, OpenAPI 3.2, error format, auth, rate limiting, versioning. Auto-loads for route/controller/handler/endpoint files. |
| [`300-testing.md`](../rules/300-testing.md) | `**/*.test.*` · `**/*.spec.*` · `**/test/**` · `**/__tests__/**` · `**/tests/**` · `**/*_test.*` · `**/*_spec.*` · `**/test_*.py` · `**/*Test.{java,kt,cs,swift}` · `**/*Tests.{java,kt,cs,swift}` · `**/*Spec.{java,kt,groovy}` · `**/tests.py` · `**/conftest.py` | Testing rules — pyramid ratios, mock policy, naming conventions, stability, coverage. Auto-loads for test/spec files. |
| [`400-mobile.md`](../rules/400-mobile.md) | `**/*.{swift,kt}` · `**/lib/**/*.dart` · `**/test/**/*.dart` · `**/android/**` · `**/ios/**` · `**/*.native.{ts,tsx,js,jsx}` · `app.config.{js,ts}` · `**/apps/*/app.config.{js,ts}` · `**/packages/*/app.config.{js,ts}` · `**/metro.config.{js,cjs}` | Mobile rules — iOS Swift, Android Kotlin/Compose, Flutter/Dart, React Native. Auto-loads for mobile source files. |
| [`500-database.md`](../rules/500-database.md) | `**/migrations/**` · `**/*.prisma` · `**/schema.*` · `**/models/**` · `**/knexfile.*` · `**/drizzle.config.*` · `**/*migration*` · `**/{Models,Entities,entities}/**` · `**/*.entity.*` · `**/*DbContext.cs` · `**/db/{migration,changelog}/**` | Database rules — schema safety, migration protocol, N+1 prevention, RLS, zero-downtime patterns. Auto-loads for migration/schema/model files. |
| [`600-devops.md`](../rules/600-devops.md) | `**/Dockerfile*` · `**/.github/**` · `**/*.tf` · `**/docker-compose*` · `**/kubernetes/**` · `**/*.k8s.*` · `**/helm/**` · `**/k8s/**` · `**/charts/*/templates/**` · `**/charts/*/{Chart,values}*.{yaml,yml}` · `**/manifests/**/*.{yaml,yml}` · `**/deploy/**/*.{yaml,yml}` · `**/kustomization.{yaml,yml}` · `**/*.tfvars` · `**/.gitlab-ci.yml` · `**/railway.toml` · `**/fly.toml` · `**/.pre-commit-config.yaml` | DevOps rules — Docker security, GitHub Actions SHA pinning, OIDC, SBOM, IaC safety. Auto-loads for Dockerfile/CI/IaC files. |
| [`700-observability.md`](../rules/700-observability.md) | `**/*.{ts,tsx,js,jsx,mjs,py,go,java,kt,kts,cs,rb,php,dart,swift,rs,c,cc,cpp,cxx,h,hpp}` | Logging, metrics, tracing — every service and handler change |
| [`800-llm-safety.md`](../rules/800-llm-safety.md) | `**/ai/**` · `**/llm/**` · `**/openai/**` · `**/anthropic/**` · `**/claude/**` · `**/agents/**/*.{ts,tsx,js,jsx,py,go}` | LLM/AI integration safety — prompt injection, output trust, cost controls |
| [`900-performance.md`](../rules/900-performance.md) | `**/*.{ts,tsx,js,jsx,mjs,py,go,java,kt,kts,cs,rb,php,dart,swift,rs,c,cc,cpp,cxx,h,hpp,css,scss,vue,svelte,astro,html}` | Performance budgets — CWV, bundle size, query latency, render |

---

## Slash commands

| Command | What it does | Takes |
| --- | --- | --- |
| `/agents-guide` | List all installed Senior Dev Kit agents and when to use each one. | — |
| `/seo-check` | Audit the project for SEO, AEO, Core Web Vitals, and technical SEO issues. | "[page or route — optional]" |
| `/skills-guide` | List all installed Senior Dev Kit skills and when each one auto-triggers. | — |

The manual-only skills listed above are invoked the same way, by typing their name.
