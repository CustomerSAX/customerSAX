# CSA Commerce Services

`apps/commerce` is a clean grouping folder for commerce microservices. The BFF consumes one stable CSA commerce GraphQL contract by selecting one adapter from `FEDERATED_SERVICES`, while each external commerce platform is isolated in its own runnable adapter service.

## Packages

- `contract`: Shared GraphQL schema and TypeScript types for products, carts, orders, and customers.
- `commercetools`: Implemented adapter service for native commercetools GraphQL APIs.
- `shopify`: Placeholder adapter service.
- `bigcommerce`: Placeholder adapter service.
- `sfcc`: Placeholder adapter service for Salesforce Commerce Cloud.

## Local Run

```bash
pnpm install
pnpm app:commerce-commercetools dev
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

## Required Env

Each adapter owns its own runtime env. For commercetools, see `apps/commerce/commercetools/.env.example`:

- `COMMERCETOOLS_PORT`
- `COMMERCETOOLS_PROJECT_KEY`
- `COMMERCETOOLS_CLIENT_ID`
- `COMMERCETOOLS_CLIENT_SECRET`
- `COMMERCETOOLS_SCOPE`
- `COMMERCETOOLS_AUTH_URL`
- `COMMERCETOOLS_API_URL`
