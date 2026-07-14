---
name: deep-research
description: Use for deep, multi-source research — fan-out searches across multiple sources, fetch primary content, cross-verify claims, synthesize a cited report.
allowed-tools: WebSearch, WebFetch, Read, Grep, Glob
when_to_use: Use when the task requires multi-source factual research, competitive analysis, technology comparison, or market research.
argument-hint: "[research question or topic]"
context: fork
agent: researcher
effort: high
---

# deep-research

Research question: $ARGUMENTS or derive from context.

1. Clarify the question in one sentence; break into sub-questions if ambiguous. Fan out — search 3+ different angles or phrasings.
2. Fetch and read primary sources directly — don't rely on search snippet summaries. Cross-verify key claims across 2+ independent sources.
3. Cite every factual claim with its source (URL/doc name). Mark unverified/single-source claims [UNVERIFIED]. Never fabricate sources, stats, or quotes — note contradictions explicitly. Prefer primary sources over blogs.

## Output

RESEARCH QUESTION: [one sentence] | SOURCES CONSULTED: [numbered list with URLs]
KEY FINDINGS: [N. finding — citation] | CONTRADICTIONS / GAPS: [if any]
SUMMARY: [3-5 sentences] | CONFIDENCE: high | medium | low [reason]
