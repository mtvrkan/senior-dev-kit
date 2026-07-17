# Project Preset — Bun

## Runtime

- Bun is a drop-in Node.js alternative. APIs are mostly compatible; use Bun-native APIs when available.
- Entry point: `bun run src/index.ts` or script defined in `package.json`.
- Hot reload: `bun --hot src/index.ts` (stateful hot reload, not full restart).
- TypeScript runs natively — no separate compilation step needed in development.

## Package management

- Always use `bun install`, `bun add`, `bun remove` — never `npm` or `yarn` in a Bun project.
- Lock file: `bun.lock` (text JSONC, the default since Bun 1.2) — always commit it. Legacy projects may still carry the older binary `bun.lockb`; Bun reads either, and `bun install` on 1.2+ migrates to the text form. Detect a Bun project by `bun.lock` OR `bun.lockb`.
- Workspaces: defined in `package.json` `workspaces` field; use `bun --filter` for scoped commands.

## Testing

- `bun test` — built-in test runner, Jest-compatible API (`describe`, `it`, `expect`).
- Single file: `bun test src/auth.test.ts`
- Watch mode: `bun test --watch`
- Coverage: `bun test --coverage`
- Mocking: `mock()` from `bun:test` — not `jest.fn()`.

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test"

describe("UserService", () => {
  it("creates user with hashed password", async () => {
    // Arrange, Act, Assert
  })
})
```

## Web framework (Elysia — if used)

Elysia is the idiomatic Bun web framework. Key patterns:

```typescript
import { Elysia, t } from "elysia"

const app = new Elysia()
  .get("/health", () => ({ ok: true }))
  .post("/users", ({ body }) => createUser(body), {
    body: t.Object({
      email: t.String({ format: "email" }),
      name: t.String({ minLength: 1 }),
    }),
  })
  .listen(3000)
```

- Use `t.Object()` schema for all request bodies — Elysia validates at runtime.
- `t.String({ format: "email" })` etc. for fine-grained validation.
- Route groups: `.group("/api/v1", app => app.get(...).post(...))`.
- Error handling: `.onError(({ code, error }) => ...)` at app or group level.

## Hono (alternative framework — if used)

```typescript
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const app = new Hono()
app.post("/users", zValidator("json", z.object({ email: z.string().email() })), (c) => {
  const body = c.req.valid("json")
  return c.json({ id: "123", ...body }, 201)
})

export default app  // Bun.serve picks this up automatically
```

## Built-in APIs to prefer

```typescript
// File I/O (Bun-native, faster than Node fs)
const file = Bun.file("./data.json")
const data = await file.json()
await Bun.write("./output.json", JSON.stringify(result))

// SQLite (built-in, no dependency)
import { Database } from "bun:sqlite"
const db = new Database("mydb.sqlite")
const stmt = db.prepare("SELECT * FROM users WHERE id = ?")
const user = stmt.get(userId)  // parameterized — never interpolate

// Hashing / crypto
const hash = await Bun.password.hash(password)  // Argon2id by default
const valid = await Bun.password.verify(password, hash)

// Fetch (global, same as browser)
const res = await fetch("https://api.example.com/data")
const json = await res.json()
```

## Security

- SQLite: always use parameterized statements (`prepare` + `?`) — never string interpolation.
- Secrets: never hardcode. Use `process.env.KEY` and keep `.env` in `.gitignore`.
- `Bun.password.hash()` uses Argon2id by default — prefer it over bcrypt.
- Input validation: Elysia's `t.Object()` schema or Zod for all user-controlled input.

## Performance

- Avoid `require()` — use `import` (ESM-native).
- Bun's `Bun.serve()` is faster than Elysia/Hono for raw HTTP — use frameworks only when needed.
- `bun:sqlite` is faster than `better-sqlite3` and has no native build step.
- Heavy CPU work: use `new Worker()` to avoid blocking the event loop.

## Anti-patterns

- Mixing `npm`/`yarn` commands in a Bun project.
- Using `jest.fn()` — use `mock()` from `bun:test`.
- Using `node:fs` for file I/O when `Bun.file()` is simpler.
- `bcrypt` — use `Bun.password` (Argon2id, built-in, faster).
- Ignoring the Bun lockfile (`bun.lock`, or legacy `bun.lockb`) in `.gitignore` — always commit it.
