## Kafka

- Topic names: `{domain}.{event}` (e.g. `order.payment.completed`)
- Partition by entity ID for ordered-per-entity processing
- `allowAutoTopicCreation: false` in production
- Always check idempotency (at-least-once = duplicates will occur)
- Dead-letter topic: `{topic}.dlq` — alert on DLQ messages
- Consumer group ID: `{service-name}-{topic}` — one per consuming service
- Same group = competing consumers | Different group = independent consumers
- Graceful shutdown: `await consumer.disconnect()` on SIGTERM
- Schema evolution: add before remove; bump `version` field on breaking changes
