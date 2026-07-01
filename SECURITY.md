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

This kit consists of Markdown configuration files, Bash/PowerShell install scripts, and Node.js validation scripts. The main attack surfaces are:

- **Install scripts** (`install.sh`, `install.ps1`) — shell injection via crafted preset names or paths
- **`settings.json` deny rules** — rules that are too permissive could allow unintended tool calls inside Claude Code
- **`global-CLAUDE.md` / agent definitions** — prompt injection via malicious content in routed tasks

Out of scope:

- Vulnerabilities in Claude Code itself (report to Anthropic)
- Vulnerabilities in the user's project introduced by following kit guidance (report to the relevant framework or library maintainer)

## Security Design Principles

The kit enforces several defence-in-depth measures:

1. **25 Bash/Read deny rules** in `settings.json` — blocks `rm -rf`, `git push --force`, `curl | bash`, secret file reads, and similar destructive patterns.
2. **Guard agents with `permissionMode: plan`** — `security-guard`, `db-guard`, `migration-guard`, and `devops-guard` produce a written plan and pause for explicit user approval before any implementation.
3. **OWASP 2025 passive scan** — every code change is silently scanned for injection, IDOR, mass assignment, ReDoS, SSRF, and supply chain issues.
4. **SHA-pinned GitHub Actions** — all Actions in this repo are pinned to a full commit SHA, not mutable version tags.
5. **Secret file protection** — `global-CLAUDE.md` hard-stops any read of `.env`, `*.pem`, `*.key`, SSH keys, and service account files.
