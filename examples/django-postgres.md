# Worked Example — Django + PostgreSQL

Complete bootstrap walkthrough for a Django REST API / full-stack project.

---

## Stack detection

```text
requirements.txt contains: django, djangorestframework, psycopg2-binary, django-environ
Detected: Django + PostgreSQL
```

Presets selected: `backend/django` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/django/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active (architecture detection)
│   ├── 200-api.md               ← **/api/**, **/views/**
│   ├── 300-testing.md           ← **/tests/**, test_*.py
│   ├── 500-database.md          ← **/migrations/**
│   └── 700-observability.md     ← **/*.py
├── skills/                      ← all 32 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 14 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Django + PostgreSQL

## preset: backend/django

### Architecture
- Django apps: `{app}/views.py → serializers.py → models.py → admin.py`
- DRF ViewSets keep thin: validation in serializers, business logic in managers/services
- permissions_classes required on every ViewSet; check object ownership explicitly

### Commands
- TEST_CMD: pytest {app}/tests/ -x -q
- LINT_CMD: ruff check .
- TYPE_CMD: mypy {app}/
- PKG_MANAGER: pip (requirements.txt detected)

### Protected files (escalate before touching)
- `{project}/settings*.py` → security-guard (secrets, auth config)
- `{app}/migrations/` → migration-guard (DB schema)
- `{app}/permissions.py` → security-guard (auth logic)
```

---

## Usage flow 1 — New API endpoint (senior-engineer, Tier 2)

**Input**

```text
Add a GET /api/products/{id}/reviews/ endpoint that returns paginated reviews for a product
```

**Auto-routing:** `senior-engineer` (new endpoint = API change = Tier 2)

**Output (plan + approval)**

```text
PLAN: paginated product reviews endpoint — 3 files
∙ products/serializers.py — add ReviewSerializer with fields: id, rating, body, author_name, created_at
∙ products/views.py — add ReviewListView(ListAPIView) with permission_classes=[IsAuthenticated] + filter by product
∙ products/urls.py — register /products/<pk>/reviews/ route
OK to proceed?
```

**After approval**

```text
∙ products/serializers.py:45 — ReviewSerializer added
∙ products/views.py:89 — ReviewListView with select_related('author') and PageNumberPagination
∙ products/tests/test_views.py — 4 cases: list reviews, pagination, unauthenticated 401, wrong product 404
TEST: pytest products/tests/test_views.py::TestReviewListView -x -q ✓ 4 passed
RISK: T2 · senior-engineer · new API endpoint
```

---

## Usage flow 2 — DB schema change (db-guard escalation, Tier 3)

**Input**

```text
Add a "featured" boolean field to the Product model
```

**Auto-routing:** DB schema signal → `db-guard`

**Output**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: products.Product.featured BooleanField nullable=False default=False
Risk: low — additive column with default; existing rows get False
Migration: zero-downtime safe (Django will use DEFAULT in ALTER TABLE)

PLAN
[S] Add field in models.py: featured = models.BooleanField(default=False)
[S] python manage.py makemigrations products --name add_featured_to_product
[S] Review generated migration for correctness
[S] Deploy migration before code that reads the field
[S] Update ProductSerializer to include 'featured' field

Approve to proceed?
```

---

## Usage flow 3 — Security review on ViewSet

**Input**

```text
Review the OrderViewSet — make sure users can only see their own orders
```

**Auto-routing:** `security-review` skill (auth/ownership check requested)

**Output**

```text
SECURITY REVIEW — OrderViewSet

FINDING 1: HIGH | orders/views.py:23 | get_queryset() returns Order.objects.all() — no user filter
  Fix: return Order.objects.filter(user=self.request.user)

FINDING 2: MEDIUM | orders/views.py:41 | retrieve() calls get_object_or_404(Order, pk=pk) — no ownership check
  Fix: use get_object_or_404(Order, pk=pk, user=self.request.user) or override get_queryset() (preferred)

FINDING 3: LOW | orders/serializers.py:15 | user field in OrderSerializer is writable
  Fix: add read_only_fields = ['user'] to Meta class; set user from request in perform_create()

SEVERITY: HIGH (IDOR) — fix before deploying
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| Endpoint bug fix | bug-hunter | sonnet | ~$0.02 |
| New DRF endpoint | senior-engineer | sonnet | ~$0.04 |
| DB schema change | db-guard → senior-engineer | opus → sonnet | ~$0.18 |
| Security review | security-guard | opus | ~$0.15 |
| Serializer/test | senior-engineer | sonnet | ~$0.03 |
| Dep audit | security-scanner | sonnet | ~$0.04 |
