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

```typescript
// Server (Next.js / NestJS)
export const userRouter = router({
  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({ where: { id: input } })
    }),
  
  create: protectedProcedure
    .input(CreateUserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input })
    }),
})

// Client — fully typed, no codegen
const user = await trpc.user.getById.query(userId)
//     ↑ TypeScript knows the return type from server definition
```

### GraphQL — when it makes sense

```graphql
# Only justified when:
# 1. Multiple different clients need different field subsets (mobile vs web vs partner)
# 2. Deep nested data with complex filtering
# 3. Client-driven requirements (not server-prescribed)

type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: Pagination): UserConnection!
}

type User {
  id: ID!
  email: String!
  orders(status: OrderStatus): [Order!]!  # ← nested, client specifies depth
}
```

N+1 prevention in GraphQL is mandatory: use DataLoader for every relation field.

```typescript
// DataLoader batches individual lookups
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

```http
# Filtering (query params for GET)
GET /users?role=admin&status=active&createdAfter=2024-01-01

# Sorting (prefix - for desc)
GET /users?sort=-createdAt,email

# Field selection (JSONAPI-inspired)
GET /users?fields=id,email,role

# Sparse fieldsets for performance — return only what client needs
```

### Long-running operations

```text
Sync (< 2s): return result directly
Async (2s-30s): accept + 202, poll endpoint
Long async (> 30s): accept + 202, webhook on completion
```

```http
# Async pattern
POST /reports/generate
→ 202 Accepted
  Location: /reports/jobs/abc123
  
GET /reports/jobs/abc123
→ 200 { status: 'processing', progress: 45 }
→ 200 { status: 'complete', result: '/reports/abc123' }

# Or webhook:
POST /reports/generate { webhookUrl: 'https://myapp.com/hooks/report' }
→ 202 Accepted { jobId: 'abc123' }
// When complete: POST to webhookUrl with result
```

### Batch operations

```http
# Bulk create
POST /users/batch
{ "users": [...] }
→ 207 Multi-Status
  { "results": [{ "status": 201, "id": "..." }, { "status": 400, "error": "..." }] }

# Bulk update (PATCH)
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

```typescript
// Cursor pagination (Prisma)
const users = await db.user.findMany({
  take: pageSize + 1,  // +1 to check if more pages exist
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
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

```typescript
// Middleware for idempotent POST/PATCH
async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key']
  if (!key) return next()
  
  const cached = await redis.get(`idempotency:${key}`)
  if (cached) {
    const { status, body } = JSON.parse(cached)
    return res.status(status).json(body)
  }
  
  // Wrap response to capture it
  const originalSend = res.json.bind(res)
  res.json = (body) => {
    if (res.statusCode < 500) {
      // Cache for 24 hours
      redis.setex(`idempotency:${key}`, 86400, JSON.stringify({ status: res.statusCode, body }))
    }
    return originalSend(body)
  }
  
  next()
}
```

## WEBHOOK DESIGN

```typescript
// Sending webhooks (producer)
async function sendWebhook(url: string, event: WebhookEvent) {
  const timestamp = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify({ ...event, timestamp })
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Timestamp': timestamp.toString(),
    },
    body: payload,
  })
}

// Receiving webhooks (consumer)
function verifyWebhook(payload: string, signature: string, timestamp: string) {
  // 1. Verify timestamp to prevent replay attacks (5 minute window)
  const webhookTime = parseInt(timestamp) * 1000
  if (Math.abs(Date.now() - webhookTime) > 5 * 60 * 1000) throw new Error('Stale webhook')
  
  // 2. Verify signature
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`sha256=${expected}`))) {
    throw new Error('Invalid signature')
  }
}
```

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

```yaml
# Discriminated union types (OpenAPI 3.2 with JSON Schema)
PaymentMethod:
  oneOf:
    - $ref: '#/components/schemas/CardPayment'
    - $ref: '#/components/schemas/BankTransferPayment'
  discriminator:
    propertyName: type
    mapping:
      card: '#/components/schemas/CardPayment'
      bank: '#/components/schemas/BankTransferPayment'

# Webhook definitions (OpenAPI 3.2)
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

# Security scheme
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

```yaml
# Rate limiting tiers (API Gateway / Kong / Traefik)
tiers:
  free:    { rps: 10,   burst: 20,   monthly: 1_000_000 }
  starter: { rps: 50,   burst: 100,  monthly: 10_000_000 }
  pro:     { rps: 500,  burst: 1000, monthly: unlimited }
  
# Circuit breaker for downstream services
circuitBreaker:
  threshold: 50%      # fail rate to open circuit
  timeout: 30s        # how long to wait before half-open
  volumeThreshold: 20 # minimum requests before counting
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
