---
name: test-writer
description: "Use to add or update tests using the existing test framework for changed behavior, edge cases, regressions, or existing untested code the user wants covered. Use automatically when behavior changes, or manually when the user asks for tests — including adding coverage to existing untested/legacy code with no behavior change."
---

# test-writer

> Codex: run this skill in the `senior-engineer` custom agent — spawn it as a subagent, pass the scope, and report its result; if subagents are unavailable, follow the steps inline.

Fires for backend service/controller/repo/handler/use-case, mobile ViewModel/UseCase/Repository, frontend server action/API route. Not for pure UI changes.

## Process

1. Read budget: changed file + existing test file (`*.spec.ts` / `*_test.go` / `test_*.py`) — 2 files max.
2. Write 3-6 cases, one assertion each: happy path (1) + edge/boundary (1-2) + error (1) + regression if bugfix (1).
3. Mock: external HTTP APIs, email/payment gateways, external SDKs, Date.now(), Math.random(). Never mock internal pure functions, utility functions, type mappers, constants, or your own DB (use a test DB — see `KIT_ROOT/rules/300-testing.md`).
4. Run targeted only: the project's TEST_CMD (from the caller, else the manifest's `scripts` block) narrowed to the test file per `KIT_ROOT/agent_docs/stack-commands.md` — never a runner you assumed.

## Output

```text
TEST: [test names] | FILE: [path] | RUN: [command — ✓ N passed] | MOCKS: [list | none]
```
