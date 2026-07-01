# /dep-check

Audit all project dependencies for CVEs, license issues, outdated versions, and deprecated packages: $ARGUMENTS

You are running a comprehensive dependency audit. Check the current project manifest files and perform the following analysis.

**Step 1 — Detect stack and find manifests**

Look for: `package.json`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`.

Read each manifest file found.

**Step 2 — CVE scan**

Run the appropriate audit command for each ecosystem found:

```text
npm/yarn/pnpm/bun:  npm audit --audit-level=moderate
Python:             pip-audit (or: safety check)
Go:                 govulncheck ./...
Rust:               cargo audit
Ruby:               bundle audit check --update
PHP:                composer audit
Java/Kotlin:        ./gradlew dependencyCheckAnalyze
```

If the tool is not installed, report which commands to run and what to look for.

**Step 3 — Outdated version analysis**

Check for packages that are significantly behind:

- More than 2 major versions behind current
- Security patches available in a newer version
- Package has a documented successor (moment → date-fns, CRA → Vite)

Use: `npm outdated` / `pip list --outdated` / `go list -m -u all`

**Step 4 — License compliance**

Flag any packages with these licenses in production dependencies:

- GPL-2.0 / GPL-3.0 (copyleft — may require open-sourcing your code)
- AGPL-3.0 (strong copyleft — applies over network)
- SSPL (Server Side Public License)
- Commons Clause additions

Safe for most projects: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, CC0-1.0

**Step 5 — Deprecation detection**

Flag packages that match any of:

- Package README says "deprecated" or "unmaintained"
- 0 commits in last 18 months (check npm/PyPI metadata)
- Official deprecation notice in package manager registry

**Output format:**

```text
DEPENDENCY AUDIT REPORT
========================

CRITICAL (CVE, fix immediately):
  [package]@[version] — CVE-YYYY-XXXXX — [description]
  → Fix: upgrade to [version] (patch available)

HIGH (outdated major version with security fixes):
  [package]@[version] → [latest] — [security fix in newer version]

MEDIUM (deprecated / license issue):
  DEP-DRIFT: [package]@[version] → [latest] — [reason]
  LICENSE: [package] — [license] — [risk]

LOW (minor outdated, no security impact):
  [count] packages with minor updates available

ACTIONS:
  1. Run: [command to fix criticals]
  2. Review: [packages needing manual review]
  3. Schedule: [non-urgent upgrades]
```

If no issues found: report "No vulnerabilities found. [N] packages scanned."
