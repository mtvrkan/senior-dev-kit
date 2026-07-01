# Project Preset — Rust API (Axum / Actix-web)

## Architecture

- Handlers in `handlers/` or `routes/` — thin, delegate to services.
- Business logic in `services/` or `domain/`. Data access in `repositories/` or `db/`.
- Shared state via `axum::extract::State<AppState>` — avoid global statics.
- Do not modify auth middleware, config loading, or `unsafe` blocks unless explicitly requested.

```rust
// handlers/users.rs (Axum)
use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{AppState, errors::AppError, schemas::{CreateUserRequest, UserResponse}};

pub async fn create_user(
    State(state): State<AppState>,
    Json(body): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    let user = state.user_service.create(body).await?;
    Ok((StatusCode::CREATED, Json(UserResponse::from(user))))
}

pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    // Extension(current_user): Extension<AuthUser>,  ← from auth middleware
) -> Result<Json<UserResponse>, AppError> {
    let user = state.user_service.get_by_id(&id).await?;
    Ok(Json(UserResponse::from(user)))
}
```

## Error handling — `thiserror` + unified AppError

```rust
use thiserror::Error;
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Forbidden")]
    Forbidden,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation: {0}")]
    Validation(String),

    #[error("Database error")]
    Database(#[from] sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound(m)   => (StatusCode::NOT_FOUND, m.clone()),
            AppError::Forbidden     => (StatusCode::FORBIDDEN, "Forbidden".into()),
            AppError::Conflict(m)   => (StatusCode::CONFLICT, m.clone()),
            AppError::Validation(m) => (StatusCode::UNPROCESSABLE_ENTITY, m.clone()),
            AppError::Database(_)   => {
                tracing::error!(error = ?self, "Database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".into())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

**Never:** `unwrap()` or `expect()` in handler or service code. Use `?` operator with `AppError`.

## Input validation — `validator` crate

```rust
use serde::Deserialize;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(email)]
    pub email: String,

    #[validate(length(min = 1, max = 100))]
    pub name: String,
}

// In handler — validate before processing
pub async fn create_user(Json(body): Json<CreateUserRequest>) -> Result<..., AppError> {
    body.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    // proceed with validated body
}
```

## Database — SQLx parameterized queries

```rust
// WRONG — string format is SQL injection
let query = format!("SELECT * FROM users WHERE email = '{}'", email);

// RIGHT — parameterized (sqlx)
let user = sqlx::query_as!(
    User,
    "SELECT id, email, name FROM users WHERE email = $1",
    email
)
.fetch_optional(&pool)
.await?;

// Transactions for multi-step writes
let mut tx = pool.begin().await?;
sqlx::query!("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from_id)
    .execute(&mut *tx).await?;
sqlx::query!("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to_id)
    .execute(&mut *tx).await?;
tx.commit().await?;
```

## Authorization — ownership check

```rust
pub async fn get_post(
    State(state): State<AppState>,
    Path(post_id): Path<String>,
    Extension(current_user): Extension<AuthUser>,
) -> Result<Json<PostResponse>, AppError> {
    let post = state.post_service.find_by_id(&post_id).await?
        .ok_or_else(|| AppError::NotFound(format!("Post {post_id} not found")))?;

    if post.user_id != current_user.id {
        return Err(AppError::Forbidden);
    }
    Ok(Json(PostResponse::from(post)))
}
```

## Structured logging — `tracing`

```rust
use tracing::{info, error, instrument};

#[instrument(skip(state), fields(user_id = %body.email))]
pub async fn create_user(State(state): State<AppState>, Json(body): Json<CreateUserRequest>)
    -> Result<(StatusCode, Json<UserResponse>), AppError>
{
    info!("Creating user");
    let user = state.user_service.create(body).await
        .map_err(|e| { error!(error = ?e, "Failed to create user"); e })?;
    info!(user_id = %user.id, "User created");
    Ok((StatusCode::CREATED, Json(UserResponse::from(user))))
}
// NEVER log: passwords, tokens, PII
```

## Unsafe — strict policy

- Never introduce `unsafe` for convenience or performance without profiling.
- If `unsafe` already exists in the codebase, understand the invariant it maintains before modifying.
- Document every `unsafe` block with: why it's needed, what invariant it upholds.

## Verification

```bash
cargo check                    # fast compile check
cargo test                     # full suite
cargo test user_service        # targeted (matches test fn name)
cargo clippy -- -D warnings    # lints as errors
cargo fmt --check              # format check
cargo audit                    # CVE scan (cargo install cargo-audit)
```

## Anti-patterns

- `unwrap()` / `expect()` in request paths — use `?` with `AppError`.
- String format in SQL queries — always `query!()` macro or parameterized.
- Introducing `unsafe` without explicit justification and documentation.
- Broad lifetime rewrites for a small change — change only what's needed.
- Cloning large objects unnecessarily in hot paths — use references or `Arc`.
- `eprintln!` / `println!` in production code — use `tracing::{info, error}`.
