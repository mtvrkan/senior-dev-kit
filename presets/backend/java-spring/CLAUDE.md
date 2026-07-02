# Project Preset — Java Spring Boot

## Architecture

- Layered: `@RestController` → `@Service` → `@Repository` (JPA or custom). Never skip layers.
- Keep controllers thin: deserialize → validate → call service → return DTO.
- Use DTOs for API boundaries — never return `@Entity` objects directly (exposes DB internals + lazy-load issues).
- Do NOT modify `SecurityConfig`, `WebSecurityConfigurerAdapter`, filters, or auth beans unless explicitly requested.

```java
// Controller — thin, DTO in/out
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }

    @GetMapping("/{id}")
    public UserResponse getById(@PathVariable String id,
                                 @AuthenticationPrincipal UserDetails principal) {
        return userService.getById(id, principal.getUsername());
    }
}
```

## Input validation — Bean Validation

Annotate all request DTOs. Spring validates before the controller body executes:

```java
public record CreateUserRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 1, max = 100) String name,
    @NotNull Role role
) {}

// Global validation error handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.UNPROCESSABLE_ENTITY);
        pd.setTitle("Validation Error");
        pd.setProperty("errors", ex.getBindingResult().getFieldErrors()
            .stream()
            .map(e -> Map.of("field", e.getField(), "message", e.getDefaultMessage()))
            .toList());
        return pd;
    }

    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleNotFound(EntityNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(404, ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetail handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ProblemDetail.forStatusAndDetail(500, "Internal server error");
    }
}
```

## Authorization — method security

```java
// @PreAuthorize on service methods — not just controller
@Service
public class PostService {

    @PreAuthorize("@postOwnerChecker.isOwner(#id, authentication)")
    public PostResponse update(String id, UpdatePostRequest req) { ... }

    // OR: explicit ownership check inside method
    public PostResponse getById(String id, String requestingUserId) {
        Post post = postRepo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Post not found: " + id));
        if (!post.getUserId().equals(requestingUserId)) {
            throw new AccessDeniedException("Access denied");
        }
        return PostResponse.from(post);
    }
}
```

Never rely only on controller-level `@PreAuthorize` — services can be called from other services.

## JPA — N+1 and lazy loading

```java
// WRONG — triggers N+1: posts loaded lazily for each user in loop
List<User> users = userRepo.findAll();
users.forEach(u -> process(u.getPosts()));  // N+1!

// RIGHT — fetch join
@Query("SELECT u FROM User u LEFT JOIN FETCH u.posts WHERE u.status = :status")
List<User> findActiveWithPosts(@Param("status") Status status);

// RIGHT — EntityGraph
@EntityGraph(attributePaths = {"posts", "posts.comments"})
List<User> findAllWithPostsAndComments();
```

Use `@Transactional(readOnly = true)` on read-only service methods — improves performance and prevents accidental writes.

## Transactions

```java
@Service
@Transactional  // class-level default — override per method
public class OrderService {

    @Transactional  // read-write
    public OrderResponse placeOrder(PlaceOrderRequest req) {
        // multi-step: deduct inventory, create order, charge payment
        // Spring rolls back on RuntimeException by default
        inventory.deduct(req.productId(), req.quantity());
        Order order = orderRepo.save(Order.from(req));
        paymentService.charge(order);  // throws → full rollback
        return OrderResponse.from(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listByUser(String userId) {
        return orderRepo.findByUserId(userId).stream()
            .map(OrderResponse::from).toList();
    }
}
```

## SQL queries — never string-build

```java
// WRONG — SQL injection
String query = "SELECT * FROM users WHERE email = '" + email + "'";
entityManager.createNativeQuery(query);

// RIGHT — JPQL named parameter
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// RIGHT — Criteria API for dynamic queries
CriteriaBuilder cb = em.getCriteriaBuilder();
CriteriaQuery<User> cq = cb.createQuery(User.class);
Root<User> root = cq.from(User.class);
cq.where(cb.equal(root.get("email"), email));
```

## Error response — RFC 7807

Use `ProblemDetail` (Spring 6+) for all error responses:

```java
ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "User not found");
pd.setType(URI.create("https://api.example.com/errors/not-found"));
pd.setProperty("userId", id);
return ResponseEntity.of(pd).build();
```

Content-Type: `application/problem+json`

## Verification

```bash
./gradlew test                                          # full suite
./gradlew test --tests "*.UserServiceTest"              # targeted
./gradlew test --tests "*.UserServiceTest.testCreate"   # single test
./gradlew build -x test                                 # compile check
./gradlew checkstyleMain                                # Checkstyle (if configured)
./gradlew spotlessCheck                                 # Spotless (if configured)
```

## Anti-patterns

- Returning `@Entity` directly from controller — always map to DTO.
- Business logic in `@RestController` — belongs in `@Service`.
- Lazy-loaded associations accessed outside `@Transactional` context — `LazyInitializationException`.
- String concatenation in JPQL/SQL — always named parameters.
- Modifying `SecurityConfig` to "fix" a bug — find the real cause.
- `@Autowired` field injection — use constructor injection (testability + required deps explicit).
- Catching `Exception` and returning 200 — use `@RestControllerAdvice`.
- N+1 queries — always check with Hibernate stats or `p6spy` in dev.
