---
name: db-change
description: Use for database schema/model/query changes involving SQL, NoSQL, ORM, relations, indexes, and data safety. Design/planning phase — once a migration file is produced, hand off to migration-review for deployment safety.
allowed-tools: Read, Grep, Glob, Bash
when_to_use: Use automatically when schema, ORM models, queries, indexes, constraints, transactions, or data shape changes.
argument-hint: "[schema change to plan]"
---

# db-change

Before any database change, produce this analysis:

1. AFFECTED: tables / collections / models touched
2. DATA LOSS RISK: DROP, rename, type narrowing, NOT NULL on existing rows
3. STRATEGY: additive change (nullable column, new table) or multi-step migration
4. MIGRATION ORDER: deploy order relative to code changes
5. INDEX/CONSTRAINT IMPACT: new indexes, constraint changes, performance effect
6. RACE/TRANSACTION RISK: concurrent write safety
7. TESTS REQUIRED: what must be verified before applying

Prefer additive changes. Never approve destructive operations without explicit user confirmation. For new entity/relation design before any schema exists, start with `data-modeling` instead.
