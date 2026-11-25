---
name: threat-model
description: Use to threat-model a new flow before it is built — signup, payment, file upload, webhook, invite, password reset, admin action, public API. Produces the abuse cases and the controls each step needs; no code.
allowed-tools: Read, Grep, Glob
disallowed-tools: Edit, Write, NotebookEdit
when_to_use: Use automatically when feature-plan or security-guard plans a new flow that takes user input, moves money, grants access or exposes data.
argument-hint: "[flow — actors, entry point, data it touches]"
context: fork
background: false
agent: security-guard
effort: high
---

# threat-model

OWASP A06 (insecure design) is a missing threat model: controls bolted on after the flow exists. Do this while the flow is still a plan.

1. DRAW the flow as steps: actor → entry point → each trust boundary crossed → data stores touched → outputs. Mark which steps an unauthenticated caller can reach.
2. STRIDE per step: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege. Keep only the threats that apply; each names the attacker, the step and the asset.
3. ABUSE CASES beyond STRIDE: enumeration, replay, race on a balance or quota, mass assignment, business-logic bypass (skip a step, repeat a step, negative amount), automation at scale.
4. CONTROL for each kept threat: the concrete check (authz on object, idempotency key, rate limit with numbers, signed timestamp, server-side price), where it lives, and the test that proves it. Rule detail: `${CLAUDE_PLUGIN_ROOT}/rules/000-security.md`, `${CLAUDE_PLUGIN_ROOT}/agent_docs/security-protocols.md`.
5. RESIDUAL: what is accepted and why. Unknowns become OPEN questions for the user.

## Output

```text
FLOW: [step → step → …] | UNAUTH REACHABLE: [steps]
THREAT: [STRIDE letter] [step] [attacker → asset] → CONTROL: [check] @ [where] | TEST: [case]
RESIDUAL: [accepted risk — why] | OPEN: [questions | none]
```
