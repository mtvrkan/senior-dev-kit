# Project Preset — Deno

## Runtime

- Deno is a TypeScript-first runtime with a built-in permission system.
- No `node_modules` — packages from JSR (`jsr:@std/...`) or npm (`npm:package`).
- Config: `deno.json` or `deno.jsonc` at project root (replaces tsconfig + package.json).
- Entry point: `deno run --allow-net --allow-read src/main.ts`

## Permissions — explicit, least privilege

Always specify only required permissions:

```bash
deno run \
  --allow-net=api.example.com \     # only this host
  --allow-read=./data \             # only this directory
  --allow-env=DATABASE_URL,PORT \   # only these vars
  src/main.ts
```

Never use `--allow-all` in production. In `deno.json` tasks, be explicit:

```json
{
  "tasks": {
    "start": "deno run --allow-net=0.0.0.0 --allow-env=PORT,DATABASE_URL src/main.ts",
    "test": "deno test --allow-net --allow-read=./fixtures"
  }
}
```

## Imports

```typescript
// JSR (preferred for Deno standard library)
import { assert } from "jsr:@std/assert"
import { serve } from "jsr:@std/http"

// npm compatibility
import { z } from "npm:zod"
import { Hono } from "npm:hono"

// Import map (deno.json) — avoid bare imports without map
{
  "imports": {
    "zod": "npm:zod@^3",
    "@std/assert": "jsr:@std/assert@^1"
  }
}
```

Never use URL imports for npm packages (`https://esm.sh/...`) — use `npm:` prefix instead.

## HTTP server

```typescript
// Deno built-in (no framework)
Deno.serve({ port: 8000 }, (req) => {
  const url = new URL(req.url)
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  }
  return new Response("Not Found", { status: 404 })
})

// Hono on Deno (recommended for REST APIs)
import { Hono } from "npm:hono"
import { zValidator } from "npm:@hono/zod-validator"
import { z } from "npm:zod"

const app = new Hono()
app.post("/users", zValidator("json", z.object({ email: z.string().email() })), (c) => {
  const body = c.req.valid("json")
  return c.json({ id: crypto.randomUUID(), ...body }, 201)
})

Deno.serve(app.fetch)
```

## Testing

```bash
deno test                              # run all tests
deno test src/auth_test.ts            # single file
deno test --watch                     # watch mode
deno test --allow-net --coverage=cov/ # with coverage
deno coverage cov/                    # generate coverage report
```

```typescript
import { describe, it } from "jsr:@std/testing/bdd"
import { assertEquals, assertThrows } from "jsr:@std/assert"

describe("UserService", () => {
  it("creates user with hashed password", async () => {
    const result = await createUser({ email: "test@example.com" })
    assertEquals(result.email, "test@example.com")
  })
})
```

Test file naming: `*_test.ts` or `*.test.ts` (both work).

## Standard library (JSR)

```typescript
import { join, dirname } from "jsr:@std/path"
import { exists, readTextFile, writeTextFile } from "jsr:@std/fs"
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64"
import { delay } from "jsr:@std/async"
import { assertSnapshot } from "jsr:@std/testing/snapshot"
```

## Security

- Permission system: request only what's needed — always.
- Web Crypto API: `crypto.subtle` for encryption/hashing (built-in, no dependency).
- Password hashing: no built-in — use `npm:argon2` or store hashed via external service.
- No `eval()`, no `new Function()` — Deno runs in secure context by default.
- Input validation: Zod (`npm:zod`) for all external input.
- SQL: use parameterized queries only — `deno-postgres`, `deno-sqlite`, or `drizzle-orm`.

```typescript
// Deno KV (built-in key-value store, no extra dep)
const kv = await Deno.openKv()
await kv.set(["users", userId], { name, email })
const entry = await kv.get(["users", userId])
```

## Tooling commands

```bash
deno lint              # linting (built-in)
deno fmt               # formatting (built-in, no prettier needed)
deno check src/main.ts # type-check (no tsc needed)
deno compile           # compile to single executable
deno task start        # run task from deno.json
```

## deno.json structure

```json
{
  "tasks": {
    "start": "deno run --allow-net --allow-env src/main.ts",
    "dev": "deno run --allow-net --allow-env --watch src/main.ts",
    "test": "deno test --allow-read=./fixtures",
    "lint": "deno lint",
    "fmt": "deno fmt --check",
    "check": "deno check src/main.ts"
  },
  "imports": {
    "zod": "npm:zod@^3",
    "hono": "npm:hono@^4",
    "@std/assert": "jsr:@std/assert@^1",
    "@std/testing": "jsr:@std/testing@^1"
  },
  "lint": {
    "rules": { "tags": ["recommended"] }
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 100,
    "singleQuote": false
  }
}
```

## Anti-patterns

- `--allow-all` in production scripts — always specify individual permissions.
- URL imports from `esm.sh` or `deno.land/x` — use `npm:` or `jsr:` instead.
- `node:fs` calls when `jsr:@std/fs` is available.
- Skipping `deno fmt` — it's opinionated but eliminates style debates.
- `tsconfig.json` in Deno projects — Deno uses its own TS config in `deno.json`.
- Bare specifiers without import map — always define in `deno.json` imports.
