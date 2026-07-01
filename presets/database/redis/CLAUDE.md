# Database Preset — Redis

## Usage

- Good for cache, rate limits, sessions, queues, leaderboards, pub/sub, and other short-lived coordination — not as the source of truth for critical data.
- Define TTL and invalidation strategy up front.
- Key naming: `{namespace}:{entity}:{id}` (e.g. `cache:user:123`) — always namespace to avoid collisions.

## Safety

- Namespace keys.
- Be careful with race conditions; use atomic operations when needed: `INCR`/`DECR` for counters, `SET NX EX` for distributed locks, `EVAL` (Lua) for multi-key atomics. Never read-modify-write a shared counter outside `MULTI/EXEC` or a Lua script.
- Do not store secrets or sensitive personal data unless encrypted and justified — treat Redis as a semi-public cache tier.
- Consider eviction policy and memory limits: configure `maxmemory-policy` (`allkeys-lru` for cache, `noeviction` for queues) and set `maxmemory`.

## Verification

- Test expiry behavior for cache/rate limit logic. Every cache key must carry a TTL (`EX` / `EXPIRE`) — no indefinite keys.
- Ensure fallback behavior when Redis is unavailable: a cache miss or connection failure should fall back to the DB, never crash the request.

## Anti-patterns

- No TTL on cache keys.
- Critical data stored only in Redis accidentally (no persistence).
- Non-atomic quota/counter updates.
- Secrets stored in plaintext.
