# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-08-14

Everything in this release is one shape: a check that watched a proxy instead of the thing, and
reported a pass because the proxy was fine. The write half of PROTECTED FILES, the per-session
context budget, the routing eval's blind spot for over-routing, the plugin-install probe, and a
`DROP COLUMN` regression whose fix had gone into the wrong file. Four of the six were caught by
measurements this release also had to fix first.

### Security

- Credential files are now edit-denied, not only read-denied. `rules/000-security.md`'s
  PROTECTED FILES heading has always read "never read, **modify**, or reference", and the deny
  list held 61 `Read(...)` rules and nothing on the write side — so half the promise was prompt
  discipline with no backstop, while check 22 (written to bind that promise to its enforcement)
  asserted only the read half and reported a pass. The rule file now splits its list in two:
  credential material (`*.pem`, `*.key`, `id_rsa*`, `.ssh/`, `secrets/`, `*.tfstate`,
  `kubeconfig`, service-account JSON, plus the home-directory credential stores) carries an
  `Edit(...)` deny; `.env`, lockfiles and build output deliberately stay writable, because
  adding a variable to `.env` is real work and the risk there is reading a secret out. Check 22
  derives which half is which from the rule file's own blocks. 412 → 445 deny rules. Shell
  writes are still not blocked, and SECURITY.md says so. [2026-08-14]
- `Edit(...)`, not `Write(...)` — and the kit knows why, because Claude Code said so. The first
  version of the change above shipped 33 `Write(...)` rules beside the `Edit(...)` ones. The next
  session start answered once per rule: "Write(~/.pgpass) is not matched by file permission checks
  — only Edit(path) rules are. Use Edit(~/.pgpass) instead (Edit rules cover all file-editing
  tools)." All 33 were inert and printed a warning banner every session. They are gone, check 22
  fails the gate if one returns, and SECURITY.md records the diagnostic verbatim — it is better
  evidence than anything else in that document's Assumption note. [2026-08-14]
- Three of SECURITY.md's four upstream assumptions are now measured rather than reasoned about. A
  dummy `.pem` was written, attacked from every vector, and deleted, with the identical operation
  on a `.txt` in the same directory as the control. Verified: `Edit(path)` denies cover the Write
  tool; the Read tool, PowerShell `gc`/`cat`/`type`, `Set-Content`, `Out-File`, `Move-Item`,
  `Test-Path` and `>` redirection are all blocked on a credential path. The previous claim that
  *all* writes into protected paths were unguarded was wrong and too pessimistic. What does get
  through, in both directions, is the verb-free .NET file API — and it stays open deliberately:
  `deny-cost` measured a namespace-wide block at 284 of 17,565 real commands (1.62%), around 250
  of them legitimate encoding-sensitive file work, and the rule is defeated anyway by holding the
  path in a variable. A rule with that false-positive rate and that bypass is worse than an honest
  gap. [2026-08-14]
- `Bash(*eval *)` was blocking this repo's own `eval/` directory. Re-running `deny-cost` against a
  corpus that had grown from 10,753 to 17,565 commands showed it matching 55 of them and **not one
  an inline-interpreter `eval`** — it fired on `head -c 700 eval/golden-prompts.json`, on
  `ls docs eval`, and on the word "eval" inside `echo` strings. Replaced with six quote- and
  `$`-anchored rules that match zero of the 17,565. Total friction 1.03% → 0.72%. The measured-cost
  paragraph in SECURITY.md is now dated, because the corpus grows and a stale friction number reads
  as a current one. [2026-08-14]

### Changed

- Both live evals gate on the share of the base model's *errors* the kit fixes
  (`min_error_reduction`) instead of absolute points of lift (`min_lift`). Lift is a difference
  between two sampled arms: with the treatment arm at 100%, it measures only how well control
  happened to do, and one control-arm flip on a 27-prompt suite is 3.7 points — half the bar it
  had to clear. The 2026-08-14 re-run scored 25/27 → 27/27 — two wrong routes, both fixed, zero
  regressions — and the old bar called that a failure. The failure is structural, not unlucky:
  as base models improve, the largest lift a suite can show shrinks toward zero, so a points bar
  becomes unsatisfiable exactly while the kit is still working. Error reduction is undefined
  rather than failing when the base model makes no mistakes, which is the behavior suite's
  current state and is now stated as such. [2026-08-14]

- `design-lead` can now return the question it is required to ask. Its contract is three far-apart
  options and one question, but a subagent has no channel to the user and its five-line output had
  no slot for either — so the one thing separating it from `ui-fixer` was the one thing it could
  not report. It now has two output shapes, and picking the right one is the contract. [2026-08-14]
- The gate can now see outside the repo. `npm run check` gained `check-install`
  (`install.mjs --check`), which compares `~/.claude` with the checkout and fails when the
  installed copy is behind. Every other step verifies the repo against itself, which is exactly
  how a green gate coexisted with an install a day stale — the design machinery below shipped,
  passed 11/11, and never reached a session. It reuses the installer's own plan, measures only the
  components that target actually installed, and skips out loud where there is no copy install
  (CI, plugin users) instead of ticking over an empty scan. [2026-08-14]
- Personal data at rest is now covered where it lives. `rules/000-security.md` said never log PII
  and stopped there; `rules/500-database.md` gains marking PII columns, collecting only what the
  feature needs, retention as a schema decision, deletion that reaches the copies (index, cache,
  warehouse, exports, backups), anonymisation over deletion for load-bearing rows, encryption for
  special categories, and the rule that non-production never receives production personal data.
  [2026-08-14]
- Commands the kit tells you to type now run on Windows. `RUN_ROUTING_EVAL=1 npm run …` and
  `ANALYZE=true next build` are parse errors in PowerShell — which is the maintainer's own shell —
  and they sat in both READMEs and two rule files. Every affected block now shows the `$env:` form
  beside the POSIX one, and check 33 fails the gate on a fenced block that uses an inline env-var
  prefix without one. [2026-08-14]
- `rules/000-security.md`'s language hotspots cover the languages the kit ships presets for.
  Ruby had no row while `backend/rails` shipped — `Marshal.load`, `permit!`, `html_safe` on user
  content appeared in no always-loaded rule — and the mobile row read "Swift/Kotlin", which does
  not obviously include the Flutter and React Native presets. Both fixed, and check 32 now fails
  the gate when a preset ships whose language has no row, or that no one has decided about.
  [2026-08-14]
- `/design-check` is now invoked rather than merely available: `new-page` and `new-screen` run it
  after building and `from-scratch` runs it at self-review, the way `new-page` already ran
  `/seo-check`. The enforcement half of the design work existed since the previous round and
  nothing called it. [2026-08-14]
- `new-page` gained the branch `new-screen` already had: no `DESIGN-SPEC.md` **and** no comparable
  page to match is a design decision, not an edit — read the directions, run the brief intake,
  settle it with the user. Web was the half without it. [2026-08-14]
- Originating a design is no longer routed to `ui-fixer`. That agent runs at low effort with a
  six-turn cap and a core rule to match what already exists — correct for edits, and the reason a
  first page silently shipped the default look. It now hands the choice back (or to `from-scratch`)
  and builds to `DESIGN-SPEC.md` once one exists; `ROUTING.md` carries the case. [2026-08-14]
- The design axes the kit froze are now project-specific. `agent_docs/design-system.md`'s font
  table paired four of five archetypes with the same body font and its type scale read as law;
  `from-scratch-guide.md` declared spacing, typography and motion fixed; `rules/100-web.md` asked
  for an "original design character" with no mechanism behind the ask. All three now defer to the
  chosen direction, and the defaults are labelled as what to use when nothing has been decided
  rather than as the answer. [2026-08-13]

### Fixed

- The SessionStart hook no longer reports a half-finished plugin install as a finished one. It
  probed `rules/000-security.md` and treated that as proof `/kit-setup` had run, but `/kit-setup`
  advertises `--only rules`, so a user could hold every rule file and none of the deny list — the
  kit's only tool-layer block on reading credential files — with nothing anywhere saying so. It
  now probes both halves against the template the plugin ships, and names the missing one.
  `/kit-setup` also honours the `--only` argument its own hint advertises. [2026-08-14]
- Check 6's deny-rule-count pattern no longer hard-codes the tool list, and fails loudly when it
  matches nothing. Adding `Edit` to the claim would have silently unverified the number the whole
  of SECURITY.md is about. [2026-08-14]
- The Turkish landing page advertised an English social card. `gen-site.ts` renders one page per
  locale and each names its own `ogImage`, but `og.html` hard-coded the English headline and both
  templates pointed `og:image` at `og.png`. The headline now comes from `strings.<locale>.json`
  like every other translated line. [2026-08-14]

- The `DROP COLUMN` regression came back, and the round-43 fix turned out to be in the wrong file.
  Round 43 measured `global-CLAUDE.md` + `rules/500-database.md` producing a destructive migration
  and patched the always-loaded protocol; round 45 measured the same pair producing it again, 3 of
  3 samples. The reason is that the *procedural* file is the more specific one when both are
  loaded: `500-database.md` shipped a zero-downtime pattern, a backup protocol and example DROP SQL
  with nothing scoping them to after the approval, so a model reading "escalate" in one file and
  "here is how the migration is written" in the other follows the one that answers the request.
  The qualifier now sits beside the procedures, in that file and in `600-devops.md`, which had the
  identical shape and had never been measured for it. Check 39 derives the obligation from
  `ESCALATE TO:` appearing in a rule file, so a new guarded rule arrives already owing the
  sentence. Re-measured: 19/19 → 19/19. [2026-08-14]
- Escalation now means stop, not label. Measured: with `global-CLAUDE.md` and
  `rules/500-database.md` loaded together the model wrote a `DROP COLUMN` migration it correctly
  refused with no kit context at all — 4/4 reproducible, control 3/3 right. Each file alone was
  correct; only the pair failed, and nothing in the kit measured rule combinations even though a
  real session always loads several. The HARD STOPS block now says what escalating forbids until
  the guard has returned a plan and the user has approved it, which restored the correct answer.
  [2026-08-14]
- `behavior-eval` and `routing-eval` pass the prompt over stdin instead of as a command-line
  argument. The treatment arm embeds whole kit files and Windows caps a command line at 32,767
  characters, so two design prompts died with `ENAMETOOLONG` and a full behavior number was
  unobtainable on the maintainer's own platform while the same suite ran on Linux. [2026-08-14]
- Both evals now score over the whole suite instead of over the calls that succeeded, and fail
  loudly when any prompt never reached the CLI. A shrinking denominator reported "8 of 10 prompts
  never ran" as a confident `8/8 (100%)`. [2026-08-14]
- The routing table had regressed and the measurement could not see it. Re-running the live A/B
  against the current suite scored 24/27 control, 25/27 treatment with two regressions: round 41's
  design rows sent "make this modal look modern" to `design-lead` when restyling one existing
  component is an edit, and the architecture rows named the `feature-plan` skill where an agent was
  asked. `agents/ROUTING.md` now draws the edit-vs-decision line inside the design entry itself
  rather than in a tie-breaker keyed on whether a `DESIGN-SPEC.md` exists, and every destination
  that is a skill says so. Re-measured: control 24/27 (89%), treatment 27/27 (100%), +11.1 points,
  zero regressions. [2026-08-14]
- The Turkish landing page unfurled an English social card. `og:locale`, the alt text and the
  hreflang tags were all translated while the image behind them was not — the one part of a
  shared link most people read. The card template now renders once per locale from the same
  strings file the page uses, so `og.png` is English and `og.tr.png` Turkish, and a new locale is
  one entry in `gen-site.ts`'s `PAGES` rather than a hand-copied filename in four places.
  [2026-08-13]

### Added

- Every rule file must now be measured by a behavior prompt, and the gate fails if one is not.
  Four were not — `200-api`, `400-mobile`, `800-llm-safety`, `1000-i18n` — and had shipped that way
  for two rounds while the suite reported a clean 14/14, because "the prompts that exist all pass"
  and "the rules that ship are all measured" are different claims and only the first had a check.
  Coverage is derived from `rules/` on disk, so a rule file added tomorrow arrives already owing a
  prompt. Five prompts added, one of them a deliberate rule *combination* (an N+1 fix that is also
  a response-shape break — `900-performance` and `200-api` pulling opposite ways), because this
  suite's only finding to date was a combination and a suite of single-file prompts cannot
  reproduce that class however many prompts it has. [2026-08-14]
- A combined budget on per-session trigger text. Check 3 caps the three always-loaded files at
  500 lines because they are paid every session — but so is every skill's description, every
  agent's description and every command's frontmatter, which the harness injects before the user
  types. Measured: 5.8k tokens of always-loaded files and a further 2.3k of trigger text, 29% of
  the real floor, guarded only per-item. A per-item cap is not a budget when the component count
  only grows, which is the same reasoning that gave check 3 its combined cap. Agents and commands
  now have the per-item cap they never had, all three validators read one constant, and check 37
  fails the gate on the sum. [2026-08-14]
- The routing eval can now detect over-routing. Every one of its 27 prompts expected some agent,
  so a `ROUTING.md` that delegated absolutely everything would have scored 100% — the suite could
  see mis-routing and under-routing, and was structurally blind to the third failure, which is
  also the expensive one: a subagent is a fresh context window spent on a one-line edit. Four
  Tier 0-1 prompts now expect `none`, both arms may answer it, and the static check fails if the
  suite ever loses its last negative case. `agents/ROUTING.md` gained Step 3.5, the gate that runs
  before the task-type table and asks whether the work is worth an agent at all. Measured the same
  day: control 25/31, treatment 31/31, all six fixed, zero regressions. [2026-08-14]
- Regressions in both live evals are re-sampled before they are believed. Observed, not reasoned
  about: the behavior suite ran twice minutes apart against byte-identical files and reported the
  design prompt as a regression once and not the other time, so `max_regressions: 0` failed the
  gate on a coin flip. Raising the budget to 1 would fix the noise by also blinding the barrier to
  one real regression — and one real regression is exactly what this suite's only finding was. So
  detection stays one call per arm, and only a prompt that actually regresses is re-sampled;
  majority of three decides, and an unconfirmed regression is still reported, because a prompt
  that answers both ways is sitting on the decision boundary. A clean run costs what it always
  did. [2026-08-14]
- Check 38 binds `gen-site.ts`'s published locales to the social cards on the `site-src` branch.
  The claim lived on one branch and its evidence on another with nothing between them: the Turkish
  locale shipped in `PAGES` while `og.tr.png` sat uncommitted, and the first thing that noticed was
  the publish workflow dying on an ENOENT inside a PNG header parser — a stack trace naming
  `binding.open`, not the file to generate. [2026-08-14]
- A recorded eval score is now bound to the kit files it measured, not just to the suite it lives
  in. Both `last_measured` blocks carry a `context_digest` — for routing, `agents/ROUTING.md` plus
  every agent's frontmatter description; for behavior, every prompt's wording plus the full text of
  each rule file it names as context — and check 34 fails the gate when the files stop matching the
  fingerprint. Three checks already guarded this number and every one of them watched a different
  variable: the READMEs quoting it, the prompt count, the suite's own shape. None watched the
  document under test. Round 41 broke two routes by editing `ROUTING.md` alone, and the reason that
  was caught at all is that the same round happened to add a prompt too; edit the routing table by
  itself and the recorded "100%" would still describe a file that no longer exists. Both eval
  scripts print the fresh digest beside the scores, so nothing is computed by hand. [2026-08-14]
- The behavior eval runs in CI. It shipped two rounds ago as a script only the maintainer could
  run, which is the wrong home for the one suite whose entire value is regression detection — it
  cannot show lift, and its single finding to date (two individually-correct rule files that
  together produced a `DROP COLUMN` migration) is exactly the failure a later rule edit
  reintroduces silently. `.github/workflows/routing-eval.yml` becomes `live-evals.yml` with one
  job per suite, sharing the weekly schedule and the fork-safe secret guard the routing arm
  already had. [2026-08-14]
- The behavior A/B has a recorded result: control 14/14, treatment 14/14, zero regressions
  (2026-08-14). `min_lift` is now 0 with the evidence for it in the data file — eight further
  candidate prompts were piloted and the base model answered all eight correctly with no kit
  context, so a two-token forced choice cannot demonstrate lift. The suite's job is regression
  detection, and it caught one on its first run. Four hard-stop tripwires added: payment under
  deadline pressure, a six-file feature, `node:latest` in CI, and a tfstate secret. [2026-08-14]
- Check 36 now reads preset bodies, not just headings. `swiftui` ("Swift 6 strict"),
  `nextjs-saas` ("Next.js 16") and `go-api` ("Go 1.22+") each made a version claim upstream can
  falsify while carrying no dated review marker. The vocabulary is derived from the preset headings
  themselves, so a new stack's name is known the day its preset lands. Five presets gained markers,
  each verified against upstream. [2026-08-14]
- Check 31 binds README A/B claims to both eval suites, not only the routing one — a second
  measured number quoted in the same prose with nothing behind it is the gap the check exists for.
  [2026-08-14]
- `PROJECT-BOOTSTRAP.md` is linked from both READMEs. A 351-line standalone template at the repo
  root that no document referenced, no installer installs and the plugin does not carry. [2026-08-14]
- A recorded eval measurement must describe the suite on disk (consistency check 34). Check 31
  bound the READMEs to `last_measured` and nothing bound `last_measured` to the file it lives in,
  so a 27th prompt could be added after a 26-prompt run and the README kept quoting "100%" over a
  suite it had never covered — the uncovered prompt being the one for the newest agent. [2026-08-14]
- A command nothing invokes is now a gate failure (consistency check 35). `/a11y-check` shipped as
  a ten-step WCAG audit that no skill, agent or guide referenced, so it could only run if the user
  typed it, while `new-page` claimed inline that it already "covers a11y". `new-page`, `new-screen`
  and `ui-change` now call it, and commands whose whole purpose is to be typed are declared rather
  than inferred. [2026-08-14]
- A preset that names a version in its heading must date that claim (consistency check 36). Check
  26 built the review-marker mechanism for one hand-picked file and check 29 generalised its
  age-out to every marker in the kit — what was missing was any requirement to carry one, so the
  age-out aged an empty set. Rails, Nuxt, SvelteKit and Angular now carry markers that state what
  was re-verified, and a preset acquires the obligation the moment a version enters its heading.
  [2026-08-14]
- `behavior-eval` — a second A/B, this one for the rules rather than the routing table. Ten
  decisions in forced-choice form (escalate or edit a JWT lifetime, log the email or an opaque id,
  ask for a design direction or ship the default, delete the failing test or fix the code), scored
  control-without-kit against treatment-with-the-rule-files. Written because the kit's own README
  said it plainly: everything except routing rested on judgment, and two rounds of design and
  architecture work had just been added to that pile. Forced choice rather than a judge model, so
  the result is reproducible; `last_measured` is null until someone spends the credits, and the
  README says so. [2026-08-14]
- `design-lead` — an opus/high agent that owns the design decision. The roster spent three
  opus-tier agents on "will this break production" and put the only UI agent on `effort: low` with
  a six-turn cap and a rule to match what exists, which is correct for an edit and is exactly why
  a first page shipped the default look. Deciding is now this agent (brief, direction, tokens,
  signature, `DESIGN-SPEC.md`); building to a recorded decision stays with `ui-fixer`, and
  `ROUTING.md` carries both directions of the split. [2026-08-14]
- `rules/1000-i18n.md` — the kit had eleven rule files and none of them mentioned localization.
  Message catalogs and key naming, ICU plurals instead of an English ternary, `Intl` formatting,
  Turkish dotted-i case folding, RTL via logical properties, text expansion, per-locale canonical
  and `hreflang`, and the catalog format for every framework the kit ships a preset for. Scoped to
  locale artifacts rather than to every UI file, so a single-locale project pays nothing.
  [2026-08-14]
- `/a11y-check` — WCAG 2.2 AA as an audit rather than one line inside `/design-check`: keyboard
  path, focus management, accessible names, state reaching the API, contrast against the real
  composited background, targets, reflow and zoom, content, and the mobile equivalents. States
  what it could not verify instead of marking unrun checks green, and says out loud that a clean
  axe run covers about a third of the criteria. [2026-08-14]
- A debt ledger for the flags. `FWD:`/`OBS:` were defined in six files and collected in none, so
  the same findings were "flagged" every month and lived until the session ended. Raising one now
  means appending a row to the project's `.claude/TECH-DEBT.md`, and `/arch-check` reconciles it
  against the code — adds what is missing, closes what is genuinely fixed. [2026-08-14]
- `/arch-check` — the structural counterpart to `/design-check`, and the same argument one level
  down. Architecture was detected from folder shape on every task and recorded nowhere, so two
  sessions reading the same tree could reach two answers and the second one is how a codebase ends
  up with two architectures. `PROJECT-CONTRACTS.md` now records the pattern, the boundaries, the
  dependency direction and which layer owns each seam (transactions, error boundary, authz,
  retries); the command audits the tree against that record — mixed patterns, inverted
  dependencies, cross-feature reach-ins, cycles, barrels, contract drift — and reports without
  fixing. Bound into `codebase-overview` (record it while mapping), `feature-plan` (start from the
  real boundary state) and `refactor-safe` (a boundary refactor should make the violation count go
  down, and unmeasured "cleaner" is an opinion). [2026-08-14]
- A **brief intake** in front of the direction gate. The kit picked a direction from the product
  type and asked the user to choose between three of its own suggestions — the one input it never
  collected was what the user actually wanted. `design-directions.md` now reads references, brand
  assets, adjectives, exclusions and hard constraints first, says what each one binds, and records
  them in `DESIGN-SPEC.md` so a later session inherits the reasons and not just the outcome.
  [2026-08-14]
- A **bespoke direction** path. Eight named directions answer one template with eight; a brief that
  points between them or past them now gets its own direction — all eight axes resolved to real
  numbers, one depth model, a project-specific name — instead of being rounded to the nearest
  label. [2026-08-14]
- **THE SIGNATURE** — the one idea a project is remembered for, and the first additive rule in a
  design system that was otherwise entirely subtractive. Holding a direction and avoiding the
  eleven tells produces *competent*; a type moment, a structural break, a material, a motion idea
  or real content at a scale that says it matters is what produces memorable. Exactly one per
  project, it has to come from the product, and it has to survive 360px, reduced-motion and
  contrast or it is a defect with ambition. `/design-check` gained steps for it and for brief
  adherence, plus a `Memorable` verdict that is only available when the signature is built, zero
  tells fired, every invariant passes and the brief is honoured. [2026-08-14]
- `agent_docs/design-directions.md`: eight design directions, each a coordinated set of values
  across type, colour, geometry, depth, density, motion, decoration and layout rhythm, plus the
  gate that picks one with the user and records it in `DESIGN-SPEC.md`. Answers the commonest
  complaint about the kit — that every project it builds looks the same. The cause was the kit's
  own: `DESIGN-SPEC.md` left exactly one variable open (a primary hue) and declared spacing,
  typography, motion and component style "fixed, not project-specific", so the only decision the
  model could make was a colour. Token *names* stay fixed on every project; the direction sets
  their values. [2026-08-13]
- `/design-check`: the enforcement half of the above. Audits what was actually built against the
  direction the spec claims, the eleven generic-output tells, layout monotony, depth coherence and
  how many distinct radius/shadow/size/spacing values are really in use. Reports only — fixes go
  back through `ui-change` or `new-page`/`new-screen` so they keep their tier and verification.
  Written because everything else added here is guidance, and the kit's own recurring lesson is
  that guidance without a mechanism does not hold. [2026-08-13]
- Mobile directions in `design-directions.md`: five directions built on an idiom-distance axis
  (native default / branded native / fully custom), because mobile differentiates inside the
  platform idiom rather than against it. Covers Apple's Liquid Glass and Material 3 Expressive as
  the materials the systems now hand you, the cross-platform "one design or adaptive" decision that
  is a defect when left silent, and the constraints no direction may cross. Carries a review
  marker — both platform design languages are moving. [2026-08-13]
- A levers section (variable-font axes, scroll-driven and viewport-scaled type, serif+mono pairing,
  one deliberate asymmetry) and a tells section listing what makes output read as machine-made.
  `ui-change` and `new-screen` are now bound to the recorded character the way `new-page` and
  `from-scratch` are, and `rules/400-mobile.md` gained the mobile equivalent of the web's design
  continuity rule. [2026-08-13]
- Interaction-state guidance the kit was missing: the priority order when several states apply at
  once, the ARIA attributes that make busy/invalid/disabled state reach a screen reader at all,
  where a spinner is still correct after the never-a-spinner-for-lists rule, and the component-token
  indirection that keeps variants from becoming duplicated class lists. `rules/100-web.md`'s
  accessibility table gains the state-announcement row; the rest is in `agent_docs/design-system.md`,
  which loads only when read. [2026-08-13]

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
