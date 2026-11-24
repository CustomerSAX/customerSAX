# CSA BFF

Standalone Apollo GraphQL gateway/BFF service.

## Run Independently

```bash
pnpm install
pnpm dev
```

This folder has its own `package.json`, `tsconfig.json`, and `Dockerfile`. It does not depend on monorepo-only packages.

## Required Env

- `BFF_PORT`
- `BFF_COMMERCE_PLATFORM`
- `FEDERATED_SERVICES`
- `MC_TICKETS_AUDIENCE` (public BFF origin used to verify Merchant Center exchange tokens)
- `MC_REFUNDS_AUDIENCE` (public BFF origin; falls back to `MC_TICKETS_AUDIENCE`)
- `MC_REPLACEMENTS_AUDIENCE` (public BFF origin; falls back to `MC_REFUNDS_AUDIENCE`)
- `MONGO_URI` (resolves a verified commercetools project key to its CSA tenant)

See `.env.example` in this folder.

Commerce services can be listed independently:

```bash
FEDERATED_SERVICES='{
  "commerce-commercetools": "https://commerce-commercetools/graphql",
  "commerce-shopify": "https://commerce-shopify/graphql",
  "commerce-bigcommerce": "https://commerce-bigcommerce/graphql",
  "commerce-sfcc": "https://commerce-sfcc/graphql"
}'
BFF_COMMERCE_PLATFORM=commercetools
```

The BFF will compose only the selected commerce service, while keeping any non-commerce federated services in the same object.
`BFF_COMMERCE_PLATFORM=salesforce` is accepted as an alias for `sfcc`.

`POST /merchant-center/tickets` is the authenticated adapter for the CSA
Merchant Center Custom Application. It validates the short-lived exchange JWT,
derives the tenant from the verified project key, and queries the existing
ticketing subgraph. Set `MONGO_ADMIN_DB` and `MONGO_PROJECTS_COLLECTION` only
when the project registry does not use their defaults (`csa-admin` and
`csa_projects`).

`POST /merchant-center/refunds` is the authenticated return-refund adapter. It
verifies the Merchant Center exchange JWT and `ManageCsaOrders` permission,
validates the selected return items and amount against commercetools, creates
a unique idempotent refund record, adds a successful Refund transaction when a
commercetools Payment is linked, and marks the return items refunded. The
registered commercetools tenant credentials need `manage_orders` and
`manage_payments` scopes. An external payment-service adapter can be added
behind this endpoint without changing the Merchant Center workflow.
