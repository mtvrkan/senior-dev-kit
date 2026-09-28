# Error Handling Patterns — Lazy Reference

## ERROR HIERARCHY

Design a typed error hierarchy so errors can be caught specifically and handled differently:

Base application error — `code` is machine-readable (`'USER_NOT_FOUND'`), `statusCode` is the HTTP
status, and `isOperational` separates expected errors from programming errors:

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}
```

Domain errors (operational — expected, handle gracefully):

```typescript
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
```

Infrastructure error (non-operational — bug or external failure):

```typescript
class DatabaseError extends AppError {
  constructor(cause: Error) {
    super('Database operation failed', 'DATABASE_ERROR', 503, false)
    this.cause = cause
  }
}
```

## RFC 9457 — PROBLEM+JSON FORMAT

Standard error response format (use this for all REST APIs):

- `type` — URI identifying the error type (docs link)
- `title` — human-readable summary (same for the same type)
- `status` — HTTP status code
- `detail` — specific explanation for this occurrence
- `instance` — URI of the specific request
- plus any domain-specific extensions: `errors` for validation errors, `retryAfter` for rate
  limiting, `code` for a machine-readable code

```typescript
interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  errors?: Record<string, string[]>
  retryAfter?: number
  code?: string
}
```

Express global error handler — programming errors don't expose details to the client, but are
logged fully:

```typescript
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

The function signature makes failure explicit, and the caller is forced to handle both cases:
`NotFoundError` maps to a 404, anything else is a programming error and is re-thrown, and past
the check TypeScript knows `result.data` is a `User`.

```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

async function getUserById(id: string): Promise<Result<User, NotFoundError | DatabaseError>> {
  try {
    const user = await db.user.findUnique({ where: { id } })
    if (!user) return { success: false, error: new NotFoundError('User', id) }
    return { success: true, data: user }
  } catch (err) {
    return { success: false, error: new DatabaseError(err as Error) }
  }
}

const result = await getUserById(id)
if (!result.success) {
  if (result.error instanceof NotFoundError) return res.status(404)...
  throw result.error
}
const user = result.data
```

## ERROR BOUNDARIES (React)

Every distinct section that can fail independently needs an Error Boundary. `componentDidCatch`
logs to error monitoring (Sentry/DataDog).

`components/ErrorBoundary.tsx`:

```tsx
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
```

Usage — wrap each independent section, so one section failing doesn't crash the entire page:

```tsx
<ErrorBoundary fallback={<UserListError />}>
  <UserList />
</ErrorBoundary>
<ErrorBoundary fallback={<OrdersError />}>
  <OrderList />
</ErrorBoundary>
```

## ERROR MONITORING INTEGRATION

Sentry setup (Next.js) — `beforeSend` drops operational errors, since they are expected:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event, hint) {
    const error = hint.originalException
    if (error instanceof AppError && error.isOperational) return null
    return event
  },
})
```

Add context to errors:

```typescript
Sentry.setUser({ id: user.id })
Sentry.addBreadcrumb({ message: 'User clicked checkout', category: 'ui' })
```

Manual capture with context:

```typescript
Sentry.captureException(error, {
  tags: { feature: 'checkout' },
  extra: { orderId, userId },
})
```

## RETRY LOGIC

Exponential backoff with jitter, for transient failures. `isRetryable` retries transient DB
failures and 5xx server errors; a 4xx is a client error and is never retried.

```typescript
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
      
      const delay = initialDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}

function isRetryable(error: Error): boolean {
  if (error instanceof DatabaseError) return true
  if (error instanceof AppError) return error.statusCode >= 500
  return false
}
```

## MOBILE ERROR PATTERNS (Flutter/Kotlin/Swift)

Flutter — sealed class result (Dart 3+):

```dart
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
```

Use in the repository:

```dart
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
```

In the ViewModel — exhaustive pattern matching:

```dart
final result = await repository.getUser(id);
switch (result) {
  case Success<User>(:final data): state = AsyncData(data);
  case Failure<User>(:final error): state = AsyncError(error, StackTrace.current);
}
```

Kotlin — sealed `UiState` class:

```kotlin
sealed class UiState<out T> {
  object Loading : UiState<Nothing>()
  data class Success<T>(val data: T) : UiState<T>()
  data class Error(val message: String, val cause: Throwable? = null) : UiState<Nothing>()
}
```

In the ViewModel:

```kotlin
fun loadUser(id: String) {
  viewModelScope.launch {
    _uiState.update { UiState.Loading }
    try {
      val user = repository.getUser(id)
      _uiState.update { UiState.Success(user) }
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      _uiState.update { UiState.Error(e.localizedMessage ?: "Unknown error", e) }
    }
  }
}
```

Avoid `runCatching` inside a coroutine: it catches `CancellationException` too, so a cancelled `viewModelScope` job turns into an error state instead of stopping. Rethrow cancellation, or catch only the specific exceptions the repository throws.

## USER-FACING ERROR MESSAGES

Machine error → human message mapping:

```typescript
const userMessages: Record<string, string> = {
  'USER_NOT_FOUND': 'Incorrect email or password.',
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

Wrap non-critical features, such as a call to an external recommendations API, with a graceful
fallback — return default content instead of crashing the page:

```typescript
async function getPersonalizedContent(userId: string) {
  try {
    return await recommendationService.getFor(userId)
  } catch (error) {
    logger.warn({ event: 'recommendation.failed', userId, error: error.message })
    return getDefaultContent()
  }
}
```

Circuit breaker pattern (with the opossum library) — it trips when a call is slower than 3 s
(`timeout`) or 50% of calls fail (`errorThresholdPercentage`), and tries again after 30 s
(`resetTimeout`):

```typescript
import CircuitBreaker from 'opossum'

const breaker = new CircuitBreaker(recommendationService.getFor, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
})

breaker.fallback(() => getDefaultContent())
breaker.on('open', () => logger.warn('Recommendation circuit opened'))
```
