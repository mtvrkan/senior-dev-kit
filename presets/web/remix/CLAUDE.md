# Project Preset — Remix

## Architecture

- Loaders handle server-side data fetching — keep them thin, delegate to service layer.
- Actions handle mutations — validate all inputs server-side with zod or similar.
- Do not use `useEffect` for data fetching — use loaders.
- Respect nested routing and outlet structure — do not flatten routes unnecessarily.
- `root.tsx` and error boundaries are protected — do not modify unless explicitly requested.

## Data / server behavior

- All data fetching in `loader` functions, all mutations in `action` functions.
- Validate and sanitize all action inputs before processing.
- Never expose stack traces, DB errors, or secrets to the client via `json()`.
- Use `defer()` only for genuinely non-critical data.
- Session handling through Remix's `createCookieSessionStorage` — do not roll custom session logic.

## UI

- Use `<Form>` component for mutations — not raw HTML forms or fetch calls.
- `useFetcher` for non-navigating mutations (inline forms, optimistic UI).
- Handle pending states: `useNavigation`, `useFetcher.state`.
- Progressive enhancement: forms should work without JS where possible.

## Performance

- Avoid loading data in components — keep it in loaders.
- Use `shouldRevalidate` to prevent unnecessary reloads.
- Watch for waterfall loader chains in nested routes.

## Verification

- `remix typecheck` / `tsc --noEmit`
- `remix build`
- `eslint`

## Anti-patterns

- Data fetching in `useEffect`.
- Unvalidated action inputs.
- Error details leaked to client via json response.
- Flattening nested routes for convenience.
