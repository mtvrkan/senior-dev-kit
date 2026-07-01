## BullMQ

- Queue names: `{domain}:{action}` (e.g. `user:send-welcome-email`)
- Always set `attempts` + `backoff` on defaultJobOptions
- `removeOnComplete: {count: N}` — prevent Redis growth
- Idempotent jobs: use deterministic `jobId` to deduplicate
- Never put large payloads in job data — store in DB, put ID in job
- Workers separate from web server process in production
- Wire `completed`/`failed`/`error` events for observability
- Graceful shutdown: `await worker.close()` on SIGTERM
- BullBoard for dev monitoring (auth-gated)
