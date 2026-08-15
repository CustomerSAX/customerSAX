# CSA Studio

Standalone Next.js app (the CSA Studio back-office) using Apollo Client and Tailwind.

## Run Independently

```bash
pnpm install
pnpm dev
```

This folder has its own `package.json`, `tsconfig.json`, Tailwind config, PostCSS config, and `Dockerfile`. It does not depend on monorepo-only packages.

## Required Env

- `NEXT_PUBLIC_GRAPHQL_URL`

See `.env.example` in this folder.
