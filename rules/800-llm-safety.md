---
description: "LLM/AI integration safety — prompt injection, output trust, cost controls"
paths:
  - "**/ai/**"
  - "**/llm/**"
  - "**/openai/**"
  - "**/anthropic/**"
  - "**/claude/**"
  - "**/agents/**/*.{ts,tsx,js,jsx,py,go}"
---

<!-- forbidden-in-examples
role:\s*['"]system['"] :: a `{ role: 'system' }` entry inside a `messages` array is the OpenAI shape; on the Anthropic Messages API `system` is a top-level parameter, and a system message is rejected as messages[0] and unsupported entirely on some models
\.safeParse\(\s*JSON\.parse\( :: JSON.parse throws on malformed model output, so nesting it in safeParse's argument position makes the `!success` fallback unreachable. Banned as a SHAPE, not only when unguarded: on one line you cannot tell whether a try/catch wraps it, and the fix is the same either way — split the parse from the validate, with only JSON.parse inside the try
-->

## HARD RULES — LLM integration

NEVER trust LLM output as safe input to: SQL queries · shell commands · eval() · innerHTML · file paths
NEVER put secrets, API keys, or raw PII into LLM prompts (use redacted placeholders)
NEVER render raw LLM output as HTML without sanitization (DOMPurify or equivalent)
ALWAYS set max_tokens — unbounded generation burns budget and enables prompt leakage
ALWAYS set a per-user or per-session cost budget — LLM calls are unbounded by default

## PROMPT INJECTION PREVENTION

```typescript
// WRONG — user content injected into system context:
const systemPrompt = `You are a helpful assistant. User's name: ${req.body.name}`

// RIGHT — `system` is a top-level parameter, never an entry in `messages`; user
// content stays in the user turn. (Putting the static prompt in a system-role
// message inside the array is the OpenAI shape — on the Messages API it is rejected
// as the first entry and is not accepted at all on some models.)
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

```typescript
// Flag user-provided URLs before fetching for LLM context:
// SSRF + prompt injection double risk
// Validate URL against allowlist OR run in sandboxed fetch with no internal network access
```

**Passive check — fires on any LLM integration change:**

- User input flows directly into `system` role → flag injection risk
- External content (file, URL, email) piped to LLM without sanitization → flag
- LLM output used as code string (`eval`, `exec`, `Function(output)()`) → STOP

## OUTPUT VALIDATION

LLM output is untrusted input — validate before use:

```typescript
// For structured output: parse and validate are two steps, and only the first throws.
// Keep JSON.parse alone inside the try — nesting it in safeParse's argument position
// makes the `!parsed.success` fallback unreachable for the commonest failure of all
// (the model returned prose, not JSON), and widening the try to cover validation too
// would swallow unrelated bugs.
function parseLlmJson(raw: string) {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { success: false } as const // not JSON at all
  }
  return outputSchema.safeParse(data)
}
const parsed = parseLlmJson(llmResponse)
if (!parsed.success) { /* fallback or retry */ }

// For text displayed to users: sanitize HTML
import DOMPurify from 'dompurify'
element.innerHTML = DOMPurify.sanitize(llmOutput)

// For text used in queries/commands: NEVER do this — redesign
```

## COST CONTROLS — required on every LLM call path

```typescript
// REQUIRED: always set limits
const response = await anthropic.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1024,          // always set — no default, no open-ended
  messages,
})

// REQUIRED: per-user budget tracking
const userUsage = await getMonthlyUsage(userId)
if (userUsage.tokens > USER_MONTHLY_LIMIT) throw new QuotaExceededError()

// REQUIRED: log cost on every call
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
| Simple classification, extraction, summarization | Haiku | 75% cheaper, sufficient quality |
| Code generation, reasoning, multi-step | Sonnet | Balance of cost + quality |
| Architecture decisions, complex analysis, judgment | Opus | Max quality when cost is secondary |

**Size the tier to the request volume, and re-check the prices before you rely on them.** Per Mtok
in/out as of 2026-08: `claude-haiku-4-5` $1/$5 · `claude-sonnet-5` $3/$15 · `claude-opus-5` $5/$25.
Opus is roughly 5× Haiku, not the ~15× that older guidance (including an earlier revision of this
file) assumed — that figure came from a prior Opus generation and has been wrong since. Treat every
number here the same way: verify against current pricing rather than trusting a rule file.

## TOOL / FUNCTION CALLING SAFETY

When exposing tools to an LLM agent:

- Each tool must validate its own inputs (never trust LLM-provided args directly)
- Tools that mutate state: require explicit user confirmation before executing
- Tools with side effects (email, payment, delete): log every call with args + caller identity
- Never give LLM tools access to: raw DB queries · shell execution · file system writes outside sandbox

```typescript
// WRONG — LLM controls arbitrary SQL:
tools: [{ name: 'query_db', description: 'Run a SQL query', params: { sql: 'string' } }]

// RIGHT — LLM controls intent, tool controls execution:
tools: [{ name: 'get_orders', description: 'Get orders for a user', params: { userId: 'string', status: 'enum' } }]
// Implementation uses parameterized query, never raw SQL from LLM
```

## AGENTIC / MULTI-STEP FLOWS

For agents that run multiple LLM calls in a loop:

- Set a maximum step count (e.g., `maxTurns: 10`) — prevent infinite loops
- Log every step: model, tokens, action taken, tool calls
- For destructive tool calls: pause and get human-in-the-loop confirmation
- On error: fail the entire flow cleanly, don't retry silently in a loop

## PII IN PROMPTS

```typescript
// WRONG — raw PII in prompt:
const prompt = `User email: ${user.email}, phone: ${user.phone}. Help them reset their password.`

// RIGHT — use opaque identifiers:
const prompt = `User ID: ${user.id}. Help them reset their password.`
// Resolve PII only at the point of action (sending the email), never in the prompt
```

Never put in prompts: email · phone · SSN · DOB · credit card · full name + address together
Safe to use: user ID · account tier · feature flags · anonymized preferences
