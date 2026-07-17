---
name: incident-response
description: Use to coordinate a live production incident or outage — triage severity, identify which guard agents to dispatch and in what order, and keep one timeline instead of ad-hoc firefighting. Read/coordinate only — it has no Agent tool, so it produces the dispatch plan and the calling agent/orchestrator actually invokes each guard.
allowed-tools: Read, Grep, Glob
when_to_use: Use automatically when the user reports a live production incident — "prod is down," "P1," "outage," "5xx spike," "users can't log in right now" — as opposed to a routine bug report with no urgency signal.
effort: high
argument-hint: "[what's down / what the user reported]"
---

# incident-response

Coordinate, don't firefight solo. This is a triage/dispatch skill — it routes to the same guard agents `agents/ROUTING.md` already defines, in parallel where safe, and keeps one timeline.

1. TRIAGE first: what's broken (endpoint/service), since when, blast radius (all users / one tenant / one flow), and is it getting worse. State this in one line before anything else.
2. Stop the bleeding beats root-cause: if a recent deploy/migration/config change correlates with the start time, ask about rollback before deep debugging — rollback is faster and safer than a live fix under pressure. A migration/deploy rollback is itself a guarded action (routes through db-guard/devops-guard, same as any other schema or CI/CD change) — urgency shortens the approval wait, it doesn't skip the guard.
3. State the dispatch plan by signal, same as ROUTING.md Step 3: auth/session broken → security-guard; DB/query errors → db-guard; deploy/infra/CI signal → devops-guard; slow/timeout without errors → performance-guard; anything else with a stack trace → bug-hunter. Mark which of these are independent so the calling agent can invoke them in parallel rather than sequentially.
4. Guard agents stay read-only planners even during an incident — urgency compresses the time between plan and approval, it doesn't skip the plan-then-approve step for a guarded area.
5. Keep one running timeline (detected → triaged → root cause found → fix applied → verified) — this becomes the postmortem input; don't let it live only in scrollback.
6. After mitigation: route to the docs-writer agent for the postmortem, and flag any missing metric/alert that would have caught this sooner as `OBS:` (per `rules/700-observability.md`).
