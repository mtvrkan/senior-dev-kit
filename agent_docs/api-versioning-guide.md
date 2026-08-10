# API Versioning Guide

Reference for the `api-design` skill's API versioning workflow — code templates for parallel versions, deprecation headers, and migration docs.

---

## Parallel version routing (Node.js / Express / NestJS)

```typescript
// router.ts — keep old version, add new alongside
app.use('/api/v1', v1Router)  // keep working — do NOT remove
app.use('/api/v2', v2Router)  // new version

// v1 handler — old contract (unchanged)
export async function getUserV1(req: Request, res: Response) {
  const user = await userService.getUser(req.params.id)
  return res.json({ name: user.fullName })  // old shape
}

// v2 handler — new contract
export async function getUserV2(req: Request, res: Response) {
  const user = await userService.getUser(req.params.id)
  return res.json({ firstName: user.firstName, lastName: user.lastName })  // new shape
}
```

---

## Deprecation headers on old version

```typescript
// Middleware applied to all v1 routes
app.use('/api/v1', (req, res, next) => {
  res.set('Deprecation', 'Wed, 01 Jul 2026 00:00:00 GMT')  // RFC 9745: an HTTP-date, not the literal string "true"
  res.set('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')  // 6 months from v2 launch
  res.set('Link', '<https://api.example.com/v2>; rel="successor-version"')
  next()
})
```

---

## Migration guide template

Create `docs/api-migration-v[N]-to-v[N+1].md` with the following sections. Shown as an outline
rather than a copy-paste block because the template itself contains fenced JSON examples, and
nesting those inside an outer fence produces the mangled `` ```text `` markers this file carried
until the 2026-08 audit.

- **`# API Migration: v[N] → v[N+1]`**
- **`## Summary of breaking changes`** — one table: `Endpoint | Type | Before | After`.
  Example row: `GET /api/v1/users/:id | Field renamed | name | firstName + lastName`
- **`## Detailed changes`** — one `### METHOD /path` subsection per changed endpoint, each with
  a **Before (v[N])** and an **After (v[N+1])** JSON block:
  `{ "name": "John Doe" }` → `{ "firstName": "John", "lastName": "Doe" }`
- **`**How to migrate:**`** — the literal find-and-replace a consumer performs, e.g. replace
  `user.name` with `` `${user.firstName} ${user.lastName}` ``
- **`## Timeline`** — table of `Date | Event`: v[N+1] available (today), deprecation headers on
  v[N] (+2 weeks), v[N] sunset (+6 months)
- **`## Questions?`** — where to open an issue or reach the API team

---

## OpenAPI spec — dual version strategy

```yaml
# openapi.yaml — maintain separate spec per version
openapi: 3.2.0
info:
  version: 2.0.0
  title: API v2

paths:
  /api/v2/users/{id}:
    get:
      operationId: getUserV2
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserV2'

components:
  schemas:
    UserV2:
      type: object
      properties:
        firstName: { type: string }
        lastName:  { type: string }
```

Run type generation after update:

```bash
openapi-typescript openapi.yaml -o types/api.d.ts
```

---

## Versioning plan template

```text
VERSIONING PLAN: [resource name]
==================================
Current: /api/v[N]/[resource]
New:     /api/v[N+1]/[resource]

Breaking changes:
  - [field removed / renamed / type changed]

Timeline:
  v[N+1] available:   [date]
  v[N] deprecated:    [date + 2 weeks]
  v[N] sunset:        [date + 6 months]

Files to change:
  router.ts          — add v[N+1] routes
  [handler].ts       — new v[N+1] handler
  middleware/deprecate.ts — Deprecation + Sunset headers on v[N]
  openapi.yaml       — add v[N+1] schema
  types/api.d.ts     — regenerate after openapi update
  docs/api-migration-vN-to-vN+1.md — create
```
