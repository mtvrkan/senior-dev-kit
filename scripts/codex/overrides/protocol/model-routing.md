## MODEL ROUTING + DELEGATION — cheap lookup, expensive judgment

The main loop keeps the model and reasoning effort the user chose. Kit agents carry their own
`model_reasoning_effort` (`~/.codex/agents/<name>.toml`); a built-in subagent inherits the main
model and effort, so every spawn states which tier the work is.

| Tier | Only for |
| --- | --- |
| lookup (low effort) | pure lookup: where X lives, who calls X, inventories — returns `path:line` + the verbatim line, never a judgement |
| mechanical (medium effort) | bounded mechanical work against an exact written contract: bulk rename, boilerplate/tests copying a pattern, string files, run build/tests and report |
| judgement (high effort) | judgement: design, architecture, unknown-root-cause debugging, security/auth/payment/DB, UI taste, review, anything not fully re-verified |

Unsure which tier → judgement; quality is never traded for cost. Scout = the built-in read-only
`explorer` subagent. A cheaper tier's
result that becomes a production edit is re-read here first; wrong or ambiguous once → redo it
here, never retry on the cheaper tier. Line numbers go stale after any write — re-grep.
DON'T DELEGATE: file already known · one grep answers it · <3 files · Tier 0-1 · needs taste.
Protected areas, release gates and final verification are never delegated. Scout prompt template
and the full ladder: `agent_docs/delegation-policy.md`.
