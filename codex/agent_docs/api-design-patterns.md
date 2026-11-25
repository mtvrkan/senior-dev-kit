# API Design Patterns — Lazy Reference

## PROTOCOL SELECTION MATRIX

| Scenario | Best choice | Why |
| --- | --- | --- |
| Public API consumed by third parties | REST | Universal, no client codegen needed |
| Internal TS/JS full-stack (Next.js + API) | tRPC | End-to-end type safety, zero codegen |
| Complex data requirements, mobile clients | GraphQL | Client-specified shape, reduces over-fetching |
| Real-time bidirectional | WebSocket / Server-Sent Events | HTTP not ideal for streaming |
| Service-to-service (microservices) | gRPC | Binary, fast, schema-first, streaming support |
| Simple webhooks / event notification | REST (POST) | Simple, universal |

### tRPC — when it shines

Server (Next.js / NestJS) — both procedures sit behind auth and `select` the public columns, so the
password hash and every other internal column never reach the client:

```typescript
const publicUserFields = { id: true, email: true, name: true } as const

export const userRouter = router({
  getById: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { id: input }, select: publicUserFields })
    }),
  
  create: protectedProcedure
    .input(CreateUserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input, select: publicUserFields })
    }),
})
```

Client — fully typed, no codegen; TypeScript knows the return type from the server definition:

```typescript
const user = await trpc.user.getById.query(userId)
```

### GraphQL — when it makes sense

Only justified when:

1. Multiple different clients need different field subsets (mobile vs web vs partner)
2. Deep nested data with complex filtering
3. Client-driven requirements (not server-prescribed)

`orders` below is nested — the client specifies the depth.

```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: Pagination): UserConnection!
}

type User {
  id: ID!
  email: String!
  orders(status: OrderStatus): [Order!]!
}
```

N+1 prevention in GraphQL is mandatory: use DataLoader for every relation field. DataLoader
batches the individual lookups:

```typescript
const ordersLoader = new DataLoader<string, Order[]>(async (userIds) => {
  const orders = await db.order.findMany({ where: { userId: { in: [...userIds] } } })
  return userIds.map(id => orders.filter(o => o.userId === id))
})
```

## REST DESIGN DEPTH

### Resource modeling

```text
Single resource:  /users/{id}
Collection:       /users
Nested (max 2):   /users/{id}/orders
                  /orders/{id}/items
Action on resource: POST /orders/{id}/cancel
Action on collection: POST /users/bulk-invite

Avoid: /orders/{id}/items/{itemId}/reviews/{reviewId}/likes
       ← too deep — flatten: /reviews/{reviewId}/likes
```

### Filtering, sorting, field selection

- Filtering — query params for GET
- Sorting — prefix `-` for descending
- Field selection (JSON:API-inspired) — sparse fieldsets for performance; return only what the
  client needs

```http
GET /users?role=admin&status=active&createdAfter=2024-01-01

GET /users?sort=-createdAt,email

GET /users?fields=id,email,role
```

### Long-running operations

```text
Sync (< 2s): return result directly
Async (2s-30s): accept + 202, poll endpoint
Long async (> 30s): accept + 202, webhook on completion
```

Async pattern, polled:

```http
POST /reports/generate
→ 202 Accepted
  Location: /reports/jobs/abc123
  
GET /reports/jobs/abc123
→ 200 { status: 'processing', progress: 45 }
→ 200 { status: 'complete', result: '/reports/abc123' }
```

Or with a webhook — when the job completes, the server POSTs the result to `webhookUrl`:

```http
POST /reports/generate { webhookUrl: 'https://myapp.com/hooks/report' }
→ 202 Accepted { jobId: 'abc123' }
```

A client-supplied `webhookUrl` is an SSRF vector — the server will POST wherever it points,
including internal services and cloud metadata endpoints. Validate it on receipt and again before
every delivery (`assertPublicHttpsUrl` under WEBHOOK DESIGN).

### Batch operations

Bulk create:

```http
POST /users/batch
{ "users": [...] }
→ 207 Multi-Status
  { "results": [{ "status": 201, "id": "..." }, { "status": 400, "error": "..." }] }
```

Bulk update (PATCH):

```http
PATCH /users/batch
{ "ids": ["a", "b", "c"], "patch": { "status": "inactive" } }
→ 200 { "updated": 3 }
```

## PAGINATION DEEP DIVE

### Cursor vs Offset comparison

| Feature | Cursor | Offset |
| --- | --- | --- |
| Consistent with insertions | ✓ Yes | ✗ No (items shift) |
| Jump to page N | ✗ No | ✓ Yes |
| Performance (large sets) | ✓ O(1) | ✗ O(n) — COUNT(*) is expensive |
| Works with real-time data | ✓ Yes | ✗ No (pages shift) |
| Simple to implement | ✗ Complex | ✓ Simple |

**Use cursor for**: feeds, timelines, infinite scroll, real-time data
**Use offset for**: paginated tables with page numbers, admin panels, small datasets (<10k rows)

Cursor pagination (Prisma) — `take: pageSize + 1` fetches one extra row to check whether more
pages exist:

```typescript
const users = await db.user.findMany({
  take: pageSize + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
})

const hasMore = users.length > pageSize
const items = hasMore ? users.slice(0, -1) : users
const nextCursor = hasMore ? items[items.length - 1].id : null

return { items, nextCursor, hasMore }
```

## VERSIONING STRATEGY

Semantic rule for deciding WHEN to version (the how — routing/deprecation-headers/migration-doc/OpenAPI templates — is in `agent_docs/api-versioning-guide.md`):

```text
MAJOR (v1 → v2): breaking change — required field added, field removed, format changed
MINOR (v1.1): new optional fields, new optional endpoints — backward compatible
PATCH: bug fixes, clarifications — no contract change
```

Only version on MAJOR breaks. Minor/patch: add without versioning.

## IDEMPOTENCY IMPLEMENTATION

Middleware for idempotent POST/PATCH:

```typescript
async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key']
  if (!key) return next()

  const cacheKey = `idempotency:${req.user.id}:${req.method}:${req.path}:${key}`
  const lockKey = `${cacheKey}:lock`
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex')

  const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX')
  if (!acquired) {
    return res.status(409).json({ title: 'A request with this Idempotency-Key is still being processed' })
  }

  const cached = await redis.get(cacheKey)
  if (cached) {
    await redis.del(lockKey)
    const { hash, status, body } = JSON.parse(cached)
    if (hash !== bodyHash) {
      return res.status(422).json({ title: 'Idempotency-Key reused with a different request body' })
    }
    return res.status(status).json(body)
  }

  const originalJson = res.json.bind(res)
  res.json = (body) => {
    const persist = res.statusCode < 500
      ? redis.set(cacheKey, JSON.stringify({ hash: bodyHash, status: res.statusCode, body }), 'EX', 86400)
      : Promise.resolve()
    persist
      .catch(err => logger.error({ err: err.message, action: 'idempotency.persist.failed' }))
      .finally(() => redis.del(lockKey))
    return originalJson(body)
  }

  next()
}
```

The key is scoped by principal, method and route, so one user can never replay another user's key and read their response. The stored body hash turns a reused key with a different payload into a 422 instead of a silent replay, and the `SET NX` lock (60s TTL, so a crashed request cannot hold it forever) answers a concurrent retry with 409 while the first attempt is still running. Taking the lock before reading the cache closes the window where two retries both miss the cache and both execute. The `res.json` override stays synchronous: Express's `res.json` returns `res` for chaining, and an `async` override would return a Promise instead. The response goes out at once, and the lock is released only after the cache write settles, so a retry in that gap still gets 409 rather than a cache miss.

## WEBHOOK DESIGN

Sending webhooks (producer). The target URL came from a client, so before every delivery it must be
`https:` and resolve only to public addresses — not private, loopback, link-local or CGNAT ranges.
`redirect: 'error'` stops a public URL from bouncing the request to an internal one, and a non-2xx
response throws so the retry schedule below picks it up:

```typescript
import { lookup } from 'node:dns/promises'
import { BlockList } from 'node:net'

const blockedRanges = new BlockList()
blockedRanges.addSubnet('0.0.0.0', 8)
blockedRanges.addSubnet('10.0.0.0', 8)
blockedRanges.addSubnet('100.64.0.0', 10)
blockedRanges.addSubnet('127.0.0.0', 8)
blockedRanges.addSubnet('169.254.0.0', 16)
blockedRanges.addSubnet('172.16.0.0', 12)
blockedRanges.addSubnet('192.168.0.0', 16)
blockedRanges.addAddress('::', 'ipv6')
blockedRanges.addAddress('::1', 'ipv6')
blockedRanges.addSubnet('fc00::', 7, 'ipv6')
blockedRanges.addSubnet('fe80::', 10, 'ipv6')

async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('Webhook URL must use https')
  const addresses = await lookup(url.hostname, { all: true })
  for (const { address, family } of addresses) {
    if (blockedRanges.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new Error('Webhook URL resolves to a non-public address')
    }
  }
  return url
}

async function sendWebhook(rawUrl: string, event: WebhookEvent) {
  const url = await assertPublicHttpsUrl(rawUrl)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = JSON.stringify(event)
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Timestamp': timestamp,
    },
    body: payload,
  })
  if (!res.ok) throw new Error(`Webhook delivery failed with status ${res.status}`)
}
```

The check resolves the hostname once and `fetch` resolves it again, so a DNS-rebinding target can
still switch addresses in between. Where that matters, connect to the address the check approved
through a custom HTTP agent or dispatcher, or send deliveries through an egress proxy that
enforces the same ranges.

Receiving webhooks (consumer) — first verify the timestamp to prevent replay attacks (5-minute
window), then verify the signature:

```typescript
function verifyWebhook(payload: string, signature: string, timestamp: string) {
  const webhookTime = Number(timestamp) * 1000
  if (!Number.isFinite(webhookTime) || Math.abs(Date.now() - webhookTime) > 5 * 60 * 1000) {
    throw new Error('Stale webhook')
  }
  
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  const expected = Buffer.from(`sha256=${digest}`)
  const received = Buffer.from(signature)
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('Invalid signature')
  }
}
```

The signature covers `timestamp.payload`, so the timestamp header cannot be swapped for a fresh one to replay an old body — the 5-minute window only means something because the timestamp is signed. `payload` must be the raw request body bytes, not re-serialized JSON. The length check comes first because `crypto.timingSafeEqual` throws a `RangeError` on buffers of different lengths.

Retry strategy for webhook delivery:

```text
Attempt 1: immediate
Attempt 2: 5 seconds
Attempt 3: 30 seconds
Attempt 4: 5 minutes
Attempt 5: 30 minutes
Attempt 6+: exponential backoff up to 24h, then dead-letter queue
```

## OPENAPI 3.2 ADVANCED PATTERNS

Discriminated union types (OpenAPI 3.2 with JSON Schema):

```yaml
PaymentMethod:
  oneOf:
    - $ref: '#/components/schemas/CardPayment'
    - $ref: '#/components/schemas/BankTransferPayment'
  discriminator:
    propertyName: type
    mapping:
      card: '#/components/schemas/CardPayment'
      bank: '#/components/schemas/BankTransferPayment'
```

Webhook definitions (OpenAPI 3.2):

```yaml
webhooks:
  orderCreated:
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderCreatedEvent'
      responses:
        '200':
          description: Webhook received
```

Security scheme:

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
```

## API GATEWAY PATTERNS

Rate limiting tiers (API Gateway / Kong / Traefik):

```yaml
tiers:
  free:    { rps: 10,   burst: 20,   monthly: 1_000_000 }
  starter: { rps: 50,   burst: 100,  monthly: 10_000_000 }
  pro:     { rps: 500,  burst: 1000, monthly: unlimited }
```

Circuit breaker for downstream services — `threshold` is the fail rate that opens the circuit,
`timeout` how long to wait before half-open, and `volumeThreshold` the minimum requests before
counting:

```yaml
circuitBreaker:
  threshold: 50%
  timeout: 30s
  volumeThreshold: 20
```

## CACHING STRATEGY

```text
Cache layers (fastest → slowest):
1. CDN edge (Cloudflare/Fastly) — public static content, GET responses
2. Application cache (Redis) — computed results, session data
3. DB query cache — N+1 prevention, expensive aggregations
4. HTTP cache headers — browser + proxy caching

Cache-Control patterns:
GET /users (auth required):      Cache-Control: private, max-age=60
GET /products (public):          Cache-Control: public, max-age=300, s-maxage=600
GET /users/{id}/avatar (stable): Cache-Control: public, max-age=86400, immutable
POST (mutations):                 Cache-Control: no-store

ETag for conditional requests:
response header: ETag: "abc123"
subsequent GET:  If-None-Match: "abc123" → 304 Not Modified (no body sent)
```
