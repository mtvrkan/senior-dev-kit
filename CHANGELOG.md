# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-10

First public release.

The kit was developed privately over a long series of internal audit rounds before this point.
That history is not reproduced here: none of it was ever published, so there is no upgrade path
from it and no version anyone could be running. This entry describes what 1.0.0 *is*, rather
than pretending to be a diff against something.

### Added

- **Seven agents.** Four are read-only guards — `db-guard`, `security-guard`, `devops-guard`,
  `performance-guard` — read-only by tool grant rather than by instruction: there is no Edit or
  Write tool in their configuration to reach for. Work touching auth, payments, schema, CI/CD,
  secrets or infrastructure routes to one of them, which produces a plan and stops. The other
  three (`senior-engineer`, `bug-hunter`, `ui-fixer`) implement. [2026-08-10]
- **Twenty-five skills** — a written procedure per task shape (fix a bug, add a page, review a
  migration, gate a release) so the model follows a discipline instead of improvising. Twenty-one
  auto-trigger on task shape; four are manual-only by design. [2026-08-10]
- **Eleven rule files** with a context budget. Only `global-CLAUDE.md`,
  `rules/000-security.md` and `rules/001-conventions.md` load every turn, under a combined
  line cap enforced by `scripts/check-consistency.ts`. The other nine load on a `paths:` glob
  match, and the sixteen `agent_docs/` reference pages load only when a skill needs one — so a
  Flutter project never pays for the REST-API rules. [2026-08-10]
- **Twenty-eight stack presets** — a set of house conventions per stack, in `web/`, `backend/`,
  `mobile/`, `orm/`, `database/`, `infrastructure/` and a `generic/fallback`. Each ships a full
  `CLAUDE.md` and a 7–15 line `compact.md` so several stacks can be composed by concatenation.
  The boot sequence detects the stack and offers to seed a project that has no `CLAUDE.md` — it
  offers rather than writes, because a project's own conventions outrank any preset. Which
  stacks are covered, which are deliberately not, and why, is in `presets/README.md`.
  [2026-08-10]
- **Path-scoped rule loading that is actually tested.** `scripts/rule-globs.test.ts` pins what
  each rule's `paths:` globs match, case by case, against Node's own glob matcher, and fails on a
  syntactically invalid glob or one that matches nothing. A `MUST_COVER` map requires each rule
  to reach *every* layout it claims, not just one — a rule that names Kubernetes manifests has to
  match `k8s/`, `manifests/` and Helm's `charts/*/templates/`, not only the one directory name
  someone thought of first. [2026-08-10]
- **Two install paths, both verified in CI.** A Claude Code plugin (`.claude-plugin/`, one-time
  `/kit-setup` for the rules and deny list a plugin cannot write), and `scripts/install.mjs`
  into `~/.claude` with dry-run, backups, marker-scoped protocol insertion, deny-rule merging
  that preserves your own keys, and `--uninstall`. [2026-08-10]
- **A guardrail layer** of Read/Bash/PowerShell deny rules covering secret-file reads (including
  Terraform state and kubeconfigs, which hold plaintext credentials), destructive shell patterns
  and zero-prompt remote package runners — with its real friction measured rather than guessed
  (`npm run deny-cost` replays your own transcript history against them). The exact rule count,
  the coverage by category, and the gaps it explicitly does *not* close are documented in
  `SECURITY.md`, which is the single place that states the number. [2026-08-10]
- **`docs/`** — install, usage, troubleshooting, and a component reference generated from the
  frontmatter on disk by `npm run gen-docs`. `npm run docs-check` fails the gate when the
  generated page and that frontmatter disagree, so the reference cannot go stale the way a
  hand-written list does. [2026-08-10]
- **A verification gate** — `npm run check` runs eleven steps and reports all of them even when
  an earlier one fails. Every count in both READMEs, every cross-file reference, every command
  the docs tell you to type, and every plugin manifest claim is re-derived from disk rather than
  trusted. The consistency checks also bind lists that used to be maintained in parallel by hand:
  every protected file has a deny rule behind it, every stack preset has a row in the command
  table, every data-layer preset has a boot-sequence detection signal, and every preset name list
  matches the directories on disk. [2026-08-10]
- **`npm run check-release`** — a separate pre-announcement step that verifies the install path
  the documentation promises actually works for a stranger: the repository resolves
  anonymously, the marketplace manifest is reachable at its published raw URL, and its version
  matches `package.json`. Deliberately outside `npm run check`, since it asserts a property of
  the published repository rather than of the working tree. [2026-08-10]
