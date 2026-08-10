---
description: "Logging, metrics, tracing — every service and handler change"
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,py,go,java,kt,kts,cs,rb,php,dart,swift,rs,c,cc,cpp,cxx,h,hpp}"
---

> Related: [`900-performance.md`](900-performance.md) co-loads on the same glob — intentional, not a conflict: 700 governs what to log, 900 governs latency/bundle budgets; apply both in full. Keep tool/version recommendations in sync across both.
>
> **Scope decision (round-9 audit, accepted — do not re-flag as an oversight):** the bare-extension glob is deliberate — observability hygiene applies to any code file, and directory-scoping (`**/api/**`, `**/services/**`, …) would silently skip files outside conventional folders (repo-root sources, Go `cmd`/`internal`, .NET layouts). Alternatives evaluated and rejected: git history, round 9.

## LOGGING RULES — zero console.log in production

| Level | When to use |
| --- | --- |
| `ERROR` | Unexpected crash, unhandled exception, data loss |
| `WARN` | Degraded state, retry, fallback activated, rate limit hit |
| `INFO` | Key state transition: user created, order placed, job completed |
| `DEBUG` | Never in prod without feature flag |

**Structured JSON always:**

```typescript
// WRONG:
console.log("user created:", user)
console.error("Error:", err)

// RIGHT:
logger.info({ userId: user.id, action: "user.created", email: user.email })
logger.error({ err: err.message, stack: err.stack, action: "order.place.failed", orderId })
```

**Correlation ID on every line:**

```typescript
// Express middleware:
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] ?? crypto.randomUUID()
  res.setHeader('x-correlation-id', req.correlationId)
  next()
})
// Every log call includes: { correlationId: req.correlationId }
```

**Never log:**

- Passwords · tokens · API keys · session IDs · full credit card numbers
- PII (email, phone, SSN, DOB) — log `userId` or an opaque ID instead
- Full request body when it contains sensitive fields → redact first
- `Authorization` header · `Cookie` header

## METRICS — required on every service/handler

When adding or changing a service or background job, add these:

| Metric | Type | Labels |
| --- | --- | --- |
| Request count | Counter | method, path, status |
| Request duration | Histogram | method, path |
| Error count | Counter | method, path, error_type |
| Active jobs | Gauge | queue, worker |
| Queue depth | Gauge | queue |
| External call duration | Histogram | service, endpoint |

```typescript
// Node.js (prom-client)
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
})

// Python (prometheus_client)
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration',
  ['method', 'path', 'status'])

// Go
requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
  Name: "http_request_duration_seconds",
  Buckets: prometheus.DefBuckets,
}, []string{"method", "path", "status"})
```

**OBS flag — auto-trigger:**
If a service/handler has no metrics instrumentation: `OBS: [service] no metrics — add request count + latency`

## HEALTH ENDPOINTS — required for every HTTP service

```typescript
// Minimum: liveness + readiness
GET /health          → 200 { status: "ok" }                    (liveness — is process alive?)
GET /health/ready    → 200 { status: "ready", db: "ok" }       (readiness — can handle traffic?)
GET /health/ready    → 503 { status: "degraded", db: "error" } (dependency down)

// Readiness checks: DB ping, cache ping, critical external dep
```

## DISTRIBUTED TRACING

When adding cross-service calls or async jobs:

- Propagate `traceparent` header (W3C Trace Context) on every HTTP call
- Pass `correlationId` in queue message payload (not just headers)
- Log span start + end with duration for any call >50ms

```typescript
// Outgoing HTTP — pass trace headers
const response = await fetch(url, {
  headers: {
    'traceparent': req.headers['traceparent'],
    'x-correlation-id': req.correlationId,
  }
})
```

## ERROR TRACKING

Every unhandled exception must reach an error tracker (Sentry, Datadog, etc.):

- Include: user context (userId, not email) · request context (method, path, correlationId)
- Group by: error type + first stack frame (not random stack depth)
- Never: catch-and-swallow without logging (`catch (e) {}`)

```typescript
// WRONG — silent swallow:
try { await riskyOperation() } catch (e) {}

// RIGHT — log + re-throw or handle:
try { await riskyOperation() } catch (e) {
  logger.error({ err: e.message, action: 'riskyOperation.failed', userId })
  throw e  // or: return fallback value with WARN
}
```

## ALERT THRESHOLDS (document in code comments when setting)

| Signal | Threshold | Urgency |
| --- | --- | --- |
| Error rate | >1% of requests | Page |
| P99 latency | >2× baseline | Page |
| P95 latency | >1.5× baseline | Warn |
| Queue depth | >1000 messages stale >5min | Page |
| Disk usage | >80% | Warn |
| Memory | >90% for >5min | Page |
