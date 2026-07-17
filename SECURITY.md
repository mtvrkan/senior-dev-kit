# Security Policy

## Supported Versions

Senior Dev Kit follows a rolling-release model. Only the latest version on `main` receives security fixes.

| Version | Status |
| --- | --- |
| latest (`main`) | Supported |
| older tags | Not supported |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via GitHub's [Security Advisories](../../security/advisories/new) feature (preferred), or email the maintainer directly at the address listed on their GitHub profile.

Please include:

- A clear description of the vulnerability
- Reproduction steps or a proof-of-concept
- Affected files or components
- Your assessment of impact and severity

## Response Timeline

| Stage | Target |
| --- | --- |
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Within 30 days for critical/high; 90 days for medium/low |
| Public disclosure | Coordinated with reporter after fix is released |

## Scope

This kit consists of Markdown configuration files and Node.js validation scripts. There is no installer script — install happens via the Claude Code plugin marketplace or by Claude reading and applying `SETUP.md`. The main attack surfaces are:

- **`settings-template.json` deny rules** — rules that are too permissive could allow unintended tool calls inside Claude Code. There is no PreToolUse/PostToolUse hook in this kit — protected-path handling (auth/payment/DB migration/CI/IaC/secrets) is prompt discipline (`global-CLAUDE.md` HARD STOPS + guard-agent routing) backed only by the Read-tool deny rules and the narrow Bash/PowerShell read-verb denies described below. Bash/PowerShell *writes* into any protected path, and reads via verbs outside the enumerated list, are not deterministically blocked.
- **`global-CLAUDE.md` / agent definitions** — prompt injection via malicious content in routed tasks

Out of scope:

- Vulnerabilities in Claude Code itself (report to Anthropic)
- Vulnerabilities in the user's project introduced by following kit guidance (report to the relevant framework or library maintainer)

## Security Design Principles

The kit enforces several defence-in-depth measures:

1. **156 Read/Bash/PowerShell deny rules** in `settings-template.json` — blocks `rm -rf`/`rm -fr` (including trailing-slash and glob forms), `find -delete` on root paths, disk destruction (`dd of=/dev/…`, `mkfs`, `shred`), a Windows recursive delete (`Remove-Item -Recurse -Force`, the cmdlet `rd`/`rmdir`/`del`/`ri`/`erase` alias to on PowerShell — namespaced to `PowerShell(...)`, not `Bash(...)`: none of those are Git-Bash commands, so a `Bash(...)`-scoped rule for them can never fire, the same dead-rule bug already fixed once this round for `Get-Content`), `git push --force` and other git data-loss commands (`branch -D main/master`, `push --delete`, `reflog expire`), download-pipe-execute in every common form (`curl|wget` piped to `bash`/`sh`/`zsh`/`python`/`node`/`perl`, `wget -qO-`, and `bash <(curl …)` process substitution — each pipe/process-substitution form is matched against both the bare interpreter name and its `/bin/`+`/usr/bin/`-qualified path, since the bare form alone is a literal-string bypass), inline-interpreter wrappers that would evade the other patterns (`eval`, `sh -c`, `bash -c`, `zsh -c`, plus their `/bin/`-qualified forms), `sudo rm`/`sudo chmod`/`sudo chown`, `chmod` 777/000 in short and long flag forms, `pip`/`pip3 --break-system-packages`, and secret-file reads covering both project-relative files and home-directory credential stores (`~/.aws/**`, `~/.kube/**`, `~/.npmrc`, `~/.netrc`, `~/.yarnrc(.yml)`, `~/.git-credentials`, `~/.config/gh/hosts.yml`, `~/.docker/config.json`, shell history, and more) — including the top-tier secret patterns (`*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `*serviceaccount*.json` and its `*serviceAccount*.json` case variant — Claude Code's cross-tool Read-deny match was verified case-insensitive on Windows in this repo's own session but that's an OS-filesystem property, not a guarantee on case-sensitive filesystems, so the literal camelCase Firebase/GCP filename convention gets its own explicit rule rather than relying on it, `*firebase-adminsdk*.json`) across the same read paths already covering `.env`. This deny list is the kit's only Bash/PowerShell-layer secret protection, split by which tool actually runs the read: `Read(...)` rules already intercept `cat`/`head`/`tail`/`sed` reads inside the Bash tool (Claude Code applies file-permission rules to those recognized Bash file-commands, not just its own Read tool — verified directly in this repo's own session, on Windows, on one occasion: a bare `cat`/`ls` of a `*.pem`-matching filename was denied by the `Read(./**/*.pem)` rule alone, with no matching `Bash(...)` rule present — see the Assumption note below for what this single observation does and doesn't prove), so this list adds only `Bash(base64 ...)` — the one common read verb `Read(...)` doesn't recognize — plus a `PowerShell(Get-Content ...)` rule per secret pattern, now also covering `secrets/`, `config/credentials.json`, `config/secrets.json`, and `*.p12`/`.secrets.baseline*` (previously only the `.env`/`.pem`/`.key`/`id_rsa*`/`id_ed25519*`/service-account/firebase patterns had `base64`/`Get-Content` coverage; those four Read-deny-only patterns were an inconsistent gap). `Get-Content` is a distinct tool namespace from Bash (Claude Code exposes Bash and PowerShell as separate tools on Windows), and its cmdlet aliases (`cat`, `type`, `gc`) are **assumed** — not independently verified in this repo's own sessions — to canonicalize to the same rule before matching (see the Assumption note below), so one `PowerShell(Get-Content ...)` rule per pattern is intended to cover all of them. An earlier version of this list carried redundant `Bash(cat/head/tail/type/Get-Content/gc ...)` entries per pattern: the first four were no-ops (already covered by `Read(...)`), and `Get-Content`/`gc` under a `Bash(...)` rule could never fire at all, since those cmdlets don't exist as Bash commands — they inflated the rule count without adding real coverage. Corrected in the current list. Non-enumerated read paths — `less`/`more`/`awk`/`dd`/`xxd`/`od`/`strings`, or any inline-interpreter read (`python -c "open(...).read()"`, `node -e`, `perl -pe`) — are NOT gated by this list; verified directly in this repo's own session (a `python -c` read of a `.pem`-matching filename executed with no permission prompt, reaching a normal `FileNotFoundError` instead of a denial). It does not cover writes.

   **Scope note:** deny rules are prefix/glob matchers on the command string — defence-in-depth, not a sandbox. They stop the destructive patterns an assistant would plausibly emit; they cannot enumerate every shell-equivalent form. The guard agents and `global-CLAUDE.md` hard stops are the layers above them.

   **Case-sensitivity note:** deny-glob matching was verified empirically to be case-**in**sensitive on Windows (confirmed via differential headless sessions with `--safe-mode` isolation) — `Read(./**/.env)` also blocks `.ENV`/`.Env`. This was not re-verified on Linux; if you rely on this list on a case-sensitive filesystem, confirm the behavior for your platform before trusting it against alternate-case bypass attempts.

   **Assumption note:** two claims in this section describe Claude Code's own internal permission-matching behavior rather than this repo's code, so they can't be pinned down by a unit test the way `scripts/deny-cost.test.ts` pins down this repo's own rule-matching logic — they can only be re-verified against a real Claude Code session, and a future Claude Code release could silently change the underlying behavior without this repo noticing. Treat both as due for re-verification at the start of each quarterly review (see `AGENTS-MAINTENANCE.md`-style cadence), not as permanently settled:
   - *"`Read(...)` intercepts Bash `cat`/`head`/`tail`/`sed`"* — empirically observed once, on Windows, in one differential session (see above). This is the single most load-bearing claim in this list: if it stops holding, every secret-file pattern loses its Bash-read coverage down to `base64` alone. Re-verify before trusting it on a new platform or after any Claude Code permissions-system update.
   - *"PowerShell's `Get-Content` aliases (`cat`/`type`/`gc`) canonicalize to the same deny rule"* — **not yet empirically verified in this repo's own sessions at all**, unlike the claim above. It follows from Claude Code's own permissions documentation but has no differential-session test behind it. Until it's verified the same way the `Read`/Bash claim was, treat `PowerShell(Get-Content ...)` as confirmed coverage only for the literal `Get-Content` invocation, and the `cat`/`type`/`gc` aliases as unconfirmed.

   **Nesting note:** every project-relative Read deny pattern is `./**/…` (not `./…`), so a secret nested inside a monorepo subpackage (`apps/web/.env`, `packages/api/secrets/`) is denied the same as one at the repo root — a single `*` in these glob patterns does not cross a `/`, so a bare `./*.pem`-style pattern would silently miss anything not at the top level.

   **Measured cost:** `npm run deny-cost` replays your own machine's Claude Code transcript history against the Bash and PowerShell deny rules and reports what it would have blocked — counting distinct denied commands, not rule matches, so a command that happens to match two rules isn't double-counted — so friction is a number rather than a guess. On the development machine (10,753 real commands across 239 transcripts) the list would have denied 20 commands (0.19%), from 6 rules: `curl * | node*` / `curl * | python*` catching API responses piped into local one-liners, `npx --yes *` catching Playwright/scaffolding installs, `git push * --delete *` catching an intentional remote-branch cleanup, `rm -rf /*` catching absolute-path deletes (on Git Bash every absolute path starts with `/c/…`, so this rule denies **all** absolute-path recursive deletes on Windows — an accepted trade-off: relative-path deletes still work and the rule keeps blocking root wipes), and `PowerShell(Remove-Item -Recurse -Force *)` catching a genuine recursive delete issued through the PowerShell tool — this rule didn't exist until this round (the prior `Bash(Remove-Item -Recurse -Force *)` rule was dead: `Remove-Item` isn't a Git Bash command, so it could never fire against a real PowerShell-tool call; moving it to the `PowerShell(...)` namespace is what makes this historical match visible at all). The inline-interpreter rules (`eval`, `sh -c`, `bash -c`, `zsh -c`) and every secret-file-read rule (`Bash(base64 ...)`, `PowerShell(Get-Content ...)`) matched zero historical commands. Run the script yourself before adopting the list, and tune any rule whose matches are legitimate for your workflow.
2. **Guard agents with `permissionMode: plan`** — `security-guard`, `db-guard`, and `devops-guard` produce a written plan and pause for explicit user approval before any implementation.
3. **OWASP 2025 passive scan** — every code change is silently scanned for injection, IDOR, mass assignment, ReDoS, SSRF, and supply chain issues.
4. **SHA-pinned GitHub Actions** — all Actions in this repo are pinned to a full commit SHA, not mutable version tags.
5. **Secret file protection** — `global-CLAUDE.md` hard-stops any read of `.env`, `*.pem`, `*.key`, SSH keys, and service account files.

## Security CI Templates

Reusable security workflow templates for **user projects** live in [`security/`](security/): dependency audit, container scan, and security gate workflows (`security/workflows/`), a hardened `Dockerfile.template`, and a Dependabot config. Copy them into your own repo — they are templates, not this repo's CI (this repo's own CI is `.github/workflows/`).
