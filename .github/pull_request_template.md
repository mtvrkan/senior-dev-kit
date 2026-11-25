# Pull request

## What changes

<!-- One or two sentences. If this is a doc-only fix, say so. -->

## Why

<!-- Link the issue, or describe the drift/bug this closes. -->

## Verification

- [ ] `npm run check` is green locally (paste the summary block if a step was skipped and why)
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`, or this change is invisible to users

## Component checklist

Only fill in the rows that apply.

- [ ] **Skill** — body is ≤ 20 lines; depth moved to `claude/agent_docs/`
- [ ] **Agent** — body is ≤ 150 lines; `claude/agents/ROUTING.md` row added; golden prompt added to `eval/golden-prompts.json`
- [ ] **Rule** — has a `paths:` frontmatter glob list; listed in `claude/global-CLAUDE.md`'s RULES REFERENCE
- [ ] **Preset** — both `CLAUDE.md` and `compact.md` present and in sync
- [ ] **Deny rule** — mirrored into `.claude/settings.json`; `npm run deny-cost` run to measure friction
- [ ] **Always-loaded file touched** — combined line count of `claude/global-CLAUDE.md` + `claude/rules/000-security.md` + `claude/rules/001-conventions.md` still under 500

## Notes for the reviewer

<!-- Anything the gate cannot check: a judgment call, an accepted tradeoff, a follow-up. -->
