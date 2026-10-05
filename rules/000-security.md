---
description: "Core security rules — passive scan on every change, OWASP 2025, supply chain, protected files, ask-first deletions/pushes/private files. No paths field: loads unconditionally every session."
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
| Ruby | `Marshal.load` · `YAML.load` (use `safe_load`) · `send`/`constantize`/`eval` on params · `permit!` · `html_safe`/`raw` on user content · interpolated `where`/`order` |
| Mobile (Swift/Kotlin/Dart/RN) | Keychain/Keystore misuse · tokens in `UserDefaults`/`SharedPreferences`/`AsyncStorage` · hardcoded keys · cleartext HTTP · deep link without validation · WebView with JS enabled on remote content |

## SUPPLY CHAIN + DEPENDENCY AUDIT

Any dep added or updated → run the runtime's audit command, review the lockfile diff and apply the
<7-day-package rule: `agent_docs/dep-check-guide.md` § "Audit commands by runtime". SHA-pinned
Actions, OIDC, `npm ci` in CI and pre-commit hooks (gitleaks): `rules/600-devops.md`.

## PROTECTED FILES — never read, modify, or reference in output

**Credential material — never read, never written.** No legitimate task produces one of these,
so both halves are enforced (`Read(...)` + `Edit(...)` deny rules):

`*.pem` · `*.key` · `*.p12` · `*.pfx` · `id_rsa` · `id_ed25519` · `id_ecdsa` · `id_dsa` · `.ssh/`
`serviceAccountKey.json` · `*firebase-adminsdk*.json` · `*serviceaccount*.json`
`secrets/` · `config/credentials.json` · `config/secrets.json`
`*.tfstate` · `*.tfstate.backup` · `kubeconfig` · `*.kubeconfig`

**Read-denied only — writable when the task genuinely calls for it:**

`.env` · `.env.*` · `.secrets.baseline*` · `*.lock` · `node_modules/` · `dist/` · `.next/`

`*.tfstate` holds every provider-returned password in plaintext, so it is credential material.
`*.tfvars` stays readable as an input file; secrets never go in a committed `.tfvars`.

Prompt discipline first — deny rules are a partial backstop, not a guarantee; full enforcement
breakdown: the kit repo's `SECURITY.md` (not installed to ~/.claude).

## ASK FIRST — deletions, pushes, private files

DELETE — never without the user's explicit yes in that same moment: files, folders, branches,
stashes, tags, DB rows, artifacts, remote resources — including files you created yourself and
temp or stray files. Covers `rm`, `Remove-Item`, `git clean`, `git branch -D`, `git stash drop`,
`git reset --hard` and any script that removes things. List exactly what would go, ask, wait. A
broad instruction ("clean up", "finish everything", "go ahead") is never approval for a deletion.

PUSH — commit verified work as usual; push only when the user asks for a push at that moment.
Covers `git push` in every form (force, tags, `--set-upstream`) and anything that pushes for you
(`gh pr create`, `gh repo sync`, a script). One request covers one push; "ship it" is not one.

PRIVATE FILES — AI-assistant files and working notes are never `git add`ed, committed or pushed:
`CLAUDE.md`, `CLAUDE.local.md`, `.claude/` (TECH-DEBT, PROJECT-MEMORY, settings), `AGENTS.md`,
`GEMINI.md`, `.codex/`, `.cursor/`, `.windsurf/`, `ROADMAP.md`, `PLAN*.md`, `NOTES*.md`,
`PROJECT-CONTRACTS.md`, `DESIGN-SPEC.md`. Keep them out through the global excludes file
(`core.excludesFile`, default `~/.config/git/ignore`) or the repo's `.git/info/exclude`, never the
committed `.gitignore`. The kit rules that write these files still apply; the files stay local. A
file the repo already tracks or deliberately publishes (a team-shared `CLAUDE.md`) is the
project's call — ask before untracking it. Public docs (README, CHANGELOG, LICENSE, `docs/`)
never point at a private file. Before any commit, check `git status` and unstage one that slipped in.
