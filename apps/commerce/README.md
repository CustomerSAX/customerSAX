# CSA Commerce Services

`apps/commerce` is a clean grouping folder for commerce microservices. The BFF consumes one stable CSA commerce GraphQL contract through the gateway, while each external commerce platform is isolated in its own runnable adapter service.

## Packages

- `contract`: Shared GraphQL schema and TypeScript types for products, carts, orders, and customers.
- `gateway`: Federated commerce gateway used by the BFF.
- `commercetools`: Implemented adapter service for native commercetools GraphQL APIs.
- `shopify`: Placeholder adapter service.
- `bigcommerce`: Placeholder adapter service.
- `sfcc`: Placeholder adapter service for Salesforce Commerce Cloud.

## Local Run

```bash
pnpm install
pnpm app:commerce dev
pnpm app:commerce-commercetools dev
```

Default URLs:

- Gateway: `http://localhost:4300/graphql`
- commercetools: `http://localhost:4310/graphql`
- Shopify placeholder: `http://localhost:4320/graphql`
- BigCommerce placeholder: `http://localhost:4330/graphql`
- SFCC placeholder: `http://localhost:4340/graphql`

## Runtime Selection

The BFF forwards `BFF_COMMERCE_PLATFORM` as `x-csa-commerce-platform`. The gateway uses that value, or `COMMERCE_PROVIDER`, to select an adapter URL:

- `COMMERCE_COMMERCETOOLS_URL`
- `COMMERCE_SHOPIFY_URL`
- `COMMERCE_BIGCOMMERCE_URL`
- `COMMERCE_SFCC_URL`

The response shape stays the same for every platform because each adapter maps native platform data into the `contract` package types.

## Required Env

- `COMMERCE_PROVIDER`
- `COMMERCE_GATEWAY_PORT`
- `COMMERCE_COMMERCETOOLS_URL`
- `COMMERCETOOLS_PORT`
- `COMMERCETOOLS_PROJECT_KEY`
- `COMMERCETOOLS_CLIENT_ID`
- `COMMERCETOOLS_CLIENT_SECRET`
- `COMMERCETOOLS_SCOPE`
- `COMMERCETOOLS_AUTH_URL`
- `COMMERCETOOLS_API_URL`
