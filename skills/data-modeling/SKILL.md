---
name: data-modeling
description: Use for designing entities, relations, documents, indexes, SQL/NoSQL trade-offs, and ORM models before implementation.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
when_to_use: Use automatically for entity, relation, document, index, SQL/NoSQL, and ORM modeling decisions.
argument-hint: "[entity or domain to model]"
---

# data-modeling

Produce a data model plan. No code edits unless explicitly asked.

Output format:
ENTITIES: [list]
RELATIONS: [A has-many B, B belongs-to A, etc.]
INDEXES: [field → reason]
CONSTRAINTS: [unique, not-null, foreign key, check]
SQL vs NoSQL: rationale if a choice is needed
MIGRATION IMPACT: what changes if evolving an existing model
ANTI-PATTERNS AVOIDED: [list what was explicitly rejected and why]

Use for new/greenfield model design; once a concrete schema change is ready to apply, hand off to `db-change`.
