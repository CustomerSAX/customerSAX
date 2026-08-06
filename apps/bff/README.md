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
