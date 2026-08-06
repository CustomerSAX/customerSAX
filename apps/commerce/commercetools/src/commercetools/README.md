# commercetools Adapter

This package is a standalone commercetools adapter service. It imports the generic commerce GraphQL contract from `@csa/commerce-contract` and owns the commercetools-specific resolvers, API calls, and mappers.

## GraphQL Layout

The Apollo subgraph follows the Phoenix component style:

- `src/http/graphql/typeDefs.ts`
- `src/http/graphql/resolvers.ts`
- `src/http/graphql/product/{index,product.graphql,product.mapper,product.resolvers,product.typeResolvers,product.types}.ts`
- `src/http/graphql/cart/{index,cart.graphql,cart.mapper,cart.resolvers,cart.typeResolvers,cart.types}.ts`
- `src/http/graphql/customer/{index,customer.graphql,customer.mapper,customer.resolvers,customer.typeResolvers,customer.types}.ts`
- `src/http/graphql/order/{index,order.graphql,order.mapper,order.resolvers,order.typeResolvers,order.types}.ts`
- `src/http/graphql/<domain>/resolvers`
- `src/http/graphql/healthcheck`

The native commercetools calls remain under `src/commercetools/api`.

## Copy To Another Codebase

Copy:

- `src/commercetools`
- `apps/commerce/contract`

Then wire `createCommercetoolsProvider()` into that codebase's API layer.

## Responsibilities

- Authenticate with commercetools.
- Call native commercetools GraphQL APIs.
- Map commercetools responses into the unified CSA commerce shape.
- Keep BFF-facing data consistent with other providers like Shopify, BigCommerce, and SFCC.

## Required Env

- `COMMERCETOOLS_PROJECT_KEY`
- `COMMERCETOOLS_CLIENT_ID`
- `COMMERCETOOLS_CLIENT_SECRET`
- `COMMERCETOOLS_SCOPE`
- `COMMERCETOOLS_AUTH_URL`
- `COMMERCETOOLS_API_URL`
