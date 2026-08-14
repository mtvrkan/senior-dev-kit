# Security Policy

## Reporting a vulnerability

Report privately through
[GitHub Security Advisories](https://github.com/mtvrkan/senior-dev-kit/security/advisories/new).
Do not open a public issue for a vulnerability.

Expect an acknowledgement within 7 days and a fix or a written decision within 30 days for
anything confirmed. This is a single-maintainer project with no SLA and no bug bounty — the
timeline is a good-faith target, not a contract. Only the latest commit on `main` is
supported; there are no backported security releases.

Anything that lets a request through the deny list or past a guard agent that this document
claims is blocked counts as a vulnerability. Anything this document already lists under
**Not covered** does not — those are known, documented limits.

## Scope

This kit consists of Markdown configuration files and Node.js validation scripts. Installation
copies files into `~/.claude/` or a project's `.claude/`, either through
`scripts/install.mjs` or through the Claude Code plugin (see `README.md`). The main attack
surfaces are:

- **`settings-template.json` deny rules** — rules that are too permissive could allow unintended tool calls inside Claude Code. There is no PreToolUse/PostToolUse hook in this kit — protected-path handling (auth/payment/DB migration/CI/IaC/secrets) is prompt discipline (`global-CLAUDE.md` HARD STOPS + guard-agent routing) backed by the Read-tool deny rules, the `Edit(...)` denies on credential material, and the narrow Bash/PowerShell read-verb denies described below. Bash/PowerShell *writes* into any protected path, and reads via verbs outside the enumerated list, are still not deterministically blocked.
- **`global-CLAUDE.md` / agent definitions** — prompt injection via malicious content in routed tasks
- **Code this kit executes on your machine.** Two scripts run outside the model's control, and
  both are plain, dependency-free JavaScript so they can be read end to end before you trust
  them. `scripts/install.mjs` runs only when you invoke it, and writes only to the target
  settings directory. `scripts/session-context.mjs` is a `SessionStart` hook that the **plugin**
  install registers, so it runs at the start of every session, unsandboxed, at the same trust
  level as any other Claude Code hook — it reads two files and writes JSON to stdout, and never
  writes to disk or reaches the network. There is no `PreToolUse`/`PostToolUse` hook: nothing in
  this kit intercepts a tool call. If you install via `scripts/install.mjs` instead of the
  plugin, no hook is registered at all.

Out of scope:

- Vulnerabilities in Claude Code itself (report to Anthropic)
- Vulnerabilities in the user's project introduced by following kit guidance (report to the relevant framework or library maintainer)

## Security Design Principles

The kit enforces several defence-in-depth measures:

1. **450 Read/Edit/Bash/PowerShell deny rules** in `settings-template.json`. Current coverage, by category:
   - **Destructive commands:** `rm -rf`/`rm -fr` (glued, split, and long-flag forms: `-r -f`, `--recursive --force`, bare `-R`), `find -delete` on root paths, disk destruction (`dd of=/dev/…`, `mkfs`, `shred`), `chmod` 777/000 (short and long flag forms), `sudo`-prefixed variants of every command above.
   - **Windows recursive delete:** `Remove-Item -Recurse -Force` in both flag orders (`-Recurse -Force` / `-Force -Recurse`) and both argument positions (path between the flags or after them) — namespaced to `PowerShell(...)`, not `Bash(...)`, since none of its aliases (`rd`/`rmdir`/`del`/`ri`/`erase`) are Git-Bash commands. PowerShell parameter abbreviations (`-rec -fo`, bare `-r`) are **not** enumerated — same accepted non-coverage class as the alias canonicalization question in the Assumption note below.
   - **Git data-loss:** `git push --force`, `branch -D main/master`, `push --delete`, `reflog expire`.
   - **Download-pipe-execute:** `curl`/`wget` piped to `bash`/`sh`/`zsh`/`python`/`node`/`perl` — both downloaders matched on the pipe target alone (`*curl * | bash`, `*wget * | bash`, …), not on the downloader's flag form, so every flag order (`-qO-`, `-O- url`, flag-before/after-URL) is covered by construction rather than enumeration (round-29 fix: wget's rules were previously flag-specific, which silently missed `wget -O- url | bash` and the wget→`perl` pipe). Plus `bash <(curl …)`/`bash <(wget …)` process substitution and inline-interpreter wrappers (`eval`, `sh -c`, `bash -c`, `zsh -c`).
   - **Path-prefix immunity:** every rule above carries a leading `*` (`Bash(*curl … | bash)`, `Bash(*rm -rf *)`, etc.) rather than anchoring to the bare verb — this closes the class of bypass where a path-qualified (`/usr/bin/curl`), `sudo`-prefixed, or chained (`cd x && rm -rf /`) invocation would otherwise skip a literal-start match. Deliberately broad (`*curl` also matches `mycurl`) — an accepted over-block/under-block tradeoff, not re-litigated per rule.
   - **Supply chain:** `pip`/`pip3 --break-system-packages`, zero-prompt remote-package runners (`npx --yes`/`npx -y`, `npm exec -y`/`npm exec --yes`, `npm x -y`/`npm x --yes`, `bunx`, `pnpm dlx`, `yarn dlx`) across every package manager this kit's BOOT SEQUENCE detects.
   - **Secret-file reads:** project-relative and home-directory credential stores — `.env`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `id_ecdsa*`, `id_dsa*`, `*serviceaccount*.json`/`*serviceAccount*.json`, `*firebase-adminsdk*.json`, `secrets/`, `config/credentials.json`, `config/secrets.json`, `*.p12`, `*.pfx`, `.secrets.baseline*`, all common lockfiles (`*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`/`bun.lock`, `Package.resolved`, `packages.lock.json`, `*.terraform.lock.hcl`), shell history, `.npmrc`/`.netrc`/`.ssh/**`/`.yarnrc(.yml)`/`.git-credentials`/`.pypirc`, and home-dir stores for AWS/kube/Docker/gh/pgpass/vault/Gradle/Maven/gcloud/Azure/GnuPG/Terraform/podman. Also **infrastructure state**: `*.tfstate`/`*.tfstate.backup` (Terraform state holds every provider-returned password in plaintext — a credential file, not an artifact) and project-local `kubeconfig`/`*.kubeconfig`. `*.tfvars` is deliberately readable: it is an input file that legitimately carries non-secret configuration, and `rules/600-devops.md` loads for it. Every `Read(...)` secret pattern has a matching `Bash(*base64 ...)` companion (the one read verb the Read-tool interception doesn't cover) and explicit `PowerShell(*Get-Content ...)`/`*gc`/`*cat`/`*type` companions, all path-prefix-immune per above.
   - **Credential edits (round 45):** `rules/000-security.md`'s PROTECTED FILES heading has always said "never read, **modify**, or reference", and for four audit rounds only the read half had a backstop — 61 `Read(...)` rules and nothing on the write side. The rule file now splits the list in two, and the credential half (`*.pem`, `*.key`, `*.p12`/`*.pfx`, `id_rsa*`/`id_ed25519*`/`id_ecdsa*`/`id_dsa*`, `.ssh/`, `secrets/`, `config/credentials.json`, `config/secrets.json`, service-account and firebase-adminsdk JSON, `*.tfstate`/`*.tfstate.backup`, `kubeconfig`/`*.kubeconfig`, plus the home-directory stores for SSH/AWS/kube/gcloud/Azure/GnuPG/Docker/podman/vault/Terraform/gh/`.netrc`/`.pgpass`/`.git-credentials`) carries an `Edit(...)` deny as well. Check 22 asserts both halves from the rule file's own two blocks, so a pattern moved between blocks moves its enforcement with it. `.env`, `.secrets.baseline*`, lockfiles and build output are deliberately **not** edit-denied: adding a variable to `.env` or regenerating a lockfile is real work, and the risk in those files is reading a secret out, which the `Read` denies already cover.

     **`Edit(...)` only — measured, not assumed.** The first version of this shipped `Write(...)` rules beside the `Edit(...)` ones, on the reasonable theory that two tools need two namespaces the way `Bash(...)` and `PowerShell(...)` do. Claude Code answered on the next session start, once per rule: *"`Write(~/.pgpass)` is not matched by file permission checks — only `Edit(path)` rules are. Use `Edit(~/.pgpass)` instead (Edit rules cover all file-editing tools)."* All 33 were inert **and** printed a warning banner every session, so they are gone and check 22 fails the gate if one returns. This belongs to the same class as the Assumption note below — someone else's matcher, not this repo's code — but it is the best-evidenced claim in that class, because it came as an explicit upstream diagnostic rather than an inference from a single observation.
   - **Not covered:** non-enumerated read verbs (`less`/`more`/`awk`/`dd`/`xxd`/`od`/`strings`, inline-interpreter reads like `python -c "open(...).read()"`), verb-free reads (PowerShell `[System.IO.File]::ReadAllText(...)`/`::ReadAllBytes(...)`, Bash `$(<secret.pem)` / `while read l; do …; done < .env` redirection), and **shell** writes into protected paths (`echo x > id_rsa`, `Set-Content`) — the `Edit(...)` rules above are file-tool rules and do not constrain what a Bash or PowerShell command writes. Verified directly in this repo's own session that a `python -c` read of a `.pem`-matching file executes with no permission prompt. See the Scope note below.

   This deny list is the kit's only Bash/PowerShell-layer secret protection. `Read(...)` rules already intercept `cat`/`head`/`tail`/`sed` reads made through the Bash tool itself (Claude Code applies file-permission rules to those recognized Bash file-commands, not just its own Read tool — verified directly in this repo's own session, on Windows, on one occasion: a bare `cat`/`ls` of a `*.pem`-matching filename was denied by the `Read(./**/*.pem)` rule alone, with no matching `Bash(...)` rule present; see the Assumption note below for what this single observation does and doesn't prove) — so the `Bash(...)` list only needs to add verbs `Read(...)` doesn't recognize (`base64`), while the `PowerShell(...)` list is a fully separate tool namespace and needs its own per-verb rules since PowerShell alias canonicalization (`cat`/`type`/`gc` → `Get-Content`) is unverified (see Assumption note).

   Full round-by-round history of how this list reached its current shape: **[Audit history](#audit-history)** below.

   **Scope note:** deny rules are prefix/glob matchers on the command string — defence-in-depth, not a sandbox. They stop the destructive patterns an assistant would plausibly emit; they cannot enumerate every shell-equivalent form. The guard agents and `global-CLAUDE.md` hard stops are the layers above them.

   **Case-sensitivity note:** deny-glob matching was verified empirically to be case-**in**sensitive on Windows (confirmed via differential headless sessions with `--safe-mode` isolation) — `Read(./**/.env)` also blocks `.ENV`/`.Env`. This was not re-verified on Linux; if you rely on this list on a case-sensitive filesystem, confirm the behavior for your platform before trusting it against alternate-case bypass attempts.

   **Measured coverage (2026-08-14, Windows, differential).** <!-- upstream-assumption verified: 2026-08 --> A dummy `tmp-deny-probe.pem` containing the literal string `probe` was written, attacked from every vector below, and deleted. The control in every row is the identical operation on `tmp-deny-probe.txt` in the same directory, which succeeded — so each block is the pattern firing, not the sandbox root. This replaces three of the four claims that used to sit in the Assumption note as reasoning:

   | Vector | Result |
   | --- | --- |
   | `Write` tool → `*.pem` | **denied** — so `Edit(path)` rules cover the Write tool, exactly as Claude Code's own diagnostic said, and the `Edit(...)` half of the credential list is real |
   | `Read` tool → `*.pem` | **denied** |
   | PowerShell `gc` / `cat` / `type` → `*.pem` | **denied**, all three |
   | PowerShell `Set-Content` / `Out-File` / `Move-Item` / `Test-Path` → `*.pem` | **blocked** by the harness's own path check, before the command ran |
   | PowerShell `>` output redirection → `*.pem` | **blocked** |
   | `[System.IO.File]::WriteAllText` → `*.pem` | **succeeded, silently** |
   | `[System.IO.File]::ReadAllText` → `*.pem` | **succeeded, silently** — returned the file's contents |

   Two consequences worth stating plainly. First, the previous claim that *all* writes into protected paths are unguarded was wrong and too pessimistic: every PowerShell file cmdlet and shell redirection tested is intercepted. Second, the verb-free .NET file API is the one vector that gets through, in both directions, and **it is deliberately not blocked** — `npm run deny-cost` measured a namespace-wide `PowerShell(*IO.File]::*)`-style rule set at 284 of 17,565 real commands (1.62%), of which roughly 250 were legitimate encoding-sensitive file work on this machine. Worse, the rule is defeated by holding the path in a variable (`[IO.File]::ReadAllText($p)`), which no string glob can see. A rule with that false-positive rate and that bypass is worse than an honest gap.

   **Assumption note:** what is left is one claim about Claude Code's internal matching that this repo cannot pin down with a unit test the way `scripts/deny-cost.test.ts` pins down its own rule-matching logic. A future Claude Code release could change it silently. Treat it as due for periodic re-verification, not as settled:
   - *"PowerShell aliases canonicalize to the same deny rule"* — superseded for `cat`/`type`/`gc`, which are now verified directly (table above) and in any case carry explicit per-alias rules since round 21. The claim still applies to any alias not explicitly enumerated (e.g. a module-qualified `Microsoft.PowerShell.Management\Get-Content`). The `verified:` marker above is checked by `scripts/check-consistency.ts`, which fails the gate once the claim ages past its re-verification window — the date is the mechanism, so move it only after actually re-running the probe, never to silence the failure.
   - *"PowerShell's `Remove-Item` aliases (`rd`/`rmdir`/`del`/`ri`/`erase`) canonicalize to the same deny rule"* — same unverified status as the `Get-Content` alias claim above, for the same reason (follows from documented PowerShell alias behavior, no differential-session test behind it yet). Treat `PowerShell(Remove-Item -Recurse -Force *)` as confirmed coverage only for the literal `Remove-Item` invocation until verified.

   **Nesting note:** every project-relative Read deny pattern is `./**/…` (not `./…`), so a secret nested inside a monorepo subpackage (`apps/web/.env`, `packages/api/secrets/`) is denied the same as one at the repo root — a single `*` in these glob patterns does not cross a `/`, so a bare `./*.pem`-style pattern would silently miss anything not at the top level.

   **Measured cost (re-run 2026-08-14):** `npm run deny-cost` replays your own machine's Claude Code transcript history against the Bash and PowerShell deny rules and reports what it would have blocked — counting distinct denied commands, not rule matches, so a command that happens to match two rules isn't double-counted — so friction is a number rather than a guess. On the development machine, now **17,565 real commands**, the list denies **127 (0.72%) from 21 rules**. Re-running it is how `Bash(*eval *)` was caught: it had matched 55 commands and **not one of them was an inline-interpreter `eval`** — it was firing on the word "eval" inside `echo` strings and, worse, on this repo's own `eval/` directory in `ls`/`head` invocations. It is now six quote- and `$`-anchored rules (`eval "…`, `eval '…`, `eval $…`, and the same three after a space) which match zero of the 17,565. The lesson generalises: a rule's cost is invisible until it is replayed, and the corpus grows.

   The original 2026-07 measurement, kept because it is what the individual rule notes below describe — 10,753 commands, 20 denied (0.19%), 6 rules: `curl * | node*` / `curl * | python*` catching API responses piped into local one-liners, `npx --yes *` catching Playwright/scaffolding installs, `git push * --delete *` catching an intentional remote-branch cleanup, `rm -rf /*` catching absolute-path deletes (on Git Bash every absolute path starts with `/c/…`, so this rule denies **all** absolute-path recursive deletes on Windows — an accepted trade-off: relative-path deletes still work and the rule keeps blocking root wipes), and `PowerShell(Remove-Item -Recurse -Force *)` catching a genuine recursive delete issued through the PowerShell tool — this rule didn't exist until this round (the prior `Bash(Remove-Item -Recurse -Force *)` rule was dead: `Remove-Item` isn't a Git Bash command, so it could never fire against a real PowerShell-tool call; moving it to the `PowerShell(...)` namespace is what makes this historical match visible at all). The inline-interpreter rules (`eval`, `sh -c`, `bash -c`, `zsh -c`) and every secret-file-read rule (`Bash(base64 ...)`, `PowerShell(Get-Content ...)`) matched zero historical commands. Run the script yourself before adopting the list, and tune any rule whose matches are legitimate for your workflow.
2. **Read-only guard agents** — `security-guard`, `db-guard`, `devops-guard`, and
   `performance-guard` produce a written plan and pause for explicit user approval before any
   implementation. What actually enforces this is their **tool grant**: each is declared with
   `tools: Read, Grep, Glob, Bash` and no `Edit` or `Write`, so the harness cannot hand them a
   file-writing tool regardless of what the prompt asks for. Their `permissionMode: plan`
   frontmatter adds plan-mode UI on top of that, and it is **ignored when the kit is installed
   as a plugin** — Claude Code strips `permissionMode`, `hooks`, and `mcpServers` from
   plugin-shipped agents for security reasons. Treat the tool grant as the guarantee and
   `permissionMode` as a convenience that is present only in `~/.claude` installs. Note that
   `Bash` is still granted for read-only investigation (`git log`, `grep`, test runs), so a
   guard's write-prevention is as strong as the deny rules in item 1, not stronger.
3. **OWASP 2025 passive scan** — every code change is silently scanned for injection, IDOR, mass assignment, ReDoS, SSRF, and supply chain issues.
4. **SHA-pinned GitHub Actions** — all Actions in this repo are pinned to a full commit SHA, not mutable version tags.
5. **Secret file protection** — `global-CLAUDE.md` hard-stops any read of `.env`, `*.pem`, `*.key`, SSH keys, and service account files.

## Audit history

The deny list was not designed in one pass; it was hardened across many internal audit rounds, and
what those rounds found is more useful to a reader than a ledger of individual rules.

**What you can and cannot verify here.** This repository was published at v1.0.0 with a squashed
history: there is one commit, and the pre-1.0.0 development history is not in it. So the round
numbers cited throughout this file and in the `round-N` comments in `rules/`, `agents/` and
`CLAUDE.md` are **internal shorthand for the maintainer, not citations you can follow** — `git log`
will not resolve them, and no claim in this document should be believed on the strength of a round
number. What *is* verifiable is in the repo you already have: `settings-template.json` is the list
that runs, `scripts/deny-cost.test.ts` and `scripts/lib/*` are the tests that constrain it, and
`npm run deny-cost` measures it against your own transcripts. Read those; treat the prose below as
a summary of intent that the tests, not the history, are responsible for keeping true.

Every real bypass fell into one of four shapes:

- **Anchoring.** A rule matched the bare verb, so a path-qualified invocation walked past it —
  `/usr/bin/base64 secret.pem` against a rule written as `base64 …`. Closed structurally: command
  rules carry a leading `*` instead of enumerating interpreter paths.
- **Asymmetry.** A secret had a `Read(...)` rule but no `base64`/`Get-Content` companion, so it was
  unreadable through one tool and readable through another. Found in three consecutive rounds on
  different files, which is why the companion list is now *derived from* the `Read(...)` rules by a
  unit test rather than maintained by hand.
- **Flag spelling.** `rm -rf` matched while `rm -r -f`, `--recursive --force` and bare `-R` did not;
  `wget -O- url | bash` matched only with the flag after the URL. Closed by matching on the command
  and the pipe target rather than on an enumeration of flags.
- **Runner coverage.** `npx --yes` was blocked while `bunx`, `pnpm dlx`, `yarn dlx` and
  `npm exec --yes` were not — the same zero-prompt remote-code path through four other front doors.

One correction belongs in the record rather than in a footnote: one rebuild regenerated the list
from categories (200 → 397 rules) while the per-round prose that used to fill this section went
untouched, so parts of it described rules that were no longer — or had never been — in the shipped
file. That is precisely why this section is now a summary of shapes: the ledger drifted from the file
it described, and the file is the thing that runs.

For the provenance of a specific rule, the authority is **the shipped file and the tests that derive
from it**, not this prose and not git. Concretely: `settings-template.json` is the rule set;
`scripts/deny-cost.test.ts` derives each secret pattern's `base64`/`Get-Content` companion rules
*from* its `Read(...)` rule, so the asymmetry shape above cannot silently reopen; and
`scripts/check-consistency.ts` binds the list to `rules/000-security.md`'s PROTECTED FILES section
and to `.gitignore` in both directions. If a rule's reason is not evident from those three, it is
undocumented — say so and re-derive it, rather than reaching for a history this repo does not carry.
