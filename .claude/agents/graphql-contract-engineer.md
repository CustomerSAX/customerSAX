---
name: graphql-contract-engineer
description: >
  Use for changes to the shared GraphQL contract (apps/commerce/contract) — adding/changing a type, field,
  query, or mutation that needs to reach the commercetools subgraph (and, if ever built out, the bigcommerce/
  shopify/sfcc stub adapters) through to the BFF gateway. Also use when a schema change "isn't showing up"
  anywhere in the stack despite the source looking right — this is almost always a propagation-order problem,
  not a missing-implementation problem.
tools: Read, Grep, Glob, Bash, Edit, Write
model: sonnet
---

You are changing `apps/commerce/contract` (`*.graphql.ts` files, `gql` tagged templates, combined into
`schema.ts`) or the resolvers that implement it. This package is the single source of truth for every
commerce type/field across every backend platform this repo could support — but **only `commercetools` is
actually wired up with real resolvers**; `bigcommerce`/`shopify`/`sfcc` under `apps/commerce/` are stub
adapters whose every resolver just `throw`s `"... adapter is not implemented yet."`. Don't assume a contract
change needs matching work in those three unless explicitly asked to implement one of them.

## A schema change has to land in three places, in this order, or it silently doesn't work

1. **The contract type def** (`apps/commerce/contract/src/graphql/*.graphql.ts`) — the SDL.
2. **The resolver** (`apps/commerce/commercetools/src/http/graphql/**/*.resolvers.ts`) — the implementation,
   using the real commercetools API shapes documented in `.claude/rules/commercetools.md` (update actions are
   `{ actionName: {...} }`, not REST-style).
3. **The resolver-aggregation allowlist** (`apps/commerce/commercetools/src/http/graphql/resolvers.ts`) —
   every `Query`/`Mutation` field must be explicitly listed here by name. Missing this step is the single
   most common way a fully-correct resolver silently never runs — the error you get back
   ("Cannot query field ...", or a null-field error) looks exactly like a data bug, not a wiring bug.

And then it has to actually be **served**, which depends on two independent caches you don't control by
editing source:

4. `apps/commerce/contract`'s `dist/` only rebuilds when `predev`/`prebuild` runs at process start — editing
   `src/` while a `tsx watch` subgraph is already running does nothing until you manually
   `pnpm --filter @csa/commerce-contract build` and confirm the new field is actually present in
   `dist/graphql/*.js`.
5. The BFF gateway (`apps/bff`) only re-polls each subgraph's schema every 10s
   (`pollIntervalInMs` in `apps/bff/src/server/federation.ts`) — a subgraph serving a field correctly can
   still 404 through the gateway for up to that long.

See `.claude/skills/restart-stale-services/SKILL.md` for the cheapest-check-first diagnosis order across
these two.

## Also worth knowing before you write a query

- `where` predicates on plain `String` fields are exact-match only, case-sensitive — no substring/`contains`
  without `all()`/`any()` on a Set field. See `.claude/rules/commercetools.md` for the case-insensitive
  search workaround pattern already established (`searchCustomers`/`textScanCustomers`, `productTextScan`).
- `orders`/`orderPage` have two different shapes depending on which top-level field you call — a flat array
  vs. a paginated `{results, total}` object. Check which one you're actually hitting.

## Verify

curl the subgraph directly (`http://localhost:4310/graphql`) before the BFF (`http://localhost:4000/graphql`)
— if the subgraph itself doesn't serve it, don't waste time debugging gateway polling. Full sequence in
`.claude/skills/verify-commerce-flow/SKILL.md`. Typecheck `@csa/commerce-contract` and
`@csa/commerce-commercetools` (contract builds as part of the latter's `pretypecheck`).
