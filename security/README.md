# security/ — Copy-Paste Security Templates

These are **templates for your own project**, not files this repo runs on itself.
Copy the ones that apply, adjust for your stack, then wire them into your CI.

| File | What it is | Where it goes |
| --- | --- | --- |
| `Dockerfile.template` | Multi-stage, non-root, health-checked Dockerfile skeleton (see `rules/600-devops.md`'s DOCKERFILE SECURITY CHECKLIST for the full rationale) | Copy to your project's `Dockerfile`, fill in your build/run commands |
| `dependabot.yml` | Weekly dependency-update PRs across 11 ecosystems (npm, pip, github-actions, docker, gomod, cargo, composer, bundler, nuget, pub, maven/gradle) — majors are ignored by default (grouped minor/patch only; a major bump needs a human to re-verify breaking changes and, for GitHub Actions, re-verify the SHA pin) | Copy to `.github/dependabot.yml`, delete the ecosystem blocks that don't apply |
| `workflows/dependency-audit.yml` | Runs the audit command for whichever ecosystem manifest is present (`npm audit`, `pip-audit`, etc. — see `rules/000-security.md`'s DEPENDENCY AUDIT COMMANDS table) | Copy to `.github/workflows/dependency-audit.yml` |
| `workflows/container-scan.yml` | Trivy image scan, fails on CRITICAL/HIGH | Copy to `.github/workflows/container-scan.yml` if you build a container image |
| `workflows/security-gate.yml` | Secret scan + SAST gate on push/PR to main branches | Copy to `.github/workflows/security-gate.yml` |

None of these are read by `npm run check` in this repo — they're distributed content, validated only
by `npm run validate`'s frontmatter/structure checks where applicable. If you change one, verify it
still parses as valid YAML and still matches the rule it implements (`rules/000-security.md` /
`rules/600-devops.md`) before committing.
