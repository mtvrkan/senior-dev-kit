---
description: "Core security rules — passive scan on every change, OWASP 2025, supply chain, protected files. No paths field: loads unconditionally every session."
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

## LANGUAGE-SPECIFIC HOTSPOTS — beyond the generic PASSIVE SCAN patterns above

| Language | Watch for |
| --- | --- |
| JS/TS | prototype mutation · `document.write()` |
| Python | `pickle.loads()` · `yaml.load()` (not safe_load) |
| PHP | `unserialize()` on input · `extract()` · `include $var` · `==` on hashes (use `hash_equals`) |
| Java/Kotlin | `ObjectInputStream` · XXE (unconfigured `DocumentBuilderFactory`) · SpEL/OGNL on input |
| C# | `BinaryFormatter` · `JsonSerializerSettings.TypeNameHandling` ≠ None |
| C/C++ | `strcpy`/`sprintf`/`gets` · unchecked `malloc` · use-after-free · `printf(userInput)` |
| Go | `text/template` for HTML (use `html/template`) · `exec.Command` with a shell string · unchecked `err` |
| Rust | `unsafe` block without a safety comment · `transmute` · `unwrap()`/`expect()` on request-path input |
| Swift/Kotlin mobile | Keychain misuse · hardcoded keys · cleartext HTTP · deep link without validation |

## SUPPLY CHAIN RULES (2025)

- GitHub Actions SHA-pinning, OIDC cloud auth, `npm ci` in CI: full detail + examples in
  `rules/600-devops.md` (auto-loads for Dockerfile/CI/IaC files) — don't restate here.
- Lockfile-integrity review, <7-day-package rule, Socket.dev: `agent_docs/dep-check-guide.md`
  § "Audit commands by runtime" — fires only on dep add/update, lazy-loads with the audit table.

## DEPENDENCY AUDIT

Auto-trigger: any dep added or updated → run the platform's audit command from
`agent_docs/dep-check-guide.md` § "Audit commands by runtime" (canonical per-runtime table —
lazy-loaded on first dep change, kept in exactly one place).
Pre-commit hook recommendations (gitleaks, detect-secrets, <10s budget): `rules/600-devops.md`
§ PRE-COMMIT HOOKS — auto-loads when a `.pre-commit-config.yaml` or CI file is touched.

## PROTECTED FILES — never read, modify, or reference in output

`.env` · `.env.*` · `*.pem` · `*.key` · `*.p12` · `id_rsa` · `id_ed25519` · `.ssh/`
`serviceAccountKey.json` · `*firebase-adminsdk*.json` · `*serviceaccount*.json`
`secrets/` · `config/credentials.json` · `config/secrets.json` · `.secrets.baseline*`
`*.tfstate` · `*.tfstate.backup` · `kubeconfig` · `*.kubeconfig`
`*.lock` · `node_modules/` · `dist/` · `.next/`

Terraform state holds every provider-returned password in plaintext — it is a credential file,
not an artifact. `*.tfvars` is deliberately NOT here: it is an input file that legitimately holds
non-secret configuration, and `rules/600-devops.md` loads for it. Secrets belong in a secret
manager, never in a committed `.tfvars`.

Prompt discipline first — deny rules are a partial backstop, not a guarantee; full enforcement
breakdown: the kit repo's `SECURITY.md` (not installed to ~/.claude).
