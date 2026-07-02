# PROJECT BOOTSTRAP — Autonomous Software Team Setup

> **Purpose:** When Claude Code reads this file, it first scans the project with minimal tokens, detects the technologies used (or intended), then **generates a project-specific `.claude/` setup itself** (CLAUDE.md, settings, agents, skills, rules). After that, every phase stays faithful to that setup, delegating to multiple subagents and operating like a professional software company — with **planning as a hard gate** and **security designed in from the first line**, all under strict TDD.
>
> **How this relates to the rest of the kit:** This bootstrap deliberately generates a **lean 7-agent roster** (architect, security-reviewer, implementer, test-author, reviewer, debugger, researcher) sized for a brand-new project — it does **not** install the kit's 17 prebuilt agents, 33 skills, or 12 commands. The generated team is a from-scratch template tailored to your stack; the prebuilt kit is a broader, maintained catalogue. If you later want the full kit in the same project, run the installer (README.md Options B/C/D) on top — the two coexist, and the installer backs up anything it would overwrite.

---

## 0. HOW TO RUN

Place this file at the project root and tell Claude Code:

```text
Read PROJECT-BOOTSTRAP.md and apply it starting from PHASE 0. Work autonomously; ask me as little as possible.
```

After the first run, copy this file to `.claude/skills/team-bootstrap/SKILL.md` in your project to re-trigger it in future sessions with `/team-bootstrap`.

---

## 1. GLOBAL PRINCIPLES (always in force, every phase)

These principles also form the core of the generated `CLAUDE.md`. They are non-negotiable.

### 1.1 Plan before you touch anything

- **No code without an approved plan.** Planning is not a formality — it is the most important phase. A wrong plan multiplies cost downstream.
- Every work item starts with a written plan: target behavior, affected files/modules, data flow, edge cases, **a threat model**, and a test list. See PHASE 1 (Plan) for the required structure.
- Use **plan mode** for any non-trivial change before editing. The plan is reviewed (by the architect, and by the security-reviewer for anything touching trust boundaries) before a single line is written.
- Prefer the smallest correct plan. If two designs are viable, the one with the smaller attack surface wins.

### 1.2 Security is a design property, not a later check

- **Threat-model during planning, not after shipping.** For each work item, identify trust boundaries, untrusted inputs, secrets, authn/authz needs, and abuse cases up front.
- Secure defaults everywhere: validate all external input, parameterize all queries, least-privilege for tokens/roles, deny-by-default authorization, no secrets in code or logs, safe error handling (no internal detail leakage).
- A dedicated **security-reviewer** agent reviews every change that touches a trust boundary (input handling, auth, data access, crypto, file/network/process, dependencies, config).
- Hooks enforce the floor deterministically: secret scanning before writes, dependency/vuln checks, and blocking dangerous commands.

### 1.3 Token discipline

- For discovery and search, use **`Glob`/`Grep` first**; read full files only when needed. Manifests (package.json, pyproject.toml, etc.) are small — read them fully; **sample** source files instead of reading everything.
- Never re-read the same file; read once, note what matters.
- Delegate noisy/long work (deep search, log analysis, broad refactor exploration, dependency audit) to a **subagent** so intermediate output never pollutes the main context — only a summary returns.
- Keep CLAUDE.md and skill bodies **short**: every loaded line is a recurring token cost. State *what to do*, not why/how.
- Batch edits; plan large changes first, then apply.

### 1.4 Model strategy (cost/quality balance)

- **Planning / architecture / security & critical review → Opus.** Implementation / coding → Sonnet. Classification, retrieval, simple scans → Haiku.
- Use **`opusplan`** in the main session: planning runs on Opus, execution drops to Sonnet automatically.
- Override per subagent via the `model:` field (see roster). Spend the frontier model only where it earns its keep.
- Keep token/context usage visible via **statusLine**; track session cost with `/cost`.

### 1.5 Delegation (work like a team)

- Main thread = **Orchestrator**. It writes no code; it plans, splits, delegates to the right agent, merges results, and enforces gates.
- Each specialist task runs in a subagent with its own context window. Independent tasks run in parallel.

### 1.6 TDD is mandatory (the heart of Done)

- **Failing test first (red)**, then the minimum code that passes (**green**), then **refactor**. No implementation without a test.
- A task is not "done" until tests are green **+** lint is clean **+** types check **+** security review passes. Hooks enforce this gate deterministically.

---

## PHASE 0 — DISCOVERY

> Goal: Learn the project with minimal tokens, detect the stack, produce a plan.

**Steps:**

1. **Check existing setup:** Does `.claude/` already exist? If so, do not overwrite — fill gaps, preserve what's there, report conflicts.
2. **Read context files:** Any `CLAUDE.md`, all root-level `*.md` (README, docs, ADRs), and any memory/notes given for this project. These may also state *intended* technologies.
3. **Detect the stack from manifests** (find with `Glob`, read the relevant one fully):
   - JS/TS: `package.json`, lockfile, `tsconfig.json`, framework (Next/React/Vue/Express/Nest…), test runner (vitest/jest), linter (eslint/biome).
   - Python: `pyproject.toml`/`requirements.txt`, `pytest`, ruff/black, framework (FastAPI/Django/Flask).
   - Go: `go.mod`; Rust: `Cargo.toml`; Java: `pom.xml`/`build.gradle`; PHP: `composer.json`, etc.
   - DB/infra: docker-compose, Dockerfile, migrations, `.env.example`, CI files (`.github/workflows`).
4. **Sample the source:** Produce a directory tree (`tree`/`Glob`); read **a few** representative files to grasp the architecture — not all of them.
5. **Security surface scan (lightweight):** Note where untrusted input enters, where secrets live, and which auth/data-access patterns exist. This seeds the threat model.
6. **If info is missing** (e.g., empty repo + intent only): use the target technologies stated in the provided `.md`/memory.

**Phase 0 output — short "Stack Report" + Plan:**

- Languages, frameworks, test/lint/build tools, package manager, DB, CI, deploy target.
- Commands: `build`, `test`, `lint`, `typecheck`, `run/dev`, `format`.
- Initial **trust-boundary map** (entry points, secrets, auth surfaces).
- List of `.claude/` files to generate + proposed team roster + skill set.
- **Single approval gate:** "I'll set up per this plan — approve?" If the user said *autonomous*, skip this gate and go straight to PHASE 1.

---

## PHASE 1 — SCAFFOLD (generate the `.claude/` setup)

> Goal: Write a project-specific, short, precise configuration based on the detected stack.

### 1.0 Verify the schema first (critical)

`settings.json` and skill/agent frontmatter schemas change over time. Before writing files, **confirm the current keys against the official Claude Code docs**:

- Docs map: `https://docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md`
- In particular: settings keys (hooks, permissions, statusLine, outputStyle, model), hook event names, skill frontmatter (`disable-model-invocation`, `allowed-tools`, `context: fork`, `agent:`), agent frontmatter (`tools`, `model`, `memory`, `mcpServers`).
The templates below are reference only; adapt to the verified schema.

### 1.1 Target directory layout

```text
.claude/
├── CLAUDE.md             # project memory (short, target <~500 tokens)
├── settings.json         # model strategy, hooks, statusLine, permissions
├── rules/
│   ├── planning.md       # how plans must be written (required structure)
│   ├── security.md       # secure-by-default rules (path-scoped)
│   ├── tests.md          # test/TDD rules
│   ├── conventions.md    # code style / architectural patterns
│   └── <stack>.md        # stack-specific rules (e.g. nextjs.md, fastapi.md)
├── agents/
│   ├── architect.md          # planner/architect (Opus)
│   ├── security-reviewer.md  # threat modeling + security review (Opus)
│   ├── implementer.md        # implementer (Sonnet)
│   ├── test-author.md        # test author / TDD (Sonnet)
│   ├── reviewer.md           # code review (Opus/Sonnet)
│   ├── debugger.md           # root-cause + fix (Sonnet)
│   └── researcher.md         # discovery/research (Explore, Haiku/Sonnet)
├── skills/
│   ├── plan-feature/SKILL.md
│   ├── threat-model/SKILL.md
│   ├── tdd-cycle/SKILL.md
│   ├── security-review/SKILL.md
│   ├── review-gate/SKILL.md
│   ├── ship-pr/SKILL.md
│   └── docs-update/SKILL.md
└── .mcp.json             # (if needed) MCP server definitions
```

### 1.2 `CLAUDE.md` template (keep it short!)

```md
# <Project Name>

## Stack
<languages, frameworks, DB, package manager — one-line list>

## Commands
- build: <...>
- test: <...>
- lint: <...>
- typecheck: <...>
- dev/run: <...>

## Architecture (short map)
<main modules and their relationships — 4-6 lines. State design intent the code can't reveal.>

## Trust boundaries
<where untrusted input enters, where secrets live, auth/data-access surfaces — 3-5 lines>

## Rules
- Plan first: no code without an approved plan. See rules/planning.md
- Security by default: see rules/security.md (threat-model every change at a boundary)
- TDD mandatory: failing test first, then code. See rules/tests.md
- Conventions: rules/conventions.md ; Stack: rules/<stack>.md
- No commit without approval.

## Operating doctrine
- Orchestrator plans and delegates to specialists in agents/.
- Phase flow: Spec → Plan(+Threat model) → Red → Green → Refactor → Review(+Security) → Integrate → Docs.
- "Done" = tests green + lint clean + types clean + security review passed + review approved.
- Token discipline: Grep/Glob first; delegate noisy work to subagents; pick model per task (opusplan).
```

### 1.3 `rules/planning.md` template

```md
# Planning rules (no code without an approved plan)
Every work item's plan MUST contain:
1. Behavior: the change in one sentence + acceptance criteria.
2. Design: affected files/modules, data flow, key decisions, alternatives rejected.
3. Threat model: trust boundaries crossed, untrusted inputs, secrets, authn/authz,
   abuse cases, and the mitigation for each.
4. Test list: the failing tests to write first (happy path + edge + abuse cases).
5. Risk & rollback: what could break, how to detect, how to revert.
Plans are reviewed by architect (and security-reviewer if a boundary is touched)
BEFORE implementation. Prefer the smallest correct plan with the smallest attack surface.
```

### 1.4 `rules/security.md` template

```md
# Secure-by-default rules
- Validate and normalize ALL external input at the boundary; reject by default.
- Parameterize every query; never build SQL/commands by string concatenation.
- AuthZ deny-by-default; check on every privileged action, server-side.
- Least privilege for tokens/roles/service accounts; scope secrets narrowly.
- No secrets in code, logs, or error messages. Load from env/secret store.
- Safe errors: no stack traces or internal detail to clients.
- Pin and audit dependencies; avoid unmaintained/unknown packages.
- Crypto: use vetted libraries; never roll your own.
- Any change touching input/auth/data/crypto/file/network/process/config
  REQUIRES security-reviewer sign-off.
```

### 1.5 `settings.json` template (write per schema verified in 1.0)

```json
{
  "model": "opusplan",
  "statusLine": {
    "type": "command",
    "command": "<emit model + cwd + context/token usage, or use built-in>"
  },
  "permissions": {
    "allow": ["Bash(<test cmd>:*)", "Bash(<lint cmd>:*)", "Read", "Edit", "Write", "Grep", "Glob"],
    "deny": ["Bash(rm -rf:*)", "Bash(git push:*)", "Bash(curl:*)", "Bash(* | sh:*)"]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "<secret scan on content; block: exit 2>" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "<scan for dangerous/exfil commands; block: exit 2>" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "<run formatter: prettier/ruff/gofmt>" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "<run tests + lint + typecheck + dependency audit; fail: exit 2>" }] }
    ],
    "SubagentStop": [
      { "hooks": [{ "type": "command", "command": "<run the relevant tests for the subagent's change>" }] }
    ]
  }
}
```

> `exit 2` = a **hard stop** Claude Code respects every time. The TDD + security floor is enforced here. Fill commands per stack (e.g. `npm test`, `pytest -q`, `go test ./...`, `npm audit`, `pip-audit`).

### 1.6 Agent template (each specialist at `.claude/agents/<name>.md`)

```md
---
name: security-reviewer
description: Threat-models plans and reviews any change touching a trust boundary (input handling, auth, data access, crypto, file/network/process, dependencies, config). Use during planning and before integrating boundary changes.
tools: Read, Grep, Glob, Bash
model: opus
memory: project
---
You are a senior application security engineer. During planning you produce a concise
threat model (boundaries, untrusted inputs, secrets, authn/authz, abuse cases + mitigations).
During review you check for injection, broken access control, secret exposure, unsafe
deserialization, SSRF, path traversal, and dependency risk. You block on unmitigated
findings and return a short, prioritized list with concrete fixes.
```

Other agents follow the same shape: `architect` → `model: opus` (writes the plan), `implementer`/`test-author` → `model: sonnet`, `reviewer` → `model: opus`, `researcher` → read-only tools in an Explore-style flow.

### 1.7 Skill template (each playbook at `.claude/skills/<name>/SKILL.md`)

```md
---
name: plan-feature
description: Produces the required plan (behavior, design, threat model, test list, risk/rollback) for a work item before any code is written. Use at the start of every feature or bug fix.
allowed-tools: Read, Grep, Glob
---
1. Restate the behavior in one sentence + acceptance criteria.
2. Map affected files/modules and the data flow.
3. Delegate a threat model to security-reviewer (boundaries, inputs, secrets, authz, abuse cases + mitigations).
4. List the failing tests to write first (happy + edge + abuse).
5. State risk & rollback.
6. Get architect (and security-reviewer if a boundary is touched) sign-off, then hand to tdd-cycle.
```

> Descriptions act as a **trigger query** — be specific (when, and over which file scope). Add `context: fork` to skills you want isolated; add `disable-model-invocation: true` for manual-only skills.

---

## PHASE 2+ — EXECUTION PIPELINE

> Every work item flows through this pipeline. The Orchestrator runs the phases, enforces gates, and delegates to specialists. **Planning and security are gates, not steps you can skip.**

| Phase | Owner (agent/model) | Work | Exit gate |
| --- | --- | --- | --- |
| **Spec** | Orchestrator (Opus) | Reduce the request to one-sentence acceptance criteria | Criteria clear? |
| **Plan** | architect (Opus) + security-reviewer (Opus) | Full plan per rules/planning.md, including threat model | **Plan approved? Threat model complete?** |
| **Red** | test-author (Sonnet) | Write failing tests (happy + edge + abuse cases) | Tests red? |
| **Green** | implementer (Sonnet) | Minimum code to pass | All tests green? |
| **Refactor** | implementer (Sonnet) | Cleanup, naming, dedup | Still green? |
| **Review** | reviewer (Opus) + security-reviewer (Opus) | Quality + **security** review | Approved / fixes required? |
| **Integrate** | Orchestrator | Lint + typecheck + full suite + dependency audit + (if needed) merge | All gates pass? |
| **Docs** | researcher/doc | Update CLAUDE.md, README, ADRs (auto-invoke skill) | Docs current? |

**Parallelization:** Independent work items (e.g., two separate endpoints) run in parallel subagents, then merge. Dependent work runs sequentially.

**Failure handling:** If a gate fails, the debugger agent works in an isolated context, finds root cause, fixes it, and retries the gate. The main context stays clean.

---

## 2. QUALITY GATES — "Definition of Done"

A task is done only when **all** of these hold:

1. Relevant tests were red first, then green.
2. The full suite passes (no regressions).
3. Lint clean, types clean, formatter applied.
4. **Security review passed** (no unmitigated boundary findings; dependency audit clean).
5. Reviewer approved (no critical notes left).
6. Relevant docs updated.

These gates are enforced deterministically by the `Stop`/`SubagentStop`/`PreToolUse`/`PostToolUse` hooks in `settings.json` — not left to model judgment.

---

## 3. TEAM ROSTER (summary)

| Agent | Model | Role | Tool access |
| --- | --- | --- | --- |
| Orchestrator (main thread) | opusplan | Plans, splits, delegates, enforces gates | All |
| architect | opus | Architecture + implementation plan | Read, Grep, Glob (read-heavy) |
| security-reviewer | opus | Threat modeling + security review | Read, Grep, Glob, Bash |
| implementer | sonnet | Production code | Read, Edit, Write, Bash, Grep, Glob |
| test-author | sonnet | TDD tests | Read, Edit, Write, Bash, Grep, Glob |
| reviewer | opus | Quality review | Read, Grep, Glob, Bash |
| debugger | sonnet | Root cause + fix (isolated) | Read, Edit, Write, Bash, Grep, Glob |
| researcher | haiku/sonnet (Explore) | Discovery/research | Read, Grep, Glob, WebSearch |

> Adjust model assignments to project complexity; simple retrieval/classification drops to Haiku.

---

## 4. FIRST RUN — instruction to the Orchestrator

Give Claude Code the following:

```text
Read PROJECT-BOOTSTRAP.md.
1) Apply PHASE 0: scan the project with minimal tokens; produce a Stack Report + Plan
   (including an initial trust-boundary map).
2) Work autonomously: skip the single approval gate, generate the .claude/ setup in PHASE 1
   (verify the schema against current Claude Code docs first).
3) Then run the PHASE 2 pipeline to complete the first work item end-to-end with TDD.
For every work item, the Plan phase (with threat model) and the Security review are HARD GATES.
Follow token discipline and the model strategy (opusplan + per-agent overrides) throughout.
```

---

### Maintenance notes

- Don't bloat skills: 8–12 well-chosen skills cover most work; every loaded skill is a token tax. Audit monthly and delete unused ones.
- Commit `.claude/` to the repo so the setup travels with the project and changes go through PR review.
- Schemas change; repeat the 1.0 verification step after every major Claude Code update.
- Re-run the threat model whenever a new trust boundary, dependency, or data flow is introduced.
