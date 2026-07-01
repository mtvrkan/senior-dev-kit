# API Preset — GraphQL

## Schema

- Schema is the contract — treat it as a protected area. Do not change types, fields, or nullability without explicit request.
- Prefer additive schema changes: add fields/types before removing.
- Use deprecation (`@deprecated`) before removing fields — allow a migration window.
- Nullability decisions are intentional; do not change non-null to nullable or vice versa without impact analysis.

## Resolvers

- Keep resolvers thin — delegate business logic to service/use-case layer.
- Validate and sanitize all input arguments.
- Check authorization per field or type where sensitivity demands it — not just at the top-level query.
- Never expose internal error details in GraphQL errors — use generic messages for clients.

## Performance

- Use DataLoader (or equivalent) for all N+1 patterns — do not resolve related entities in a loop.
- Implement query complexity and depth limits to prevent abusive queries.
- Use field-level caching where appropriate; invalidate on mutation.
- Avoid over-fetching in resolvers — select only needed DB fields.

## Security

- Disable introspection in production unless explicitly required.
- Rate-limit mutation endpoints.
- Validate file upload size and type if schema supports uploads.
- Never expose raw DB IDs if they carry privilege — use opaque or encoded IDs.

## Verification

- Schema linting: `graphql-inspector` or `eslint-plugin-graphql`
- `graphql-codegen` for type generation after schema change
- Run existing resolver tests

## Subscriptions (real-time)

Use GraphQL subscriptions only when: client needs push (not polling) AND data changes are user-specific or infrequent.
For high-frequency broadcasts prefer SSE or a dedicated WebSocket channel.

```typescript
// Schema
type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  newMessage(roomId: ID!): Message!
}

// Resolver (graphql-ws + Redis pub-sub)
import { PubSub } from 'graphql-subscriptions'
import { RedisPubSub } from 'graphql-redis-subscriptions'  // multi-server

const pubsub = new RedisPubSub({ publisher: redisPublisher, subscriber: redisSubscriber })

export const resolvers = {
  Subscription: {
    orderStatusChanged: {
      // Authenticate before subscribing
      subscribe: withFilter(
        () => pubsub.asyncIterator('ORDER_STATUS_CHANGED'),
        (payload, args, context) => {
          if (!context.user) throw new Error('Unauthorized')
          return payload.orderStatusChanged.id === args.orderId
            && payload.orderStatusChanged.userId === context.user.id  // ownership check
        },
      ),
    },
  },
  Mutation: {
    updateOrderStatus: async (_, { orderId, status }, ctx) => {
      const order = await orderService.updateStatus(orderId, status, ctx.user)
      await pubsub.publish('ORDER_STATUS_CHANGED', { orderStatusChanged: order })
      return order
    },
  },
}
```

Subscription security checklist:

- [ ] Auth check in `subscribe` function — not just HTTP middleware
- [ ] Ownership/scope filter via `withFilter` — never send one user's data to another
- [ ] Complexity limits apply to subscription queries too
- [ ] Unsubscribe on connection close (memory leak prevention)

## Anti-patterns

- Business logic in resolvers.
- Resolving related entities without DataLoader.
- Introspection enabled in production.
- Authorization checked only at query root, not field level.
- Returning raw internal error messages to clients.
- Subscriptions without ownership filter (broadcasts to wrong users).
- In-memory PubSub for subscriptions in multi-server deployments (use Redis).
