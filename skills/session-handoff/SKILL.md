---
name: session-handoff
description: Use to close a session with its state saved, or to open a new one from where the last stopped — open work, decisions, traps, uncommitted changes. No code changes.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically on "note what we did and what is left", "I'm closing the session", "anything left unfinished?", "where were we", "bring it back up", or after an accidental close.
argument-hint: "[close | open]"
---

# session-handoff

Two modes, so a new session never needs the story retold.

**Close**

1. List every item asked for in this session as done, half-done or not started — that list is the honest answer to "anything left?".
2. Update the project's existing handoff file (`STATUS.md`, `TODO.md`, …); none → `.claude/HANDOFF.md`, which the global excludes keep out of git. Sections: done today (with key files), decisions (one-line why), open work (numbered, by priority), traps for next time. Absolute dates only (YYYY-MM-DD).
3. Durable preferences and corrections the user gave → auto-memory as `feedback`; project decisions and gotchas → `project-memory`. Update an existing entry, never duplicate it.
4. Commit only if the user asked in this session, push only if they asked for a push — after `git status` shows no private file staged and the CHANGELOG entry exists. Not asked → say there are uncommitted changes.
5. Stop every dev server, simulator, background agent and keep-awake process this session started. Deleting files is not part of cleanup; list and ask.
6. Summary in 3–5 lines: done, open, where the note is.

**Open**

1. Read the handoff file, `.claude/PROJECT-MEMORY.md`, the project's auto-memory, `git status` and `git log -5`.
2. Asked to bring it up → start the dev server and give the URL; one already running → reuse it.
3. Report: last session in 1–2 lines, open work in the note's order, an uncommitted-changes warning. Recommend finishing half-done work before new work; on "continue", start without asking again.
