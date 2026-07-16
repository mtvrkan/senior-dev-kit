# With vs Without the Kit — Same Requests, Different Outcomes

> **Illustrative transcripts.** These are representative flows showing how the kit
> changes behavior on identical requests — condensed for readability, not verbatim
> session logs. Run the same prompts yourself to compare.

## Request 1 — "users tablosuna bir kolon ekle, eski kolonu da sil"

**Without the kit:** Claude writes a single migration that adds the new column
and drops the old one in the same file, applies it, and reports done. The drop
ships before any deployed code stops reading the old column — a production
incident waiting for the next deploy.

**With the kit:** the request hits the `DB schema` hard stop. Routing:
`db-guard` (opus, `permissionMode: plan`) — no code is written. Output:

```text
PLAN: add users.locale, retire users.lang
[S] migration 1 — add nullable locale (expand)
[S] deploy code writing both · backfill in batches
[S] migration 2 — drop lang (contract, next release)
CONTRACT: DTO + API type + UI type updated together
RISK: T3·db-guard·schema | ROLLBACK: migration 2 deferred → drop is reversible until then
--- awaiting explicit approval
```

The drop is deferred to a second release per `agent_docs/zero-downtime-migration.md`.
If hooks are enabled, any direct edit under `migrations/` additionally triggers a
permission prompt naming `db-guard` — even if the model forgot to escalate.

## Request 2 — "login butonu mobilde taşıyor, düzelt"

**Without the kit:** often a correct fix — plus unrequested refactors, a new
utility file, and a paragraph of narration. Tokens: whatever an opus/sonnet
default burns on a one-line CSS change.

**With the kit:** routed to `ui-fixer` (haiku, Tier 0-1). Output is one line:

```text
∙ styles/login.css:48 — max-width: 100% + flex-wrap on .login-actions
```

Cost: ~$0.001. No refactor, no narration — Tier 0 caps the response at one line.

## Request 3 — "fix CSS in the login form"

**Without the kit:** treated as a pure styling task; auth-adjacent template edits
go unreviewed.

**With the kit:** the guard-area noun (`login` → auth) outranks the task-type verb
(ROUTING.md precedence line). `security-guard` reviews the plan first — the CSS
change itself is trivial, but the *file* is `middleware`-adjacent, and the kit
treats the blast radius, not the verb, as the signal. This is the routing case
covered by `eval/golden-prompts.json` and scored by the live routing eval.
