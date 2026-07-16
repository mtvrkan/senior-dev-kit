---
description: "Core security rules — passive scan on every change, OWASP 2025, supply chain, pre-commit tooling. No paths field: loads unconditionally every session."
---

## PASSIVE SCAN — every code change, zero overhead

Run silently. If any check fires: STOP → flag → propose fix → continue.

| Check | Pattern to detect |
| --- | --- |
| SQL injection | String concat/interpolation in queries: `"SELECT * WHERE id=" + input` |
| Shell injection | `exec(userInput)`, `subprocess(shell=True)`, backtick with variable |
| XSS | `innerHTML = userInput`, `dangerouslySetInnerHTML`, `eval(userInput)` |
| Path traversal | `path.join(base, userInput)` without normalization + boundary check |
| IDOR | Object returned by ID without ownership check against `req.user` |
| Mass assignment | `Object.assign(model, req.body)` or `Model.create(req.body)` without allowlist |
| Prototype pollution | `Object.assign({}, userInput)` where target is shared object |
| ReDoS | Unbounded quantifiers (`(.+)+`, `(a*)*`) applied to user strings |
| SSRF | Server-side `fetch(userProvidedUrl)` without allowlist |
| Open redirect | `res.redirect(req.query.next)` without validation |
| Secrets in output | Any API key / token / password printed to logs or response body |

## OWASP TOP 10 — 2025 EDITION

| Rank | Category | Auto-check trigger |
| --- | --- | --- |
| A01 | Broken Access Control | auth/permissions code changed |
| A02 | Security Misconfiguration (↑) | any config file changed |
| A03 | Software Supply Chain Failures (NEW) | any dep added/updated |
| A04 | Cryptographic Failures | password/token/encryption code |
| A05 | Injection | DB query, shell call, template render |
| A06 | Insecure Design | missing threat model, missing rate limit/business-logic validation on a new flow |
| A07 | Authentication Failures | login/session/JWT logic |
| A08 | Software or Data Integrity Failures | serialization/deserialization, pipeline |
| A09 | Security Logging and Alerting Failures | error handling, logging code changed |
| A10 | Mishandling of Exceptional Conditions (NEW) | any try/catch changed |

## LANGUAGE-SPECIFIC HOTSPOTS

| Language | Watch for |
| --- | --- |
| JS/TS | `eval()` `innerHTML=` `dangerouslySetInnerHTML` `exec()` prototype mutation `document.write()` |
| Python | `pickle.loads()` `yaml.load()` (not safe_load) `subprocess(shell=True)` `eval()` `exec()` |
| Go | `fmt.Sprintf` in SQL queries · `os/exec` with user input · `text/template` vs `html/template` |
| PHP | `eval()` `system()` unsanitized `$_REQUEST` `include(userInput)` `unserialize()` |
| Java/Kotlin | `Runtime.exec()` JNDI lookups deserialization without allowlist `ObjectInputStream` |
| Ruby | backtick with variable · `eval()` · `send(userMethod)` · mass assignment |
| Swift/Kotlin mobile | Keychain misuse · hardcoded keys · cleartext HTTP · deep link without validation |
| Rust | unnecessary `unsafe` blocks · `from_utf8_unchecked` · untrusted deserialization |

## SUPPLY CHAIN RULES (2025)

- Pin ALL GitHub Actions to full commit SHA — never mutable tags (GitHub added an opt-in org-level policy to require this in Aug 2025 — not a global default, so pin explicitly regardless of org settings)
  `uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2`
- Use OIDC for cloud auth (AWS/GCP/Azure) — never long-lived secrets in Actions secrets
- `npm ci` in CI (never `npm install`) — `ci` already fails on a lockfile/manifest mismatch, no flag needed; `--frozen-lockfile` is a Yarn/pnpm flag, not npm's (npm warns "Unknown cli config" today and will hard-error in a future major version)
- Review lockfile `resolved` / `integrity` field changes in PRs (lockfile injection vector)
- New packages published <7 days ago: verify before adding
- Socket.dev: use for npm supply chain malware detection when available

## DEPENDENCY AUDIT COMMANDS

| Runtime | Command |
| --- | --- |
| npm | `npm audit --audit-level=moderate` |
| pnpm | `pnpm audit --audit-level=moderate` |
| yarn | `yarn audit --level moderate` |
| bun | `bun audit` |
| pip | `pip-audit` |
| poetry | `poetry run pip-audit` |
| uv | `uv run pip-audit` |
| go | `govulncheck ./...` |
| rust | `cargo audit` |
| java/gradle | `./gradlew dependencyCheckAnalyze` |
| java/maven | `mvn dependency-check:check` |
| php | `composer audit` |
| ruby | `bundle audit check --update` |
| dotnet | `dotnet list package --vulnerable` |
| dart/flutter | `osv-scanner -L pubspec.lock` (Dart has no built-in `pub audit` command) |

Auto-trigger: any dep added or updated → run platform audit command.

## PRE-COMMIT HOOKS — BUDGET: <10 SECONDS TOTAL

Fast (use as pre-commit): gitleaks (~0.5s) · detect-secrets (~1-2s) · hadolint (~0.2s) · bandit (~1-3s)
Slow (CI only, never pre-commit): Semgrep full ruleset (~30-60s) · CodeQL (minutes) · Trivy image

Recommended stack for .pre-commit-config.yaml:

- gitleaks/gitleaks (secret scan, full git history)
- Yelp/detect-secrets (baseline-managed)
- hadolint/hadolint (Dockerfile lint, if present)
- PyCQA/bandit (Python security, if Python project)
- pre-commit-hooks: detect-private-key · no-commit-to-branch(main,master) · check-merge-conflict

## PROTECTED FILES — never read, modify, or reference in output

`.env` · `.env.*` · `*.pem` · `*.key` · `*.p12` · `id_rsa` · `id_ed25519` · `.ssh/`
`serviceAccountKey.json` · `*firebase-adminsdk*.json` · `*serviceaccount*.json`
`secrets/` · `config/credentials.json` · `config/secrets.json` · `.secrets.baseline*`
`*.lock` · `node_modules/` · `dist/` · `.next/`
