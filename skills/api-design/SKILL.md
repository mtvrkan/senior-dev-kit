---
name: api-design
description: Use for designing REST/GraphQL API contracts before implementing, and for planning breaking-change version transitions (v1→v2, deprecations, client migration paths). Produces endpoint spec, DTO shapes, error codes, auth requirements. No code edits.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically before implementing any new API endpoint, when API shape is unclear, or when a change removes/renames a field, adds a required field, or changes error format/auth — anything that breaks existing clients.
argument-hint: "[endpoint or resource to design or version]"
---

# api-design

Design the API contract. No implementation — wait for confirmation before coding.

1. Read 1-2 existing endpoints. Extract URL pattern, response envelope, error shape, auth mechanism, status codes — match ALL in the new design.
2. Changing an EXISTING endpoint → grep for callers first. Non-breaking → propose a backwards-compatible alternative. Breaking → version transition below.

## Version transitions (breaking changes only)

Breaking = removed/renamed field, required field added, type/status-code/error-format/auth changed, endpoint removed. Non-breaking (no versioning): new optional field/param, new endpoint.
Plan: current `/api/v[N]` → new `/api/v[N+1]`, both live in parallel — never remove old behavior on deploy. Old version gets `Deprecation` + `Sunset` + `Link` headers; sunset ≥6 months after v[N+1] ships. Write `docs/api-migration-vN-to-vN+1.md`, update OpenAPI spec, regenerate types.
Deep reference: `agent_docs/api-versioning-guide.md` — parallel routing code, deprecation headers, migration guide template, OpenAPI dual-version strategy.

## Output

```text
ENDPOINT: [METHOD] [/path/:param] | AUTH: [guard name | none | role:admin]
REQUEST: headers / params / body (with types) | RESPONSE 200/201: { field: type } ← match existing envelope
ERRORS: 400/401/403/404 — when each applies | IDEMPOTENCY: [required|not] | RATE LIMIT: [required|not]
BREAKING CHANGE RISK: [none|low|HIGH→mitigation] | OPEN QUESTIONS: [none|must-answer]
```

Every mutating endpoint needs auth. Sensitive endpoints must be rate-limited. Never implement — wait for "go".
