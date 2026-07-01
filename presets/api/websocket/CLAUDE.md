# API Preset — WebSocket / Real-time

## Protocol selection

| Need | Solution |
| --- | --- |
| Bidirectional, low-latency | WebSocket (ws / socket.io) |
| Server-to-client only (notifications, feeds) | Server-Sent Events (SSE) |
| Presence, rooms, pub-sub | Socket.IO (wraps WebSocket + fallbacks) |
| Edge/serverless | SSE or Cloudflare Durable Objects |

SSE is simpler and HTTP/2 multiplexes it well — prefer SSE over WebSocket when client doesn't need to send data.

## WebSocket server — ws (Node.js)

```typescript
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { parse } from 'url'

const wss = new WebSocketServer({ noServer: true })

// Authentication — verify token on upgrade, not after
server.on('upgrade', async (req: IncomingMessage, socket, head) => {
  try {
    const { query } = parse(req.url!, true)
    const token = query.token as string
    if (!token) return socket.destroy()

    const user = await verifyToken(token)    // throws if invalid
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user)  // pass user to connection handler
    })
  } catch {
    socket.destroy()  // reject unauthenticated connections
  }
})

// Connection registry (in-memory — use Redis for multi-server)
const clients = new Map<string, WebSocket>()   // userId → socket

wss.on('connection', (ws, req, user: AuthUser) => {
  clients.set(user.id, ws)

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    handleMessage(user, msg, ws)
  })

  ws.on('close', () => clients.delete(user.id))
  ws.on('error', (err) => logger.error({ userId: user.id, err }, 'ws error'))

  // Heartbeat — detect dead connections
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping()
    else { clearInterval(ping); ws.terminate() }
  }, 30000)
})
```

## Message envelope — consistent format

```typescript
// All messages (client → server and server → client) use this shape
interface WsMessage {
  type: string        // 'chat.message' | 'presence.join' | 'error'
  requestId?: string  // echo back for client-side response matching
  payload: unknown
}

// Never send raw strings — always JSON envelope
function send(ws: WebSocket, type: string, payload: unknown, requestId?: string) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type, payload, requestId }))
}
```

## Server-Sent Events (SSE)

```typescript
// Express SSE endpoint
app.get('/events', authenticate, (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')  // disable nginx buffering
  res.flushHeaders()

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'connected', userId: req.user.id })}\n\n`)

  // Subscribe to user's events (Redis pub-sub or EventEmitter)
  const unsubscribe = eventBus.subscribe(req.user.id, (event) => {
    res.write(`id: ${event.id}\n`)
    res.write(`event: ${event.type}\n`)
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`)
  })

  // Heartbeat (prevent proxy timeout)
  const heartbeat = setInterval(() => res.write(':ping\n\n'), 20000)

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})
```

## Multi-server pub-sub (Redis adapter)

```typescript
// When running multiple Node.js instances, use Redis to broadcast
import { createClient } from 'redis'

const publisher  = createClient({ url: process.env.REDIS_URL })
const subscriber = createClient({ url: process.env.REDIS_URL })
await subscriber.connect()
await publisher.connect()

// Subscribe to channel for this server's users
await subscriber.subscribe('ws:broadcast', (message) => {
  const { userId, type, payload } = JSON.parse(message)
  const ws = clients.get(userId)
  if (ws) send(ws, type, payload)
})

// Publish from anywhere (any server instance picks it up)
async function broadcastToUser(userId: string, type: string, payload: unknown) {
  await publisher.publish('ws:broadcast', JSON.stringify({ userId, type, payload }))
}
```

## Rooms / channels (Socket.IO)

```typescript
import { Server } from 'socket.io'
const io = new Server(server)

io.use(async (socket, next) => {
  try {
    socket.data.user = await verifyToken(socket.handshake.auth.token)
    next()
  } catch { next(new Error('Unauthorized')) }
})

io.on('connection', (socket) => {
  const user = socket.data.user

  socket.on('room:join', (roomId: string) => {
    // Validate user has access to room before joining
    if (!canJoinRoom(user, roomId)) return socket.emit('error', { code: 'FORBIDDEN' })
    socket.join(roomId)
    socket.to(roomId).emit('room:user-joined', { userId: user.id })
  })

  socket.on('chat:send', (data: { roomId: string; text: string }) => {
    // Validate user is in room
    if (!socket.rooms.has(data.roomId)) return
    const message = { id: uuid(), userId: user.id, text: data.text, at: new Date() }
    io.to(data.roomId).emit('chat:message', message)
  })
})
```

## Security checklist

- [ ] Auth on upgrade/connection (not after handshake)
- [ ] Rate limit messages per connection: track msg count per second, disconnect on abuse
- [ ] Validate all message types — treat WebSocket input like HTTP request body
- [ ] Max message size: `wss = new WebSocketServer({ maxPayload: 64 * 1024 })` (64KB)
- [ ] No room join without authorization check
- [ ] Sanitize outgoing data — never echo raw user input to other users without sanitization
- [ ] Disable WebSocket compression for encrypted payloads (permessage-deflate vulnerability)

## Anti-patterns

- Token in URL query param stored in server logs (use header in upgrade or initial auth message)
- Broadcasting to all clients without auth check (exposure of other users' data)
- No heartbeat/ping (dead connections accumulate, memory leak)
- Synchronous handlers blocking the event loop (use async/await)
- Single-server session store without Redis (WebSocket state lost on restart/scale)
- Sending large binary data over WebSocket (use presigned URL + S3 instead)
