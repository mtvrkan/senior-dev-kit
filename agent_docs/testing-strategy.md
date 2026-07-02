# Testing Strategy — Lazy Reference

## TEST DOUBLE HIERARCHY (strictest → loosest)

Choose the least-powerful double that satisfies the test:

```text
Fake     → real working implementation, simplified (in-memory DB, fake email)
Stub     → returns canned responses, no verification
Mock     → verifies interactions (was method called? how many times?)
Spy      → wraps real object, records calls
Dummy    → placeholder, never actually used
```

**Rule: prefer fakes over mocks for infrastructure boundaries (DB, email, queue).**

Why: mocks verify the call was made, not that it worked. A fake DB runs the same ORM queries and surfaces schema bugs.

```typescript
// MOCK (verifies interaction only — brittle)
jest.spyOn(emailService, 'send').mockResolvedValue(undefined)
expect(emailService.send).toHaveBeenCalledWith({ to: 'user@example.com', ... })

// FAKE (real behavior — robust)
class InMemoryEmailService implements EmailService {
  sent: Email[] = []
  async send(email: Email) { this.sent.push(email) }
}
// Test asserts on: emailService.sent[0].to === 'user@example.com'
// + actually validates Email shape, recipients, subject
```

## PROPERTY-BASED TESTING — when to use

Use when: function has complex invariants over a range of inputs.
Don't use for: simple happy/error/edge paths (use example-based tests).

```typescript
// fast-check example: sorting invariants
import fc from 'fast-check'

test('sorted array contains same elements as input', () => {
  fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
    const sorted = mySort(arr)
    expect(sorted.length).toBe(arr.length)
    expect(sorted).toEqual([...arr].sort((a, b) => a - b))
  }))
})
```

Good candidates: parsers, serializers, sort/search algorithms, mathematical operations, business rules with ranges.

## MUTATION TESTING — confidence metric

Run mutation testing to measure test quality (not just coverage):

```bash
# JavaScript/TypeScript
npx stryker run

# Python
mutmut run

# Java
./gradlew pitest
```

Mutation score >75% = tests are meaningful.
Coverage 100% but mutation score 30% = tests exist but don't verify behavior.

**Only run mutation testing for core business logic — too slow for full suite.**

## CONTRACT TESTING — microservices

Use when: services have API contracts. Catches breaking changes before deploy.

```typescript
// Pact (consumer-driven contract testing)
// Consumer (web app) defines what it expects:
const interaction = {
  description: 'a request for user list',
  request: { method: 'GET', path: '/users' },
  response: {
    status: 200,
    body: like([{ id: like('string'), email: like('string') }])
  }
}

// Provider (API) verifies it can fulfill the contract:
// pact verify --provider-base-url http://localhost:3001
```

## SNAPSHOT TESTING — when valid vs trap

**Valid use**: UI components where visual output matters + you want to catch regressions.
**Trap**: Overusing for business logic — snapshots become "accept whatever the code does" tests.

```typescript
// VALID: component snapshot
expect(render(<UserCard user={mockUser} />).container).toMatchSnapshot()

// TRAP: snapshot of business logic output
expect(calculateTax(order)).toMatchSnapshot()  // ← should assert specific values
```

Update snapshots: `vitest --update-snapshots` only when the change is intentional.

## PARALLEL TEST EXECUTION

```typescript
// Vitest — parallel by default
// Jest — shard for CI
jest --shard=1/4  // run 25% of tests (use in CI matrix)

// Database isolation for parallel tests
// Each worker gets its own schema:
beforeAll(() => db.createSchema(`test_${process.env.JEST_WORKER_ID}`))
afterAll(() => db.dropSchema(`test_${process.env.JEST_WORKER_ID}`))
```

## TEST DATA MANAGEMENT

### Builder pattern for test fixtures

```typescript
// GOOD: factory with sensible defaults + override
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: crypto.randomUUID(),
    email: `user-${Date.now()}@example.com`,
    role: 'user',
    createdAt: new Date(),
    ...overrides,
  }
}

// Usage:
const admin = createUser({ role: 'admin' })
const verifiedUser = createUser({ emailVerifiedAt: new Date() })
```

### Database seeding for tests

```typescript
// Use transactions for rollback isolation (faster than recreating DB)
beforeEach(async () => {
  await db.beginTransaction()
})
afterEach(async () => {
  await db.rollback()  // ← no data cleanup needed
})
```

## FLAKY TEST DIAGNOSIS

Flaky test = test that passes and fails without code change. Common causes:

| Cause | Symptom | Fix |
| --- | --- | --- |
| Timing dependency | Fails on slow CI, passes locally | `await waitFor()` instead of `sleep()` |
| Shared state | Fails when run after specific other test | Proper beforeEach/afterEach cleanup |
| Random data without seed | Fails occasionally | Use seeded random or fixed test data |
| Race condition | Intermittent in parallel mode | Fix async logic, not the test |
| External API calls | Fails when API is down | Mock external APIs in unit tests |
| Timezone | Fails in different TZs | Use UTC explicitly, mock `Date` |

Detection: `vitest --retry=3` — if it passes on retry, it's flaky.

## TEST PERFORMANCE

Large test suites become slow. Prioritize:

```text
CI fast path (<2 min):
  - Unit tests only
  - Changed files only (test affected by `--changed`)
  - Exclude E2E

CI full path (<10 min, on merge to main):
  - Unit + Integration
  - E2E smoke suite (critical paths only)

Nightly (full E2E + mutation):
  - Full E2E suite
  - Mutation testing on core modules
```

```bash
# Only run tests affected by git changes
vitest run --changed
jest --onlyChanged
```

## TESTING ASYNC CODE

```typescript
// WRONG: timing-dependent
test('loads data', async () => {
  render(<UserList />)
  await new Promise(r => setTimeout(r, 1000))  // ← arbitrary wait
  expect(screen.getByText('John')).toBeInTheDocument()
})

// RIGHT: wait for DOM state
test('loads data', async () => {
  render(<UserList />)
  expect(await screen.findByText('John')).toBeInTheDocument()  // waits up to 1s
})

// For API polling or delayed effects:
test('retries on failure', async () => {
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  }, { timeout: 3000, interval: 100 })
})
```

## COVERAGE THAT MATTERS

Line coverage is a proxy, not a goal. Better signals:

```text
Branch coverage > line coverage (tests all conditional paths)
Mutation score > branch coverage (tests actually assert behavior)
```

Areas where coverage matters:

- Business rules / domain logic: 80%+ branch coverage
- Auth / payment paths: 90%+ (critical)
- Error handling: test every catch block with its specific error type
- Utility functions: near 100% (pure functions are cheap to test)

Areas where coverage is a waste:

- Framework boilerplate (NestJS controllers with no logic)
- Simple DTOs / interfaces
- Auto-generated code

## INTEGRATION TEST PATTERNS BY STACK

```typescript
// NestJS — full module integration
const app = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(EmailService).useClass(FakeEmailService)
  .compile()
const server = app.getHttpServer()
await request(server).post('/users').send(userData).expect(201)

// FastAPI — TestClient
from fastapi.testclient import TestClient
client = TestClient(app)
response = client.post('/users', json=user_data)
assert response.status_code == 201

// Go — httptest
w := httptest.NewRecorder()
r := httptest.NewRequest(http.MethodPost, '/users', body)
handler.ServeHTTP(w, r)
assert.Equal(t, 201, w.Code)
```

## VISUAL REGRESSION TESTING

```bash
# Playwright — screenshot comparison
await expect(page).toHaveScreenshot('user-list.png', { maxDiffPixelRatio: 0.02 })

# Update baseline:
playwright test --update-snapshots
```

When to use: design system components · critical UI views · PDF/chart generation.
Don't use for: every page (too many false positives with dynamic content).
