# Preset Maintenance Policy

This document defines version support, deprecation timelines, and review cadence for the 49 presets in this kit.

---

## Version Support Matrix

> Dates clustered around 2026-06-30/07-01 are the v1.0.0 release baseline: the entire kit was reviewed item-by-item in that pre-release hardening pass, so the shared date reflects a real review, not a bulk stamp. Later edits stagger the dates naturally.

Each preset targets the **current stable major version** of its framework at the time of last update.
The version window is listed here so users can judge whether a preset is still applicable.

| Category | Preset | Supported Version(s) | Last Reviewed |
| --- | --- | --- | --- |
| **Web** | `nextjs-saas` | Next.js 14–15 | 2026-06-30 |
| **Web** | `react-vite` | React 18–19 · Vite 5–6 | 2026-06-30 |
| **Web** | `vue-nuxt` | Vue 3.x · Nuxt 3.x | 2026-06-30 |
| **Web** | `sveltekit` | SvelteKit 2.x | 2026-06-30 |
| **Web** | `angular` | Angular 17–18 | 2026-06-30 |
| **Web** | `astro` | Astro 4–5 | 2026-06-30 |
| **Web** | `remix` | Remix 2.x | 2026-06-30 |
| **Backend** | `nestjs` | NestJS 10–11 | 2026-06-30 |
| **Backend** | `node-express` | Express 4.x · Node 20+ | 2026-06-30 |
| **Backend** | `fastapi` | FastAPI 0.100+ · Python 3.11+ | 2026-06-30 |
| **Backend** | `django` | Django 4.2–5.x | 2026-06-30 |
| **Backend** | `flask` | Flask 3.x | 2026-06-30 |
| **Backend** | `go-api` | Go 1.21+ | 2026-06-30 |
| **Backend** | `rust-api` | Rust 1.75+ · Axum 0.7+ | 2026-06-30 |
| **Backend** | `java-spring` | Spring Boot 3.x · Java 21 | 2026-06-30 |
| **Backend** | `laravel` | Laravel 11.x | 2026-06-30 |
| **Backend** | `rails` | Rails 7.x | 2026-06-30 |
| **Backend** | `dotnet-api` | .NET 8–9 | 2026-06-30 |
| **ORM** | `prisma` | Prisma 5.x | 2026-06-30 |
| **ORM** | `drizzle` | Drizzle ORM 0.30+ | 2026-06-30 |
| **ORM** | `typeorm` | TypeORM 0.3.x | 2026-06-30 |
| **ORM** | `sequelize` | Sequelize 6.x | 2026-06-30 |
| **ORM** | `mongoose` | Mongoose 8.x | 2026-06-30 |
| **ORM** | `sqlalchemy` | SQLAlchemy 2.x | 2026-06-30 |
| **Database** | `postgres` | PostgreSQL 15–17 | 2026-07-01 |
| **Database** | `mysql` | MySQL 8.x | 2026-06-30 |
| **Database** | `sqlite` | SQLite 3.x | 2026-06-30 |
| **Database** | `mongodb` | MongoDB 7.x | 2026-06-30 |
| **Database** | `redis` | Redis 7.x | 2026-06-30 |
| **Database** | `supabase` | supabase-js 2.x · CLI 1.x+ | 2026-06-30 |
| **Database** | `firebase` | Firebase 10.x SDK | 2026-06-30 |
| **Mobile** | `flutter` | Flutter 3.x · Dart 3.x | 2026-06-30 |
| **Mobile** | `kotlin-android` | Kotlin 1.9+ · Compose 1.6+ | 2026-06-30 |
| **Mobile** | `swift-ios` | Swift 5.9+ · iOS 17+ | 2026-06-30 |
| **Mobile** | `react-native` | RN 0.73+ · Expo SDK 50+ | 2026-06-30 |
| **Runtime** | `bun` | Bun 1.x | 2026-06-30 |
| **Runtime** | `deno` | Deno 1.40+ / 2.x | 2026-06-30 |
| **Runtime** | `cloudflare-workers` | Workers Runtime · Wrangler 3+ | 2026-06-30 |
| **API** | `trpc` | tRPC v11 | 2026-06-30 |
| **API** | `graphql` | GraphQL 16.x · Apollo 4.x | 2026-06-30 |
| **API** | `websocket` | WS / Socket.IO 4.x | 2026-06-30 |
| **Messaging** | `bullmq` | BullMQ 5.x | 2026-06-30 |
| **Messaging** | `kafka` | KafkaJS 2.x | 2026-06-30 |
| **Infrastructure** | `docker` | Docker Engine 26+ · Compose v2 | 2026-06-30 |
| **Infrastructure** | `kubernetes` | Kubernetes 1.28+ | 2026-06-30 |
| **Infrastructure** | `terraform` | Terraform 1.7+ | 2026-06-30 |
| **AI** | `llm-integration` | Anthropic SDK 0.24+ | 2026-06-30 |
| **Generic** | `fallback` | Stack-agnostic fallback | 2026-06-30 |
| **Generic** | `monorepo` | Turborepo 2.x / Nx 18+ | 2026-06-30 |

All 49 presets share the same "Last Reviewed" date because they were reviewed together for the v1.0.0 launch — this is expected and not a sign of neglect. Going forward, update only the row(s) for the preset(s) you actually touch; do not bulk-refresh the whole table on unrelated changes, or the cohort will keep re-forming and every preset will flag `stale-check` on the same day each cycle.

---

## Deprecation Policy

### When a preset becomes stale

A preset is considered **stale** when:

- The framework has released a new major version with breaking changes
- The preset references APIs, config keys, or patterns removed in the new version
- More than **12 months** have passed since the last review

### Deprecation lifecycle

```text
Active → Stale (flag in table) → Deprecated (header added) → Removed (next minor release)
```

**Step 1 — Flag as stale:** Add `[STALE]` prefix to the preset name in this table. Add a note in the preset's `CLAUDE.md` header:

```markdown
> ⚠ This preset targets [Framework] [version]. A newer version is available — see PRESET-MAINTENANCE.md.
```

**Step 2 — Deprecate:** When a replacement is ready, add to the preset's `CLAUDE.md`:

```markdown
> DEPRECATED: Use [new-preset] instead. This preset will be removed in the next minor release.
```

**Step 3 — Remove:** Delete the preset directory in the next minor version bump. Update CHANGELOG.md.

### Breaking change protocol

When a framework releases a breaking major version:

1. Create a new preset (e.g., `rails-8`) — do NOT overwrite the existing one
2. Run `npm run validate` to confirm no broken cross-references
3. Add the new preset to this table
4. Mark the old preset as stale
5. After 3 months, move the old preset to deprecated

---

## Review Cadence

| Trigger | Action |
| --- | --- |
| Framework major version release | Review affected preset within 30 days |
| Security advisory for a framework | Review affected preset within 7 days |
| Quarterly scheduled review | Audit all presets against latest stable versions |
| User-reported issue | Review within 14 days |

### Quarterly review checklist

For each preset:

- [ ] Verify version numbers in `CLAUDE.md` still match current stable release
- [ ] Check if any referenced APIs, CLI commands, or config keys have changed
- [ ] Verify test/lint/build commands still work with the current toolchain
- [ ] Check if security recommendations are still current (CVEs, deprecated crypto, etc.)
- [ ] Update `Last Reviewed` date in this table

---

## Contributing a Preset Update

1. Edit the preset's `CLAUDE.md` with the updated conventions
2. Update the `Last Reviewed` date in this table
3. Run `npm run validate` — must pass
4. Add an entry to `CHANGELOG.md` under a new version
5. Submit a PR with the title: `preset(name): update to vX.Y`
