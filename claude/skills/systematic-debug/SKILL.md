---
name: systematic-debug
description: Use for bugs whose cause is not localizable — intermittent or flaky failures, "works on my machine", regressions with no stack trace, heisenbugs, wrong results with no error. Hypothesis-driven, one variable at a time.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically when bug-fix cannot name a suspect file from the evidence, or after one fix attempt did not hold.
argument-hint: "[symptom, when it happens, what changed recently]"
effort: high
---

# systematic-debug

The bug-fix skill assumes the evidence points at a file. This one is for when it does not — guessing and patching is how a flaky bug becomes two.

1. REPRODUCE: find a command that shows the failure, and its rate (e.g. 3/20 runs). No reproduction → gather evidence first (logs, timestamps, inputs, environment diff); never fix what you cannot observe.
2. BISECT the change: last known good vs first known bad — `git bisect run <repro>` when history is the variable, halving the input when data is, toggling config/env one key at a time when the environment is.
3. HYPOTHESIS LOG: one hypothesis per attempt, the observation that would falsify it, the result. Change one variable per run. Two falsified in a row → widen the evidence, don't narrow the guess.
4. FIX at the proven cause only, then rerun the reproduction enough times to beat the observed failure rate. Add the reproduction as a regression test.
5. Race, timing or ordering cause → name the shared state and the missing ordering (lock, await, idempotency, transaction); a sleep or retry is not a fix.
6. Guarded area implicated (auth, payment, schema, CI) → stop and escalate per HARD STOPS with the log so far.

## Output

```text
REPRO: [command] — [failure rate before → after]
CAUSE: [proven cause] — [the evidence that proved it]
LOG: H1 [..] ✗ · H2 [..] ✓
FIX: [file:line — what changed] | TEST: [regression test]
```
