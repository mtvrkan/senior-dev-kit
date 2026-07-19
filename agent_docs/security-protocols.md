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

| # | Key mitigations |
| --- | --- |
| A01 | RBAC + ABAC at service layer, not UI only. Check `userId === resource.userId` on every read/write. |
| A02 | TLS everywhere. Argon2id for passwords. AES-256-GCM for data at rest. Never MD5/SHA1 for security. |
| A03 | SHA-pin GitHub Actions (see `rules/600-devops.md`). Audit `npm audit` / `pip-audit`. SBOM on release. Lockfile integrity. |
| A04 | Threat model new features. Fail secure by default. Defense in depth. |
| A05 | Security headers (CSP, HSTS, X-Frame-Options). Disable debug in prod. No default credentials. |
| A06 | CVE scan in CI. Dependabot auto-PRs. Keep major versions current. |
| A07 | MFA for admin. Account lockout after N failures. Secure session invalidation. |
| A08 | HMAC for webhooks. Signed releases. Don't deserialize untrusted data. |
| A09 | Log auth events, privilege changes, failed access. Redact PII in logs. |
| A10 | Handle all error states explicitly. Never silently swallow exceptions. |

## AUTHENTICATION PATTERNS

### JWT (stateless)

```typescript
// GOOD JWT implementation
const token = jwt.sign(
  { sub: user.id, role: user.role },  // minimal payload — no PII
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '15m' }  // short expiry
)

// Refresh token (long-lived, stored in httpOnly cookie)
const refreshToken = jwt.sign(
  { sub: user.id, tokenFamily: uuid() },  // family for rotation detection
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

```typescript
// Express-session with security options
session({
  secret: process.env.SESSION_SECRET,  // >= 32 random bytes
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,     // prevents XSS cookie theft
    secure: true,       // HTTPS only
    sameSite: 'strict', // prevents CSRF
    maxAge: 60 * 60 * 1000  // 1 hour
  },
  store: new RedisStore({ client })  // never MemoryStore in prod
})
```

### Password hashing

```typescript
// Argon2id (preferred)
import { hash, verify } from '@node-rs/argon2'
const hashed = await hash(password, { memoryCost: 65536, timeCost: 3 })

// bcrypt (acceptable, if argon2 not available)
const hashed = await bcrypt.hash(password, 12)  // min cost 10, prefer 12
```

**Never**: MD5, SHA1, SHA256 for passwords (fast hash = easily brute-forced).

## CSRF PROTECTION

```typescript
// SameSite=Strict cookies (modern, preferred)
cookie: { sameSite: 'strict' }  // browser won't send on cross-site requests

// Double Submit Cookie (for SPAs with cross-origin)
// 1. Set CSRF token in cookie (readable by JS)
// 2. Client reads cookie, sends in X-CSRF-Token header
// 3. Server compares cookie value and header value
// Only an attacker-controlled page can't read the cookie

// Verify both origin and referer for extra protection:
const origin = req.headers.origin || req.headers.referer
if (!allowedOrigins.includes(new URL(origin).origin)) throw new ForbiddenError()
```

## RATE LIMITING STRATEGY

```typescript
// Different limits for different sensitivity levels:
const limits = {
  login:          { window: '15m', max: 5 },    // strict: brute force protection
  register:       { window: '1h',  max: 10 },   // prevent account farming
  passwordReset:  { window: '1h',  max: 3 },    // strict: prevent enumeration
  otpVerify:      { window: '10m', max: 5 },    // strict: prevent OTP brute force
  api:            { window: '1m',  max: 100 },  // per-user rate limiting
  publicApi:      { window: '1m',  max: 20 },   // unauthenticated endpoints
}

// Always include these headers:
res.set('X-RateLimit-Limit', limit.max)
res.set('X-RateLimit-Remaining', remaining)
res.set('X-RateLimit-Reset', resetTime)
// On 429:
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

```typescript
// Zod validation at API boundary:
const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  role: z.enum(['user', 'admin']),  // whitelist, never trust freeform role strings
})

const body = CreateUserSchema.safeParse(req.body)
if (!body.success) return res.status(400).json(formatZodError(body.error))
// body.data is now typed and validated — safe to use
```

## SQL INJECTION PREVENTION

```typescript
// WRONG: string interpolation
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`)
// Attacker input: userId = "' OR '1'='1"

// RIGHT: parameterized (ORM)
const user = await db.user.findUnique({ where: { id: userId } })

// RIGHT: parameterized (raw SQL)
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId])

// RIGHT: tagged template (sql-template-tag)
const user = await db.query(sql`SELECT * FROM users WHERE id = ${userId}`)
```

## XSS PREVENTION

```typescript
// React / Vue / Angular: safe by default (auto-escapes output)
// DANGER: explicit HTML injection
<div dangerouslySetInnerHTML={{ __html: userContent }} />  // ← XSS if unchecked

// If you must render HTML from untrusted source:
import DOMPurify from 'isomorphic-dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

// Content Security Policy (defense in depth):
// Never: Content-Security-Policy: *
// Always: specific domains + 'nonce-{nonce}' for inline scripts
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

```typescript
// Helmet.js (Node):
import helmet from 'helmet'
app.use(helmet())  // sets all of the above with secure defaults

// Custom CSP:
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", `'nonce-${nonce}'`],
    styleSrc: ["'self'", "'unsafe-inline'"],  // unsafe-inline OK for CSS only
    imgSrc: ["'self'", 'data:', 'https:'],
  }
}))
```

## FILE UPLOAD SECURITY

```typescript
// NEVER: trust client-provided filename or MIME type
// ALWAYS: validate on server side

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
const maxSize = 5 * 1024 * 1024  // 5MB

// 1. Check actual MIME type (magic bytes) — not Content-Type header
import { fileTypeFromBuffer } from 'file-type'
const { mime } = await fileTypeFromBuffer(buffer)
if (!allowedMimeTypes.includes(mime)) throw new ValidationError('Invalid file type')

// 2. Generate new filename — never use original
const safeFilename = `${crypto.randomUUID()}${allowedExtension}`

// 3. Store outside web root or in blob storage (S3, GCS)
// NEVER: serve user uploads from the same domain as the app
// Use: CDN subdomain (uploads.example.com ≠ app.example.com) — prevents cookie theft

// 4. Virus scan for documents (not just images)
// Use: ClamAV or cloud scanner
```

## SUPPLY CHAIN SECURITY (OWASP A03 2025)

GitHub Actions SHA-pinning and SBOM generation commands are in `rules/600-devops.md` — canonical home (auto-loads for CI/Docker/IaC files), not repeated here.

```yaml
# Lockfile integrity: commit lockfiles, verify in CI
npm ci             # ← uses lockfile exactly, fails if package.json changed without update
pip install --require-hashes -r requirements.txt

# Dependabot: auto-PR for security updates
# .github/dependabot.yml — enable for npm, pip, docker, github-actions separately
```

## SECRETS MANAGEMENT

```bash
# NEVER in code:
API_KEY = "sk-abc123..."  # ← commits to git history FOREVER

# ALWAYS: environment variables + secret manager
process.env.API_KEY         # runtime injection
AWS Secrets Manager         # production
HashiCorp Vault             # self-hosted
GitHub Secrets              # CI/CD
Doppler / Infisical         # developer experience

# Detect leaked secrets:
# Pre-commit: gitleaks / detect-secrets
# CI: trufflesecurity/trufflehog action
# Rotate immediately if leaked — git history rewrite is not enough
```

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

```typescript
// Always log (security events):
logger.info({ event: 'auth.login.success', userId, ip, userAgent })
logger.warn({ event: 'auth.login.failure', email, ip, reason })
logger.info({ event: 'auth.logout', userId, sessionId })
logger.warn({ event: 'auth.password_reset.requested', email, ip })
logger.info({ event: 'admin.user.role_changed', actorId, targetUserId, oldRole, newRole })
logger.warn({ event: 'access.forbidden', userId, resource, action })
logger.info({ event: 'data.exported', userId, dataType, count })

// Never log:
// passwords, tokens, API keys, full credit card numbers, SSNs
// Raw request bodies (may contain credentials)
```
