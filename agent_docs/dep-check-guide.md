# Dependency Check Guide

Reference for the `security-scan` skill's dependency-hygiene check — open-source alternatives table and dependency philosophy.

---

## Dependency philosophy

| Situation | Rule |
| --- | --- |
| Package requires paid license for production | Flag → ask user before keeping (BLOCKING) |
| Commercial alternative being considered | Recommend free alternative first |
| Package not imported anywhere | Flag as dead dependency |
| moment.js / lodash (full) / jQuery present | Flag → modern alternatives exist |
| Package does only 1 small thing | Flag → can this be done with 5 lines of code? |
| Newer, maintained alternative exists | Flag → propose upgrade path |

---

## Open-source preferred alternatives

| Avoid | Prefer | Reason |
| --- | --- | --- |
| `moment` | `date-fns`, `dayjs`, native `Intl` | moment is deprecated, 67KB |
| `lodash` (full) | `lodash-es` (tree-shakeable) or native JS | native has most methods now |
| `jQuery` | Native DOM / framework methods | redundant in modern apps |
| `axios` (if fetch works) | Native `fetch` with typed wrapper | built-in, smaller |
| AG Grid Enterprise | TanStack Table v8 (free, headless) | free, composable |
| Syncfusion / Telerik / DevExtreme | shadcn/ui DataTable, Mantine, Ant Design | free, well-maintained |
| `node-cron` | BullMQ scheduler | persistent, retryable |
| `passport` (complex setup) | Better Auth, Auth.js | modern, simpler, type-safe — not Lucia (deprecated Mar 2025) |
| `class-transformer` + `class-validator` | Zod | simpler, type-safe, one package |
| `jsonwebtoken` alone | Better Auth (handles session + refresh) | full auth solution |
| `nodemailer` (complex setup) | Resend SDK | simpler API, better DX |
| `bcryptjs` | `argon2` | more secure for passwords |
| `uuid` (Node.js 14+) | `crypto.randomUUID()` | built-in, zero deps |
| `cross-env` (Node.js 20+) | Native `env` in package.json scripts | built-in now |

---

## Audit commands by runtime

```bash
# JS / TS
npm audit --audit-level=high
npm outdated
pnpm audit --audit-level=high
yarn npm audit --level high
bun audit

# Python
pip-audit
pip list --outdated

# Ruby
bundle audit check --update
bundle outdated

# PHP
composer audit
composer outdated

# Dart / Flutter (no built-in `pub audit` command)
osv-scanner -L pubspec.lock
dart pub outdated

# Kotlin / Java (Gradle)
./gradlew dependencyCheckAnalyze

# Rust
cargo audit
cargo outdated

# Go
govulncheck ./...
```

---

## Bundle size check (JS/TS only)

```bash
# Check a package before adding
npx bundlephobia [package]@[version]

# Analyze existing bundle
next build && npx @next/bundle-analyzer
# or
npx vite-bundle-visualizer
```

Flag if single dependency adds >30KB gzip to initial bundle.
