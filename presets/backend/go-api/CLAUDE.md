# Project Preset — Go API

## Architecture

- Follow existing package boundaries — never move packages or create new top-level packages without asking.
- Keep handlers thin: parse input → call service → return response. No business logic in handlers.
- Business logic lives in services/usecases. Data access in repositories/stores.
- Respect context propagation: every function that does I/O must accept `ctx context.Context` as first argument.
- Do not change auth, config, or database migrations unless explicitly requested.

## Error handling

Go errors are values — handle them explicitly at every call site.

```go
// WRONG: ignoring errors
result, _ := db.Query(ctx, query, args...)

// RIGHT: explicit handling
result, err := db.QueryRow(ctx, query, userID).Scan(&user.ID, &user.Email)
if err != nil {
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, ErrUserNotFound
    }
    return nil, fmt.Errorf("query user %s: %w", userID, err)
}
```

Use sentinel errors (`var ErrNotFound = errors.New("not found")`) for domain errors. Wrap with `%w` to preserve the chain. Never return raw DB errors to the HTTP layer.

## Input validation

Validate at the handler boundary — never trust request data:

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Name  string `json:"name"  validate:"required,min=1,max=100"`
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid JSON")
        return
    }
    if err := h.validator.Struct(req); err != nil {
        respondError(w, http.StatusUnprocessableEntity, err.Error())
        return
    }
    // proceed with validated req
}
```

## SQL — parameterized only

Never interpolate user input into SQL strings:

```go
// WRONG — SQL injection
query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)

// RIGHT — parameterized (pgx)
row := db.QueryRow(ctx, "SELECT id, email, name FROM users WHERE email = $1", email)

// RIGHT — parameterized (database/sql)
row := db.QueryRowContext(ctx, "SELECT id, email, name FROM users WHERE email = ?", email)
```

## Goroutines — lifecycle control

Never start a goroutine without controlling its lifecycle:

```go
// WRONG — goroutine leak
go func() {
    for {
        process()
        time.Sleep(time.Second)
    }
}()

// RIGHT — cancellable via context
go func(ctx context.Context) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            process(ctx)
        }
    }
}(ctx)
```

Never use `GlobalScope` equivalents. Always tie goroutine lifetime to a context or WaitGroup.

## Structured logging (slog — Go 1.21+)

```go
import "log/slog"

// Request handler — always include request ID
logger := slog.With("request_id", r.Header.Get("X-Request-ID"))

// Key-value pairs, never format strings
logger.Info("user created", "user_id", user.ID, "email", user.Email)
logger.Error("query failed", "error", err, "query", "find_user")

// NEVER log: passwords, tokens, PII, full request body with sensitive fields
```

## HTTP handler pattern

```go
// Thin handler: parse → validate → call service → respond
func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")  // or mux.Vars(r)["id"]

    user, err := h.userService.GetByID(r.Context(), userID)
    if err != nil {
        if errors.Is(err, service.ErrNotFound) {
            respondError(w, http.StatusNotFound, "user not found")
            return
        }
        slog.Error("get user failed", "error", err, "user_id", userID)
        respondError(w, http.StatusInternalServerError, "internal error")
        return
    }

    respondJSON(w, http.StatusOK, user)
}
```

## Testing — table-driven tests

```go
func TestUserService_GetByID(t *testing.T) {
    tests := []struct {
        name    string
        userID  string
        mock    func(*MockUserRepo)
        want    *User
        wantErr error
    }{
        {
            name:   "returns user when found",
            userID: "user-123",
            mock:   func(m *MockUserRepo) { m.On("FindByID", "user-123").Return(&User{ID: "user-123"}, nil) },
            want:   &User{ID: "user-123"},
        },
        {
            name:    "returns ErrNotFound when missing",
            userID:  "missing",
            mock:    func(m *MockUserRepo) { m.On("FindByID", "missing").Return(nil, ErrNotFound) },
            wantErr: ErrNotFound,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            repo := new(MockUserRepo)
            tt.mock(repo)
            svc := NewUserService(repo)
            got, err := svc.GetByID(context.Background(), tt.userID)
            assert.ErrorIs(t, err, tt.wantErr)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

## Verification

```bash
go test ./...                    # full suite
go test ./user/... -run TestName -v  # targeted
go vet ./...                     # static analysis (always)
golangci-lint run                # if configured
go build ./...                   # confirm compilation
```

## Anti-patterns

- Ignoring errors with `_` on non-trivial operations.
- `fmt.Sprintf` or string concatenation in SQL queries.
- Starting goroutines without context or WaitGroup for lifecycle.
- Returning raw `error` strings from DB layer to HTTP responses.
- Using `context.Background()` inside request handlers (use `r.Context()`).
- `log.Printf` instead of structured `slog` in new code.
- Not using transactions for multi-step writes.
