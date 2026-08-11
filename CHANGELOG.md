# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-11

First public release. The kit was developed privately over a long series of internal audit rounds
before this point. That history is not reproduced here: none of it was ever published, so there is
no upgrade path from it and no version anyone could be running. This entry describes what 1.0.0
*is*, rather than pretending to be a diff against something.

### Fixed

- The LLM-safety rule's prompt-injection example put the static system prompt in a `messages` entry,
  which is the OpenAI shape and is rejected by the Anthropic API the same file calls twenty lines
  later. Its schema-validation example nested `JSON.parse` inside `safeParse`, so the fallback for
  the commonest failure — the model returning prose — was unreachable. [2026-08-11]
- The repo's own `.claude/settings.json` is now byte-identical to the shipped template rather than
  merely a superset of its deny rules: the two held the same 412 rules in different orders, and the
  order was bound by nothing. [2026-08-11]
- `SECURITY.md` no longer points readers at `git log -p settings-template.json` for rule provenance,
  and states up front that its round numbers are internal shorthand rather than citations a reader
  can follow. The shipped file and the tests that derive from it are named as the authority
  instead. [2026-08-11]
- The single-session, single-platform observation that `Read(...)` intercepts Bash `cat` is now
  dated and expires with every other freshness marker, instead of standing indefinitely as the most
  load-bearing unverified claim in the deny list. [2026-08-11]
- One path-glob matcher, shared, instead of four hand-copied ones. Each copy needed a placeholder
  to keep `**` from being eaten by the `*` pass, and the copy in `check-consistency.ts` used a NUL
  byte for it — which made the repo's largest script report as *binary* to ripgrep, so searching
  the one file whose maintenance loop is "grep it for the check that owns this rule" returned
  nothing. The shared implementation needs no placeholder at all and has unit tests, which none of
  the four copies did. [2026-08-11]
- The example checker's coverage counter counted violations, not lines graded, so its newest arm
  reported zero on a clean kit — a number indistinguishable from "this arm scanned nothing". Each
  arm now counts the population it actually grades and reports it separately, and a declared
  forbidden shape that grades zero lines fails the gate instead of passing in silence.
  [2026-08-11]
- Kubernetes guidance no longer contradicts itself: the devops rule demanded a CPU limit on every
  container while the Kubernetes preset called that an anti-pattern, and both load for the same
  manifest edit. The rule now requires resource requests plus a memory limit and treats the CPU
  limit as a deliberate choice. [2026-08-11]
- The Terraform preset no longer tells you to add `tfsec` to a pipeline that the devops rule
  retires it from. [2026-08-11]
- The observability rule's own logging example no longer logs a user's email address, nineteen
  lines above its own "never log PII" bullet. The same mistake is fixed in the security-protocols
  audit-log examples (email and session ID) and the FastAPI preset's logging example. [2026-08-11]
- The correlation-ID middleware example now validates the inbound header before it reaches every
  log line, instead of trusting a caller-controlled string. [2026-08-11]
- A tool retirement is no longer waved through by an unrelated warning word elsewhere on the same
  line — the retirement check now reads clauses, not whole lines, on both sides of the
  comparison. [2026-08-11]
- The IaC scanner pins in the devops rule were roughly two years stale (Trivy 0.55, Checkov 3.2)
  underneath a marker that said the file's versions had been reviewed this month. The pin digest
  only covered base images and `*-version:` inputs, so the three pins ninety lines below it were
  exempt — a partial digest that reported coverage it did not have. It now matches what a pin *is*
  (any `image:tag`, `package==version`, or `version:` input, prose or fence) rather than the
  shapes someone happened to notice, and both scanners are current. [2026-08-11]

- The landing page's back-to-top control only nudged the page instead of returning to
  the top. It anchored to the header, which is `position: sticky` — a stuck element
  reports the position it is currently stuck at, so the browser decided the target was
  already in view. It now targets a zero-size marker at the top of `<body>`, with
  `tabindex="-1"` so keyboard focus follows the scroll. [2026-08-11]
- The generator's comment-stripping regexes required a bare `
`, so on a CRLF checkout
  they silently missed and published the templates' contributor notes into the live page.
  Found by diffing a locally built render against the one CI produced. The helpers moved
  to `scripts/lib/templates.ts` — they were untestable inside `gen-site.ts`, which reads
  the page source at import time, and that is why the bug shipped — and are now covered
  by unit tests on both line endings. The page-source branch also gained the
  `.gitattributes` that `main` has had all along: a normalisation rule that only holds on
  one branch is not a rule. [2026-08-11]
- `npm run markdown-lint` reached into `site/`, which on a working machine is a checkout
  of a different branch. Narrowed to this branch's own files. [2026-08-11]

### Added

- The live routing eval is an A/B rather than a single arm: every golden prompt is routed once with
  only the agent descriptions (control) and once with the routing table added (treatment). It fails
  if the routing table cannot beat the baseline it costs context to load, and — separately from that
  net figure — if it breaks any route the descriptions alone get right, since breakage would
  otherwise cancel against improvement and pass. This is the only measurement in the repo of whether
  the kit changes model behavior. [2026-08-11]
- The first live A/B result, recorded rather than described: control 22/26, treatment 26/26, a
  +15.4-point lift with zero routes broken. The four prompts the routing table moved are the ones
  where a guarded noun has to outrank the verb in the sentence. `min_lift` is now derived from that
  measurement — half of it, so model variance does not fail the gate but a collapse does — instead
  of the placeholder zero it shipped with, and the integers live in `eval/golden-prompts.json` with
  a check that fails if either README quotes a score that file does not hold. [2026-08-11]
- Both READMEs say plainly that the test suite proves documentation matches disk and does not
  measure output quality, and point at the one opt-in behavioral measurement. [2026-08-11]
- Test- and suite-count claims are checked across every shipped document, not only the two READMEs.
  The claim that prompted it — "the other 341 tests" — was in a console string in `routing-eval.ts`
  and went stale the moment a test was added; scripts now state no suite size at all, since
  anything they print is unverifiable by construction. [2026-08-11]
- Rule files can declare code shapes that must never appear in an exemplary example, in a
  machine-readable marker; the example checker grades every fenced block in the kit against them.
  It caught two false positives in its own first fix, which is the point. [2026-08-11]
- Dated review markers are checked kit-wide and expire after twelve months, and bare parenthesised
  years used as freshness labels are rejected outright. Years that name a published thing — a spec
  edition, a CVE, a dated incident — stay exempt by construction. [2026-08-11]
- No shipped document may cite this repo's git history as authoritative while the published history
  is squashed; the check derives the commit depth itself and stops firing on its own if real
  history is ever shipped. [2026-08-11]
- Consistency checks that catch the classes of drift above. A tool a rule file retires
  (deprecated / archived / "do not add") may no longer be recommended by any preset, agent, skill
  or reference doc; every preset whose rule file ships an overlapping checklist must name that
  rule file; the kit's own fenced code examples are now graded against the prose around them
  (logging PII, unpinned GitHub Actions), which previously was the only prose under no check at
  all; and the devops rule's version pins are digested against the date they were last verified
  upstream, so a pin cannot move without someone re-dating the claim. [2026-08-11]
- A canonical retired-UI-API list in the web rule, and a retirement check that can now read
  library APIs and not just CLI tool names. The shadcn palette is restated in each preset that
  ships shadcn, with nothing binding the copies; a verdict written once in the rule that co-loads
  with all of them now fails the gate anywhere the retired API is still recommended. Seeded with
  shadcn/ui's `useToast`, superseded by Sonner. [2026-08-11]

- Raster assets for the landing page: a 1200x630 social card (`site/og.png`), an iOS
  home-screen icon and a `favicon.ico`, wired up with `og:image`, `twitter:image`,
  `summary_large_image` and `apple-touch-icon`. `npm run gen-og` produces all three from
  the same tokens the page uses, rasterising the card's HTML with headless Chrome; the
  card's declared dimensions are read out of the PNG header rather than typed, so the
  meta tags cannot claim a size the file does not have. The script is deliberately
  outside `npm run check` — the gate has to pass on a machine with Node and nothing
  else — so its outputs are committed and regenerated by hand. [2026-08-11]

### Changed

- Spacing and typography guidance is presented as the kit's default rather than as law. `p-5`/`p-7`
  are no longer blanket-banned — they are valid Tailwind on its own 4px scale and are a finding only
  where the surrounding file uses the 8px scale; arbitrary values remain a finding everywhere. One
  font family across a UI and type ratios other than 1.333 are stated as legitimate choices. The
  ui-fixer agent, the design-system doc and the from-scratch checklist say the same. [2026-08-11]
- Refreshed the version-pinned examples in the devops rule (Python 3.14, Go 1.26, .NET 10 runtime,
  Trivy 0.73, Checkov 3.3) and the Terraform preset's provider pins. [2026-08-11]

- The landing page moved off `main`. Its source now lives on a `site-src` branch and the
  rendered output on `gh-pages`; a clone of the kit carries neither, which is the point —
  everything in this repository is downloaded by anyone installing it, and a website is
  not part of a Claude Code configuration kit. That is about 360 KB of templates,
  stylesheet and images off every clone. `.github/workflows/site.yml` checks out both
  branches, renders, and force-pushes one orphan commit to `gh-pages`, so publishing is
  no longer a manual copy; the `site-src` branch carries a four-line workflow that calls the
  same file rather than a second copy of it. The derivation is unchanged — the page's
  numbers still come from `main` at build time — but `site-check` and consistency check
  28 now run inside that build instead of in `npm run check`, and check 28 says so out
  loud when it scans nothing rather than passing in silence. [2026-08-11]

### Added — what 1.0.0 is

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
- **A landing page**, published from the `gh-pages` branch and served at the origin declared in
  `package.json`. English and Turkish, one page each, no framework, no JavaScript and no external
  requests. Every number it states about the kit is counted from the repository at build time by
  `scripts/lib/counts.ts` — the same derivation that guards the READMEs — and the list of gate
  steps it prints is read out of `scripts/run-checks.ts` rather than transcribed beside it.
  Consistency check 28 fails the build if a template hard-codes a count instead. The rendered
  output is deliberately not committed here: it lives on `gh-pages` only, so a published page can
  never be older than the templates it came from. The page argues the kit on three fronts —
  judgment, context economy, and guard rails — and the economy section states real measured
  numbers: the always-loaded line count, the share of the rule set it represents, and the caps
  that hold it there, all read from the same module `check-consistency.ts` enforces them with.
  [2026-08-11]
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
