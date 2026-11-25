---
description: List all installed Senior Dev Kit skills and when each one auto-triggers.
---

# /skills-guide

Read every `KIT_ROOT/skills/*/SKILL.md` and summarize for the user: each skill's name and its
`description` (the description ends with the auto-trigger condition).

Keep the summary to one table (skill | auto-triggers when), grouped loosely by purpose (bug /
test / review, feature / API / DB, docs, security / release, research, mobile / web UI). Note
which skills run inside a specific custom agent (their body says so in its first lines) versus
invocable by any agent, and which are manual-only (`agents/openai.yaml` beside the skill sets
`allow_implicit_invocation: false`). Do not restate each skill's full body — link the user to
`skills/<name>/SKILL.md` for detail. See `KIT_ROOT/agents/ROUTING.md`'s "Agent vs. skill" section
for how skills relate to agents.
