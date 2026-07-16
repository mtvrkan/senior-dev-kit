# Commands Maintenance Policy

This document tracks review dates for the 2 slash-command definitions in `commands/`.
Commands are manually invoked prompt files (`/name`) with YAML frontmatter (`description` required,
`argument-hint` expected when the body uses `$ARGUMENTS` — enforced by `npm run validate`); they must be reviewed when:

- The command's output format or referenced tool commands (audit CLIs, lint/build commands) go stale
- A command overlaps or conflicts with a skill of the same name (commands are the manual-invocation surface; skills carry the shared logic)
- More than **12 months** have passed since the last review

---

## Version Support Matrix

> Dates clustered around 2026-06-30/07-01 are the v1.0.0 release baseline: the entire kit was reviewed item-by-item in that pre-release hardening pass, so the shared date reflects a real review, not a bulk stamp. Later edits stagger the dates naturally.

| Command | Purpose | Last Reviewed |
| --- | --- | --- |
| `agents-guide` | List installed agents and when to use each one | 2026-07-02 |
| `seo-check` | Audit SEO, AEO, and Core Web Vitals | 2026-07-15 |

---

## Naming and skill counterparts

Commands used to share their exact name with a skill counterpart (`performance-check`, `dep-check`, `smart-task`, ...) — the command was the manual-invocation surface, the skill carried the shared logic. That whole tier was removed in the 11→2 command consolidation: their capability now lives entirely in the same-named skill, invoked directly (e.g. `/security-scan` fires the `security-scan` skill; `/kit-doctor` fires the `kit-doctor` skill).

The 2 remaining commands are standalone with no skill counterpart, by design — they're one-off audits/lookups, not auto-fireable playbooks:

- `seo-check` — no `seo` skill exists; SEO guidance lives in `rules/100-web.md` and `agent_docs/seo-patterns.md`
- `agents-guide` — a static lookup table over `agents/`, not a task

---

## Review Cadence

| Trigger | Action |
| --- | --- |
| Referenced CLI commands (audit tools, lint/build) change | Review within 30 days |
| A same-named skill's scope changes | Review within 7 days |
| Quarterly scheduled review | Audit all commands against their skill counterparts |

### Quarterly review checklist

For each command:

- [ ] Verify referenced CLI commands and tool names are still current
- [ ] Verify the output format still matches what the equivalent skill (if any) produces
- [ ] Verify the frontmatter `description` / `argument-hint` still match the body
- [ ] Update `Last Reviewed` date in this table

---

## Contributing a Command Update

1. Edit the relevant `commands/<name>.md` with the updated instructions
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `command(name): update for [reason]`
