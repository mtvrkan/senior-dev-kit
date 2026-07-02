---
name: llm-integration
description: Use for tasks involving LLM/AI API integration — adding model calls, RAG pipelines, prompt engineering, streaming, tool use, or AI cost optimization.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically when adding or modifying LLM/AI API calls, RAG pipelines, embeddings, prompt templates, streaming responses, or AI-related cost/security concerns.
argument-hint: "[feature or endpoint to build]"
---

# llm-integration

Build or modify AI/LLM features safely. Read `presets/ai/llm-integration/CLAUDE.md` first.

1. Read one existing LLM call — match model client, error handling, logging. Identify streaming/structured/RAG/tool-use.
2. User input entering the system prompt → STOP, injection risk. API key in client code → move to backend. No HTML sanitization → add DOMPurify.

Patterns: simple `messages.create`→handle RateLimitError; streaming `messages.stream`→SSE/WebSocket→`[DONE]`; structured `tool_use` schema→`tool_choice:auto`; RAG embed→search→context→generate; agentic generate→tool calls→execute→append→generate (cap iterations).

## Output

```text
PATTERN: [completion|streaming|structured|RAG|agentic] | MODEL: [env var] | · [file:line — change]
SECURITY: [none | mitigated] | TEST: [✓] | COST: [tokens/call × daily vol]
```
