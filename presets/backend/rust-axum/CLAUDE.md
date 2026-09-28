# Project Preset — Rust (axum + tokio)

## Architecture

- Handlers are thin: extract → call a service → return `impl IntoResponse`. Business logic lives
  in plain modules that don't know about HTTP.
- Shared dependencies travel in `AppState` via `State<AppState>`, cloned cheaply
  (`Arc` inside), never a global `static`.
- One error enum per crate boundary, implementing `IntoResponse`. Handlers return
  `Result<T, AppError>` — never `unwrap()`.

```rust
#[derive(Clone)]
struct AppState { db: PgPool, users: Arc<UserService> }

async fn create_user(
    State(state): State<AppState>,
    Json(body): Json<CreateUser>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    body.validate()?;
    let user = state.users.create(body).await?;
    Ok((StatusCode::CREATED, Json(user.into())))
}

let app = Router::new()
    .route("/users", post(create_user))
    .route("/users/{id}", get(get_user))
    .layer(TraceLayer::new_for_http())
    .with_state(state);
```

`body.validate()` comes from the `validator` crate.

## Errors — one enum, `?` everywhere

```rust
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("not found")]            NotFound,
    #[error("forbidden")]            Forbidden,
    #[error(transparent)]            Db(#[from] sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, public) = match &self {
            AppError::NotFound  => (StatusCode::NOT_FOUND,  "not found"),
            AppError::Forbidden => (StatusCode::FORBIDDEN,  "forbidden"),
            AppError::Db(e) => {
                tracing::error!(error = %e, "db failure");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error")
            }
        };
        (status, Json(json!({ "error": public }))).into_response()
    }
}
```

Log the internal error, return a generic message — the detail stays in the log. `sqlx::Error`
text can name columns.

## `unwrap` policy

`unwrap()` / `expect()` / `panic!` are acceptable only in `main`, in tests, and on invariants
that are genuinely impossible — and there it is `expect("...")` whose message states the invariant
(`expect("regex literal is valid")`), not a bare `unwrap()`. Anywhere on a request path they are a
remote denial of service — use `?` or an explicit match.

## Async — tokio

- Never block a runtime worker: no `std::fs`, no `std::thread::sleep`, no synchronous HTTP.
  CPU-bound work goes to `tokio::task::spawn_blocking`.
- `tokio::join!` / `try_join!` for independent awaits; sequential `.await` only on a dependency.
- Hold no `std::sync::Mutex` guard across an `.await` — use `tokio::sync::Mutex` or restructure.

## Database — sqlx

`query_as!` is compile-time checked and parameterized:

```rust
let user = sqlx::query_as!(User, "SELECT id, email FROM users WHERE email = $1", email)
    .fetch_optional(&state.db)
    .await?;
```

NEVER build SQL with `format!("SELECT * FROM users WHERE email = '{email}'")`.

Transactions with `pool.begin()`; commit explicitly — a dropped transaction rolls back silently.

## `unsafe`

Every `unsafe` block needs a `// SAFETY:` comment stating the invariant that makes it sound. An
`unsafe` block with no such comment does not get merged. Prefer a safe crate over hand-rolled
FFI.

## Observability

```rust
tracing::info!(user_id = %user.id, "user.created");
```

Structured fields, not format strings. `tracing-subscriber` with JSON output in production. Never log tokens or password hashes.

## Verification

- `cargo test <name>` — targeted.
- `cargo clippy -- -D warnings` — lint, with warnings as errors.
- `cargo fmt --check` — style.
- `cargo build` — or `cargo check` for a fast type pass.
- `cargo deny check advisories` — CVE / license audit.

```bash
cargo test users::create_user
cargo clippy -- -D warnings
cargo fmt --check
cargo build
cargo deny check advisories
```

## Anti-patterns

- `unwrap()`/`expect()` on a request path.
- `.clone()` sprayed to silence the borrow checker instead of adjusting lifetimes or borrowing.
- `String` parameters where `&str` would do; `Vec<T>` where `&[T]` would do.
- Blocking calls inside an async fn.
- `std::sync::Mutex` held across `.await`.
- `format!` into SQL.
- `unsafe` without a `// SAFETY:` comment.
- `#[allow(dead_code)]` used to hide an unfinished refactor.
