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

This kit consists of Markdown configuration files and Node.js validation/hook scripts. There is no installer script — install happens via the Claude Code plugin marketplace or by Claude reading and applying `SETUP.md`. The main attack surfaces are:

- **`hooks/protected-paths.mjs`** (PreToolUse hook) — must not itself introduce path-traversal or bypassable matching, since it's the harness-enforced guardrail for secrets/auth/payment/migration/CI paths. Its Bash-command path extraction is targeted regexes, not a shell parser: it catches redirects, `sed -i`, PowerShell `Set-Content`/`Copy-Item`, `cp`/`mv`, `git checkout --`, and the common single-call form of interpreter one-liners (`python -c "open(f,'w').write(...)"`, `python -c "Path(f).write_text(...)"`, `node -e "writeFileSync(f,...)"`, `node -e "appendFileSync(f,...)"`, `ruby -e "File.write(f,...)"`, `php -r "file_put_contents(f,...)"`). Accepted, undefended gaps: command substitution (`$(...)`), variable indirection (`f=.env; echo x>$f`), base64/eval obfuscation, chaining beyond one redirect/cmdlet, and any interpreter write API not in the matched list above (e.g. `os.write`, `csv.writer`) or reached via a variable/multi-statement script.
- **`settings-template.json` deny rules** — rules that are too permissive could allow unintended tool calls inside Claude Code
- **`global-CLAUDE.md` / agent definitions** — prompt injection via malicious content in routed tasks

Out of scope:

- Vulnerabilities in Claude Code itself (report to Anthropic)
- Vulnerabilities in the user's project introduced by following kit guidance (report to the relevant framework or library maintainer)

## Security Design Principles

The kit enforces several defence-in-depth measures:

1. **123 Read/Bash deny rules** in `settings-template.json` — blocks `rm -rf`/`rm -fr` (including trailing-slash and glob forms), `find -delete` on root paths, disk destruction (`dd of=/dev/…`, `mkfs`, `shred`), Windows recursive deletes (`rd /s`, `Remove-Item -Recurse -Force`), `git push --force` and other git data-loss commands (`branch -D main/master`, `push --delete`, `reflog expire`), download-pipe-execute in every common form (`curl|wget` piped to `bash`/`sh`/`zsh`/`python`/`node`/`perl`, `wget -qO-`, and `bash <(curl …)` process substitution — each pipe/process-substitution form is matched against both the bare interpreter name and its `/bin/`+`/usr/bin/`-qualified path, since the bare form alone is a literal-string bypass), inline-interpreter wrappers that would evade the other patterns (`eval`, `sh -c`, `bash -c`, `zsh -c`, plus their `/bin/`-qualified forms), `sudo rm`/`sudo chmod`/`sudo chown`, `chmod` 777/000 in short and long flag forms, `pip`/`pip3 --break-system-packages`, and secret-file reads covering both project-relative files and home-directory credential stores (`~/.aws/**`, `~/.kube/**`, `~/.npmrc`, `~/.netrc`, `~/.yarnrc(.yml)`, `~/.git-credentials`, `~/.config/gh/hosts.yml`, `~/.docker/config.json`, shell history, and more).

   **Scope note:** deny rules are prefix/glob matchers on the command string — defence-in-depth, not a sandbox. They stop the destructive patterns an assistant would plausibly emit; they cannot enumerate every shell-equivalent form. The guard agents and `global-CLAUDE.md` hard stops are the layers above them.

   **Case-sensitivity note:** deny-glob matching was verified empirically to be case-**in**sensitive on Windows (confirmed via differential headless sessions with `--safe-mode` isolation) — `Read(./**/.env)` also blocks `.ENV`/`.Env`. This was not re-verified on Linux; if you rely on this list on a case-sensitive filesystem, confirm the behavior for your platform before trusting it against alternate-case bypass attempts.

   **Nesting note:** every project-relative Read deny pattern is `./**/…` (not `./…`), so a secret nested inside a monorepo subpackage (`apps/web/.env`, `packages/api/secrets/`) is denied the same as one at the repo root — a single `*` in these glob patterns does not cross a `/`, so a bare `./*.pem`-style pattern would silently miss anything not at the top level.

   **Measured cost:** `npm run deny-cost` replays your own machine's Claude Code transcript history against the Bash deny list and reports what it would have blocked, so friction is a number rather than a guess. On the development machine (3,646 real commands across 160 transcripts) the list would have denied 19 commands (0.52%), all from 4 rules: `curl * | node*` / `curl * | python*` catching API responses piped into local one-liners, `npx --yes *` catching Playwright installs, and `rm -rf /*` catching absolute-path deletes (on Git Bash every absolute path starts with `/c/…`, so this rule denies **all** absolute-path recursive deletes on Windows — an accepted trade-off: relative-path deletes still work and the rule keeps blocking root wipes). The inline-interpreter rules (`eval`, `sh -c`, `bash -c`, `zsh -c`) matched zero historical commands. Run the script yourself before adopting the list, and tune any rule whose matches are legitimate for your workflow.
2. **Guard agents with `permissionMode: plan`** — `security-guard`, `db-guard`, and `devops-guard` produce a written plan and pause for explicit user approval before any implementation.
3. **OWASP 2025 passive scan** — every code change is silently scanned for injection, IDOR, mass assignment, ReDoS, SSRF, and supply chain issues.
4. **SHA-pinned GitHub Actions** — all Actions in this repo are pinned to a full commit SHA, not mutable version tags.
5. **Secret file protection** — `global-CLAUDE.md` hard-stops any read of `.env`, `*.pem`, `*.key`, SSH keys, and service account files.

## Security CI Templates

Reusable security workflow templates for **user projects** live in [`security/`](security/): dependency audit, container scan, and security gate workflows (`security/workflows/`), a hardened `Dockerfile.template`, and a Dependabot config. Copy them into your own repo — they are templates, not this repo's CI (this repo's own CI is `.github/workflows/`).
