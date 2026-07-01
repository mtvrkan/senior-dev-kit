---
name: api-versioning
description: Use when introducing breaking API changes, creating a new API version, deprecating old endpoints, or planning an API migration path for existing clients.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
when_to_use: Use when: removing a field from API response, renaming a field, changing required/optional status, changing error format, changing auth requirement, or creating v2+ of any API.
argument-hint: "[endpoint or resource being versioned] [breaking change description]"
---

# api-versioning

Manage API version transitions. Clients must never break on deploy. See `agent_docs/api-versioning-guide.md` for parallel routing code, deprecation headers, migration guide template, and OpenAPI dual-version strategy. For designing a brand-new endpoint's shape, use `api-design` first.

Non-breaking (no versioning): new optional field/param, new endpoint. Breaking (new version required): removed/renamed field, required field added, type changed, status code changed, error format changed, auth changed, endpoint removed.

1. Classify the change — non-breaking → skip versioning, implement directly.
2. Plan version: current `/api/v[N]` → new `/api/v[N+1]`. Sunset old version 6 months after v[N+1] ships.
3. Implement both versions in parallel — do NOT remove old behavior. Add `Deprecation` + `Sunset` + `Link` headers to old version middleware.
4. Write `docs/api-migration-vN-to-vN+1.md`. Update OpenAPI spec, regenerate types.

## Output

```text
Resource: [endpoint(s)] | Breaking: [list] | New: /api/v[N+1] | Old deprecated: [date] · sunset: [date]
Files: [router, handler, middleware, openapi.yaml, types/api.d.ts, migration guide]
TEST: [command — ✓ N passed]
```
