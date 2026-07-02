# Worked Example — Java Spring Boot + PostgreSQL

Complete bootstrap walkthrough for a Spring Boot 3.x project using Spring Data JPA + Flyway + PostgreSQL.

---

## Stack detection

```text
pom.xml contains: spring-boot-starter-web, spring-data-jpa, postgresql
Detected: Java Spring Boot + PostgreSQL
```

Presets selected: `backend/java-spring` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/java-spring/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active (architecture detection)
│   ├── 200-api.md               ← **/api/**, **/controllers/**
│   ├── 300-testing.md           ← **/*Test.java, **/*Tests.java
│   ├── 500-database.md          ← **/migrations/**, **/entities/**
│   └── 700-observability.md     ← **/*.java
├── skills/                      ← all 33 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Java Spring Boot + PostgreSQL

## preset: backend/java-spring

### Architecture
- Layered: com.example.project/{controller, service, repository, model, dto, exception}
- Controllers thin: delegate immediately to @Service classes
- @Service classes hold business logic; never call repo directly from controller
- DTOs for all request/response bodies — never expose @Entity objects through API
- @Repository interfaces extend JpaRepository or CrudRepository
- @Transactional on service methods that write, never on controllers

### Commands
- TEST_CMD: ./gradlew test --tests "*.ClassName" (or ./mvnw test -Dtest=ClassName)
- LINT_CMD: ./gradlew checkstyleMain (if configured)
- BUILD_CMD: ./gradlew bootJar (or ./mvnw package -DskipTests)
- TYPE_CMD: ./gradlew compileJava

### Protected files (escalate before touching)
- src/main/java/**/SecurityConfig.java → security-guard
- src/main/java/**/JwtFilter.java → security-guard
- src/main/resources/db/migration/** → migration-guard

## preset: database/postgres

### PostgreSQL rules
- All schema changes via Flyway: src/main/resources/db/migration/V{n}__{desc}.sql
- Never manual ALTER TABLE in dev — always create a migration file
- Parameterized queries only — never string concat in JPQL or native queries
- Index every FK column; add @Index on @Table for composite indexes
- Timestamps: always TIMESTAMPTZ; map to Instant in Java
```

---

## Step 3 — Real usage flows

### Flow A: Add a new REST endpoint

**User:** "Add a `GET /users/{id}/orders` endpoint that returns a paginated list of orders for a user"

**Routing:** `feature-build` skill → `senior-engineer` agent (sonnet)

**Agent behavior:**

1. Reads `src/main/java/.../controller/UserController.java` (existing controller pattern)
2. Reads `src/main/java/.../repository/OrderRepository.java` (existing repo pattern)
3. Notes existing `PageRequest` pagination in use → follows same pattern
4. Checks N+1: plans single `@Query` JPQL join instead of per-order fetch

**Output:**

```text
PLAN: paginated user orders endpoint — 5 files
[P:A] dto/OrderListResponse.java — record with List<OrderDto> data, String cursor, boolean hasMore
[P:A] repository/OrderRepository.java — findByUserId(Pageable) JPQL query
[S]   service/OrderService.java — getUserOrders(userId, pageable) + ownership check
[S]   controller/UserController.java — GET /{id}/orders with @RequestParam(defaultValue="20") int size
[S]   service/OrderServiceTest.java — 3 cases (happy, empty page, wrong user → 403)
CONTRACT: GET /users/{id}/orders?page=0&size=20 → {data:[...], totalElements:int, totalPages:int}
OK to proceed?
```

**After approval:**

```text
∙ dto/OrderListResponse.java:1 — new record
∙ repository/OrderRepository.java:28 — findByUserId @Query with JOIN FETCH
∙ service/OrderService.java:51 — getUserOrders with userId == auth assertion
∙ controller/UserController.java:67 — @GetMapping("/{id}/orders")
∙ service/OrderServiceTest.java — 3 cases added
TEST: ./gradlew test --tests "*.OrderServiceTest" ✓ 3 passed
RISK: T2 · senior-engineer · API+DB
```

---

### Flow B: Add a new JPA entity + Flyway migration

**User:** "Add a `Tag` entity that can be attached to orders"

**Routing:** DB schema signal → `db-guard` agent

**Output:**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: new tables — tags (id, name, created_at) + order_tags (order_id, tag_id)
Risk: low — additive, no existing data affected
Zero-downtime: safe

MIGRATION PLAN
[S] src/main/resources/db/migration/V4__add_tags.sql
    CREATE TABLE tags (
      id          BIGSERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL UNIQUE,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    );
    CREATE TABLE order_tags (
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      tag_id   BIGINT NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
      PRIMARY KEY (order_id, tag_id)
    );
    CREATE INDEX ix_order_tags_order_id ON order_tags (order_id);
    CREATE INDEX ix_order_tags_tag_id   ON order_tags (tag_id);

[S] model/Tag.java — @Entity with @ManyToMany(mappedBy="tags")
[S] model/Order.java — add @ManyToMany @JoinTable(name="order_tags") List<Tag> tags
[S] repository/TagRepository.java — extends JpaRepository<Tag, Long>
[S] dto/TagDto.java — record(Long id, String name)

Rollback: V4__add_tags.sql paired with V4__add_tags__undo.sql (drop tables in reverse order).
Approve to proceed?
```

---

### Flow C: Security audit before production deploy

**User:** `/security-scan` before go-live

**Routing:** `security-scan` skill → `security-scanner` agent (sonnet)

**Output (abbreviated):**

```text
SECURITY SCAN — Spring Boot API
================================

HIGH: controller/UserController.java:43
  Issue: PATCH /users/{id} — no ownership assertion
  Attack: authenticated user A can modify user B's profile (IDOR)
  Fix: assert auth principal id == path variable id, return 403 if mismatch

MEDIUM: config/SecurityConfig.java:28
  Issue: CORS configured with allowedOrigins("*") for credentialed requests
  Risk: CSRF via cross-origin requests; credentials leak
  Fix: restrict to known origins: allowedOrigins("https://app.example.com")

LOW: service/AuthService.java:61
  Issue: BCrypt cost factor set to 10 — acceptable but consider 12 for new installs
  Guidance: cost 12 adds ~250ms per hash on modern hardware (acceptable for auth)

SUMMARY: Critical:0 High:1 Medium:1 Low:1
VERDICT: fix High before deploy

IMPLEMENTATION PLAN:
1. UserController.java:43 — add @PreAuthorize or manual id == principal.getId() guard
2. SecurityConfig.java:28 — replace wildcard with explicit origin allowlist
```

---

## Step 4 — Cost estimates

| Task | Agent | Model | Typical cost |
| --- | --- | --- | --- |
| Add REST endpoint (4-5 files) | senior-engineer | sonnet | ~$0.05 |
| New entity + migration plan | db-guard | opus | ~$0.15 |
| Security scan (5-6 files) | security-scanner | sonnet | ~$0.06 |
| Bug fix (1-2 files) | bug-hunter | sonnet | ~$0.02 |
| Docs update (JavaDoc, README) | docs-writer | haiku | ~$0.003 |
