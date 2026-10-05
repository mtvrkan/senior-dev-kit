# Agent Routing Decision Tree

Highest-priority signal wins. Read top-to-bottom; stop at the first match.

**Precedence order (memorize this line):** live-incident signal (Step 0) > guard-area noun (Steps 1 and 3) > stack trace (Step 2) > too-small-to-delegate (Step 3.5) > pure-lookup (Step 3.6) > task-type verb (Step 4). Step 0 outranks everything else because it doesn't pick an agent — it decides whether Steps 1-3 run as one coordinated, parallel dispatch instead of a single sequential match. A guard-area noun outranks every other remaining signal whenever the request **changes that guarded surface** — "fix CSS in the login form" is security-guard territory, not ui-fixer. A request that only *references* a guarded area without touching its code (writing tests against it, documenting it, researching it) routes by task type instead. Ties between two guard areas are resolved by blast radius (see "Multiple guard signals"); ties between non-guard signals by the [Conflict resolution](#conflict-resolution--when-two-signals-match) table.

---

## Step 0 — Live incident check (before everything else)

"Prod is down" / "P1" / "outage" / "5xx spike" / "users can't log in right now" — anything reporting
a *live* incident rather than a routine bug, even one carrying a stack trace or an obvious guard-area
noun — routes to the `incident-response` skill first, not straight to bug-hunter or a single guard.
It runs inline in the main loop and plans the dispatch — severity, blast radius, which of the
same Step 1/3 guards below; the main loop then invokes the guards (in parallel where safe) and
keeps one timeline for the postmortem. This check runs *before* Step 1 because it
doesn't compete with the hard-stop/guard-area/stack-trace signals below — it decides whether they
run as one coordinated dispatch instead of picking among them.

---

## Step 1 — Hard stop check (always first, after Step 0)

Does the request touch any of `global-CLAUDE.md`'s HARD STOPS nouns (auth, payment, DB schema,
CI/CD, secrets, infrastructure — see that section, already loaded every session, for the exact
list; not restated here so the two copies can't drift)?

**YES →** Do NOT route to any implementation agent.
Route directly to the appropriate guard (see Step 3) and produce a plan only.

---

## Step 2 — Error / crash signal

Is a stack trace or error message present?

```text
YES → bug-hunter (no clarification needed — read trace, fix, test)
      EXCEPTION: if trace touches auth/payment/DB schema → escalate to guard (Step 3)
      EXCEPTION: if the report also carries live-incident language (see Step 0) → incident-response skill, not bug-hunter directly
NO  → continue to Step 3
```

---

## Step 3 — Domain signal (guarded areas)

| Signal in the request | Agent | Tier |
| --- | --- | --- |
| auth / session / JWT / OAuth / login / logout | security-guard | 3 |
| payment / billing / invoice / subscription | security-guard | 3 |
| injection / XSS / CSRF / CVE / vulnerability | security-guard | 3 |
| secrets / API key / credential exposure / secret rotation | security-guard | 3 |
| DB schema / model / column / index / constraint | db-guard | 3 |
| migration / ALTER TABLE / DROP / data backfill | db-guard | 3-4 |
| CI/CD / GitHub Actions / Docker / Terraform / K8s / IaC / infrastructure / prod config | devops-guard | 3-4 |

Guard agents are **read-only planners** — they produce a written plan and pause for approval.
Implementation only starts after explicit user approval ("looks good", "proceed", "yes").

Where a row shows a tier range, severity within the domain picks the exact tier: additive
migration = 3, destructive `DROP`/`TRUNCATE`/bulk-delete = 4; routine CI/CD change = 3, prod
config/secrets = 4 (full trigger list: `global-CLAUDE.md` TOKEN TIER table — not restated here).

### Multiple guard signals in one request

When a request matches more than one row in the Step 3 table (e.g. "add an encrypted-token column" = auth + DB schema), route to **all** matching guards, sequenced by blast radius — widest-impact guard plans first, narrower guard reviews its slice before implementation:

```text
auth/payment + DB schema   → security-guard (data classification, encryption-at-rest) → db-guard
auth/payment + CI/CD       → security-guard (secrets, auth flow) → devops-guard
DB schema + CI/CD          → db-guard → devops-guard (deploy ordering)
```

Each guard's plan is shown before the next guard starts — never skip straight to implementation because one guard approved.

### db-guard runs both DB review phases

db-guard covers schema design AND migration deployment safety in one agent (two output modes):

```text
User: "add a column to users" / "add an index" (additive, GO-tier)
  → db-guard (schema design: additive-first, index analysis, risk classification
              + deployment safety: deploy order, rollback procedure, zero-downtime staging)
        → senior-engineer (implements only after the plan is approved)

User: "drop the legacy_status column" (destructive, STOP-tier — needs explicit user approval + verified backup)
  → db-guard (schema design flags it STOP + deployment safety spells out the rollback/backup requirement)
        → user approval required before senior-engineer implements

User: "review this migration file" (migration exists, no schema-design question)
  → db-guard, deployment-safety mode only (MIGRATION SAFETY REVIEW output)
```

---

## Step 3.5 — Is this worth an agent at all?

No guard area matched, no stack trace. Every other step picks *which* agent; this one decides
*whether*. A subagent is a fresh context window that re-reads the project from zero and returns
a summary — on Tier 0-1 work that costs several times what doing it directly costs, and buys
nothing. Over-routing is the failure mode a routing document is most likely to cause and least
likely to notice.

**Route to NO agent — handle it in the main loop — when any of these holds:**

```text
Tier 0-1 by global-CLAUDE.md's TOKEN TIER table (1-2 files, <10 lines, isolated)
Pure question / explanation / review-only, no edit requested
A typo, rename, copy tweak or comment in a file the user already named
```

This gate runs before the task-type table below, not after it. "Copy / CSS → ui-fixer" means
*once the work is big enough to delegate at all* — a one-word label change in one named file is
Tier 0 and stops here. Steps 0-3 always override this one: a one-line edit to `auth.ts` is a
guard's call however small it is.

---

## Step 3.6 — Is it just a lookup?

The work is big enough to delegate, but the question is *where something is*, not *what to do
about it* — locate a symbol/route/string, list who imports or calls X, inventory keys across many
files, confirm a pattern repo-wide.

```text
YES → Agent(subagent_type: "Explore", model: "haiku") — read-only, skips the CLAUDE.md hierarchy,
      returns path:line + verbatim lines. Protocol and prompt template: agent_docs/delegation-policy.md
      The caller (not the scout) decides what the findings mean and re-reads before editing.
NO  → Step 4
```

Never send a lookup to a custom kit agent: those load the whole CLAUDE.md hierarchy per spawn and
buy nothing a scout needs. Never send a decision to a scout.

---

## Step 4 — Task type signal

No guard area matched and the work is big enough to hand off. What kind of task is it?

```text
CSS / button / modal / copy / animation / layout    → ui-fixer   (sonnet, Tier 2; Tier 0-1 stopped at Step 3.5)
Bug / error in specific file, no guard area         → bug-hunter (sonnet, Tier 2; a stack trace already routed at Step 2)
Flaky / intermittent / no trace / cause unknown     → main loop, `systematic-debug` skill (Tier 2)
Upgrade a dependency major / migrate a library      → main loop, `dep-upgrade` skill (Tier 2; it needs WebFetch for
                                                      the migration guide; build/CI/auth libraries → their guard first)
New flow taking input, money or access, pre-build   → security-guard, `threat-model` skill (Tier 2-3)
Add test / update spec / regression coverage        → senior-engineer, `test-writer` skill (Tier 1-2)
Review a diff / PR / recent change                  → main loop, `code-review` skill (Tier 1-2)
New page / screen / component — pure UI             → ui-fixer   (sonnet, Tier 1-2)
Design has to be DECIDED, not matched: first page/  → design-lead (opus, Tier 2-3)
  screen with no DESIGN-SPEC.md · whole-project
  redesign · a brief with references or brand assets
  ("make it ours"). Restyling ONE existing component
  — "make this modal look modern" — is an edit against
  its neighbours, not a decision → ui-fixer, always
New page needing backend (upload, API, DB)          → senior-engineer (sonnet, Tier 2)
API contract / endpoint design / versioning         → senior-engineer (sonnet, Tier 2-3)
Normal feature, refactor, multi-file work           → senior-engineer (sonnet, Tier 2)
Slow query / N+1 / bundle / render loop             → performance-guard (sonnet, Tier 2-3)
Dep CVE / audit / outdated packages                 → security-guard (scan mode, Tier 1-2)
  (app/language dependency audit — "scan our dependencies" defaults here; container image
  or CI pipeline scan specifically → devops-guard instead, see below)
Large feature / architecture / system design        → main loop in native plan mode, running the
  incl. "should we migrate to X" evaluations           `feature-plan` skill (Tier 3); senior-engineer
                                                      implements the approved plan
New project / greenfield / starting from scratch    → main loop runs `from-scratch` (its phase gates need the user)
Research / fact-check / comparison                  → main loop; type /deep-research (Tier 2-3)
README / changelog / API docs                       → main loop, `docs-update` skill (Tier 0-1)
```

---

## Step 5 — Ambiguity resolution

Thresholds live in global-CLAUDE.md's AMBIGUITY line (always loaded — not restated here so the
two copies can't drift). Stack trace present → bug-hunter, no clarification needed.

---

## Conflict resolution — when two signals match

| Conflict | Winner | Reason |
| --- | --- | --- |
| Bug in auth code | security-guard (not bug-hunter) | Guard areas always win |
| Feature that needs DB column | db-guard plans first, senior-engineer implements | Schema change requires guard review |
| CSS bug that touches auth session display | security-guard | Auth signal dominates |
| Performance issue in a DB query | performance-guard reads, db-guard if schema change needed | Read-only perf = performance-guard; schema fix = db-guard |
| Refactor touching 6+ files | `feature-plan` in plan mode first, then senior-engineer | >5 files = Tier 2 min; large scope = Tier 3, plan before edits |
| Security scan vs. specific vulnerability fix | security-guard both — tool-driven scan mode for audits, code-review mode for fixes | Scan ≠ fix, but one agent owns both modes |
| Docs update that changes API contract | senior-engineer first; `docs-update` after | Contract change precedes docs |
| "Review my auth/payment/DB/CI code" (review verb + guard-area noun) | The matching Step 3 guard, not `code-review` | Guard-area nouns always outrank the generic "review/check" verb — `code-review` is for diffs with no guard-area signal |
| "Design the API contract" for one feature/service | senior-engineer (no full plan cycle) | `feature-plan` is for system-wide / multi-system design; a single service's API contract and versioning is Tier 2-3 engineering |
| New page that also needs backend (upload, API, DB) | senior-engineer (not ui-fixer) | ui-fixer is UI-only — anything requiring server/state work starts at senior-engineer instead of escalating mid-task |
| First page/screen of a project — no `DESIGN-SPEC.md` and nothing to match | design-lead (not ui-fixer) | Choosing a design direction is a decision made *with the user*; ui-fixer runs at low effort with a match-what-exists rule, so routing it there silently ships the default look. Once the spec exists, construction goes back to ui-fixer |
| "Make this modal / page nicer, more modern, more impressive" — ONE existing surface | ui-fixer (not design-lead) | Restyling something that already exists is an edit against its neighbours, whatever words the request uses. With a `DESIGN-SPEC.md` the direction is already decided and re-opening it is the drift the spec prevents; without one, the surrounding pages *are* the spec. design-lead enters only when there is nothing to match or the whole project is being re-decided |
| Refactor with no behavior change | senior-engineer (not bug-hunter) | Nothing is broken — bug-hunter needs an error/regression signal; behavior-preserving restructuring is normal engineering |
| Write tests for auth/payment/DB code | senior-engineer with `test-writer` (not the guard) | Tests exercise existing behavior without changing the guarded surface — escalate to the guard only if the tests expose a vulnerability |
| System-wide redesign that spans a guarded area (e.g. the whole checkout flow) | `feature-plan` in plan mode (not the guard) | Architecture-scale scope wins the entry point; the matching guards then review their slices of the plan before implementation (see "Multiple guard signals") |

---

## Escalation chain

```text
design-lead (only when the design must be decided; hands the built spec back down)
  └─▶ ui-fixer
ui-fixer
  └─▶ design-lead (no DESIGN-SPEC.md and nothing to match — a decision, not an edit)
  └─▶ senior-engineer (if backend or state needed)
        └─▶ `feature-plan` in native plan mode (if scope grows or design ambiguous)
              └─▶ security-guard / devops-guard ─────────────┐
              └─▶ db-guard (schema design + migration deployment safety) ─┤
              └─▶ performance-guard (read-only; reports back, does not implement) ─┤
                                                                └─▶ senior-engineer (implements approved plan)
                                                                      └─▶ `code-review` skill (optional post-implementation check)
```

---

## Agent vs. skill — who vs. how

An **agent** (`agents/<name>.md`) is a persona: it owns a tool grant, a model tier, a turn
budget, and (for guards) escalation authority. A **skill** (`skills/<name>/SKILL.md`) is a
reusable procedure any agent can run. `allowed-tools:` only pre-approves tools; it does not
remove any. A skill that must never edit says so with `disallowed-tools:`, which also strips those
tools from the rest of the turn — so an auto-triggered planning skill (`db-change`, `api-design`)
says "no code edits" in its body instead.

Most guard-style agents are bound 1:1 (or 1:few) to a same-purpose skill — the agent is *who*
handles the request (persona, tools, escalation), the skill is *how* (the procedure it
follows). Skills with no agent row below never run inside a kit agent: `docs-update`,
`feature-plan` (native plan mode), `from-scratch`, `incident-response`, `systematic-debug` and
`dep-upgrade` run inline in the main loop, and `code-review` forks an isolated read-only
subagent that the turn waits for (`background: false`). `api-design` and `project-memory` run in
the main loop, or inside `senior-engineer` when it calls them through its Skill tool. Flow skills
that DO have a row (`bug-fix`, `db-change`, `ui-change`, `new-page`, `new-screen`, …) are
dual-mode: invoked directly they run in the main loop; when their bound agent is dispatched, the
agent follows them as its procedure.

### Manual-only skills — routing never reaches these

Four skills set `disable-model-invocation: true` in their frontmatter. That flag tells Claude
Code never to auto-trigger them, no matter how well a request matches their description, so they
run only when **you** type the slash command:

`/deep-research` · `/env-audit` · `/kit-doctor` · `/kit-setup`

Everywhere they appear on this page they are written in slash form, because the row is telling
you what to type — not naming a destination the routing tables above will ever reach on their
own. `npm run validate` enforces that convention: a manual-only skill named in this file,
`global-CLAUDE.md`, either README, or `docs/` without its slash form on the same line fails the
gate. (Bare-name mentions were how the previous release ended up promising automatic routing to
a skill the model is structurally unable to invoke.)

| Agent (who) | Preloaded (`skills:`) | Forks into it (`agent:`) | Verb reflects |
| --- | --- | --- | --- |
| `bug-hunter` | `bug-fix` | — | fixing bugs |
| `performance-guard` | `performance-check` | `performance-check` | checking perf |
| `security-guard` | `security-review`, `security-scan` | `security-review`, `security-scan`, `threat-model` | reviewing / scanning / threat-modelling |
| `db-guard` | `db-change`, `migration-review` | `migration-review` | changing schema / reviewing migrations |
| `devops-guard` | `release-gate`, `security-scan` | `release-gate`, `/env-audit` (a manual-only skill cannot be preloaded) | gating a release |
| `ui-fixer` | `ui-change`, `new-page`, `new-screen` | — | building UI to a design that is already decided |
| `design-lead` | `new-page`, `new-screen` | — | deciding the design itself — direction, tokens, signature — then handing construction to `ui-fixer` |
| `senior-engineer` | `feature-build`, `refactor-safe`, `test-writer` | `test-writer`, `codebase-overview` | general implementation — the default implementer, not a specialist |

The two middle columns mirror each agent's `skills:` frontmatter and each skill's `agent:`
frontmatter, which `npm run validate` cross-references against real skill directories and agent
files — if this table goes stale relative to them, it's a documentation nit, not a broken
reference (the frontmatter bindings are the enforced source of truth).

---

## Natural language triggers (EN + TR)

| Keyword pattern | Routes to |
| --- | --- |
| fix / broke / error / crash / hata / düzelt | bug-hunter |
| add / create / build / implement / ekle / oluştur | senior-engineer |
| refactor / restructure / split / modularize / sadeleştir / böl | senior-engineer |
| design / look / visual / tasarla / görsel | design-lead — but a single existing component is ui-fixer (Step 4) |
| architecture / system design / plan / mimari | main loop, running the `feature-plan` skill in plan mode; senior-engineer implements |
| auth / login / token / session / JWT / güvenlik | security-guard |
| secret / API key / credential / gizli anahtar | security-guard |
| slow / perf / N+1 / bundle / yavaş | performance-guard |
| DB / schema / column / model / tablo | db-guard |
| migrate / migration / ALTER / DROP | db-guard |
| Docker / CI / pipeline / deploy / infra | devops-guard |
| review / check / incele / bak / diff | main loop, running the `code-review` skill |
| test / spec / coverage | test-writer |
| CSS / button / modal / tailwind / layout | ui-fixer |
| research / find / compare / araştır | main loop — offer `/deep-research` (never auto-routes) |
| README / docs / changelog / belge | docs-update |
