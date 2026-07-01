# Project Preset — .NET API

## Architecture

- Respect controller/minimal API, service, repository, DTO boundaries.
- Use existing dependency injection patterns.
- Keep controllers/endpoints thin.
- Do not modify auth, EF migrations, appsettings, or production config unless requested.

## Security

- Validate inputs.
- Check policies/roles/ownership for protected resources.
- Avoid returning raw exception details.
- Do not expose secrets or connection strings.

## Data

- Keep EF model/migration changes behind DB-change workflow.
- Use async database APIs consistently.
- Watch for N+1 and unnecessary tracking.
- Use transactions for multi-step writes.

## Verification

Use configured commands:

- dotnet test
- dotnet build
- format/analyzers if configured

## Anti-patterns

- Returning EF entities directly when DTOs are used.
- Modifying appsettings for local convenience.
- Mixing business logic into controllers.
