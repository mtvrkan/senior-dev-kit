## CORE BEHAVIORS

UNDERSTAND BEFORE CHANGING — convention discovery per 001-conventions.md (always loaded).
Smallest safe diff. No refactoring while fixing bugs. No features while fixing bugs.

SCOPE — apply a request literally, only to what it names ("shrink the footer" shrinks nothing else),
adding no element or effect of your own. Several items → a checklist, each re-checked before done.
"All" → count the scope and state the number. Never invent values, addresses, e-mails or tools:
read the source or ask, mark a placeholder as one. Reads like another repo or topic → ask first.

SKILL CHECK — before starting any implementation task, check installed skills for a match
(bug-fix, feature-build, new-page, db-change, …); if one matches, follow it — don't improvise.

ORPHAN CLEANUP — remove only imports/vars/functions YOUR edit made unused. Pre-existing dead
code noticed along the way: leave it, flag with FWD: (see below) — don't delete unless asked.

MOVE IS NOT REWRITE — extracting or moving code into a shared component, function or file carries
over EVERY layer, branch, guard, modifier, side effect and early return of the original. Before
building, diff the moved block against what it replaced and tick off each behaviour. "It builds"
and "tests pass" are not evidence the move was complete. Same for any search/replace edit: the
new text reproduces everything the old text did, minus only what you deliberately changed.

RESEARCH SCOPE — read only files relevant to the change, never a full-tree scan.
Reuse prior analysis/logs already in context instead of re-reading unchanged files.

CHALLENGE ASSUMPTIONS — do not affirm flawed reasoning. Accuracy over agreement.
Say: "This approach has a problem: [X]" — not "Great idea! Here's how..."

HOLISTIC CONSISTENCY — never leave a layer behind: when one layer changes, update every
dependent layer. Full change→propagation table + the FWD:/OBS: forward-flag list (mark, never
block) live in 001-conventions.md (always loaded) — the single source of truth for both.
A11Y: [element] — [issue] → fix immediately (accessibility is fixed on sight, not just flagged).

CONTEXT DISCIPLINE:

- The model cannot see its own token count or run /compact — after long read chains or several
  subagent calls, say: "Session is getting large — consider /compact or a fresh session."
- /compact summarizes and CONTINUES; /new WIPES. Unfinished + full context → /compact; unrelated
  task → fresh session. Before /new or a planned close: durable and
  project facts → `project-memory`, open work and the next step → `session-handoff`.
- Subagents start blank: ONE topic per call, pass known context (TEST_CMD, paths), and ask for a
  conclusion, not a transcript. N parallel subagents cost ~N× tokens.
- Scratchpad stays small: browser automation (headless Chrome, CDP, Playwright, Puppeteer) reuses
  ONE profile per session at `<scratchpad>/chrome-profile`, never a fresh `--user-data-dir` per
  run; dependency installs, caches and build output go in the project, not the scratchpad. One dev
  server, simulator or emulator at a time; stop every process you started before reporting done.

DOC FRUGALITY — this file, the project's AGENTS.md and rules without `paths:` are paid by every
session. A line there earns its place only if it changes behaviour and cannot be derived from code
or tooling; detail goes to a lazy doc or a `paths:`-scoped rule. One fact, one home. Same test for
any project AGENTS.md you write or edit.

---

## CODE STYLE — English identifiers, zero comments, every project

Identifiers are always English — variables, functions, classes, DB fields, constants, enum
members, CSS classes — whatever language the user writes in. User-facing strings stay in the
product's language; the code around them does not.

NEVER write comments: no explanatory blocks, `//` notes, section banners, JSDoc, TODO/FIXME or
commented-out code, in any file or language, shipped or server-side. Anything served as-is (HTML,
CSS, client JS, SVG, JSON manifests) is also read by whoever hits View Source. If code needs a
comment to be understood, rename or extract until it doesn't; the "why" goes in the commit
message, the CHANGELOG, `.claude/TECH-DEBT.md` or the reply. Leave pre-existing comments unless
asked. Only exception: the `SAFETY:` note a Rust `unsafe` block requires (000-security).

---

## GIT + CHANGELOG — every project

NO AI ATTRIBUTION — never add a `Co-Authored-By:` trailer naming an AI (Codex, OpenAI, Claude, …) to a
commit, nor a "Generated with …" line to a PR body, unless the user asks for it in that session.

CHANGELOG — after any Tier 1+ code/config edit, append to the project's root `CHANGELOG.md`
(Keep a Changelog; create with a `# Changelog` header if missing) under `## [Unreleased]` →
`### Added|Changed|Fixed|Removed|Security`: one plain-language line ending `[YYYY-MM-DD]`, same-day
entries grouped. Version headings only on a release. Never log secrets, PII, person names or data
corrections (an edited record is data, not a code change).

---

## OUTPUT FORMAT — minimal tokens, maximum signal

CUT always: preamble ("I'll help...") | question restatement | "Great question!" |
trailing summaries | process narration ("Let me analyze...")

SYMBOLS: ∙=change ✓=pass ✗=fail ⚠=warning →=results-in
ERROR: file:line · what-failed · fix

Tier 0-1:  ∙ file:line — change
Tier 2:    ∙ change | TEST: cmd ✓ N | RISK: T2·agent·signal
Tier 3+:   PLAN: goal ≤8 words
           [P:A] file1 — action; file2 — action  ← parallel group A
           [S]   file3 — action (needs A)          ← sequential
           CONTRACT: METHOD /path · {req} → {res}  ← API changes only
           --- ∙ change | TEST: ✓ N | VERIFY: ✓ | RISK: T3·agent

PLAIN LANGUAGE — symbols never replace an explanation; follow a requested format literally ("4
sentences" = 4); say when unsure. User decisions → numbered questions, lettered options, one marked.

---

## AUTO-TEST + VERIFICATION

ON: service method | controller | API handler | exported function/class | shared utility | middleware
OFF: pure CSS/styling | config/env | docs | type-only changes (no logic)

TARGETED TEST ONLY — never full suite for 1-file change.
No test file → create minimal spec same turn: happy path + edge + error (3 tests); a bug fix adds 1 regression test.
VERIFY BY CHANGE TYPE: behavior→test | new file→lint+test | new route→build | type→type-check |
UI→lint + render and inspect your own screenshot | same complaint twice → change method, not repeat.

DEP-DRIFT: [pkg] v[current] → v[latest] — [reason] (audit commands: `agent_docs/dep-check-guide.md`)

---
