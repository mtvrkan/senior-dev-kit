---
name: context-audit
description: "Measure what every session pays before it starts — always-loaded files, their size, and what could move to a lazy doc without losing a rule."
---

# context-audit

Answer one question with numbers: **what does this setup cost every session, in every project, and
which of it is not earning its place?** Report first, change nothing until the user approves.

## 1. Measure

Always loaded in full at session start: the kit's protocol (the marked block in `~/.codex/AGENTS.md`
after `$kit-setup`; otherwise `KIT_ROOT/protocol.md`, injected by the plugin's SessionStart hook),
the always-on rules `KIT_ROOT/rules/000-security.md` and `001-conventions.md` (same hook), and every
`AGENTS.md` from the project root down to the working directory. Everything under `agent_docs/`,
the path-scoped rules and skill bodies load on demand — they are not part of the fixed cost.

```bash
for f in ~/.codex/AGENTS.md "KIT_ROOT/protocol.md" "KIT_ROOT/rules/000-security.md" "KIT_ROOT/rules/001-conventions.md" ./AGENTS.md; do
  [ -f "$f" ] || continue
  printf "%-40s lines=%-5s ~tokens=%s\n" "$f" "$(grep -c '' "$f")" "$(( $(wc -c < "$f") / 4 ))"
done
```

Count the protocol once (the hook skips it when the AGENTS.md block is present). Report the total,
and the three largest sections inside the largest file.

## 2. Judge each block against DOC FRUGALITY (protocol.md)

```text
Changes behaviour + not derivable from code/tooling  → keep, always loaded
Reference table, enumeration, procedure detail       → move to agent_docs/*.md, leave a pointer
Restated somewhere else                              → keep one home, delete the copy
Framework default, or a listing a command answers    → delete
Only relevant on an explicit trigger phrase          → lazy doc; the stub names the trigger
```

## 3. Contradictions

Two always-loaded lines that disagree cost more than either saves. Report every pair found, with
`path:line` for both, and which one RULE PRECEDENCE (`KIT_ROOT/rules/001-conventions.md`) makes the winner.

## 4. Output

```text
FIXED COST: <total> ~tokens/session  (<file> <n> · <file> <n> · …)
MOVE:    <path:line> <what> → agent_docs/<doc>.md   (−<n> tokens/session)
DELETE:  <path:line> <what> — restated at <path:line>
CONFLICT: <path:line> vs <path:line> — <one line>
KEEP:    <anything large that a reader might expect to be cut, and why it stays>
```

Then ask before editing. Moving text is a move, not a rewrite: carry every line over verbatim
(MOVE IS NOT REWRITE), and never trade a rule for a token.
