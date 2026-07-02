## WebSocket / SSE

- Authenticate on upgrade/connection — not after handshake
- Token in auth header or initial message — not URL (logs exposure)
- All messages JSON envelope: `{type, payload, requestId}`
- Max payload: `maxPayload: 64 * 1024` (64KB)
- Rate-limit messages per connection; disconnect on abuse
- Heartbeat/ping every 30s — detect dead connections
- Multi-server: Redis pub-sub for cross-instance broadcast
- Room join: validate authorization before `socket.join(roomId)`
- SSE: prefer over WebSocket for server-push-only use cases
- Sanitize all outgoing data — never echo raw user input to other users
