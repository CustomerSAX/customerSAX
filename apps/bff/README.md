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
