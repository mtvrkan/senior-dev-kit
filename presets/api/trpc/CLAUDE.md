# API Preset — tRPC

## Router structure

- Respect existing router hierarchy — do not restructure routers for a single procedure.
- Keep procedures thin: input validation in zod schema, business logic in service layer.
- Use `publicProcedure` and `protectedProcedure` (or equivalent) correctly — never expose a protected route via `publicProcedure`.
- Do not modify the root router or context factory unless explicitly requested.

## Input validation

- Every procedure must have a zod input schema — no `z.any()` or missing `.input()`.
- Validate and sanitize all inputs before passing to service layer.
- Use `.output()` schema to enforce response shape where type safety is critical.

## Authorization

- Authorization belongs in middleware or at the procedure level — not in the service layer alone.
- Check resource ownership before returning or mutating data.
- `ctx.session` / `ctx.user` from context is the source of truth — never accept user identity from input.

## Performance

- Watch for N+1 in query procedures — batch DB calls when fetching relations.
- Avoid calling multiple procedures from the client where one batched procedure would do.
- Use tRPC's built-in batching for client-side calls.

## Verification

- `tsc --noEmit` — type safety across client/server boundary
- Existing test suite for procedure logic
- `eslint`

## Anti-patterns

- Protected logic in publicProcedure.
- Missing zod input schema.
- Business logic in the procedure handler instead of service.
- Accepting user identity from procedure input instead of context.
- Multiple serial procedure calls where one would suffice.
