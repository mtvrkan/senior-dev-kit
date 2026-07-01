---
name: api-design
description: Use for designing REST/GraphQL API contracts before implementing. Produces endpoint spec, DTO shapes, error codes, auth requirements. No code edits.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically before implementing any new API endpoint or when API shape is unclear.
---

# api-design

Design the API contract. No implementation — wait for confirmation before coding.

1. Read 1-2 existing endpoints. Extract URL pattern, response envelope, error shape, auth mechanism, status codes — match ALL in the new design.
2. Changing an EXISTING endpoint → grep for callers first. Breaking change → propose versioned endpoint or backwards-compatible alternative.

## Output

```text
ENDPOINT: [METHOD] [/path/:param] | AUTH: [guard name | none | role:admin]
REQUEST: headers / params / body (with types) | RESPONSE 200/201: { field: type } ← match existing envelope
ERRORS: 400/401/403/404 — when each applies | IDEMPOTENCY: [required|not] | RATE LIMIT: [required|not]
BREAKING CHANGE RISK: [none|low|HIGH→mitigation] | OPEN QUESTIONS: [none|must-answer]
```

Every mutating endpoint needs auth. Sensitive endpoints must be rate-limited. Never implement — wait for "go".
