---
description: List all installed Senior Dev Kit skills and when each one auto-triggers.
---

# /skills-guide

Read every `skills/*/SKILL.md` under KIT ROOT (`~/.claude/` for a copy install, the plugin
directory for a plugin install) and summarize for the user: each skill's name, its `description`,
and its `when_to_use` auto-trigger condition.

Keep the summary to one table (skill | auto-triggers when), grouped loosely by purpose (bug /
test / review, feature / API / DB, docs, security / release, research, mobile / web UI). Note
which skills are bound to a specific agent (`agent:` in frontmatter) versus invocable by any
agent, and which are manual-only (`disable-model-invocation: true`). Do not restate each
skill's full body — link the user to `skills/<name>/SKILL.md` for detail. See
`agents/ROUTING.md`'s "Agent vs. skill" section for how skills relate to agents.
