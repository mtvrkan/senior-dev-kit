# Project Preset — Node / Express / Fastify / Hono API

## Architecture

- Respect existing layer boundaries: `routes/` → `controllers/` → `services/` → `repositories/`.
- Keep route handlers thin: parse input → validate → call service → return response.
- Business logic belongs in services. Data access in repositories or ORM calls.
- Middleware registered globally (auth, rate-limit, error handler) — never duplicate inline.
- TypeScript: strict mode. Never `any` unless interfacing with untyped third-party code.

## Request validation — at the boundary

Validate all input before it reaches service layer. Zod is the recommended schema library:

```typescript
import { z } from "zod"

const CreateUserSchema = z.object({
  email: z.email(),
  name:  z.string().min(1).max(100),
})
```

Express:

```typescript
app.post("/users", async (req, res, next) => {
  const result = CreateUserSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ errors: z.flattenError(result.error) })
  }
  const user = await userService.create(result.data)
  res.status(201).json(user)
})
```

Fastify (schema-first):

```typescript
fastify.post("/users", {
  schema: {
    body: {
      type: "object",
      required: ["email", "name"],
      properties: {
        email: { type: "string", format: "email" },
        name:  { type: "string", minLength: 1, maxLength: 100 },
      },
    },
  },
}, async (req, reply) => {
  const user = await userService.create(req.body)
  return reply.status(201).send(user)
})
```

The schema above is Zod 4 (`z.email()`, `z.flattenError()`); on Zod 3 the equivalents are
`z.string().email()` and `result.error.flatten()`. Check the installed major before copying.

Never put `role`, `isAdmin` or any privilege field on a create/register schema — a client-settable
role lets anyone sign up as admin. The service assigns the default role; role changes go through a
separate endpoint behind an admin-only authorization check.

**NEVER:** trust `req.body.userId` for authorization — use `req.user.id` from the verified JWT/session middleware.

## Error handling

Global error handler — never return raw errors to clients. In Express it must be the last
middleware registered; unexpected errors are logged, not exposed:

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      type: err.type,
      message: err.message,
    })
  }
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error")
  res.status(500).json({ message: "Internal server error" })
})
```

Domain errors:

```typescript
class AppError extends Error {
  constructor(public statusCode: number, public type: string, message: string) {
    super(message)
  }
}
class NotFoundError   extends AppError { constructor(m: string) { super(404, "not_found", m) } }
class ForbiddenError  extends AppError { constructor(m: string) { super(403, "forbidden", m) } }
class ConflictError   extends AppError { constructor(m: string) { super(409, "conflict", m) } }
```

## Authorization — every protected route

Check ownership — never skip it:

```typescript
async function getPost(req: Request, res: Response) {
  const post = await postRepo.findById(req.params.id)
  if (!post) throw new NotFoundError("Post not found")
  if (post.userId !== req.user.id) throw new ForbiddenError("Access denied")
  return res.json(post)
}
```

## SQL safety

WRONG — SQL injection:

```typescript
const users = await db.query(`SELECT * FROM users WHERE email = '${email}'`)
```

RIGHT — parameterized (pg):

```typescript
const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email])
```

RIGHT — Prisma (always safe):

```typescript
const user = await prisma.user.findUnique({ where: { email } })
```

RIGHT — Drizzle:

```typescript
const user = await db.select().from(users).where(eq(users.email, email))
```

## Structured logging

```typescript
import pino from "pino"
const logger = pino({ level: process.env.LOG_LEVEL ?? "info" })

logger.info({ userId: user.id, action: "login" }, "User logged in")
logger.error({ err, userId: req.user?.id }, "Payment failed")
```

Always include context as an object — never format strings. NEVER log passwords, tokens, the full
`req.body`, or PII.

## Async patterns

WRONG on Express 4 — if `userService.list()` throws, no handler catches it and the unhandled
rejection crashes the process. On Express 5 the same code is fine: the rejection goes to the error
middleware.

```typescript
app.get("/users", async (req, res) => {
  const users = await userService.list()
  res.json(users)
})
```

Express 5 (the current default) forwards a rejected async handler to the error middleware on its
own. Express 4 does NOT — check the installed major before assuming either. On Express 4 only,
import `express-async-errors` once at the entry point; Fastify and Hono handle it natively.

```typescript
import "express-async-errors"
```

RIGHT — parallel independent async calls:

```typescript
const [user, posts] = await Promise.all([
  userRepo.findById(id),
  postRepo.findByUserId(id),
])
```

## Rate limiting — required on auth endpoints

Login and register get a strict limit — 5 attempts per 15-minute window:

```typescript
import rateLimit from "express-rate-limit"

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  message: { error: "Too many attempts, try again later" },
})
app.use("/auth/login", authLimiter)
app.use("/auth/register", authLimiter)
```

## Verification

- TypeScript: `tsc --noEmit` type-checks, `eslint` lints.
- Tests, targeted: `vitest run` or `jest`, whichever the project uses.
- Build: `tsc -p tsconfig.build.json`.

```bash
npx tsc --noEmit
eslint src/ --max-warnings 0
vitest run src/users/user.test.ts
jest src/users/user.spec.ts --no-coverage
tsc -p tsconfig.build.json
```

## Anti-patterns

- Business logic in route handlers — belongs in services.
- `req.body.userId` for auth — use `req.user.id` from middleware.
- Raw DB errors returned to client — always use AppError hierarchy.
- `catch (e) {}` silent swallow — always log and rethrow or respond.
- `any` type — use `unknown` + type guard or Zod parse.
- Serial `await` for independent calls — use `Promise.all()`.
- No rate limiting on `/auth/*` endpoints.
- `console.log` instead of structured logger in production code.
