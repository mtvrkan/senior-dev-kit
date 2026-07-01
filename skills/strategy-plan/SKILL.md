---
name: strategy-plan
description: Use for product strategy, feature roadmaps, build-vs-buy decisions, OKRs, competitive positioning, and prioritization frameworks.
allowed-tools: WebSearch, WebFetch, Read, Grep, Glob
when_to_use: Use for high-level strategic and product decisions that are not directly about code implementation.
---

# strategy-plan

Decision or problem: $ARGUMENTS or derive from context.

1. State the decision in one sentence. Map context: current state, constraints, goals, timeline, budget.
2. Generate at least 2 meaningfully different options. Analyze trade-offs: pros, cons, risks per option.
3. Recommend one option with clear rationale based on stated constraints, not ideal conditions. Surface assumptions that would change the recommendation.
4. Never present one option. Separate known facts from assumptions. Note if research is needed to evaluate an option.

## Output

PROBLEM: [one sentence] | CONTEXT: [constraints, goals, timeline]
OPTIONS: A. [name] — pros/cons/risk | B. [name] — pros/cons/risk
RECOMMENDATION: [option + rationale] | ASSUMPTIONS: [list]
NEXT STEP: [one concrete action] | OPEN QUESTIONS: [what would change recommendation]
