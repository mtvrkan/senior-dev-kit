# Project Preset — Kafka (Event Streaming)

## When Kafka, when not

Use Kafka: multiple consumers for same event | replay needed | audit trail | cross-service events | throughput > 10k msg/s
Use BullMQ/Redis: single consumer job queues | simpler retry logic | < 10k msg/s

## Topic naming

```json
{domain}.{event}             # user.registered
{domain}.{entity}.{action}   # order.payment.completed
{env}.{domain}.{event}       # prod.user.registered   (prefix for env separation)
```

Partitions: partition by entity ID (userId, orderId) for ordered processing per entity.

## Producer — KafkaJS

```typescript
import { Kafka, CompressionTypes, logLevel } from 'kafkajs'

const kafka = new Kafka({
  clientId: process.env.SERVICE_NAME,
  brokers: process.env.KAFKA_BROKERS!.split(','),
  ssl: process.env.NODE_ENV === 'production',
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'scram-sha-512',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD!,
  } : undefined,
  logLevel: logLevel.WARN,
})

const producer = kafka.producer({
  allowAutoTopicCreation: false,  // topics must be pre-created in prod
  transactionTimeout: 30000,
})
await producer.connect()

// Event envelope — consistent shape across all events
interface DomainEvent<T = unknown> {
  id: string          // UUID for idempotency
  type: string        // 'user.registered'
  version: number     // schema version — start at 1
  occurredAt: string  // ISO 8601
  payload: T
  metadata?: { correlationId?: string; userId?: string }
}

async function publishEvent<T>(topic: string, event: DomainEvent<T>, key: string) {
  await producer.send({
    topic,
    compression: CompressionTypes.GZIP,
    messages: [{
      key,           // partition key — e.g. userId for ordered per-user processing
      value: JSON.stringify(event),
      headers: { 'event-type': event.type, 'event-version': String(event.version) },
    }],
  })
}
```

## Consumer — at-least-once delivery

```typescript
const consumer = kafka.consumer({
  groupId: `${process.env.SERVICE_NAME}-${topicName}`,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
})
await consumer.connect()
await consumer.subscribe({ topic: topicName, fromBeginning: false })

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value!.toString())

    // IDEMPOTENCY CHECK — always, because at-least-once means duplicates happen
    const alreadyProcessed = await db.processedEvent.findUnique({ where: { id: event.id } })
    if (alreadyProcessed) return

    try {
      await processEvent(event)
      await db.processedEvent.create({ data: { id: event.id, processedAt: new Date() } })
    } catch (err) {
      // Dead-letter: after exhausting retries, send to DLQ topic
      if (shouldDeadLetter(err)) {
        await producer.send({ topic: `${topic}.dlq`, messages: [{ value: message.value! }] })
        return  // ack the original to avoid infinite loop
      }
      throw err  // re-throw to trigger Kafka retry (pause + resume partition)
    }
  },
})
```

## Consumer groups — scaling

```text
Same group ID = competing consumers (each message processed ONCE, load balanced)
Different group ID = independent consumers (each message processed by ALL groups)

Example:
  order.payment.completed → email-service consumer group  (send receipt)
  order.payment.completed → inventory-service consumer group  (update stock)
  → Both get every message independently
```

## Schema evolution

- Add fields: safe (consumers ignore unknown fields)
- Remove fields: breaking — bump event `version` field, maintain both versions
- Rename fields: breaking — add new field first, deprecate old, remove after all consumers updated
- Use Schema Registry (Confluent) for large teams to enforce compatibility

## Dead Letter Queue (DLQ)

Every consumer must define a DLQ topic: `{original-topic}.dlq`
DLQ messages must include original headers + error reason + timestamp.
Alert on DLQ messages — they represent processing failures.

## Graceful shutdown

```typescript
process.on('SIGTERM', async () => {
  await consumer.disconnect()
  await producer.disconnect()
})
```

## Anti-patterns

- `allowAutoTopicCreation: true` in production (creates topics with wrong partition count)
- No idempotency check (at-least-once = duplicates will happen)
- Committing offset before processing succeeds (message loss on crash)
- One partition (no parallelism)
- Putting full objects in events (store in DB, put reference in event)
- Mixing produce and consume in the same `kafka.producer()` instance
