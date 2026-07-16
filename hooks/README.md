# Hooks — Deterministic Enforcement Layer

Everything else in this kit is *prompt discipline*: CLAUDE.md tells the model to
escalate before touching protected areas, and the model complies. Hooks turn the
most important of those rules into a **harness guarantee** — Claude Code itself
intercepts the tool call, regardless of what the model decided.

## What ships here

| File | Event | What it does |
| --- | --- | --- |
| `protected-paths.mjs` | `PreToolUse` on `Edit\|Write\|NotebookEdit\|Bash` | Any edit into a protected path (secrets, auth, payment, DB migrations, CI/IaC) is downgraded to an explicit permission prompt naming the guard agent that should review it first. Also catches Bash commands that reach the same paths via a redirect, `sed -i`, a PowerShell cmdlet, `cp`/`mv`, or `git checkout --` (a targeted heuristic, not a shell parser — see the script's header comment for the accepted residual gap). A narrow content-guard separately flags `dangerouslySetInnerHTML` and `subprocess(...shell=True...)` in the text being written, independent of the destination path. Nothing is silently blocked — the human decides. |
| `hooks.json` | — | Plugin-mode wiring: when the kit is installed as a Claude Code plugin, this file registers the hook automatically via `${CLAUDE_PLUGIN_ROOT}`. |

The hook **fails open**: if Claude Code's hook input format ever changes, the
script exits 0 instead of bricking every edit — the CLAUDE.md prompt-level hard
stops remain as the fallback layer.

## Enabling

**Plugin install:** `hooks.json` registers this hook automatically via `${CLAUDE_PLUGIN_ROOT}` —
no manual wiring needed.

**SETUP.md / manual install:** copy `protected-paths.mjs` to `~/.claude/hooks/` (or
`.claude/hooks/` for a project-local install), then merge this into the target
`settings.json` by hand — `SETUP.md` Step 5e does this for you when Claude runs the install:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit|Bash",
        "hooks": [
          { "type": "command", "command": "node \"$HOME/.claude/hooks/protected-paths.mjs\"" }
        ]
      }
    ]
  }
}
```

On Windows, replace the command with the expanded absolute path
(`node "C:\\Users\\<you>\\.claude\\hooks\\protected-paths.mjs"`) — `$HOME` is not
expanded by every Windows shell. Merge into any existing `hooks` key rather than overwriting it;
if `hooks.PreToolUse` already has an entry whose `command` contains `protected-paths.mjs`, leave
it as-is instead of adding a duplicate.

## Escape hatch

After a guard agent's plan has been explicitly approved, set
`SDK_ALLOW_PROTECTED=1` in the environment to skip the prompt for that session.
Unset it when the approved work is done.

Every bypass that would otherwise have prompted is logged as a structured
JSON line on stderr (`hook.protected_path.bypassed`, with `category`, `guard`,
and `path`), so a skipped protected-path prompt stays visible in the session
transcript instead of disappearing silently.

## Verifying it works

Ask Claude to edit a file matching a protected pattern (e.g. `touch a change to
.github/workflows/anything.yml`). Instead of an auto-approved edit you should see
a permission prompt whose reason begins with `senior-dev-kit protected path
(CI/CD & infrastructure)`.

## Adding your own

Each hook is a standalone script reading the tool-call JSON on stdin. Exit 0 to
allow, print a `hookSpecificOutput.permissionDecision` JSON to force
`ask`/`deny`, or exit 2 with stderr to hard-block with feedback to the model.
Keep hooks under ~50ms — they run on every matching tool call.
