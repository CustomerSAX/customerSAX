# CSA Commerce Services

`apps/commerce` is a clean grouping folder for commerce microservices. The BFF consumes one stable CSA commerce GraphQL contract by selecting one adapter from `FEDERATED_SERVICES`, while each external commerce platform is isolated in its own runnable adapter service.

## Architecture: the platform-neutral adapter seam

This is the repo's core abstraction — a classic ports-and-adapters (hexagonal) seam that lets the
backend commerce platform be swapped with **zero change to any caller**:

```
                       one stable, platform-neutral GraphQL contract
  contract/  ───────────────────────────────────────────────────────────────►  @csa/commerce-contract
  (schema.ts + types.ts:                                                         (the "port": schema + types,
   CommerceProvider port)                                                         incl. the CommerceProvider interface)
        │  each adapter IMPLEMENTS the same contract, mapping its native backend into these types
        ▼
  ┌────────────────┬──────────────┬────────────────┬──────────┐
  │ commercetools  │   shopify    │  bigcommerce   │   sfcc   │   ◄─ per-platform adapter subgraphs
  │ (implemented)  │   (stub)     │   (stub)       │  (stub)  │      (same schema, different backend)
  └────────────────┴──────────────┴────────────────┴──────────┘
        │  BFF composes exactly ONE of these, chosen by BFF_COMMERCE_PLATFORM
        ▼
  bff/  (Apollo Gateway) ─────────────────────────────────────────────────────►  every consumer
        selectCommerceService() keeps the single matching commerce subgraph        (webapp, ai-assist)
        + all non-commerce subgraphs (ticketing, admin)
```

**The three layers:**

1. **Contract (`contract/src/*.graphql.ts`, `types.ts`)** — the platform-neutral schema plus the
   `CommerceProvider` TypeScript port. This is the fixed target: it never mentions commercetools,
   Shopify, or any vendor. It is compiled to `dist/`, and every adapter imports the built output
   (not the source) — so a schema edit is only live after `pnpm --filter @csa/commerce-contract build`.

2. **Adapter subgraphs (`commercetools/`, `shopify/`, ...)** — each is a deployable Apollo subgraph
   that serves the **same** contract schema but talks to a different backend. The adapter's job is
   entirely translation: authenticate to the platform, call its native API, and map the native
   response into the contract types (see `commercetools/src/commercetools/mappers.ts` and
   `provider.ts`, which implements `CommerceProvider`). commercetools is the only one wired up here;
   the others are runnable stubs.

3. **BFF federation (`bff/src/server/federation.ts`)** — the Apollo Gateway composes **exactly one**
   commerce adapter, selected by `BFF_COMMERCE_PLATFORM`, alongside the non-commerce subgraphs.
   Because every adapter exposes the identical schema, composing more than one would collide;
   `selectCommerceService()` enforces the "pick one" rule. Switching platforms is a single env-var
   change on the BFF — no consumer, query, or type changes anywhere upstream.

**The factory in one sentence:** callers depend only on the contract; the BFF chooses which
concrete adapter fulfills it at runtime, so the whole commerce backend can be swapped by changing
`BFF_COMMERCE_PLATFORM` (and pointing `FEDERATED_SERVICES` at that adapter's URL).

## Packages

- `contract`: Shared GraphQL schema and TypeScript types for products, carts, orders, and customers.
- `commercetools`: Implemented adapter service for native commercetools GraphQL APIs.
- `shopify`: Placeholder adapter service.
- `bigcommerce`: Placeholder adapter service.
- `sfcc`: Placeholder adapter service for Salesforce Commerce Cloud.

Each adapter is a deployable Node.js/Apollo subgraph with its own `package.json`, `Dockerfile`, and `tsconfig.json`. A different project can take only `apps/commerce/contract` plus the adapter it needs, for example `apps/commerce/commercetools`, without taking Shopify, BigCommerce, or SFCC.

Each adapter also owns a `terraform` folder with portable Cloud Run boilerplate. The full CSA environment can still compose all adapters from `infra/gcp`.

## Local Run

```bash
pnpm install
pnpm app:commerce-commercetools dev
```

Build a single adapter image from the repository root:

```bash
docker build -f apps/commerce/commercetools/Dockerfile -t csa-commerce-commercetools .
```

Default URLs:

- commercetools: `http://localhost:4310/graphql`
- Shopify placeholder: `http://localhost:4320/graphql`
- BigCommerce placeholder: `http://localhost:4330/graphql`
- SFCC placeholder: `http://localhost:4340/graphql`

## Runtime Selection

The BFF uses `BFF_COMMERCE_PLATFORM` to select one commerce service from `FEDERATED_SERVICES`:

```bash
FEDERATED_SERVICES='{
  "commerce-commercetools": "http://localhost:4310/graphql",
  "commerce-shopify": "http://localhost:4320/graphql",
  "commerce-bigcommerce": "http://localhost:4330/graphql",
  "commerce-sfcc": "http://localhost:4340/graphql"
}'
BFF_COMMERCE_PLATFORM=commercetools
```

The response shape stays the same for every platform because each adapter maps native platform data into the `contract` package types.

The BFF composes only the selected adapter. Do not compose every commerce adapter at the same time, because they intentionally expose the same CSA commerce schema.

## Required Env

Each adapter owns its own runtime env. For commercetools, see `apps/commerce/commercetools/.env.example`:

- `COMMERCETOOLS_PORT`
- `COMMERCETOOLS_PROJECT_KEY`
- `COMMERCETOOLS_CLIENT_ID`
- `COMMERCETOOLS_CLIENT_SECRET`
- `COMMERCETOOLS_SCOPE`
- `COMMERCETOOLS_AUTH_URL`
- `COMMERCETOOLS_API_URL`
