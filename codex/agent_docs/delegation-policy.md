# Delegation policy — cheap lookup, expensive judgment

Full protocol behind the global protocol's MODEL ROUTING + DELEGATION section. Read it the first
time a session is about to delegate something, or when deciding whether an agent is worth spawning
at all.

Goal: spend fewer tokens on *finding* things, zero fewer on *deciding* them. Any rule here that
would trade accuracy for cost is wrong and does not belong in this file.

---

## The ladder

| Tier | How it is invoked | Gets | Never gets |
| --- | --- | --- | --- |
| scout | the built-in read-only `explorer` subagent, lookup tier | locate file/symbol/route/string · which files import or call X · which lines match · what a config/locale/manifest contains · inventory + counts | any edit · any judgement · anything not checkable against a file |
| worker | a kit custom agent (`~/.codex/agents/<name>.toml`), kit-defined reasoning effort | bounded implementation against a written contract: tests, mechanical refactor, doc updates, scoped feature | architecture decisions · guarded areas without an approved plan |
| main | this loop | every design decision · every production edit · guarded areas · final verification · what the user is told | — |

`explorer` is the scout vehicle because it is read-only and returns only its final report. A custom
agent's `description` sits in every session's index whether used or not, and its instructions load
on every spawn. Pay that only for agents that genuinely need the kit's rules (the guards). Pure
lookup does not.

## Mechanism notes

- Model resolution: a kit agent runs at the `model_reasoning_effort` in its TOML; a built-in agent
  inherits the main model and effort unless `agents.default_subagent_model` /
  `agents.default_subagent_reasoning_effort` are set in `~/.codex/config.toml`.
- Only the subagent's final report enters this context — its tool calls, file reads and reasoning
  stay in its own window. That is the entire saving, and the reason the report must be short.
- Subagents do not share this session's prompt cache: every spawn pays an uncached first turn.
  That fixed cost is why small lookups are cheaper done directly.
- Nesting depth and concurrency are capped by Codex. Never chain scout → scout for anything
  where an exact line matters; each hop is a fresh context and a fresh chance to drift.
- Unused MCP servers still cost context for their tool index — check `/mcp`, disconnect what the
  project does not use. `/status` shows what fills the window.

## Scout prompt template

```text
Find <what> in <dir/repo>. Use `rg` first; read only the ranges you need.
Return at most 30 lines, in exactly this shape, and nothing else:

FOUND
<path>:<line> — <the matched line, verbatim>
NOTE: <one line, only if the caller cannot use the hits without it>

or

NOT FOUND
searched: <the patterns/globs you actually ran>

Rules: every claim carries path:line taken from this run's tool output; quote, never paraphrase;
partial or ambiguous → say so, or report NOT FOUND. Never guess a path. No analysis, no
recommendations, no edits.
```

## Zero-loss rules

1. Delegate lookup, never decision. A scout reports where things are; what to do about them is
   this loop's job, always.
2. Re-read before you edit. The main model reads the exact lines it is about to change, in this
   context, from the file — never edits from a scout's paraphrase or a remembered line number.
3. Line numbers go stale the moment anything is written. Re-grep after any edit before using an
   older report.
4. One question per call, with the context the scout cannot have: paths already known, TEST_CMD,
   stack, what was already ruled out.
5. Cap the return at ~30 lines. A transcript is a failed report — send it back or redo it here.
6. Empty or ambiguous twice → this loop does it directly. No third retry.
7. Protected areas (`rules/000-security.md`), release-gate verdicts and the final verification run
   are never delegated, at any tier, however mechanical they look.

## When NOT to delegate

```text
You already know the file            → Read it
One grep answers it                  → Grep it
Fewer than ~3 files in play          → do it here
Tier 0-1                             → do it here (ROUTING.md Step 3.5)
The answer needs taste or judgement  → do it here
Protected area                       → guard, per HARD STOPS
```

Delegate for **breadth** — many files, unknown location, repo-wide sweep, "which of these 40
catalogs is missing the key" — never for a lookup you could type yourself in one command.

## Doc frugality

Always loaded every session, in full: the global protocol, the project's AGENTS.md, and rules with
no `paths:` (000, 001). Everything else — `agent_docs/*.md`, `paths:`-scoped rules, skill bodies,
nested AGENTS.md files — loads only when it is needed.

- A line in an always-loaded file is paid by every future session in every project. It earns its
  place only if it changes behaviour and cannot be derived from the code, the tooling or a lazier
  file.
- Detail, procedures, tables of options → a lazy doc or a `paths:`-scoped rule; the always-loaded
  file keeps the decision and a pointer.
- One fact, one home. A restated fact is two facts that will disagree within a month.
- AGENTS.md is read once at session start: edits to it apply after `/new`, `/compact` or a
  restart.
