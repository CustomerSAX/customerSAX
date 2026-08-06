# commercetools Adapter

This package is a standalone commercetools adapter service. It implements the shared `CommerceProvider` contract from `@csa/commerce-contract`.

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
