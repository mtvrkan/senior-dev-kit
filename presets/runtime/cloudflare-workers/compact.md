## Cloudflare Workers

- Entry: `src/index.ts` — exports `default { fetch(req, env, ctx) }` — NO Node.js built-ins
- Bindings via `env.MY_KV / MY_BUCKET / MY_DB / MY_QUEUE` (never process.env)
- Storage: KV=cache/sessions | R2=files | D1=relational | Queues=background | DO=coordination
- Secrets: `wrangler secret put NAME` — NEVER in wrangler.toml or source
- TEST: vitest run [f] | DEV: wrangler dev | DEPLOY: wrangler deploy | TYPE: tsc --noEmit
- Bundle <1MB gzip | cold start <10ms | ctx.waitUntil() for fire-and-forget
- Protected: wrangler.toml → devops-guard | src/middleware/auth.ts → security-guard
