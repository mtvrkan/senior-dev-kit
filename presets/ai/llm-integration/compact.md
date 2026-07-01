## LLM Integration

- Model via env (`MODEL_ID`) — never hardcode
- Stream all user-facing responses
- `tool_use` for structured output — more reliable than JSON-mode prompting
- RAG: embed → retrieve (pgvector/Pinecone) → augment → generate
- User input NEVER in system prompt (prompt injection)
- Sanitize LLM output before rendering (XSS risk)
- Retry on RateLimitError with exponential backoff
- Track token usage per request; alert on budget overrun
- Max tokens always set — never unbounded
- PII stripped before sending to external API
