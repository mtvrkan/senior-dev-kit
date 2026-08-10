# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] — 2026-08-09

### Added

- MIT `LICENSE` — the repository was public-facing with no license, which left users no legal
  right to use, copy, or fork it. [2026-08-09]
- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` — the kit installs as a
  Claude Code plugin with `/plugin marketplace add mtvrkan/senior-dev-kit`. [2026-08-09]
- `scripts/install.mjs` — non-destructive installer for the parts a plugin cannot carry
  (`rules/`, the deny list, the global protocol). Backs up existing files and merges deny
  rules instead of overwriting. Supports `--dry-run`, `--uninstall`, and `--yes`. [2026-08-09]
- `SessionStart` hook that injects the global senior protocol into plugin installs, since
  Claude Code does not load a `CLAUDE.md` shipped inside a plugin. [2026-08-09]
- English `README.md` with `README.tr.md` as the Turkish translation, plus `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, and GitHub issue/PR templates. [2026-08-09]
- `scripts/check-plugin.ts` — validates the plugin and marketplace manifests against the
  components actually on disk, and keeps their versions in sync with `package.json`.
  [2026-08-09]
- `kit-setup` skill (`/kit-setup`) — the one-time, consented step that installs the rules and
  deny list a plugin cannot deliver. Skill count is now 25. [2026-08-09]
- `check-consistency.ts` now re-derives every count claim from both `README.md` and
  `README.tr.md`, so the translation cannot quietly rot into stale numbers. [2026-08-09]

### Changed

- `README.md`, `SECURITY.md`, `presets/README.md`, and `package.json` no longer describe the
  kit as personal-use-only; they document a real installation, support, and vulnerability
  disclosure path. [2026-08-09]
- `SECURITY.md` no longer credits `permissionMode: plan` as the guarantee behind read-only
  guard agents. Claude Code ignores that field for plugin-shipped agents; the guarantee is the
  agents' tool grant, which excludes `Edit` and `Write`. [2026-08-09]
- Skills, agents, and commands reference bundled documentation through
  `${CLAUDE_PLUGIN_ROOT}` so the paths resolve under a plugin install as well as a
  `~/.claude` install. [2026-08-09]
- `SECURITY.md`'s audit history is now a summary of the four bypass shapes 31 rounds actually
  found (anchoring, `Read`/`base64` asymmetry, flag spelling, runner coverage) instead of a
  round-by-round ledger that carried its own notice saying parts of it described rules never
  present in the shipped file. Per-rule provenance is `git log -p settings-template.json`, which
  cannot drift from the file it describes. [2026-08-10]

### Fixed

- `check-consistency.ts`'s agent_docs cross-check was silently disabled. Its section regex had
  no end-of-string terminator and the list it reads is the last paragraph of
  `global-CLAUDE.md`, so the match always failed and the check skipped without a word. It now
  terminates at end of file and fails loudly if the section ever stops parsing. [2026-08-09]
- `scripts/install.mjs --uninstall` deleted the kit's copy of a file it had displaced without
  restoring the user's original, which made "we backed it up" a technicality. It now restores
  from the recorded backup — unless the file was edited after install, in which case the edit
  wins. [2026-08-09]
- The installer archived its own previous version on every upgrade, burying the one backup
  that matters under version noise. It now only backs up files it did not write. [2026-08-09]
- The installer exited 0 when it could not prompt (no TTY, no `--yes`), so a CI step could
  report a successful install that never ran. It exits 1. [2026-08-09]
- `agent_docs/security-protocols.md`'s OWASP mitigation table was still using the **2021**
  category numbering while `rules/000-security.md` (always loaded) uses 2025. A02, A04, A05 and
  A06 each pointed at the wrong mitigations, and Injection had no row at all — so an agent that
  read "A05 triggered" from the always-loaded rule and looked up A05 here got security-header
  advice instead of injection defenses. Each row now names its category explicitly. [2026-08-09]
- `agent_docs/zero-downtime-migration.md`'s canonical backfill statement used
  `UPDATE … LIMIT`, which is MySQL-only and a syntax error in PostgreSQL — the database the kit
  ships a preset for. Both dialects are now given, with the subquery form for Postgres.
  [2026-08-09]
- `agent_docs/from-scratch-guide.md` told you to write `app/globals.css` (step 3) and
  `app/layout.tsx` (step 5) before scaffolding the project (step 6), but `create-next-app`
  aborts in a directory that already has conflicting files. Scaffolding moved to step 3 and the
  rest renumbered. The guide also prescribed `--src-dir` while giving non-`src` paths; both are
  now reconciled. [2026-08-09]
- `agent_docs/architecture.md` showed a `turbo.json` with the `pipeline` key, which Turborepo
  2.0 renamed to `tasks` and v2 refuses to run. [2026-08-09]
- `rules/800-llm-safety.md` priced Opus at $15/$75 per Mtok and used that to claim Opus costs
  ~15× Haiku. Current Opus is $5/$25 — roughly 5×. The stale figure was load-bearing for a
  "never use Opus in high-volume paths" rule, so the magnitude mattered. Now lists current
  model IDs and prices with an explicit re-verify instruction. [2026-08-09]
- `rules/600-devops.md` listed `terraform apply -target` as a rollback method in the release
  checklist; corrected to the real procedure, matching the fix in
  `agent_docs/devops-security-guide.md`. [2026-08-09]
- `agent_docs/devops-security-guide.md` gave `terraform apply -target=… -var restore=true` as
  the Terraform rollback. No such convention exists. Replaced with the real procedure: revert
  the config commit and re-apply. [2026-08-09]
- `agent_docs/architecture.md` called barrel files an outright anti-pattern while
  `rules/001-conventions.md` allows one at a module root. Reconciled to the 001 rule.
  [2026-08-09]
- Broken code samples: a Go `httptest` snippet used `'/users'` (a rune literal — does not
  compile), an INP example used `await` inside a non-`async` function with unreachable code
  after a `return`, a Playwright TypeScript block was fenced as `bash`, and the API migration
  template nested fences in a way that emitted stray ```` ```text ```` markers into the document
  a user copies. [2026-08-09]
- `rules/900-performance.md` and `agent_docs/dep-check-guide.md` both recommended
  `npx bundlephobia …` and an `npx @next/bundle-analyzer` / `next analyze` invocation. Checked
  against the registry: `bundlephobia` publishes no `bin` and `@next/bundle-analyzer` is a
  config wrapper, so neither command has ever worked. Replaced with `npm view … dist.unpackedSize`
  and `ANALYZE=true next build`. [2026-08-09]

### Fixed (upgrade path)

- `scripts/install.mjs` now refuses to install the protocol when `~/.claude/CLAUDE.md` already
  contains an unmarked copy of it, and names the line to delete. Everyone who installed the kit
  before the managed block existed followed `cp global-CLAUDE.md ~/.claude/CLAUDE.md`, so the
  common upgrade path was appending a second copy and silently paying for the entire protocol
  twice on every turn of every session. `--allow-duplicate-protocol` overrides. The detection
  anchors on the protocol's own title with the version token stripped, so it recognises copies
  of older releases too. [2026-08-10]
- Both READMEs now say not to combine the plugin with a full `~/.claude` install (every agent,
  skill and command would load twice) and describe the pre-2.2 upgrade path. [2026-08-10]

### Added (verification)

- The installer's Node floor is declared once, in `package.json`'s
  `seniorDevKit.installerNodeFloor`, and is now the only claim in the repo that CI actually
  exercises end to end: a new `installer-compat` job installs into a scratch target on that Node
  version with no `npm ci`, verifies the files and the merged deny list, uninstalls, and asserts
  a second run is a no-op. "Requires Node.js 18+" had been prose in two READMEs and a source
  comment while every CI job ran Node 24. `check-consistency.ts` check 2c binds the READMEs,
  `lib/install-core.mjs`'s header, CONTRIBUTING's separate contributor floor, and the existence
  of that CI job to the declared value. [2026-08-10]
- `check-consistency.ts` check 15 — every executable instruction in the repo's own documents is
  resolved against reality: `npm run <script>` against `package.json`, every `--flag` on a line
  mentioning `install.mjs` against the installer's own argument parser, every `--only` component
  against `COMPONENTS`, and every backticked slash command (`/<name>`) against `skills/` and `commands/`
  (with Claude Code's built-ins listed explicitly). Checks 1-14 all guarded numbers; nothing
  guarded the commands a reader is told to type. It found two dead references on its first run.
  The reverse direction is covered too: a flag the parser accepts but `--help` never prints is
  an error. It also reads `scripts/session-context.mjs`, the one place a renamed skill would break
  silently in code rather than in prose. [2026-08-10]
- `check-consistency.ts` check 16 — the caps themselves. Skill bodies (20 lines), agent bodies
  (150), `compact.md` (7–15) and the always-loaded budgets (250 per file / 500 combined) are
  enforced by three separate scripts and then quoted by hand in five documents. Each quotation is
  now compared against the constant that enforces it, and a quotation that disappears is an error
  rather than a silently unmatched pattern. [2026-08-10]

- `check-consistency.ts` check 13 — every backticked `agent_docs/…` and `rules/…` path in
  agents, skills and commands must resolve on disk, and no file may hardcode a `~/.claude/…`
  content path that is dead under a plugin install. 43 references now verified. [2026-08-09]
- `check-consistency.ts` check 14 — every `github.com/<owner>/<repo>` link across the manifests,
  both READMEs, the issue templates and the policy docs must match `package.json`'s
  `repository.url`. A stale slug after a rename would send new users to a 404. [2026-08-09]
- `check-consistency.ts` check 13b — `global-CLAUDE.md`'s "N stacks" promise is re-derived from
  the row count of `agent_docs/stack-commands.md`. [2026-08-09]
- `check-plugin.ts` now refuses a version that has no `CHANGELOG.md` heading, since bumping the
  plugin version is what ships an update to every installed user. [2026-08-09]

## [2.1.0] — 2026-07-19

Baseline release: 7 agents, 24 skills, 11 rules, 3 commands, 9 presets, and 398 deny rules,
after 31 internal audit rounds. See `SECURITY.md` § Audit history for how the deny list
reached its current shape.
