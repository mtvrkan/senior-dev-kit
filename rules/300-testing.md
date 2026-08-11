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
  # JVM/.NET convention is a PascalCase suffix, not a `.test.` infix, and .NET keeps its tests in
  # a sibling `*.Tests` project rather than a `tests/` folder — neither shape matches the globs
  # above.
  - "**/*Test.{java,kt,cs,swift}"
  - "**/*Tests.{java,kt,cs,swift}"
  - "**/*Spec.{java,kt,groovy}"
  # Django's default is a single `tests.py` per app — not `test_*.py`, not a `tests/` package —
  # and it is the file the django preset's own targeted-test command names. `conftest.py` is
  # where pytest fixtures live, so a change there affects every test in the tree.
  - "**/tests.py"
  - "**/conftest.py"
  # Rust keeps unit tests inline behind `#[cfg(test)]`, so no path glob can reach them; its
  # integration tests do live in `tests/`, which the folder glob above already covers.
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

**The elevated E2E shares are deliberate, not typos — do not "fix" toward a classic
pyramid.** Full-stack's 40% follows the testing-trophy shape (most full-stack bugs live at
integration boundaries and the user flows they break); mobile's 30% exists because device/OS
fragmentation and platform integrations (push, deep links, biometrics) only surface
on-device. API/CLI/microservice rows stay classic because their bug surface is unit-shaped.

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

Canonical per-stack table (26 stacks, targeted-test flags): `agent_docs/stack-commands.md`.
Only the two rows whose filter syntax goes beyond "pass the file path" are worth restating:

```text
Go:      go test ./auth/... -run TestLogin -v -count=1
XCTest:  xcodebuild test -scheme App -only-testing:AuthTests/testLogin
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
