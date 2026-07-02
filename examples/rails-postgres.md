# Worked Example — Rails 7 + PostgreSQL

Complete bootstrap walkthrough for a Ruby on Rails API or full-stack project.

---

## Stack detection

```text
Gemfile contains: rails, pg, devise, pundit
Detected: Rails 7 + PostgreSQL
```

Presets selected: `backend/rails` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/rails/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active
│   ├── 200-api.md               ← **/controllers/**, **/routes/**
│   ├── 300-testing.md           ← spec/**
│   ├── 500-database.md          ← db/migrate/**
│   └── 700-observability.md     ← **/*.rb
├── skills/                      ← all 33 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — Rails 7 + PostgreSQL

## preset: backend/rails

### Architecture
- MVC: routes → controller (thin) → service object / model → view / serializer
- Strong params on every controller action that accepts input — never params.permit!
- Pundit policies for all protected resources; rescue_from Pundit::NotAuthorizedError
- N+1: use .includes(:relation) or .preload — Bullet gem if configured will catch these

### Commands
- TEST_CMD: bundle exec rspec spec/{file}_spec.rb
- LINT_CMD: bundle exec rubocop
- DB_MIGRATE: bin/rails db:migrate
- PKG_MANAGER: bundler
```

---

## Usage flow 1 — New controller action (senior-engineer, Tier 2)

**Input**

```text
Add a POST /api/products/:id/publish endpoint to publish a product draft
```

**Auto-routing:** `senior-engineer` (new endpoint + state change = Tier 2)

**Output (plan)**

```text
PLAN: publish product action — 3 files
∙ config/routes.rb — add member action :publish under resources :products
∙ app/controllers/api/products_controller.rb — add publish action with strong params + Pundit authorize
∙ app/policies/product_policy.rb — add publish? method: admin or product.user == current_user
OK to proceed?
```

**After approval**

```text
∙ config/routes.rb:18 — member { post :publish } added inside resources :products
∙ app/controllers/api/products_controller.rb:67 — publish action with authorize + product.update!(status: 'published')
∙ app/policies/product_policy.rb:34 — publish? delegates to update? (owner or admin)
∙ spec/controllers/api/products_controller_spec.rb — 4 cases added
TEST: bundle exec rspec spec/controllers/api/products_controller_spec.rb -e "publish" ✓ 4 passed
RISK: T2 · senior-engineer · new API endpoint
```

---

## Usage flow 2 — DB migration (migration-guard, Tier 3)

**Input**

```text
Add a published_at timestamp to products
```

**Auto-routing:** DB schema signal → `db-guard` (hands off to `migration-guard` for the migration file)

**Output**

```text
ESCALATE TO: db-guard — schema change detected

DB CHANGE REVIEW
Change: products.published_at TIMESTAMPTZ nullable
Risk: low — additive nullable column; zero-downtime on PostgreSQL
Indexes: consider index on published_at if queried frequently by date range

PLAN
[S] bin/rails generate migration AddPublishedAtToProducts published_at:datetime
[S] Review migration: add_column :products, :published_at, :datetime
[S] Optional: add_index :products, :published_at (if WHERE published_at IS NOT NULL queries exist)
[S] bin/rails db:migrate
[S] Update publish action to set published_at: Time.current

Approve to proceed?
```

---

## Usage flow 3 — Authorization review

**Input**

```text
Review the ProductsController — are there any authorization gaps?
```

**Auto-routing:** `safe-review` skill (auth/ownership review)

**Output**

```text
SECURITY REVIEW — app/controllers/api/products_controller.rb

FINDING 1: HIGH | products_controller.rb:14 | index action missing Pundit policy scope
  Fix: @products = policy_scope(Product) — never Product.all in authorized context

FINDING 2: HIGH | products_controller.rb:28 | update action checks authorize(@product) but
  set_product calls Product.find(params[:id]) — any user can update any product's ID
  Fix: scope set_product to current user: Product.where(user: current_user).find(params[:id])

FINDING 3: LOW | products_controller.rb:45 | No rescue_from Pundit::NotAuthorizedError
  Fix: add to ApplicationController: rescue_from Pundit::NotAuthorizedError, with: :forbidden_response

SEVERITY: HIGH — IDOR on update action (any user can modify any product)
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| View/template bug | bug-hunter | sonnet | ~$0.02 |
| New controller action | senior-engineer | sonnet | ~$0.04 |
| DB migration | db-guard → senior-engineer | opus → sonnet | ~$0.17 |
| Security/auth review | security-guard | opus | ~$0.13 |
| RSpec test suite | test-engineer | sonnet | ~$0.03 |
| Dep audit | security-scanner | sonnet | ~$0.04 |
