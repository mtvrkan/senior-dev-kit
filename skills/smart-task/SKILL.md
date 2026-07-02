---
name: smart-task
description: Manually invoke to classify the task, choose tier/risk/agent/skill, and produce a minimal plan. No code edits.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Manually invoke when task scope or risk is unclear — classifies by tier and routes to the correct skill.
model: claude-sonnet-5
effort: medium
argument-hint: "[task — goal plus any known files or constraints]"
---

# smart-task

Classify and route: $ARGUMENTS

If the argument is empty or too vague to classify, infer the task from recent conversation; still ambiguous → ask ONE specific question, then classify.

## Tier detection

| Tier | Condition |
| --- | --- |
| 0 Trivial | 1 file, <10 lines, no protected area |
| 1 Low | 1-2 files, isolated, no behavior dep |
| 2 Medium | 3-5 files, behavior/API/state change |
| 3 High | protected area, multi-system, DB, auth |
| 4 Critical | billing/prod data/destructive |

**T0-1:** `TIER: 0 | SKILL: [skill] | FILE: [path:line — action] | VERIFY: [command]` — proceed immediately.
**T2:** `TIER: 2 | SKILL: [skill] | RISK: medium` then `[P:A] [file] — [action]; [P:B] [file] — [action]` + `CONTRACT:` + `TEST:` + `VERIFY:`. Wait for "go" if non-obvious.
**T3+:** `TIER: 3 | SKILL: [skill] | RISK: high | GUARD: [agent]` then `GOAL:` + `[P:A/B] [file] — [action]` + `CONTRACT:` + `PROTECTED:` + `VERIFY:` + `ROLLBACK:`. Do not proceed until user confirms.
Grep/glob to find real paths before listing. Every step: specific file + action. Mark independent steps `[P:GroupName]`. Auto-test fires after backend/mobile/API-route changes.
