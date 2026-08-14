# CSA Commerce Services

`apps/commerce` is a clean grouping folder for commerce microservices. The BFF consumes one stable CSA commerce GraphQL contract by selecting one adapter from `FEDERATED_SERVICES`, while each external commerce platform is isolated in its own runnable adapter service.

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

## B2B Business Units

The shared commerce contract includes a platform-neutral B2B surface for the old CSA/Phoenix-style UI:

- `companies`: maps to commercetools Business Units.
- `company`: reads one Business Unit by id or key.
- `companyCarts`: maps a company tab to B2B carts for the selected Business Unit.
- `companyOrders`: maps a company tab to B2B orders for the selected Business Unit.
- `quotes`: placeholder quote page contract for the Quote tab.

The commercetools adapter includes native Business Unit GraphQL mapping with sample fallback for local/demo usage when Business Units are not available in the connected project.

## Required Env

Each adapter owns its own runtime env. For commercetools, see `apps/commerce/commercetools/.env.example`:

- `COMMERCETOOLS_PORT`
- `COMMERCETOOLS_PROJECT_KEY`
- `COMMERCETOOLS_CLIENT_ID`
- `COMMERCETOOLS_CLIENT_SECRET`
- `COMMERCETOOLS_SCOPE`
- `COMMERCETOOLS_AUTH_URL`
- `COMMERCETOOLS_API_URL`
