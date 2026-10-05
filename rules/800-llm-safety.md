---
description: "LLM/AI integration safety — prompt injection, output trust, cost controls"
paths:
  - "**/ai/**"
  - "**/llm/**"
  - "**/openai/**"
  - "**/anthropic/**"
  - "**/claude/**"
  - "**/agents/**/*.{ts,tsx,js,jsx,py,go}"
  - "**/*{openai,anthropic}*.{ts,tsx,js,jsx,py,go}"
  - "**/{llm,prompt,prompts}.{ts,js,py,go}"
  - "**/{llm,prompt,prompts}[._-]*.{ts,js,py,go}"
---

## HARD RULES — LLM integration

NEVER trust LLM output as safe input to: SQL queries · shell commands · eval() · innerHTML · file paths
NEVER put secrets, API keys, or raw PII into LLM prompts (use redacted placeholders)
NEVER render raw LLM output as HTML without sanitization (DOMPurify or equivalent)
ALWAYS set max_tokens — unbounded generation burns budget and enables prompt leakage
ALWAYS set a per-user or per-session cost budget — LLM calls are unbounded by default

## PROMPT INJECTION PREVENTION

WRONG — user content injected into system context:

```typescript
const systemPrompt = `You are a helpful assistant. User's name: ${req.body.name}`
```

Putting the static prompt in a system-role message inside the array is the OpenAI shape — on the
Messages API it is rejected as the first entry and is not accepted at all on some models.

RIGHT — `system` is a top-level parameter, never an entry in `messages`; user content stays in the user turn:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  system: STATIC_SYSTEM_PROMPT,
  messages: [
    { role: 'user', content: `My name is ${sanitize(req.body.name)}. Help me with...` },
  ],
})
```

**Indirect prompt injection — when LLM reads external content (web, docs, emails):**

Flag user-provided URLs before fetching them for LLM context — SSRF + prompt injection double risk.
Validate the URL against an allowlist OR run it in a sandboxed fetch with no internal network access.

**Passive check — fires on any LLM integration change:**

- User input flows directly into `system` role → flag injection risk
- External content (file, URL, email) piped to LLM without sanitization → flag
- LLM output used as code string (`eval`, `exec`, `Function(output)()`) → STOP

## OUTPUT VALIDATION

LLM output is untrusted input — validate before use:

For structured output, parse and validate are two steps, and only the first throws. Keep
`JSON.parse` alone inside the `try` — nesting it in `safeParse`'s argument position makes the
`!parsed.success` fallback unreachable for the commonest failure of all (the model returned prose,
not JSON), and widening the `try` to cover validation too would swallow unrelated bugs. The `catch`
branch is the not-JSON-at-all case; the `!parsed.success` branch is where the fallback or retry goes.

```typescript
function parseLlmJson(raw: string) {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { success: false } as const
  }
  return outputSchema.safeParse(data)
}
const parsed = parseLlmJson(llmResponse)
if (!parsed.success) retryOrFallback()
```

For text displayed to users, sanitize the HTML:

```typescript
import DOMPurify from 'dompurify'
element.innerHTML = DOMPurify.sanitize(llmOutput)
```

For text used in queries or commands: NEVER do this — redesign so the LLM output never reaches
the query or command string.

## COST CONTROLS — required on every LLM call path

REQUIRED: always set limits — `max_tokens` has no default and is never left open-ended:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  messages,
})
```

REQUIRED: per-user budget tracking:

```typescript
const userUsage = await getMonthlyUsage(userId)
if (userUsage.tokens > USER_MONTHLY_LIMIT) throw new QuotaExceededError()
```

REQUIRED: log cost on every call:

```typescript
logger.info({
  action: 'llm.call',
  model: response.model,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  userId,
  feature,
})
```

**OBS flag:** Any LLM call path with no cost logging → `OBS: [feature] LLM call has no cost tracking — add token usage logging`

## MODEL SELECTION RULES

| Use case | Model | Why |
| --- | --- | --- |
| Simple classification, extraction, summarization | Haiku | ~50% cheaper than Sonnet on input, sufficient quality |
| Code generation, reasoning, multi-step | Sonnet | Balance of cost + quality |
| Architecture decisions, complex analysis, judgment | Opus | Max quality when cost is secondary |

**Size the tier to the request volume, and re-check the prices before you rely on them.** Per Mtok
in/out as of 2026-09: `claude-haiku-4-5` $1/$5 · `claude-sonnet-5` $2/$10 · `claude-opus-5` $5/$25.
Opus is roughly 5× Haiku, not the ~15× that older guidance (including an earlier revision of this
file) assumed — that figure came from a prior Opus generation and has been wrong since. Treat every
number here the same way: verify against current pricing rather than trusting a rule file.

## TOOL / FUNCTION CALLING SAFETY

When exposing tools to an LLM agent:

- Each tool must validate its own inputs (never trust LLM-provided args directly)
- Tools that mutate state: require explicit user confirmation before executing
- Tools with side effects (email, payment, delete): log every call with args + caller identity
- Never give LLM tools access to: raw DB queries · shell execution · file system writes outside sandbox

WRONG — LLM controls arbitrary SQL:

```typescript
tools: [{ name: 'query_db', description: 'Run a SQL query', params: { sql: 'string' } }]
```

RIGHT — LLM controls intent, tool controls execution:

```typescript
tools: [{ name: 'get_orders', description: 'Get orders for a user', params: { userId: 'string', status: 'enum' } }]
```

The implementation uses a parameterized query, never raw SQL from the LLM.

## AGENTIC / MULTI-STEP FLOWS

For agents that run multiple LLM calls in a loop:

- Set a maximum step count (e.g., `maxTurns: 10`) — prevent infinite loops
- Log every step: model, tokens, action taken, tool calls
- For destructive tool calls: pause and get human-in-the-loop confirmation
- On error: fail the entire flow cleanly, don't retry silently in a loop

## PII IN PROMPTS

WRONG — raw PII in prompt:

```typescript
const prompt = `User email: ${user.email}, phone: ${user.phone}. Help them reset their password.`
```

RIGHT — use opaque identifiers:

```typescript
const prompt = `User ID: ${user.id}. Help them reset their password.`
```

Resolve PII only at the point of action (sending the email), never in the prompt.

Never put in prompts: email · phone · SSN · DOB · credit card · full name + address together
Safe to use: user ID · account tier · feature flags · anonymized preferences
