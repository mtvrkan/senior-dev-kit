# Worked Example — Laravel + MySQL

Complete bootstrap walkthrough for a Laravel API / Filament admin project.

---

## Stack detection

```text
composer.json contains: laravel/framework, filament/filament, doctrine/dbal
.env contains: DB_CONNECTION=mysql
Detected: Laravel + Filament + MySQL
```

Presets selected: `backend/laravel` · `database/mysql`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/laravel/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active
│   ├── 200-api.md               ← **/api/**, **/Http/Controllers/**
│   ├── 300-testing.md           ← **/tests/**
│   ├── 500-database.md          ← **/migrations/**
│   └── 700-observability.md     ← **/*.php
├── skills/                      ← all 32 skills
├── agents/                      ← all 14 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Laravel + MySQL

## preset: backend/laravel

### Architecture
- Detect frontend: Filament (admin), Inertia+React, Livewire, or Blade+Alpine
- Route → FormRequest (validate) → Controller → Service/Action → Model
- Policies for all protected resources; $fillable in every model (mass assignment guard)
- N+1: use with(['relation']) eager loading; never lazy in loops

### Commands
- TEST_CMD: php artisan test --filter Name
- LINT_CMD: ./vendor/bin/pint
- TYPE_CMD: phpstan analyse (if configured)
- PKG_MANAGER: composer

### Protected files (escalate before touching)
- config/auth.php → security-guard
- database/migrations/ → migration-guard
- .env → never read or modify
```

---

## Usage flow 1 — New Filament Resource (senior-engineer, Tier 2)

**Input**

```text
Add a Products resource to the Filament admin panel with list, create, and edit
```

**Auto-routing:** `senior-engineer` (new Filament Resource = multi-file feature = Tier 2)

**Output (plan)**

```text
PLAN: Filament Products resource — 3 files
∙ App/Filament/Resources/ProductResource.php — TextColumn(name/price/status), TextInput+Select form
∙ App/Filament/Resources/ProductResource/Pages/{ListProducts,CreateProduct,EditProduct}.php — generated
∙ App/Policies/ProductPolicy.php — view/create/update/delete checks against auth()->user()->role
OK to proceed?
```

**After approval**

```text
∙ app/Filament/Resources/ProductResource.php:1 — TextColumn(id, name, price, status, created_at) + filters
∙ app/Filament/Resources/ProductResource.php:45 — Forms: TextInput(name required), TextInput(price numeric), Select(status)
∙ app/Policies/ProductPolicy.php:1 — admin-only create/delete; owner update via $product->user_id === $user->id
∙ app/Models/Product.php:12 — added to AuthServiceProvider policy map
TEST: php artisan test --filter ProductResourceTest ✓ 5 passed
RISK: T2 · senior-engineer · new Filament resource + Policy
```

---

## Usage flow 2 — DB migration with guard (db-guard, Tier 3)

**Input**

```text
Add a discount_percent column to products table
```

**Auto-routing:** DB schema signal → `db-guard` (hands off to `migration-guard` for the migration file)

**Output**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: products.discount_percent DECIMAL(5,2) nullable
Risk: low — nullable column; no default needed; existing rows get NULL
Migration type: additive — zero-downtime safe on MySQL InnoDB

PLAN
[S] php artisan make:migration add_discount_percent_to_products_table
[S] Migration: $table->decimal('discount_percent', 5, 2)->nullable()->after('price');
[S] Review: no large table lock risk (MySQL InnoDB instant ADD COLUMN for nullable)
[S] Update Product $fillable to include 'discount_percent'
[S] Update ProductResource form to include TextInput for discount_percent

Approve to proceed?
```

---

## Usage flow 3 — Mass assignment vulnerability found

**Input**

```text
Review the OrderController — is it vulnerable to mass assignment?
```

**Auto-routing:** `safe-review` skill → auth/security pattern = `security-guard`

**Output**

```text
SECURITY REVIEW — App/Http/Controllers/OrderController.php

FINDING 1: CRITICAL | OrderController.php:28 | Order::create($request->all()) — mass assignment
  Fix: Use FormRequest + Order::create($request->validated()) — never $request->all()
  OR add $fillable = ['product_id', 'quantity', 'notes'] to Order model

FINDING 2: HIGH | OrderController.php:41 | Order::find($id) without ownership check
  Fix: Order::where('id', $id)->where('user_id', auth()->id())->firstOrFail()
  Or: Gate::authorize('view', $order) with OrderPolicy

FINDING 3: MEDIUM | OrderController.php:15 | No permission middleware on OrderController
  Fix: Add middleware('auth') in constructor; add permission check in Policy

SEVERITY: CRITICAL — mass assignment allows users to set arbitrary order fields
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| Blade template bug | bug-hunter | sonnet | ~$0.02 |
| Filament column/form change | ui-fixer | haiku | ~$0.005 |
| New Filament resource | senior-engineer | sonnet | ~$0.05 |
| DB migration | db-guard → senior-engineer | opus → sonnet | ~$0.18 |
| Security review | security-guard | opus | ~$0.15 |
| Dep audit | security-scanner | sonnet | ~$0.04 |
