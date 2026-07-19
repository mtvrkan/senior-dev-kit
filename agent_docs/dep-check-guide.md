# Dependency Check Guide

Reference for the `security-scan` skill's dependency-hygiene check (open-source alternatives
table, dependency philosophy) AND for general library/framework/tooling choice at any point in
the session (new file, `feature-build`, adding a package) — load whenever recommending or adding
a dependency, not only during a security-scan pass.

---

## Category preferences — Prefer → Avoid

| Category | Prefer | Avoid |
| --- | --- | --- |
| CSS | Tailwind v3/v4, CSS Modules | Bootstrap, raw CSS for new projects |
| React UI | shadcn/ui, Radix UI, Headless UI | MUI v4, Ant Design 4.x |
| Vue UI | Naive UI, Nuxt UI, shadcn-vue | Vuetify 2, Element UI |
| React state | Zustand + TanStack Query + Jotai | Redux+saga (new), MobX |
| Forms | React Hook Form + Zod | Formik, class-validator alone |
| Tables | TanStack Table v8 | Custom HTML table |
| Date | date-fns, Temporal API | moment.js |
| HTTP client | Native `fetch` with typed wrapper | jQuery.ajax, XMLHttpRequest |
| Build | Vite, Turbopack | Create React App (deprecated), Webpack (new) |
| Testing JS | Vitest + Testing Library, Playwright | Jasmine, Karma, Mocha (new) |
| ORM (TS) | Prisma, Drizzle | Sequelize, TypeORM (new) |
| Auth | Better Auth, Auth.js | Passport.js (new), Lucia (deprecated Mar 2025 — maintainer stopped shipping it as a library) |
| Email | Resend, Nodemailer | — |
| Analytics | PostHog (self-host), Plausible | Google Analytics |
| RN lists | FlashList | FlatList (long lists) |
| RN nav | Expo Router v6 | React Navigation alone (if Expo) |
| Android UI | Material 3 (Compose) | Material 2, XML layouts (new) |
| iOS UI | SwiftUI | UIKit (new screens) |
| Flutter state | Riverpod | Provider (new) |
| Python HTTP | httpx, aiohttp | requests (async projects) |
| Python API | FastAPI | Flask (new async) |
| Python typing | Pydantic v2 | marshmallow (new) |
| Go HTTP | stdlib net/http, chi, Echo | Gorilla Mux (new) |
| Go ORM | sqlc, ent | GORM (if sqlc fits) |
| PHP | Laravel 11+, Livewire | raw PHP (new), CodeIgniter |
| Ruby | Rails 7+, Hotwire | Sinatra (large projects) |
| Animation | CSS transitions, Framer Motion (React), View Transitions API | GSAP (complex only) |
| Page transitions | View Transitions API (native, zero KB) | Framer Motion AnimatePresence |

### Paid dependency rule

If recommending a paid lib/service (Clerk, Auth0, AG Grid Enterprise, etc.):

1. STOP — do not proceed with paid option.
2. Find free alternative from the table above (or the "Open-source preferred alternatives" table below).
3. If no free alternative: ask user — "X requires paid plan. Free alternative Y covers [features]. Use Y, or do you have X license?"
4. NEVER silently add paid dependency to package.json/Gemfile/composer.json.

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
| `dotenv` (for .env loading) | `node --env-file=.env` (Node 20.6+) | built-in .env loading, zero deps |
| `cross-env` (inline env vars in npm scripts) | keep — no built-in replacement | still needed for `VAR=x node script.js` cross-platform in package.json scripts |

---

## Audit commands by runtime

Canonical table — kept in exactly one place (moved here from the always-loaded
`rules/000-security.md`, which now points at this section; a second hand-synced copy is how
the two silently drift the next time a package manager changes its CLI).

Supply-chain checks on every dep add/update (moved here from 000-security for the same reason
— they only ever fire together with this table):

- Review lockfile `resolved` / `integrity` field changes in PRs (lockfile injection vector)
- New packages published <7 days ago: verify before adding
- Socket.dev: use for npm supply chain malware detection when available

| Runtime | Command |
| --- | --- |
| npm | `npm audit --audit-level=moderate` |
| pnpm | `pnpm audit --audit-level=moderate` |
| yarn | `yarn npm audit --severity moderate` (Yarn Berry; Classic v1: `yarn audit --level moderate`) |
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

Auto-trigger: any dep added or updated → run the platform audit command.

For the `*outdated`/bundle-size checks this guide adds on top of the audit command itself,
see below.

```bash
npm outdated
pip list --outdated
bundle outdated
composer outdated
dart pub outdated
cargo outdated
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
