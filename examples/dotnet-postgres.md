# Worked Example — .NET 8 API + PostgreSQL + EF Core

Complete bootstrap walkthrough for a .NET Web API project.

---

## Stack detection

```text
*.csproj contains: Microsoft.AspNetCore.OpenApi, Npgsql.EntityFrameworkCore.PostgreSQL, MediatR
Detected: .NET 8 API + PostgreSQL + EF Core
```

Presets selected: `backend/dotnet-api` · `database/postgres`

---

## Step 1 — Files copied to `.claude/`

```text
.claude/
├── CLAUDE.md                    ← presets/backend/dotnet-api/CLAUDE.md
├── settings.json                ← deny list + subagent model
├── rules/
│   ├── 000-security.md          ← always active (passive scan, OWASP 2025)
│   ├── 001-conventions.md       ← always active
│   ├── 200-api.md               ← **/Controllers/**, **/Endpoints/**
│   ├── 300-testing.md           ← **/*.Tests/**
│   ├── 500-database.md          ← **/Migrations/**
│   └── 700-observability.md     ← **/*.cs
├── skills/                      ← all 33 skills
├── agents/                      ← all 17 agents
└── agent_docs/                  ← all 15 reference docs
```

---

## Step 2 — Auto-generated `stack-rules.md`

```markdown
# Stack Rules — .NET 8 API + PostgreSQL + EF Core

## preset: backend/dotnet-api

### Architecture
- Layered: Controller → Service/Handler → Repository → DbContext
- DTOs for all API boundaries — never return EF entities directly
- FluentValidation or DataAnnotations for input; ProblemDetails (RFC 7807) for errors
- EF Core: async APIs only (ToListAsync, FindAsync); no tracking for read-only queries

### Commands
- TEST_CMD: dotnet test --filter "~ClassName" --no-build
- BUILD_CMD: dotnet build
- LINT_CMD: dotnet format --verify-no-changes
- PKG_MANAGER: dotnet (NuGet)
```

---

## Usage flow 1 — New endpoint (senior-engineer, Tier 2)

**Input**

```text
Add a GET /api/orders/{id}/items endpoint that returns the line items for an order
```

**Auto-routing:** `senior-engineer` (new endpoint + DTO boundary = Tier 2)

**Output (plan)**

```text
PLAN: order items endpoint — 4 files
∙ Models/OrderItem.cs — DTO: OrderItemDto { Id, ProductName, Quantity, UnitPrice, Total }
∙ Repositories/OrderRepository.cs — add GetOrderWithItemsAsync(Guid id, Guid userId)
∙ Services/OrderService.cs — add GetOrderItemsAsync(id, userId) with ownership check
∙ Controllers/OrdersController.cs — add GET {id}/items → service → 200/404
OK to proceed?
```

**After approval**

```typescript
∙ Models/DTOs/OrderItemDto.cs:1 — record OrderItemDto with computed Total property
∙ Repositories/OrderRepository.cs:67 — GetOrderWithItemsAsync with Include(o => o.Items).AsNoTracking()
∙ Services/OrderService.cs:43 — ownership check: order.UserId != userId → throw ForbiddenException
∙ Controllers/OrdersController.cs:89 — [HttpGet("{id}/items")] with [Authorize] attribute
∙ Tests/OrdersControllerTests.cs — 4 cases: items list, not found 404, wrong user 403, unauthorized 401
TEST: dotnet test --filter "OrdersControllerTests" ✓ 4 passed
RISK: T2 · senior-engineer · new API endpoint + DTO
```

---

## Usage flow 2 — EF Core migration (db-guard, Tier 3)

**Input**

```text
Add a Notes column to the Orders table
```

**Auto-routing:** EF migration signal → `db-guard`

**Output**

```text
ESCALATE TO: db-guard — EF Core migration detected

DB CHANGE REVIEW
Change: Orders.Notes VARCHAR(500) nullable
Risk: low — nullable column, additive migration, no backfill needed
EF behavior: generates ALTER TABLE ADD COLUMN — safe on PostgreSQL

PLAN
[S] Order.cs model — add Notes property: public string? Notes { get; set; }
[S] dotnet ef migrations add AddNotesToOrders
[S] Review generated migration — verify only ADD COLUMN, no destructive ops
[S] dotnet ef database update (dev); in prod: apply via CI/CD before code deploy
[S] OrderDto.cs — add Notes field to API response if needed

Approve to proceed?
```

---

## Usage flow 3 — Security review on controller

**Input**

```text
Review the PaymentsController — make sure it's secure
```

**Auto-routing:** payment keyword → `security-guard` (Tier 3)

**Output**

```text
ESCALATE TO: security-guard — payment logic touched

SECURITY REVIEW — Controllers/PaymentsController.cs

FINDING 1: CRITICAL | PaymentsController.cs:34 | Payment amount taken from request body
  Fix: calculate amount server-side from order total — never trust client-provided amount

FINDING 2: HIGH | PaymentsController.cs:51 | No idempotency key check — duplicate payment risk
  Fix: check idempotency key (X-Idempotency-Key header) against processed payments table

FINDING 3: HIGH | PaymentsController.cs:67 | PaymentId from URL (/payments/{id}/capture)
  without ownership verification — any user can capture any payment
  Fix: add WHERE UserId = currentUserId to payment lookup

FINDING 4: LOW | PaymentsController.cs:19 | Stripe secret key logged on error
  Fix: remove secret from error log; use logger.LogError(ex, "Payment failed for orderId {OrderId}", orderId)

SEVERITY: CRITICAL — do not deploy without fixes
```

---

## Per-task cost estimates

| Task type | Agent | Model | Est. cost |
| --- | --- | --- | --- |
| Controller bug fix | bug-hunter | sonnet | ~$0.02 |
| New endpoint + DTO | senior-engineer | sonnet | ~$0.05 |
| EF Core migration | db-guard → senior-engineer | opus → sonnet | ~$0.18 |
| Payment security review | security-guard | opus | ~$0.20 |
| Test addition | test-engineer | sonnet | ~$0.03 |
| Dep audit | security-scanner | sonnet | ~$0.04 |
