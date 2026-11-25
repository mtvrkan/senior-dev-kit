# Security Protocols — Lazy Reference

## THREAT MODELING — before new features

Framework: STRIDE per component

| Threat | Question | Example |
| --- | --- | --- |
| **S**poofing | Can attacker fake identity? | JWT with `alg:none`, session fixation |
| **T**ampering | Can attacker modify data in transit? | No HTTPS, no HMAC on webhooks |
| **R**epudiation | Can attacker deny actions? | No audit log for sensitive operations |
| **I**nformation Disclosure | What data leaks? | Stack traces in API, verbose error messages |
| **D**enial of Service | Can attacker exhaust resources? | No rate limiting, no input size limits |
| **E**levation of Privilege | Can attacker gain higher access? | IDOR, missing role checks |

Run STRIDE for: new API endpoints · auth changes · file upload features · payment flows · admin panels.

## OWASP TOP 10 2025 — concrete mitigations

Category names/ranks/triggers are in `rules/000-security.md` (always loaded) — this is the mitigation detail that doesn't fit there:

The category name is repeated in each row on purpose: the 2025 edition reordered the list, and
a bare `A0n` here silently meant something else than the same `A0n` in `000-security.md` until
the 2026-08 audit caught it (A02/A04/A05/A06 were still carrying their OWASP 2021 meanings, and
Injection had no mitigation row at all).

| # | Category | Key mitigations |
| --- | --- | --- |
| A01 | Broken Access Control | RBAC + ABAC at service layer, not UI only. Check `userId === resource.userId` on every read/write. |
| A02 | Security Misconfiguration | Security headers (CSP, HSTS, X-Frame-Options). Disable debug in prod. No default credentials. Least-privilege cloud IAM. |
| A03 | Software Supply Chain Failures | SHA-pin GitHub Actions (see `rules/600-devops.md`). `npm audit` / `pip-audit` in CI. SBOM on release. Lockfile integrity. Dependabot auto-PRs. |
| A04 | Cryptographic Failures | TLS everywhere. Argon2id for passwords. AES-256-GCM for data at rest. Never MD5/SHA1 for security. |
| A05 | Injection | Parameterized queries only — never string interpolation. Allowlist-validate before any shell call. Sanitize with DOMPurify before `dangerouslySetInnerHTML`. See the SQL and XSS sections below. |
| A06 | Insecure Design | Threat model new features (STRIDE, above). Fail secure by default. Rate-limit and business-rule-validate every new flow. Defense in depth. |
| A07 | Authentication Failures | MFA for admin. Account lockout after N failures. Secure session invalidation. Short access-token expiry. |
| A08 | Software or Data Integrity Failures | HMAC for webhooks. Signed releases. Don't deserialize untrusted data. |
| A09 | Security Logging and Alerting Failures | Log auth events, privilege changes, failed access. Redact PII in logs. Alert on anomalies, not just record them. |
| A10 | Mishandling of Exceptional Conditions | Handle all error states explicitly. Never silently swallow exceptions. Fail closed, not open. |

## AUTHENTICATION PATTERNS

### JWT (stateless)

The access token carries a minimal payload (no PII) and a short expiry. The refresh token is
long-lived, stored in an httpOnly cookie, and carries a `tokenFamily` so a replayed, already-rotated
token can be detected.

GOOD — JWT implementation:

```typescript
const token = jwt.sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '15m' }
)

const refreshToken = jwt.sign(
  { sub: user.id, tokenFamily: uuid() },
  process.env.JWT_REFRESH_SECRET,
  { algorithm: 'HS256', expiresIn: '7d' }
)
```

**Never**:

- `alg: none` (allows unsigned tokens)
- PII in payload (JWTs are base64, not encrypted)
- Long expiry (>1h) for access tokens
- JWT secret < 32 bytes

### Session (stateful)

Express-session with security options: `SESSION_SECRET` is at least 32 random bytes, `httpOnly`
prevents cookie theft via XSS, `secure` sends the cookie over HTTPS only, `maxAge` is 1 hour, and
the store is Redis — never `MemoryStore` in production.

```typescript
session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000
  },
  store: new RedisStore({ client })
})
```

`Lax` is the session default: `Strict` also drops the cookie on inbound top-level navigation, so a user following a link from email or another site lands logged out. Reserve `Strict` for a separate cookie that gates high-value flows (payments, account deletion, credential changes).

### Password hashing

Argon2id (preferred):

```typescript
import { hash, verify } from '@node-rs/argon2'
const hashed = await hash(password, { memoryCost: 65536, timeCost: 3 })
```

bcrypt (acceptable if Argon2 is not available) — minimum cost 10, prefer 12:

```typescript
const hashed = await bcrypt.hash(password, 12)
```

**Never**: MD5, SHA1, SHA256 for passwords (fast hash = easily brute-forced).

## CSRF PROTECTION

```typescript
cookie: { sameSite: 'lax' }
```

Double submit cookie (for SPAs with cross-origin requests):

```typescript
function issueCsrfToken(sessionId: string): string {
  const nonce = crypto.randomBytes(32).toString('hex')
  const message = `${sessionId.length}!${sessionId}!${nonce.length}!${nonce}`
  const mac = crypto.createHmac('sha256', CSRF_SECRET).update(message).digest('hex')
  return `${mac}.${nonce}`
}

function isValidCsrfToken(sessionId: string, cookieToken: string, headerToken: string): boolean {
  if (!cookieToken || cookieToken !== headerToken) return false
  const [mac, nonce] = headerToken.split('.')
  if (!mac || !nonce) return false
  const message = `${sessionId.length}!${sessionId}!${nonce.length}!${nonce}`
  const expected = Buffer.from(crypto.createHmac('sha256', CSRF_SECRET).update(message).digest('hex'))
  const received = Buffer.from(mac)
  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}
```

Check the request's origin as extra protection — the `Origin` header, falling back to `Referer`
when a browser omits it. A request carrying neither, or a value that does not parse, is rejected
rather than allowed through or left to throw:

```typescript
function requestOrigin(req: Request): string | null {
  const source = req.headers.origin ?? req.headers.referer
  if (!source) return null
  try {
    return new URL(source).origin
  } catch {
    return null
  }
}

const origin = requestOrigin(req)
if (!origin || !allowedOrigins.includes(origin)) throw new ForbiddenError()
```

`SameSite=Lax` blocks cross-site POSTs but not same-site subdomains or unsafe GETs, so pair it with a token. Use the signed double-submit pattern above (OWASP's recommendation): the token is an HMAC bound to the session ID, set in a JS-readable cookie and echoed in an `X-CSRF-Token` header. A plain random double-submit value is weaker — anyone who can plant a cookie (a sibling subdomain, a MITM on HTTP) can plant a matching pair.

## RATE LIMITING STRATEGY

Different limits for different sensitivity levels:

- `login` — strict: brute-force protection
- `register` — prevents account farming
- `passwordReset` — strict: prevents enumeration
- `otpVerify` — strict: prevents OTP brute force
- `api` — per-user rate limiting
- `publicApi` — unauthenticated endpoints

```typescript
const limits = {
  login:          { window: '15m', max: 5 },
  register:       { window: '1h',  max: 10 },
  passwordReset:  { window: '1h',  max: 3 },
  otpVerify:      { window: '10m', max: 5 },
  api:            { window: '1m',  max: 100 },
  publicApi:      { window: '1m',  max: 20 },
}
```

Always include the three `X-RateLimit-*` headers; on a 429, also send `Retry-After`:

```typescript
res.set('X-RateLimit-Limit', limit.max)
res.set('X-RateLimit-Remaining', remaining)
res.set('X-RateLimit-Reset', resetTime)
res.set('Retry-After', secondsUntilReset)
```

## INPUT VALIDATION LAYERS

```text
Layer 1: Type coercion (parse, don't validate)
  → Zod schema / Pydantic model: transform input to typed object

Layer 2: Business rules validation
  → "email not already in use" → hits DB

Layer 3: Authorization check
  → "user has permission to do this action"

Never combine layers. Never skip Layer 1 (type coercion first, always).
```

Zod validation at the API boundary — past the `success` check, `body.data` is typed and validated,
safe to use:

```typescript
const CreateUserSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(12).max(128),
})

const body = CreateUserSchema.safeParse(req.body)
if (!body.success) return res.status(400).json(formatZodError(body.error))
```

`role` is deliberately absent: on self-registration the server assigns it (`role: 'user'`), and changing it belongs to a separate admin-only endpoint with its own authorization check. Even an enum-restricted `role` in a client DTO lets anyone sign up as `admin`.

## SQL INJECTION PREVENTION

WRONG — string interpolation (attacker input: `userId = "' OR '1'='1"`):

```typescript
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`)
```

RIGHT — parameterized (ORM):

```typescript
const user = await db.user.findUnique({ where: { id: userId } })
```

RIGHT — parameterized (raw SQL):

```typescript
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId])
```

RIGHT — tagged template (sql-template-tag):

```typescript
const user = await db.query(sql`SELECT * FROM users WHERE id = ${userId}`)
```

## XSS PREVENTION

React / Vue / Angular are safe by default: they auto-escape output.

INSECURE — explicit HTML injection, XSS if `userContent` is unchecked:

```typescript
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

If you must render HTML from an untrusted source, sanitize it first:

```typescript
import DOMPurify from 'isomorphic-dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

Content Security Policy as defense in depth — never `Content-Security-Policy: *`; always specific
domains plus `'nonce-{nonce}'` for inline scripts:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{nonce}'
```

## SECURITY HEADERS CHECKLIST

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: (specific policy — not *)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY  (or SAMEORIGIN if needed)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Helmet.js (Node) — `helmet()` alone does not produce the list above: its defaults are HSTS
without `preload`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN`, and no
`Permissions-Policy` header at all. Pass the options you want and set `Permissions-Policy` yourself:

```typescript
import helmet from 'helmet'
app.use(helmet({
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xFrameOptions: { action: 'deny' },
}))
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})
```

Custom CSP — `'unsafe-inline'` is acceptable for CSS (`styleSrc`) only. The nonce must be new on
every response: a value computed once at module scope is the same for every visitor, so an
injected script can simply reuse it. Generate it per request and hand Helmet a function, which it
calls with the request and response:

```typescript
import crypto from 'node:crypto'

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(32).toString('hex')
  next()
})
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  }
}))
```

Render the same `res.locals.cspNonce` into each inline `<script nonce="...">` tag.

## FILE UPLOAD SECURITY

Never trust the client-provided filename or MIME type; always validate on the server side. The
size cap below is 5 MB.

1. Check the actual MIME type (magic bytes) — not the `Content-Type` header.
2. Generate a new filename — never use the original.
3. Store outside the web root or in blob storage (S3, GCS). Never serve user uploads from the same
   domain as the app; use a CDN subdomain (`uploads.example.com` ≠ `app.example.com`) — prevents
   cookie theft.
4. Virus scan documents (not just images) with ClamAV or a cloud scanner.

```typescript
import { fileTypeFromBuffer } from 'file-type'

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxSize = 5 * 1024 * 1024

if (buffer.length > maxSize) throw new ValidationError('File too large')
const type = await fileTypeFromBuffer(buffer)
if (!type || !allowedMimeTypes.includes(type.mime)) throw new ValidationError('Invalid file type')

const safeFilename = `${crypto.randomUUID()}.${type.ext}`
```

## SUPPLY CHAIN SECURITY (OWASP A03 2025)

GitHub Actions SHA-pinning and SBOM generation commands are in `rules/600-devops.md` — canonical home (auto-loads for CI/Docker/IaC files), not repeated here.

Lockfile integrity: commit lockfiles and verify them in CI. `npm ci` uses the lockfile exactly and
fails if `package.json` changed without a lockfile update.

```bash
npm ci
pip install --require-hashes -r requirements.txt
```

Dependabot opens auto-PRs for security updates: in `.github/dependabot.yml`, enable it for npm,
pip, docker and github-actions separately.

## SECRETS MANAGEMENT

WRONG — a key in code commits to git history forever:

```bash
API_KEY = "sk-abc123..."
```

Always use environment variables plus a secret manager:

- `process.env.API_KEY` — runtime injection
- AWS Secrets Manager — production
- HashiCorp Vault — self-hosted
- GitHub Secrets — CI/CD
- Doppler / Infisical — developer experience

Detect leaked secrets with gitleaks / detect-secrets as a pre-commit hook and the
trufflesecurity/trufflehog action in CI. Rotate immediately if a secret leaks — a git history
rewrite is not enough.

## CRYPTOGRAPHY GUIDELINES

```text
SYMMETRIC ENCRYPTION:  AES-256-GCM (authenticated, preferred) or ChaCha20-Poly1305
KEY DERIVATION:        Argon2id (memory-hard) or PBKDF2 with 600k+ iterations
HASHING (general):     SHA-256 / SHA-3
SIGNING:               Ed25519 or ECDSA P-256 (avoid RSA-2048 for new code)
RANDOM:                crypto.getRandomValues() / os.urandom() — never Math.random()
TLS:                   TLS 1.3 preferred, TLS 1.2 minimum. Disable TLS 1.0/1.1.

NEVER:
- ECB mode (predictable patterns visible in ciphertext)
- MD5 or SHA1 (for security purposes)
- DES / 3DES
- RSA < 2048 bits
- Math.random() for security-sensitive operations
```

## AUDIT LOGGING — what to log

Always log security events. A failed login has no `userId` yet: derive a keyed hash of the attempted
identifier once, outside the log call, and log only that. It correlates repeat attempts just as
well, and the raw identifier never reaches the log store or a stack frame captured next to it.

```typescript
logger.info({ event: 'auth.login.success', userId, ip, userAgent })
const attemptedIdHash = hmac(attemptedEmail)
logger.warn({ event: 'auth.login.failure', attemptedIdHash, ip, reason })
logger.info({ event: 'auth.logout', userId })
logger.warn({ event: 'auth.password_reset.requested', attemptedIdHash, ip })
logger.info({ event: 'admin.user.role_changed', actorId, targetUserId, oldRole, newRole })
logger.warn({ event: 'access.forbidden', userId, resource, action })
logger.info({ event: 'data.exported', userId, dataType, count })
```

Never log (canonical list: `rules/700-observability.md`'s Never log list): passwords,
tokens, API keys, session IDs, full credit card numbers, SSNs, email/phone, or raw request bodies
(they may contain credentials).
