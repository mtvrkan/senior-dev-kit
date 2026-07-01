# /plan-first

Plan this work safely. No code edits.

Task: $ARGUMENTS

Output:
GOAL: one sentence
NON-GOALS: what is explicitly excluded
AFFECTED AREAS: [files / modules / services]
PROTECTED AREAS TOUCHED: [auth / payment / DB / secrets / CI — list any]
RISK: low | medium | high | critical
GUARD AGENTS NEEDED: [db-guard | security-guard | migration-guard | none]
STEPS:

  1. [step — small enough to be one diff]
  2. ...
VERIFY WITH: [commands]
ROLLBACK/MIGRATION NOTES: [if applicable]

Do not edit files.
