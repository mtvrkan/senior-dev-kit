# Project Preset — ASP.NET Core (C#)

## Architecture

- Minimal APIs or controllers — pick one per project and stay with it.
- Endpoint → service → repository/`DbContext`. Business rules live in services.
- DTOs (usually `record`s) at the boundary. An EF entity is never a request or response body.
- Dependency injection through the constructor; register lifetimes deliberately
  (`AddScoped` for anything touching `DbContext`, never `AddSingleton`).

```csharp
[ApiController]
[Route("api/v1/users")]
public sealed class UsersController(IUserService users) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult<UserResponse>> Create(CreateUserRequest body, CancellationToken ct)
    {
        var created = await users.CreateAsync(body, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> Get(Guid id, CancellationToken ct)
        => await users.GetOwnedAsync(id, User.GetUserId(), ct) is { } u ? Ok(u) : NotFound();
}
```

`CancellationToken` on every async endpoint and every async service method — a cancelled request
should stop doing work.

## Validation

```csharp
public sealed record CreateUserRequest(
    [property: Required, EmailAddress, MaxLength(255)] string Email,
    [property: Required, MinLength(1), MaxLength(100)] string Name);
```

`[ApiController]` turns model-state failures into an automatic 400 with a `ProblemDetails` body.
For rules beyond attributes, use FluentValidation — not `if` chains inside the endpoint.

## Security — the protected area

`Program.cs`, `Startup.cs`, `appsettings*.json`, JWT bearer config and any `[Authorize]` policy
are Tier 3: plan first.

- `[Authorize]` alone is authentication plus role, not ownership. Check the owning user id in
  the service or it is an IDOR.
- Secrets come from user-secrets / Key Vault / environment — never from a committed
  `appsettings.json`.
- Passwords via ASP.NET Identity's hasher or Argon2. Never `BinaryFormatter`, never
  `TypeNameHandling.All` in a serializer — both are remote code execution.

## EF Core — N+1, tracking, transactions

```csharp
// WRONG — N+1
foreach (var o in db.Orders.ToList()) Console.WriteLine(o.Customer.Name);

// RIGHT — projection (best) or Include
var rows = await db.Orders
    .Where(o => o.Status == status)
    .Select(o => new OrderRow(o.Id, o.Customer.Name))   // only the columns needed
    .AsNoTracking()
    .ToListAsync(ct);
```

- `AsNoTracking()` on every read-only query.
- `FromSqlRaw` with interpolation is SQL injection — use `FromSqlInterpolated` or parameters.
- Migrations are Tier 3: `dotnet ef migrations add` is a schema change, plan first.

## Errors — one place, ProblemDetails out

```csharp
app.UseExceptionHandler();                   // + AddProblemDetails()
// Domain failures: return typed results, not exceptions, for expected paths.
```

Never return `ex.ToString()`. `DeveloperExceptionPage` is development-only.

## Async

- `async` all the way — never `.Result` or `.Wait()`, they deadlock and hide exceptions.
- `Task.WhenAll` for independent calls; sequential `await` only when there's a dependency.
- `IAsyncEnumerable<T>` for streaming large result sets.

## Logging

```csharp
logger.LogInformation("User created {UserId}", user.Id);   // structured template
```

Never interpolate into the message template (defeats structured logging), and never log tokens,
passwords, connection strings or full request bodies.

## Verification

```bash
dotnet test --filter "FullyQualifiedName~UserServiceTests"   # targeted
dotnet build                                                  # compile check
dotnet format --verify-no-changes                             # style
dotnet ef migrations list                                     # confirm migration state
```

## Anti-patterns

- Returning an EF entity from an endpoint.
- `.Result` / `.Wait()` / `async void` outside an event handler.
- Missing `AsNoTracking()` on read queries; missing `CancellationToken` on async paths.
- `[Authorize]` treated as an ownership check.
- `BinaryFormatter`, or `TypeNameHandling` other than `None`.
- `catch (Exception) { }`, or catching and rethrowing with `throw ex;` (resets the stack — use `throw;`).
- `AddSingleton` for anything holding a `DbContext`.
