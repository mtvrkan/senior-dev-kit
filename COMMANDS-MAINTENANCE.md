# Commands Maintenance Policy

This document tracks review dates for the 12 slash-command definitions in `commands/`.
Commands are manually invoked prompt files (`/name`); they must be reviewed when:

- The command's output format or referenced tool commands (audit CLIs, lint/build commands) go stale
- A command overlaps or conflicts with a skill of the same name (commands are the manual-invocation surface; skills carry the shared logic)
- More than **12 months** have passed since the last review

---

## Version Support Matrix

| Command | Purpose | Last Reviewed |
| --- | --- | --- |
| `agents-guide` | List installed agents and when to use each one | 2026-07-01 |
| `deep-research` | Manually trigger multi-source research on a topic | 2026-07-01 |
| `dep-check` | Manually trigger a dependency CVE/license/outdated audit | 2026-07-01 |
| `perf-check` | Manually trigger a performance issue analysis | 2026-07-01 |
| `plan-first` | Manually force plan-first behavior before risky work | 2026-07-01 |
| `release-gate` | Manually trigger a pre-release safety check | 2026-07-01 |
| `safe-review` | Manually trigger a diff/target review | 2026-07-01 |
| `security-scan` | Manually trigger or plan a security scan | 2026-07-01 |
| `seo-check` | Audit SEO, AEO, and Core Web Vitals | 2026-07-01 |
| `smart-task` | Manually classify and route a task before coding | 2026-07-01 |
| `strategy-plan` | Manually produce a strategic plan or decision analysis | 2026-07-01 |
| `write-article` | Manually trigger article/long-form content writing | 2026-07-01 |

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
- [ ] Update `Last Reviewed` date in this table

---

## Contributing a Command Update

1. Edit the relevant `commands/<name>.md` with the updated instructions
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `command(name): update for [reason]`
