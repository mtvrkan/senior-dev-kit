# Project Preset — Supabase

## The one rule that matters

**The anon key is public.** It ships in the browser bundle by design. The only thing standing
between a stranger and every row in your database is Row Level Security. A table with RLS
disabled — or with a policy of `using (true)` — is a public API, whatever the client code does.

```sql
alter table public.posts enable row level security;   -- required on EVERY table

create policy "owner reads own posts"
  on public.posts for select
  using ( (select auth.uid()) = user_id );

create policy "owner writes own posts"
  on public.posts for insert
  with check ( (select auth.uid()) = user_id );
```

- `using` filters existing rows (select/update/delete); `with check` validates the incoming row
  (insert/update). An insert policy without `with check` lets a user write a row owned by someone
  else.
- Wrap `auth.uid()` as `(select auth.uid())` — it is then evaluated once per query instead of once
  per row, which is the difference between a fast and an unusable table at scale.
- The **service-role key bypasses RLS entirely**. It belongs only in a server environment
  (server route, edge function, worker) — never in a client bundle, never in `NEXT_PUBLIC_*`.

Verify, don't assume:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- any row with rowsecurity = false is publicly readable via the anon key
```

## Schema and migrations

- Migrations live in `supabase/migrations/` and are checked in. Never edit schema through the
  dashboard on a project that has migrations — the two diverge silently.
- `supabase db diff -f <name>` to capture local changes; `supabase db push` to apply.
- Schema changes are Tier 3 (see `rules/500-database.md`) — plan first, expand-then-contract.
- Generate types after every schema change or the client lies to you:
  `supabase gen types typescript --local > src/types/database.ts`.

## Auth

- `supabase.auth.getUser()` on the server validates the JWT with the auth server.
  `getSession()` reads unverified local storage — never trust it for an authorization decision.
- Email confirmation on, and a real redirect allowlist. `*` in the redirect list is an account
  takeover vector.
- Row-level ownership uses `auth.uid()`, not a `user_id` value the client supplies.

## Queries

```ts
// Select only what's needed — `select('*')` over a joined table is a common slow path
const { data, error } = await supabase
  .from('posts')
  .select('id, title, author:profiles(id, name)')
  .eq('published', true)
  .order('created_at', { ascending: false })
  .range(0, 19)          // always paginate; the default cap will surprise you

if (error) throw new AppError(error.message)   // never ignore `error` — data is null on failure
```

Both `data` and `error` come back on every call. Checking only `data` swallows failures.

## Edge functions and realtime

- Edge functions run on Deno: `Deno.env.get()`, web APIs only, no Node built-ins.
- Realtime subscriptions respect RLS, but a channel left subscribed on unmount leaks — clean up
  in the effect's teardown.
- Storage buckets have their own policies, separate from table RLS. A public bucket is public.

## Verification

```bash
supabase start                     # local stack
supabase db reset                  # replay migrations from scratch — catches broken ordering
supabase gen types typescript --local > src/types/database.ts
supabase db lint                   # includes RLS-disabled warnings
```

## Anti-patterns

- A table without `enable row level security`, or a policy of `using (true)`.
- Service-role key anywhere reachable from the browser.
- `getSession()` used for an authorization decision on the server.
- Trusting a client-supplied `user_id` instead of `auth.uid()`.
- Ignoring the `error` half of the response.
- Schema edited in the dashboard while `supabase/migrations/` exists.
- `select('*')` with nested relations on a hot path.
- Stale generated types after a schema change.
