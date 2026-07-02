# Project Preset — LLM / AI Integration

## Model selection

| Need | Model | Why |
| --- | --- | --- |
| Complex reasoning, long context | claude-sonnet-5 / claude-opus-4-8 | Best quality |
| Fast, cheap, high-volume | claude-haiku-4-5-20251001 | Low latency + cost |
| Structured output (JSON) | Any Claude model + tool_use | More reliable than JSON-mode |
| Embeddings | voyage-3 (Voyage AI — Anthropic-recommended) / text-embedding-3-small (OpenAI) | Anthropic has no embeddings API |

Never hardcode model name in business logic — inject via config/env (`MODEL_ID=...`).

## Streaming

Always stream for user-facing responses. Never buffer the full response when latency matters.

```typescript
// Anthropic SDK — streaming
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()

async function streamCompletion(prompt: string, res: Response) {
  const stream = client.messages.stream({
    model: process.env.MODEL_ID ?? 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
    }
  }
  res.write('data: [DONE]\n\n')
  res.end()
}
```

## Tool use (structured output)

Prefer `tool_use` over JSON-mode prompting — it forces schema compliance.

```typescript
const tools: Anthropic.Tool[] = [{
  name: 'extract_order',
  description: 'Extract structured order data from user message',
  input_schema: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'string' } },
      quantity: { type: 'integer', minimum: 1 },
      deliveryDate: { type: 'string', format: 'date' },
    },
    required: ['items', 'quantity'],
  },
}]

const response = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 512,
  tools,
  tool_choice: { type: 'auto' },
  messages: [{ role: 'user', content: userMessage }],
})

const toolUse = response.content.find(b => b.type === 'tool_use')
if (toolUse && toolUse.type === 'tool_use') {
  const data = toolUse.input as OrderData  // typed, validated by schema
}
```

## RAG — Retrieval Augmented Generation

```typescript
// Anthropic has no embeddings API — use Voyage AI (recommended) or OpenAI
import OpenAI from 'openai'
const openai = new OpenAI()  // swap for the 'voyageai' client if using voyage-3

// 1. Embed the query
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: userQuery,
})

// 2. Retrieve relevant chunks (Postgres pgvector / Pinecone / Weaviate)
const chunks = await db.execute(sql`
  SELECT content, metadata,
    1 - (embedding <=> ${embedding.data[0].embedding}::vector) AS similarity
  FROM documents
  ORDER BY embedding <=> ${embedding.data[0].embedding}::vector
  LIMIT 5
`)

// 3. Augment prompt — keep context under model's effective window
const context = chunks.rows.map(c => c.content).join('\n\n---\n\n')
const prompt = `Answer based only on the provided context.\n\nContext:\n${context}\n\nQuestion: ${userQuery}`

// 4. Generate
const answer = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  system: 'You are a helpful assistant. Only use the provided context.',
  messages: [{ role: 'user', content: prompt }],
})
```

## Prompt security — injection prevention

NEVER interpolate raw user input directly into system prompts.

```typescript
// WRONG — prompt injection risk
const system = `You are an assistant. User info: ${req.body.userInput}`

// RIGHT — separate user content into user turn only
const messages = [
  { role: 'user', content: sanitize(req.body.userInput) }
]
// System prompt contains NO user data
```

Always validate/sanitize output before rendering in UI — LLMs can produce XSS payloads in untrusted content tasks.

## Memory patterns

```typescript
// Short-term (per-conversation): pass messages array
const messages = conversationHistory  // Array<{role, content}>
messages.push({ role: 'user', content: newMessage })
const response = await client.messages.create({ ..., messages })
messages.push({ role: 'assistant', content: response.content })

// Long-term: embed + store → retrieve relevant memories at turn start
// Never store full conversation history indefinitely — apply summarization window
```

Summarization window: when conversation exceeds 80% of context window, summarize earlier turns.

## Cost control

- Set `max_tokens` conservatively — never leave it unbounded.
- Cache identical prompts: same system + same user input → return cached response (Redis TTL=1h).
- Log token usage per request: `response.usage.input_tokens` + `output_tokens`.
- Alert when monthly cost exceeds threshold (set budget in cloud provider or track in DB).

```typescript
// Track usage in DB
await db.llmUsage.create({
  userId, model, inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  costUsd: estimateCost(response.usage, model),
})
```

## Error handling

```typescript
import { APIError, RateLimitError, APIConnectionError } from '@anthropic-ai/sdk'

async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof RateLimitError) {
        const delay = Math.min(1000 * 2 ** attempt, 30000)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      if (err instanceof APIConnectionError && attempt < maxRetries) continue
      throw err  // non-retryable: re-throw immediately
    }
  }
}
```

## Security checklist

- [ ] Prompt injection: user input never interpolated into system prompt
- [ ] Output validation: sanitize before rendering (DOMPurify for HTML)
- [ ] Rate limiting: per-user daily token budget enforced server-side
- [ ] No PII in prompts: strip emails, phone numbers, SSNs before sending
- [ ] API key: never in client bundle — proxy all LLM calls through backend
- [ ] Model outputs: never trust as trusted code or SQL — always treat as untrusted input

## Anti-patterns

- Sending raw `req.body` content directly into LLM prompt (injection risk)
- Storing full message history forever (cost + privacy)
- No retry logic for rate limits
- Hardcoded model name in source code (not configurable)
- Blocking/synchronous LLM calls in API handlers without streaming
- Rendering raw LLM HTML output without sanitization
