---
name: project-memory
description: Use to persist durable project-level facts (architecture decisions, gotchas, non-obvious conventions) to a project memory file so future sessions don't rediscover them from scratch. Read/write only, no code changes.
allowed-tools: Read, Write, Edit, Glob
when_to_use: Use automatically before /clear when unresolved context matters, after a confirmed architecture decision, or when the user says "remember this" / "note this for later." Manually invoke as /project-memory to review or update the file directly.
model: haiku
effort: low
argument-hint: "[what to remember, or omit to review/update existing entries]"
---

# project-memory

Maintain `.claude/PROJECT-MEMORY.md` — durable project facts not in the code or git history (why a decision was made, a footgun that cost time, a convention written nowhere else). Not personal preferences — that's the user's own `~/.claude` memory, out of scope here.

1. Read the existing file first if present — update/extend an entry, never duplicate it.
2. Structure as dated bullets under `## Decisions` / `## Gotchas` / `## Conventions` / `## Open questions` — one line each, with a one-clause "why."
3. Write only what would change a future decision or prevent repeating a mistake — skip what's obvious from the code.
4. Never record secrets, credentials, or PII, even paraphrased inside a decision/gotcha note — write "rotated the prod DB credential after a leak" not the credential itself, "tenant X hit the null-address bug" not their email. Same NEVER READ OR OUTPUT list as everywhere else in the kit.
5. At session start, read the file before unfamiliar work if it exists; verify stale-looking entries against current code before acting on them.
6. Trigger on: "remember this" / "note this for later," before a planned `/clear` with unresolved context, or after a confirmed architecture decision / resolved non-obvious bug.
7. Keep the file under ~150 lines — propose trimming superseded entries instead of appending forever.
