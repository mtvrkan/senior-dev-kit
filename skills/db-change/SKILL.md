---
name: db-change
description: Use for database schema/model/query changes AND new entity/relation/document modeling — SQL, NoSQL, ORM, relations, indexes, constraints, data safety. Design/planning phase — once a migration file is produced, hand off to migration-review for deployment safety.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically when schema, ORM models, queries, indexes, constraints, transactions, or data shape changes — or when designing entities/relations/documents for a new feature before any schema exists.
argument-hint: "[schema change to plan]"
---

# db-change

Greenfield modeling (no schema exists yet) — produce a data model plan first, no code edits:

```text
ENTITIES: [list] | RELATIONS: [A has-many B, …] | INDEXES: [field → reason]
CONSTRAINTS: [unique, not-null, FK, check] | SQL vs NoSQL: [rationale if a choice is needed]
ANTI-PATTERNS AVOIDED: [what was rejected and why]
```

Changing an existing schema — produce this analysis before any change:

1. AFFECTED: tables / collections / models touched
2. DATA LOSS RISK: DROP, rename, type narrowing, NOT NULL on existing rows
3. STRATEGY: additive change (nullable column, new table) or multi-step migration
4. MIGRATION ORDER: deploy order relative to code changes
5. INDEX/CONSTRAINT IMPACT: new indexes, constraint changes, performance effect
6. RACE/TRANSACTION RISK: concurrent write safety
7. TESTS REQUIRED: what must be verified before applying

Prefer additive changes. Never approve destructive operations without explicit user confirmation.

Deep references: `agent_docs/zero-downtime-migration.md` — expand/contract phases and deploy ordering; `agent_docs/architecture.md` — where models and repositories live.
