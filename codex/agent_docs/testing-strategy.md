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

Mock — verifies interaction only, brittle:

```typescript
jest.spyOn(emailService, 'send').mockResolvedValue(undefined)
expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }))
```

Fake — real behavior, robust:

```typescript
class InMemoryEmailService implements EmailService {
  sent: Email[] = []
  async send(email: Email) { this.sent.push(email) }
}
```

The test then asserts on `emailService.sent[0].to === 'user@example.com'`, and actually validates the Email shape, recipients and subject.

## PROPERTY-BASED TESTING — when to use

Use when: function has complex invariants over a range of inputs.
Don't use for: simple happy/error/edge paths (use example-based tests).

fast-check example, sorting invariants:

```typescript
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

JavaScript/TypeScript — the bare `stryker` package is the pre-1.0 name, deprecated since 2019 and
still published; `npx stryker run` fetches that instead of Stryker:

```bash
npx @stryker-mutator/core run
```

Python:

```bash
mutmut run
```

Java:

```bash
./gradlew pitest
```

Mutation score >75% = tests are meaningful.
Coverage 100% but mutation score 30% = tests exist but don't verify behavior.

**Only run mutation testing for core business logic — too slow for full suite.**

## CONTRACT TESTING — microservices

Use when: services have API contracts. Catches breaking changes before deploy.

Pact (consumer-driven contract testing). The consumer (web app) defines what it expects, runs its
own client against Pact's mock server, and the passing test writes the contract to `pacts/`:

```typescript
import { PactV3, MatchersV3 } from '@pact-foundation/pact'

const { eachLike, like } = MatchersV3
const provider = new PactV3({ consumer: 'web', provider: 'api' })

provider
  .uponReceiving('a request for user list')
  .withRequest({ method: 'GET', path: '/users' })
  .willRespondWith({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: eachLike({ id: like('string'), email: like('string') }),
  })

await provider.executeTest(async (mockServer) => {
  const users = await fetchUsers(mockServer.url)
  expect(users[0].email).toBeDefined()
})
```

The provider (API) verifies it can fulfill the contract, in a provider-side test run against the
started API:

```typescript
await new Verifier({
  providerBaseUrl: 'http://localhost:3001',
  pactUrls: [path.resolve('pacts/web-api.json')],
}).verifyProvider()
```

## SNAPSHOT TESTING — when valid vs trap

**Valid use**: UI components where visual output matters + you want to catch regressions.
**Trap**: Overusing for business logic — snapshots become "accept whatever the code does" tests.

RIGHT — valid, component snapshot:

```typescript
expect(render(<UserCard user={mockUser} />).container).toMatchSnapshot()
```

WRONG — trap, snapshot of business logic output; it should assert specific values:

```typescript
expect(calculateTax(order)).toMatchSnapshot()
```

Update snapshots: `vitest -u` only when the change is intentional.

## PARALLEL TEST EXECUTION

Vitest runs in parallel by default. Jest shards for CI — `--shard=1/4` runs 25% of the tests, one
shard per CI matrix job:

```bash
jest --shard=1/4
```

Database isolation for parallel tests — each worker gets its own schema:

```typescript
beforeAll(() => db.createSchema(`test_${process.env.JEST_WORKER_ID}`))
afterAll(() => db.dropSchema(`test_${process.env.JEST_WORKER_ID}`))
```

## TEST DATA MANAGEMENT

### Builder pattern for test fixtures

GOOD — factory with sensible defaults + override:

```typescript
function createUser(overrides: Partial<User> = {}): User {
  return {
    id: crypto.randomUUID(),
    email: `user-${Date.now()}@example.com`,
    role: 'user',
    createdAt: new Date(),
    ...overrides,
  }
}
```

Usage:

```typescript
const admin = createUser({ role: 'admin' })
const verifiedUser = createUser({ emailVerifiedAt: new Date() })
```

### Database seeding for tests

Use transactions for rollback isolation (faster than recreating the DB); the rollback means no data
cleanup is needed:

```typescript
beforeEach(async () => {
  await db.beginTransaction()
})
afterEach(async () => {
  await db.rollback()
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

Only run tests affected by git changes:

```bash
vitest run --changed
jest --onlyChanged
```

## TESTING ASYNC CODE

WRONG — timing-dependent, an arbitrary wait:

```typescript
test('loads data', async () => {
  render(<UserList />)
  await new Promise(r => setTimeout(r, 1000))
  expect(screen.getByText('John')).toBeInTheDocument()
})
```

RIGHT — wait for DOM state; `findByText` waits up to 1s:

```typescript
test('loads data', async () => {
  render(<UserList />)
  expect(await screen.findByText('John')).toBeInTheDocument()
})
```

For API polling or delayed effects:

```typescript
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

NestJS — full module integration:

```typescript
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(EmailService).useClass(FakeEmailService)
  .compile()
const app = moduleRef.createNestApplication()
await app.init()
await request(app.getHttpServer()).post('/users').send(userData).expect(201)
await app.close()
```

FastAPI — TestClient:

```python
from fastapi.testclient import TestClient
client = TestClient(app)
response = client.post('/users', json=user_data)
assert response.status_code == 201
```

Go — httptest (double quotes: `'/users'` is a rune literal in Go and will not compile):

```go
w := httptest.NewRecorder()
r := httptest.NewRequest(http.MethodPost, "/users", body)
handler.ServeHTTP(w, r)
assert.Equal(t, 201, w.Code)
```

## VISUAL REGRESSION TESTING

Playwright — screenshot comparison:

```typescript
await expect(page).toHaveScreenshot('user-list.png', { maxDiffPixelRatio: 0.02 })
```

Update the baseline:

```bash
npx playwright test --update-snapshots
```

When to use: design system components · critical UI views · PDF/chart generation.
Don't use for: every page (too many false positives with dynamic content).
