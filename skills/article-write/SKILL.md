---
name: article-write
description: Use for writing articles, blog posts, technical content, reports, and structured long-form content.
allowed-tools: Read, Write, Edit, Grep, Glob, WebFetch, WebSearch
when_to_use: Use when the task is to produce a written article, blog post, report, newsletter, or long-form document.
argument-hint: "[topic or content brief]"
---

# article-write

Topic: $ARGUMENTS or derive from context.

1. Outline first — section outline before prose. Verify facts via WebSearch/WebFetch, or flag uncertain claims [NEEDS VERIFICATION].
2. Write section by section, matching requested tone (technical/casual/formal/persuasive). Clear headings, short paragraphs, concrete examples, active voice.
3. Never fabricate facts, stats, or quotes. If writing in Turkish: natural language, not machine-translated tone. Opening hook + closing CTA/summary always.
4. Review for clarity, accuracy, flow, and audience fit before finishing.

## Output

```text
TITLE: [proposed title] | AUDIENCE: [who] | TONE: [technical|casual|formal|persuasive] | OUTLINE: [sections]
---
[full article content]
---
WORD COUNT: [N] | REVIEW NOTES: [facts to verify]
```
