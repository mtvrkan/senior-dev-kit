# Documentation

Four pages, in the order you need them.

| Page | Read it when |
| --- | --- |
| [Install](install.md) | Getting the kit onto your machine, and taking it off again |
| [Usage](usage.md) | Understanding what changes about a normal working day |
| [Reference](reference.md) | Looking up a specific agent, skill, rule or command |
| [Troubleshooting](troubleshooting.md) | Something installed but isn't behaving |

Elsewhere in the repo:

- [`../README.md`](../README.md) — the two-minute version
- [`../SECURITY.md`](../SECURITY.md) — threat model, deny-rule coverage, and what is deliberately *not* blocked
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — the verification gate and the budgets a change has to fit
- [`../agents/ROUTING.md`](../agents/ROUTING.md) — the full routing decision tree, including tie-breaks
- [`../presets/README.md`](../presets/README.md) — per-stack project templates

[Reference](reference.md) is generated from the component frontmatter on disk and verified by
`npm run docs-check`. The other three are written by hand; every command they tell you to type is
checked against the real script and skill names by `npm run consistency-check`.
