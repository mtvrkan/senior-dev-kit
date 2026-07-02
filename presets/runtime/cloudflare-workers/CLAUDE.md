# Cloudflare Workers — Claude Rules

## Stack context

- Runtime: Cloudflare Workers (V8 isolate — NOT Node.js)
- Language: TypeScript (always — never plain JS in new projects)
- Framework: Hono (preferred) or plain Request/Response
- Storage: KV (key-value), R2 (object), D1 (SQLite), Queues, Durable Objects
- Package manager: npm / wrangler CLI

## Architecture

- Entry point: `src/index.ts` — exports `default { fetch }` handler
- Route handling: Hono router in `src/routes/` | handlers in `src/handlers/`
- Bindings accessed via `c.env` (Hono) or `env` param — never globals
- No Node.js built-ins: no `fs`, `path`, `crypto` (use `globalThis.crypto`)
- Response: always `new Response(...)` — never `res.send()` or `res.json()`

## Commands

- DEV_CMD: wrangler dev
- DEPLOY_CMD: wrangler deploy
- TEST_CMD: vitest run [file]
- TYPE_CMD: tsc --noEmit
- PKG_MANAGER: npm (wrangler.toml detected)

## Binding patterns

```typescript
// wrangler.toml defines bindings — access via env param
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // KV
    const value = await env.MY_KV.get('key')
    // R2
    const obj = await env.MY_BUCKET.get('file.txt')
    // D1
    const result = await env.MY_DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
    // Queue
    await env.MY_QUEUE.send({ type: 'event', payload })
  }
}

// TypeScript env type (always define)
interface Env {
  MY_KV: KVNamespace
  MY_BUCKET: R2Bucket
  MY_DB: D1Database
  MY_QUEUE: Queue
  MY_SECRET: string   // wrangler secret put MY_SECRET
}
```

## Storage selection guide

| Need | Storage |
| --- | --- |
| Session / cache / feature flags (small values) | KV |
| Files / blobs / images | R2 |
| Relational data, queries | D1 (SQLite) |
| Background jobs / fan-out | Queues |
| Coordination / WebSocket state | Durable Objects |

## Security rules

- **Secrets:** always `wrangler secret put SECRET_NAME` — NEVER in `wrangler.toml` or source
- **CORS:** explicit `Access-Control-Allow-Origin` header — never wildcard for credentialed requests
- **Input validation:** validate all request body/params at handler boundary (use Zod)
- **Rate limiting:** use Cloudflare rate limiting rules OR KV-backed counter per IP
- No `eval()`, no `new Function()` — blocked by V8 isolate policy

## Performance rules

- Cold start budget: < 10ms (Workers are serverless — minimize imports)
- Bundle size: keep < 1 MB (gzip) — tree-shake aggressively
- KV read: ~5ms | R2 read: ~15ms | D1 query: ~5-20ms — design for these
- Use `ctx.waitUntil()` for fire-and-forget work (logging, analytics) — never `await` non-critical paths
- Cache responses with `Cache-Control` headers + `cf.cacheTtl`

## Anti-patterns (never generate)

- `process.env.X` — use `env.X` via binding
- `require('fs')` or any Node.js built-in — Workers runtime only
- `setTimeout` for delays — use Queues or Durable Objects
- Blocking I/O in the main isolate — always `await` async calls
- `console.log` in production — use structured logging via `wrangler tail` compatible format
- Long-running synchronous loops — isolate has CPU time limit (50ms default)

## wrangler.toml template

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2026-05-01"

[[kv_namespaces]]
binding = "MY_KV"
id = "abc123"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"

[[d1_databases]]
binding = "MY_DB"
database_name = "my-db"
database_id = "xyz789"

[observability]
enabled = true
```

## Protected files (escalate before touching)

- `wrangler.toml` → devops-guard (bindings = production infrastructure)
- `src/middleware/auth.ts` → security-guard
- Any file touching `env.STRIPE_*` or `env.*_SECRET` → security-guard
