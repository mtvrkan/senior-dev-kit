# Project Preset — BullMQ (Job Queues)

## When to use a job queue

Use BullMQ when: operation > 200ms | must survive server restart | needs retry on failure | multiple workers needed | rate limiting required
Direct call when: < 50ms | result needed synchronously | single consumer

## Queue naming convention

```json
{domain}:{action}            # user:send-welcome-email
{domain}:{action}:{priority} # report:generate:high
```

Never generic names like `queue`, `tasks`, `jobs`.

## Job definition

```typescript
// types/jobs.ts — typed job data (no any)
export interface WelcomeEmailJob {
  userId: string
  email: string
  name: string
}

export interface ReportGenerateJob {
  reportId: string
  format: 'pdf' | 'xlsx'
  filters: ReportFilters
}
```

## Producer — enqueue

```typescript
import { Queue } from 'bullmq'
import { redis } from '../lib/redis'

export const emailQueue = new Queue<WelcomeEmailJob>('user:email', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },  // keep last 100 completed
    removeOnFail: { count: 500 },      // keep last 500 failed for debugging
  },
})

// Enqueue — never fire-and-forget without job ID tracking
async function sendWelcomeEmail(user: User) {
  const job = await emailQueue.add('welcome', {
    userId: user.id, email: user.email, name: user.name,
  })
  return job.id  // store in DB if you need to check status later
}
```

## Worker — process

```typescript
import { Worker, Job } from 'bullmq'

const emailWorker = new Worker<WelcomeEmailJob>(
  'user:email',
  async (job: Job<WelcomeEmailJob>) => {
    // Worker receives ONE job at a time (concurrency=1 default)
    await emailService.sendWelcome(job.data)
    // Don't return undefined — return something for job result log
    return { sent: true, at: new Date().toISOString() }
  },
  {
    connection: redis,
    concurrency: 5,  // max parallel jobs in this worker process
  },
)

// Lifecycle events — always wire up for observability
emailWorker.on('completed', (job) => logger.info({ jobId: job.id, queue: 'user:email' }, 'job done'))
emailWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'job failed'))
emailWorker.on('error', (err) => logger.error({ err }, 'worker error'))

// Graceful shutdown
process.on('SIGTERM', async () => {
  await emailWorker.close()
})
```

## Delayed and scheduled jobs

```typescript
// Delay (run once, after N ms)
await emailQueue.add('reminder', data, { delay: 24 * 60 * 60 * 1000 })

// Repeat (cron-like)
import { QueueScheduler } from 'bullmq'
const scheduler = new QueueScheduler('reports', { connection: redis })

await reportQueue.add('daily-summary', {}, {
  repeat: { pattern: '0 8 * * *', tz: 'UTC' },
})
```

## Job priorities

```typescript
// Lower number = higher priority
await emailQueue.add('transactional', data, { priority: 1 })    // highest
await emailQueue.add('marketing', data,     { priority: 10 })   // lower
```

## Idempotency — prevent duplicate processing

```typescript
// Use a deterministic job ID to deduplicate
await emailQueue.add('welcome', data, {
  jobId: `welcome-${user.id}`,  // second add with same ID is a no-op
})
```

## Monitoring

Always run BullBoard or similar in development:

```typescript
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

const serverAdapter = new ExpressAdapter().setBasePath('/admin/queues')
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter })
app.use('/admin/queues', authenticate, serverAdapter.getRouter())
```

## Anti-patterns

- Putting large payloads in job data (store in DB, put ID in job)
- No retry configuration (transient failures kill jobs permanently)
- No graceful shutdown (jobs corrupted on SIGTERM)
- Using `Queue.add()` without job ID for idempotent operations
- Running workers in the same process as the web server in production
- No `removeOnComplete`/`removeOnFail` — Redis grows unbounded
