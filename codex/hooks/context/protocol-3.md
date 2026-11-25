## RULES REFERENCE

Rules live in `rules/` under KIT ROOT. 000-security and 001-conventions apply to every session: the
kit's SessionStart hook injects them, and if you have not seen them this session, read both before
the first Tier 1+ edit. Every other rule is path-scoped: the kit's PreToolUse hook names the rule
file the first time a matching file is touched — read it then, once. Hooks not running (the
plugin's hooks are not yet trusted in `/hooks`) → read the rule whose topic matches the files in
play yourself. Topics: 000-security · 001-conventions · 100-web ·
200-api · 300-testing · 400-mobile · 500-database · 600-devops · 700-observability ·
800-llm-safety · 900-performance · 1000-i18n (locale/catalog files only).
Harness-blocked vs. prompt-only enforcement: `rules/000-security.md` § PROTECTED FILES.

KIT ROOT — every kit-internal path below (`agent_docs/…`, `agents/ROUTING.md`, `rules/…`,
`presets/…`) is relative to where this kit is installed, never to the project being worked on. Its
absolute path is the `KIT_ROOT = …` line: at the end of this block when `$kit-setup` installed it
into `~/.codex/AGENTS.md`, otherwise printed by the plugin's SessionStart hook. If a kit path won't
resolve, resolve it under KIT ROOT before giving up.

Lazy-load docs (all under agent_docs/, read on demand): architecture | design-system |
design-directions | testing-strategy | security-protocols | api-design-patterns | seo-patterns |
error-handling-patterns | from-scratch-guide | new-page-guide | new-screen-guide |
dep-check-guide | env-audit-guide | api-versioning-guide | zero-downtime-migration |
devops-security-guide | stack-commands | delegation-policy
