# CSA Webapp

Standalone Next.js webapp using Apollo Client and Tailwind.

## Run Independently

```bash
pnpm install
pnpm dev
```

This folder has its own `package.json`, `tsconfig.json`, Tailwind config, PostCSS config, and `Dockerfile`. It does not depend on monorepo-only packages.

## Required Env

- `NEXT_PUBLIC_GRAPHQL_URL`
