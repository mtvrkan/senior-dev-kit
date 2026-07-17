---
description: "Testing rules — pyramid ratios, mock policy, naming conventions, stability, coverage. Auto-loads for test/spec files."
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/test/**"
  - "**/__tests__/**"
  - "**/tests/**"
  - "**/*_test.*"
  - "**/*_spec.*"
  - "**/test_*.py"
---

## TEST PYRAMID RATIOS

| Project type | Unit | Integration | E2E |
| --- | --- | --- | --- |
| REST API / backend | 40% | 50% | 10% |
| Full-stack web | 20% | 40% | 40% |
| Mobile (Flutter/RN) | 40% | 30% | 30% |
| CLI / library / SDK | 80% | 18% | 2% |
| Microservice | 30% | 60% | 10% |

Integration tests > unit tests for code that touches DB, filesystem, or external services.

**Full-stack web's 40% E2E is deliberate, not a typo.** It follows the "testing trophy"
shape (Kent C. Dodds), not the classic pyramid: most full-stack bugs live at integration
boundaries (API↔DB wiring, client↔server contract, auth/routing) rather than in isolated
business logic, so unit tests get the smallest share and E2E covers the critical user
flows those boundary bugs actually break.

**Mobile's 30% E2E is also elevated above a classic pyramid, for a different reason:**
device/OS fragmentation (screen sizes, OS versions, permission dialogs) and platform
integration points (push notifications, deep links, biometric auth, background/foreground
transitions) only surface on a real device or emulator — no unit or integration test
exercises them, so E2E carries more of mobile's risk than a backend's would.

REST API, CLI/library, and Microservice stay classic-pyramid-shaped because their bug
surface is different — a CLI/library's correctness is almost entirely in its pure logic,
so unit tests dominate there instead.

## MOCK POLICY — what to mock vs not

ALWAYS mock: external HTTP APIs · email sending · payment gateways · time (`Date.now()`) · random
NEVER mock: the live DB connection/driver in an INTEGRATION test (use a real test DB) · your own internal services in an integration test (integration test them)
SOMETIMES mock: filesystem (prefer temp dirs) · queues (mock for unit, real for integration)

Rationale: mocking the DB connection in an integration test hides schema/query bugs that only
surface in prod — that test exists specifically to catch those. This does NOT forbid mocking a
repository/interface at the service-layer boundary in a UNIT test (see the AAA example below,
`mockUserRepo`) — that's mocking a dependency, not the DB itself; the repository's own tests
still hit a real test DB. If a suite has zero tests hitting a real DB, the mock policy is being
violated even though individual unit tests look correct in isolation.

## TEST NAMING CONVENTIONS

Pattern: `describe('[unit under test]')` → `it('[behavior description]')`

```text
describe('UserService')
  it('creates user with hashed password')
  it('throws EmailAlreadyExists when email is taken')
  it('returns null when user not found (never throws)')
```

BDD alternative (when framework supports): `given/when/then` in test description.
Never: `it('works')` · `it('test1')` · `it('should work correctly')`

## AAA PATTERN — mandatory structure

```typescript
// Unit test for the service layer — mocks the repository INTERFACE (a
// dependency boundary), not the DB itself. UserRepo's own test suite still
// runs against a real test DB per the mock policy above.
// Arrange — set up data and dependencies
const user = { id: '1', email: 'test@example.com' }
mockUserRepo.findById.mockResolvedValue(user)

// Act — call the unit under test
const result = await userService.getById('1')

// Assert — verify the outcome
expect(result.email).toBe('test@example.com')
```

## SELECTOR STABILITY — UI tests

PREFER: `data-testid="submit-button"` · `aria-label="Submit"` · `role="button"` + text
AVOID: CSS selectors (`.btn.btn-primary`) · DOM position (`nth-child(3)`) · visible text alone (localizes)
NEVER: XPath for UI tests

Add `data-testid` to interactive elements when writing UI tests — do not query by class.

## TEST FILE POLICY

- Extending an existing test file (adding new `it`/`test` cases for changed behavior) is always allowed
- Never rewrite or delete existing test cases in a file without explicit user permission — a failing test is a signal to fix the code, not the test
- When adding a feature, add tests in the SAME turn (not "I'll add tests next")
- Test file location: co-located with source (`auth.service.ts` → `auth.service.test.ts`)
  OR in `__tests__/` subdirectory — follow what already exists in project
- When no test file exists for a changed unit → create minimal spec same turn

## MINIMAL SPEC (when creating new tests)

Minimum 3 cases: happy path + edge case + error case

```typescript
// Happy path: expected input → expected output
it('returns user when found', async () => { ... })
// Edge case: boundary condition
it('returns null when id is empty string', async () => { ... })
// Error case: failure mode
it('throws DatabaseError when connection fails', async () => { ... })
```

## TARGETED TEST COMMAND — never full suite for 1-file change

```text
Jest:    jest path/to/auth.service.spec.ts --no-coverage --passWithNoTests
Vitest:  vitest run path/to/auth.service.test.ts
Bun:     bun test path/to/auth.service.test.ts
pytest:  pytest tests/test_auth.py -x -q
Go:      go test ./auth/... -run TestLogin -v -count=1
Cargo:   cargo test auth::tests::test_login
Gradle:  ./gradlew test --tests "*.AuthServiceTest"
XCTest:  xcodebuild test -scheme App -only-testing:AuthTests/testLogin
Flutter: flutter test test/auth_test.dart
RSpec:   bundle exec rspec spec/services/auth_service_spec.rb
.NET:    dotnet test --filter "FullyQualifiedName~AuthServiceTests.TestLogin"
```

## COVERAGE GUIDANCE

Minimum targets (flag if below, never block):

- Business logic / service layer: 80%
- Utility functions: 90%
- UI components: 60%
- Database queries: integration test, not coverage metric

Never aim for 100% — tests for getters/setters and trivial code are waste.

## E2E TOOLS BY PLATFORM

| Platform | Tool | Command |
| --- | --- | --- |
| Web | Playwright | `npx playwright test` |
| Web | Cypress | `npx cypress run` |
| React Native | Detox | `detox test -c ios.sim.release` |
| Flutter | integration_test | `flutter test integration_test/` |
| iOS native | XCTest | `xcodebuild test -scheme App` |
| Android native | Espresso | `./gradlew connectedAndroidTest` |
| API | Supertest (Node) | in Jest/Vitest suite |
| API | httpx.AsyncClient (Python) | in pytest suite |

Integration test for APIs: use `WebApplicationFactory` (.NET) · `TestClient` (FastAPI) · `httptest` (Go).
Always: real DB connection for integration tests — never mock the DB.
