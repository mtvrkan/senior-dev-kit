# Project Preset — Django / DRF

## Architecture

- Apps are vertical slices: `apps/<domain>/{models,serializers,views,services,urls}.py`.
- Views stay thin — serializer validates, a service function does the work, the serializer
  renders the response. Business logic does not live in views or in model `save()` overrides.
- Fat models are fine for query logic (managers, `QuerySet` methods); side effects belong in
  services.

`apps/users/views.py`:

```python
class UserViewSet(viewsets.ModelViewSet):
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        return User.objects.filter(organization=self.request.user.organization)
```

Scoping `get_queryset` by the requesting user is the authorization boundary — it is what
prevents IDOR. A `permission_classes` entry alone does not stop user A from fetching user B's
object by id.

## Settings are the protected area

`settings.py`, `urls.py`, `SECRET_KEY`, `ALLOWED_HOSTS`, auth backends and middleware are
Tier 3 — plan first.

- `DEBUG = False` in production, non-negotiable; `DEBUG = True` with a real `ALLOWED_HOSTS`
  leaks settings through the error page.
- Secrets from the environment (`django-environ`, `os.environ`), never a literal in `settings.py`.
- Split settings (`base.py` / `dev.py` / `prod.py`) rather than `if DEBUG:` branches.

## ORM — N+1 and query count

WRONG — one query per row:

```python
for order in Order.objects.all():
    print(order.customer.name)
```

RIGHT — `select_related` for FK / OneToOne (SQL JOIN), `prefetch_related` for M2M / reverse FK
(a second query):

```python
Order.objects.select_related("customer")
Article.objects.prefetch_related("tags")
```

Fetch only the columns needed:

```python
User.objects.only("id", "email")
User.objects.values("id", "email")
```

- `.count()` not `len(qs)`; `.exists()` not `if qs:`.
- `bulk_create` / `bulk_update` for batches — never a `save()` inside a loop.
- `select_for_update()` inside `transaction.atomic()` for read-modify-write.
- Raw SQL only via parameters: `Model.objects.raw("... WHERE id = %s", [id])` — never f-strings.

## Migrations are Tier 3

`makemigrations` output is reviewed, not trusted. Adding a non-null column to a populated table,
renaming, or dropping requires the expand → backfill → contract sequence across deploys. Check
`sqlmigrate` before applying anything to production data.

## Serializers

```python
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["id", "email", "name"]
        read_only_fields = ["id"]
```

`fields` is an explicit allowlist. NEVER `fields = "__all__"` — it leaks new columns automatically.

Validation belongs in `validate_<field>` / `validate`, not in the view.

## Async and background work

Anything over ~200ms (email, PDF, third-party call) goes to Celery or Django-Q, not into the
request. Tasks are idempotent and take ids, not model instances.

## Verification

- Targeted test run — `manage.py test`, or `pytest` if the project uses pytest-django.
- `check --deploy` audits production settings.
- `makemigrations --check --dry-run` fails if models drifted from migrations.

```bash
python manage.py test apps.users.tests.TestUserAPI
pytest apps/users -x -q
ruff check .
mypy apps/
python manage.py check --deploy
python manage.py makemigrations --check --dry-run
```

## Anti-patterns

- `fields = "__all__"` on a serializer.
- Queryset not scoped to the requesting user in `get_queryset`.
- `.save()` inside a loop; `len(qs)` instead of `.count()`.
- Business logic in `Model.save()` or in a signal — signals hide control flow; prefer an explicit
  service call.
- `DEBUG = True`, a hardcoded `SECRET_KEY`, or `ALLOWED_HOSTS = ["*"]` outside local dev.
- f-string SQL in `.raw()` or `.extra()`.
- Long-running work inline in a view.
