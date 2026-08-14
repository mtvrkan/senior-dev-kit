# Project Preset — Go HTTP API (net/http + chi)

<!-- reviewed: 2026-08 — the "Go 1.22+" floor in the errgroup example only. Verified against the Go
release history: the per-iteration loop variable landed in 1.22, so the comment is still the right
floor, and 1.26 is current — the claim is a minimum, not a pin, and does not go stale as Go moves. -->

## Architecture

- Standard layout: `cmd/<binary>/main.go`, private packages under `internal/`, shared libraries
  under `pkg/` only if something outside the module imports them.
- Handler → service → store. Handlers parse and write HTTP; services hold rules; stores hold SQL.
- Dependencies are struct fields set in `main`, passed down explicitly. No package-level globals,
  no `init()` doing work.
- Accept interfaces, return structs. Define the interface in the *consumer* package.

```go
type UserHandler struct{ svc *user.Service }

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
    var body CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        writeError(w, http.StatusBadRequest, "invalid body")
        return
    }
    u, err := h.svc.Create(r.Context(), body)
    if err != nil {
        writeError(w, statusFor(err), "could not create user")   // generic text out
        return
    }
    writeJSON(w, http.StatusCreated, toResponse(u))
}
```

## Errors — values, wrapped, inspected with `errors.Is`/`As`

```go
var ErrNotFound = errors.New("not found")

if err != nil {
    return fmt.Errorf("fetch user %s: %w", id, err)   // %w keeps the chain
}

switch {
case errors.Is(err, user.ErrNotFound): return http.StatusNotFound
case errors.Is(err, user.ErrForbidden): return http.StatusForbidden
default: return http.StatusInternalServerError
}
```

Never `_ = err`. Never compare error strings. Log the wrapped error server-side, return a generic
message to the client.

## Context — first parameter, always

`ctx context.Context` is the first argument of every function that does I/O, and it is threaded
from `r.Context()` all the way to the database driver. A request that is cancelled must stop
work. Never store a `context.Context` in a struct.

## Concurrency

```go
g, ctx := errgroup.WithContext(ctx)
for _, id := range ids {
    g.Go(func() error { return fetch(ctx, id) })   // Go 1.22+: no loop-var capture bug
}
if err := g.Wait(); err != nil { return err }
```

- Every goroutine has a defined exit; a goroutine started and forgotten is a leak.
- Guard shared state with a mutex or a channel — run `go test -race` and mean it.
- Bound concurrency (`errgroup.SetLimit`, worker pool) — unbounded fan-out over user input is a
  self-inflicted DoS.

## Database

```go
row := db.QueryRowContext(ctx, `SELECT id, email FROM users WHERE email = $1`, email)
// NEVER: fmt.Sprintf("SELECT ... WHERE email = '%s'", email)

defer rows.Close()          // on every Query
if err := rows.Err(); err != nil { ... }   // checked after the loop, not only inside it
```

Set `SetMaxOpenConns` / `SetConnMaxLifetime` — the defaults are unbounded.

## Security

- `html/template` for anything rendered to a browser. `text/template` does not escape.
- `exec.Command("sh", "-c", userInput)` is shell injection — pass argv elements separately.
- Timeouts on every `http.Server` (`ReadHeaderTimeout` especially) and every outbound client.
  A default `http.Client` waits forever.

## Verification

```bash
go test ./internal/user/... -run TestCreateUser -v   # targeted
go test -race ./...                                  # before anything concurrent ships
golangci-lint run
go vet ./...
go build ./...
govulncheck ./...                                    # CVE audit
```

## Anti-patterns

- Ignoring an error with `_`, or `if err != nil { return err }` losing all context (wrap with `%w`).
- `panic` for control flow in a library.
- `interface{}`/`any` where a concrete type or generic would do.
- Package-level mutable state; `init()` that opens connections or reads config.
- Goroutine without a termination path, or unbounded fan-out.
- `context.Context` stored in a struct instead of passed as the first parameter.
- A `http.Server` or `http.Client` with no timeouts.
