# Database Preset — Firebase / Firestore

## Modeling

- Design documents around query patterns.
- Avoid deeply nested or unbounded structures.
- Consider read/write costs and index requirements.
- Composite indexes are required for `where().orderBy()` queries — Firestore errors at runtime without them; create via console or `firestore.indexes.json`.

## Security

- Security rules are part of backend security, not optional.
- Do not rely only on client-side checks.
- Validate ownership and roles in rules/functions.
- Always use `request.auth.uid` in rules — never trust `request.resource.data.userId` (client-controlled, spoofable).
- Security rule changes go through the security-guard skill — a rule error can silently block all access.

## Performance

- Avoid broad collection reads.
- Use pagination and indexed queries.
- Be mindful of offline behavior.
- Always `.limit(N)` on collection reads; paginate via cursor (`startAfter(lastDoc)`) — never an unbounded read.
- Writes: use `batch()` for multi-document atomicity (no rollback support) and `transaction()` when a read-then-write needs consistency.
- Web clients: `enableIndexedDbPersistence()` for offline support; handle the offline → reconnect transition explicitly.

## Anti-patterns

- Public client writes without strict rules.
- Large unbounded documents.
- Enforcing paid/free limits only on client.
- Service account key shipped in client code.
