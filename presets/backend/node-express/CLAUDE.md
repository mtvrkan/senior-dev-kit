# Project Preset — Node / Express / Fastify / Hono API

## Architecture

- Respect existing layer boundaries: `routes/` → `controllers/` → `services/` → `repositories/`.
- Keep route handlers thin: parse input → validate → call service → return response.
- Business logic belongs in services. Data access in repositories or ORM calls.
- Middleware registered globally (auth, rate-limit, error handler) — never duplicate inline.
- TypeScript: strict mode. Never `any` unless interfacing with untyped third-party code.

## Request validation — at the boundary

Validate all input before it reaches service layer:

```typescript
// Zod (recommended)
import { z } from "zod"

const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().min(1).max(100),
  role:  z.enum(["user", "admin"]).default("user"),
})

// Express
app.post("/users", async (req, res, next) => {
  const result = CreateUserSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ errors: result.error.flatten() })
  }
  const user = await userService.create(result.data)
  res.status(201).json(user)
})

// Fastify (schema-first)
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

**NEVER:** trust `req.body.userId` for authorization — use `req.user.id` from the verified JWT/session middleware.

## Error handling

Global error handler — never return raw errors to clients:

```typescript
// Express global error handler (must be last middleware)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      type: err.type,
      message: err.message,
    })
  }
  // Unexpected errors — log, don't expose
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error")
  res.status(500).json({ message: "Internal server error" })
})

// Domain errors
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

```typescript
// Check ownership — never skip
async function getPost(req: Request, res: Response) {
  const post = await postRepo.findById(req.params.id)
  if (!post) throw new NotFoundError("Post not found")
  if (post.userId !== req.user.id) throw new ForbiddenError("Access denied")
  return res.json(post)
}
```

## SQL safety

```typescript
// WRONG — SQL injection
const users = await db.query(`SELECT * FROM users WHERE email = '${email}'`)

// RIGHT — parameterized (pg)
const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email])

// RIGHT — Prisma (always safe)
const user = await prisma.user.findUnique({ where: { email } })

// RIGHT — Drizzle
const user = await db.select().from(users).where(eq(users.email, email))
```

## Structured logging

```typescript
import pino from "pino"
const logger = pino({ level: process.env.LOG_LEVEL ?? "info" })

// Always include context — never format strings
logger.info({ userId: user.id, action: "login" }, "User logged in")
logger.error({ err, userId: req.user?.id }, "Payment failed")

// NEVER log: passwords, tokens, full req.body, PII
```

## Async patterns

```typescript
// WRONG — unhandled rejection crashes the process
app.get("/users", async (req, res) => {
  const users = await userService.list()  // if this throws, no handler catches it
  res.json(users)
})

// Express 5 (the current default) forwards a rejected async handler to the error middleware
// on its own. Express 4 does NOT — check the installed major before assuming either.
import "express-async-errors"  // Express 4 only: once at entry point. Fastify/Hono handle it natively.

// RIGHT — parallel independent async calls
const [user, posts] = await Promise.all([
  userRepo.findById(id),
  postRepo.findByUserId(id),
])
```

## Rate limiting — required on auth endpoints

```typescript
import rateLimit from "express-rate-limit"

// Login/register: strict
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 5,
  standardHeaders: true,
  message: { error: "Too many attempts, try again later" },
})
app.use("/auth/login", authLimiter)
app.use("/auth/register", authLimiter)
```

## Verification

```bash
# TypeScript
npx tsc --noEmit                  # type check
eslint src/ --max-warnings 0      # lint

# Tests (targeted)
vitest run src/users/user.test.ts  # vitest
jest src/users/user.spec.ts --no-coverage  # jest

# Build
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
