---
description: Rebuild the shared commerce contract and confirm which subgraph fields it now exposes.
---

Run:

```bash
pnpm --filter @csa/commerce-contract build
```

Then confirm the rebuild actually landed by listing every exported GraphQL type/field name across
`apps/commerce/contract/dist/graphql/*.js` (grep for `type `, `Query {`, `Mutation {`, and the field lines
inside those blocks). If the running commercetools subgraph (`http://localhost:4310/graphql`, if reachable)
doesn't yet reflect a field that's now present in `dist/`, see `.claude/skills/restart-stale-services/SKILL.md`
for how to force its `tsx watch` process to reload — don't just restart it blindly.
