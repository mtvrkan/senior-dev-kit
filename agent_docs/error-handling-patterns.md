# Error Handling Patterns — Lazy Reference

## ERROR HIERARCHY

Design a typed error hierarchy so errors can be caught specifically and handled differently:

```typescript
// Base application error
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,          // machine-readable: 'USER_NOT_FOUND'
    public readonly statusCode: number,    // HTTP status
    public readonly isOperational: boolean = true  // expected vs programming error
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// Domain errors (operational — expected, handle gracefully)
class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' not found`, 'NOT_FOUND', 404)
  }
}

class ValidationError extends AppError {
  constructor(message: string, public readonly fields?: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400)
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

class ForbiddenError extends AppError {
  constructor(resource: string, action: string) {
    super(`Cannot ${action} ${resource}`, 'FORBIDDEN', 403)
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super('Too many requests', 'RATE_LIMITED', 429)
  }
}

// Infrastructure error (non-operational — bug or external failure)
class DatabaseError extends AppError {
  constructor(cause: Error) {
    super('Database operation failed', 'DATABASE_ERROR', 503, false)
    this.cause = cause
  }
}
```

## RFC 9457 — PROBLEM+JSON FORMAT

Standard error response format (use this for all REST APIs):

```typescript
interface ProblemDetail {
  type: string      // URI identifying error type (docs link)
  title: string     // human-readable summary (same for same type)
  status: number    // HTTP status code
  detail: string    // specific explanation for this occurrence
  instance: string  // URI of the specific request
  // + any domain-specific extensions:
  errors?: Record<string, string[]>  // for validation errors
  retryAfter?: number               // for rate limiting
  code?: string                     // machine-readable code
}

// Express global error handler:
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode)
      .contentType('application/problem+json')
      .json({
        type: `https://api.example.com/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
        title: err.message,
        status: err.statusCode,
        detail: err.message,
        instance: req.path,
        ...(err instanceof ValidationError && err.fields ? { errors: err.fields } : {}),
        ...(err instanceof RateLimitError ? { retryAfter: err.retryAfter } : {}),
      })
  }
  
  // Programming errors: don't expose details, log fully
  logger.error({ requestId, error: err, stack: err.stack })
  
  return res.status(500)
    .contentType('application/problem+json')
    .json({
      type: 'https://api.example.com/errors/internal',
      title: 'An unexpected error occurred',
      status: 500,
      detail: 'Please try again later. If the problem persists, contact support.',
      instance: req.path,
    })
})
```

## RESULT TYPE PATTERN (no-throw approach)

For operations that have expected failure modes, Result type is cleaner than try/catch:

```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

// Function signature makes failure explicit
async function getUserById(id: string): Promise<Result<User, NotFoundError | DatabaseError>> {
  try {
    const user = await db.user.findUnique({ where: { id } })
    if (!user) return { success: false, error: new NotFoundError('User', id) }
    return { success: true, data: user }
  } catch (err) {
    return { success: false, error: new DatabaseError(err as Error) }
  }
}

// Caller is forced to handle both cases:
const result = await getUserById(id)
if (!result.success) {
  if (result.error instanceof NotFoundError) return res.status(404)...
  throw result.error  // re-throw programming error
}
const user = result.data  // TypeScript knows this is User
```

## ERROR BOUNDARIES (React)

Every distinct section that can fail independently needs an Error Boundary:

```tsx
// components/ErrorBoundary.tsx
'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to error monitoring (Sentry/DataDog)
    logger.error({ error: error.message, componentStack: info.componentStack })
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">Something went wrong</p>
          <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

// Usage: wrap each independent section
<ErrorBoundary fallback={<UserListError />}>
  <UserList />
</ErrorBoundary>
<ErrorBoundary fallback={<OrdersError />}>
  <OrderList />
</ErrorBoundary>
// One section failing doesn't crash the entire page
```

## ERROR MONITORING INTEGRATION

```typescript
// Sentry setup (Next.js)
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event, hint) {
    // Don't send operational errors to Sentry (expected)
    const error = hint.originalException
    if (error instanceof AppError && error.isOperational) return null
    return event
  },
})

// Add context to errors:
Sentry.setUser({ id: user.id, email: user.email })
Sentry.addBreadcrumb({ message: 'User clicked checkout', category: 'ui' })

// Manual capture with context:
Sentry.captureException(error, {
  tags: { feature: 'checkout' },
  extra: { orderId, userId },
})
```

## RETRY LOGIC

```typescript
// Exponential backoff with jitter (for transient failures)
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; initialDelay?: number; shouldRetry?: (error: Error) => boolean } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 500, shouldRetry = isRetryable } = options
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts || !shouldRetry(error as Error)) throw error
      
      // Exponential backoff with jitter
      const delay = initialDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

function isRetryable(error: Error): boolean {
  if (error instanceof DatabaseError) return true  // DB transient failures
  if (error instanceof AppError) return error.statusCode >= 500  // 5xx = server error
  return false  // 4xx = client error, don't retry
}
```

## MOBILE ERROR PATTERNS (Flutter/Kotlin/Swift)

```dart
// Flutter — sealed class result (Dart 3+)
sealed class Result<T> {
  const Result();
}
class Success<T> extends Result<T> {
  final T data;
  const Success(this.data);
}
class Failure<T> extends Result<T> {
  final Exception error;
  const Failure(this.error);
}

// Use in repository:
Future<Result<User>> getUser(String id) async {
  try {
    final user = await api.getUser(id);
    return Success(user);
  } on NotFoundException {
    return Failure(NotFoundException('User not found'));
  } on NetworkException catch (e) {
    return Failure(e);
  }
}

// In ViewModel — exhaustive pattern matching:
final result = await repository.getUser(id);
switch (result) {
  case Success<User>(:final data): state = AsyncData(data);
  case Failure<User>(:final error): state = AsyncError(error, StackTrace.current);
}
```

```kotlin
// Kotlin — sealed class + Result<T>
sealed class UiState<out T> {
  object Loading : UiState<Nothing>()
  data class Success<T>(val data: T) : UiState<T>()
  data class Error(val message: String, val cause: Throwable? = null) : UiState<Nothing>()
}

// In ViewModel:
fun loadUser(id: String) {
  viewModelScope.launch {
    _uiState.update { UiState.Loading }
    runCatching { repository.getUser(id) }
      .onSuccess { user -> _uiState.update { UiState.Success(user) } }
      .onFailure { error -> _uiState.update { UiState.Error(error.localizedMessage ?: "Unknown error", error) } }
  }
}
```

## USER-FACING ERROR MESSAGES

```typescript
// Machine error → human message mapping
const userMessages: Record<string, string> = {
  'USER_NOT_FOUND': 'We couldn\'t find that account. Check the email and try again.',
  'INVALID_CREDENTIALS': 'Incorrect email or password.',
  'ACCOUNT_LOCKED': 'Too many failed attempts. Try again in 30 minutes.',
  'EMAIL_ALREADY_EXISTS': 'An account with this email already exists.',
  'VALIDATION_ERROR': 'Please check the highlighted fields and try again.',
  'RATE_LIMITED': 'You\'re doing that too fast. Please wait a moment.',
  'PAYMENT_FAILED': 'Payment couldn\'t be processed. Check your card details.',
  'DEFAULT': 'Something went wrong. Please try again.',
}

function toUserMessage(error: AppError): string {
  return userMessages[error.code] ?? userMessages['DEFAULT']
}
```

Rules for user messages:

- Actionable: tell users what to do, not just what went wrong
- Non-technical: no stack traces, no "500 Internal Server Error"
- Non-blaming: "couldn't find" not "you entered wrong"
- Specific enough to help: "check email field" not just "error"
- Secure: don't reveal system internals, user enumeration vectors

## GRACEFUL DEGRADATION

```typescript
// Wrap non-critical features with fallback
async function getPersonalizedContent(userId: string) {
  try {
    return await recommendationService.getFor(userId)  // external API
  } catch (error) {
    logger.warn({ event: 'recommendation.failed', userId, error: error.message })
    return getDefaultContent()  // graceful fallback — don't crash the page
  }
}

// Circuit breaker pattern (with opossum library)
import CircuitBreaker from 'opossum'

const breaker = new CircuitBreaker(recommendationService.getFor, {
  timeout: 3000,         // If slower than 3s, trip
  errorThresholdPercentage: 50,  // If 50% fail, trip
  resetTimeout: 30000,   // After 30s, try again
})

breaker.fallback(() => getDefaultContent())
breaker.on('open', () => logger.warn('Recommendation circuit opened'))
```
