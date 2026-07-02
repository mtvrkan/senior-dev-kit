# Project Preset — Flask

## Architecture

- Follow the existing application factory pattern (`create_app()`) if present — never import `app` directly.
- Blueprints for route grouping — one blueprint per domain area (users, auth, admin, api).
- Keep route functions thin: parse → validate → call service → return response.
- Business logic belongs in service classes or domain modules, not in route handlers.
- Type hints on all new functions (Python 3.10+ union syntax: `str | None`).

```python
# app/__init__.py — factory pattern
def create_app(config: str = "production") -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_map[config])

    db.init_app(app)
    jwt.init_app(app)  # or whatever extensions are in use

    from .users import users_bp
    from .api.v1 import api_v1_bp
    app.register_blueprint(users_bp, url_prefix="/users")
    app.register_blueprint(api_v1_bp, url_prefix="/api/v1")

    return app
```

## Input validation

Validate all external input at the route boundary — never trust raw `request.json` or `request.form`:

```python
# With marshmallow (if project uses it)
class CreateUserSchema(Schema):
    email = fields.Email(required=True)
    name  = fields.Str(required=True, validate=Length(min=1, max=100))

@users_bp.post("/")
def create_user():
    schema = CreateUserSchema()
    try:
        data = schema.load(request.get_json())
    except ValidationError as err:
        return {"errors": err.messages}, 422
    return user_service.create(data), 201

# With Pydantic v2 (if project uses it)
class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)

@users_bp.post("/")
def create_user():
    try:
        body = CreateUserRequest.model_validate(request.get_json())
    except ValidationError as err:
        return {"errors": err.errors()}, 422
    return user_service.create(body.model_dump()), 201
```

## Error handling

Register global error handlers — never let raw exceptions reach the client:

```python
# app/__init__.py or errors.py
@app.errorhandler(404)
def not_found(e):
    return {"error": "not_found", "message": str(e)}, 404

@app.errorhandler(422)
def unprocessable(e):
    return {"error": "validation_error", "details": e.description}, 422

@app.errorhandler(Exception)
def internal_error(e):
    app.logger.exception("Unhandled error")
    return {"error": "internal_server_error"}, 500

# Domain-level errors — raise, catch at handler boundary
class NotFoundError(Exception): pass
class ConflictError(Exception): pass
```

## Security

- Validate and sanitize all inputs — never pass `request.json` directly to ORM or shell.
- Check ownership before returning user-owned resources: `if resource.user_id != current_user.id: abort(403)`
- Never expose stack traces in API responses — use `app.config["PROPAGATE_EXCEPTIONS"] = False` in prod.
- Do not modify auth/session middleware or JWT configuration unless explicitly requested.
- SQL: use SQLAlchemy ORM or parameterized queries — never f-string or `.format()` in raw SQL.

```python
# WRONG
query = f"SELECT * FROM users WHERE email = '{email}'"

# RIGHT — ORM
user = User.query.filter_by(email=email).first()

# RIGHT — raw if needed
result = db.session.execute(text("SELECT * FROM users WHERE email = :email"), {"email": email})
```

## Data patterns

```python
# Transactions for multi-step writes
def transfer_credits(from_id: int, to_id: int, amount: int) -> None:
    try:
        from_user = User.query.get_or_404(from_id)
        to_user   = User.query.get_or_404(to_id)
        from_user.credits -= amount
        to_user.credits   += amount
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

# Avoid N+1 — use joinedload / selectinload
from sqlalchemy.orm import joinedload
posts = Post.query.options(joinedload(Post.author)).all()
```

Migrations via Alembic / Flask-Migrate — never `db.create_all()` in production.

## Verification

```bash
pytest [file] -x -q        # targeted test
pytest --cov=app -q        # with coverage
ruff check .               # lint (preferred over flake8)
mypy app/                  # type check (if mypy configured)
flask run                  # startup smoke check
```

## Anti-patterns

- Putting business logic directly in route functions.
- `from app import app` in blueprints — breaks factory pattern and causes circular imports.
- Exposing SQLAlchemy model objects with `__dict__` — use serializers/schemas to control output.
- Raw `request.json` passed to ORM create/update without validation.
- `db.create_all()` for schema management — always use Alembic migrations.
- `except Exception: pass` — always log and re-raise or return an error response.
