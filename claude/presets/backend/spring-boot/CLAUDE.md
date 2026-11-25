# Project Preset — Spring Boot (Java / Kotlin)

## Architecture

- `@RestController` → `@Service` → `@Repository`. Controllers map HTTP; services hold business
  rules; repositories hold queries. No `JpaRepository` injected into a controller.
- Constructor injection only — `final` fields, no `@Autowired` on fields (untestable, hides
  cycles).
- DTOs at the boundary. A JPA entity is never a request body and never a response body.

```java
@RestController
@RequestMapping("/api/v1/users")
class UserController {
    private final UserService userService;

    UserController(UserService userService) { this.userService = userService; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    UserResponse create(@Valid @RequestBody CreateUserRequest body) {
        return userService.create(body);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    UserResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser caller) {
        return userService.getOwned(id, caller.id());
    }
}
```

## Validation — Bean Validation on the DTO

```java
record CreateUserRequest(
    @NotBlank @Email  @Size(max = 255) String email,
    @NotBlank @Size(min = 1, max = 100) String name
) {}
```

`@Valid` on the parameter is what actually triggers it — without it the annotations are inert.

Never put `role`, `isAdmin` or any privilege field on a create/register DTO — a client-settable
role lets anyone sign up as admin. The service assigns the default role; role changes go through a
separate endpoint behind an admin-only `@PreAuthorize` check.

## Security — the protected area

Anything under `SecurityConfig` / its `SecurityFilterChain` bean, JWT parsing, or
`@PreAuthorize` rules is Tier 3: plan first, no silent edits. `WebSecurityConfigurerAdapter` was
removed in Spring Security 6 — it only appears in legacy code; new config is a
`SecurityFilterChain` `@Bean`.

- Authorization is an ownership check in the service, not only a role check at the edge.
  `hasRole('USER')` does not stop user A reading user B's record.
- `BCryptPasswordEncoder` (or Argon2) for passwords — never MD5/SHA, never plain `equals` on a
  hash.
- CSRF stays on for cookie-session apps; disabling it is only correct for a stateless
  token API, and the reason goes in the commit message or PR, not a code comment.

## JPA — N+1, lazy loading, transactions

WRONG — N+1, one query per order:

```java
orders.forEach(o -> log.info(o.getCustomer().getName()));
```

RIGHT — fetch join:

```java
@Query("select o from Order o join fetch o.customer where o.status = :status")
List<Order> findByStatusWithCustomer(@Param("status") Status status);
```

- `@Transactional` on the service method, not the repository, and not the controller.
- `LazyInitializationException` means an entity escaped the transaction — map to a DTO inside it.
- Never build JPQL/SQL by string concatenation; use named parameters or Criteria.

## Errors — one handler, RFC 9457 body

```java
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }
}
```

Never return a raw exception message or stack trace. `server.error.include-stacktrace=never`.

## Logging

```java
private static final Logger log = LoggerFactory.getLogger(UserService.class);
log.info("user.created userId={}", user.id());
```

Parameterized messages, no string concatenation. Never log tokens, passwords, full request bodies, or `Authorization` headers.

## Kotlin notes

- `data class` for DTOs; `val` by default.
- Coroutines with Spring WebFlux, or `@Async` on MVC — do not block a reactive thread.
- Nullability is enforced at the DTO boundary; don't spray `!!` to silence it.

## Verification

- Targeted test: `./gradlew test --tests` on Gradle, `./mvnw test -Dtest=Class#method` on Maven.
- Style: `./gradlew ktlintCheck`, or `./mvnw spotless:check`.
- `./gradlew build` compiles and runs the suite.

```bash
./gradlew test --tests "*UserServiceTest"
./mvnw test -Dtest=UserServiceTest#createsUser
./gradlew ktlintCheck
./gradlew build
```

## Anti-patterns

- Field `@Autowired` instead of constructor injection.
- Returning a JPA entity from a controller — leaks columns and triggers lazy loads in serialization.
- `@Transactional` on a controller, or on a private/self-invoked method (the proxy won't apply it).
- Role check without an ownership check — IDOR.
- `catch (Exception e) {}` — swallowing, or logging `e.getMessage()` and losing the stack.
- Building queries with `+` string concatenation.
- `spring.jpa.hibernate.ddl-auto=update` in production — migrations belong to Flyway/Liquibase.
