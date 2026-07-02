# Database Preset — Supabase

## Architecture

- Treat Supabase as PostgreSQL + Auth + RLS.
- Use Row Level Security intentionally — every table must have RLS enabled with policies; never disable RLS to "fix a bug."
- Keep service-role keys server-side only — never in client code or committed `.env`.
- Do not expose privileged operations to the client.

## Data / security

- Validate inputs server-side for privileged operations.
- Review policies for user-owned resources; `auth.uid()` in a policy is authoritative.
- Test SELECT, INSERT, UPDATE, DELETE policies separately — use `SET LOCAL ROLE authenticated` to impersonate a user in `psql` when testing.
- Prefer additive migrations: `supabase migration new` or `supabase db push`, routed through the db-guard skill.
- Use indexes based on query patterns — Supabase wraps Postgres, so every FK column still needs an index.
- Queries: use the Supabase JS `.from().select().eq()` API — never string-interpolated SQL in an RPC; always parameterized.
- Edge Functions: verify the `Authorization` header on every function — never trust a client-sent user identity.
- Storage: set bucket policies; validate file type and size server-side; never trust client-supplied upload metadata.

## Anti-patterns

- Disabling RLS without a plan.
- Using the service role key in client code.
- Relying on UI-only authorization.
- Missing INSERT policy (silently blocks writes).
- Unvalidated file uploads.
