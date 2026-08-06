# Customer Service Accelerator

Monorepo scaffold for the CSA architecture on GCP.

## What Is Included

- `apps/webapp`: Next.js + React frontend, intended for Firebase Hosting.
- `apps/bff`: Node.js GraphQL BFF / Apollo gateway facade.
- `apps/commerce`: Commerce service group with a shared contract and platform adapters.
- `apps/ai-assist`: Node.js AI assist service facade for Cloud Run.
- `packages/ui`: Shared React UI primitives.
- `configs/typescript`: Shared TypeScript configuration.
- `infra/gcp`: Terraform starter for GCP services in the diagram.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Terraform 1.7+
- Google Cloud SDK

## Local Development

```bash
pnpm install
pnpm dev
```

App-specific env examples live with each app:

- `apps/webapp/.env.example`
- `apps/bff/.env.example`
- `apps/ai-assist/.env.example`
- `apps/commerce/commercetools/.env.example`

Default local URLs:

- Webapp: `http://localhost:3000`
- BFF GraphQL: `http://localhost:4000/graphql`
- commercetools Adapter GraphQL: `http://localhost:4310/graphql`
- AI Assist: `http://localhost:8080`

## Federated BFF

The webapp uses Apollo Client and reads `NEXT_PUBLIC_GRAPHQL_URL` to call the BFF.

`apps/bff` runs as a local hello-world GraphQL server by default. When `FEDERATED_SERVICES` is set, it starts as an Apollo Federation gateway and introspects the configured subgraphs.

Commerce adapters can be listed as separate federated services:

```bash
FEDERATED_SERVICES='{
  "commerce-commercetools": "http://localhost:4310/graphql",
  "commerce-shopify": "http://localhost:4320/graphql",
  "commerce-bigcommerce": "http://localhost:4330/graphql",
  "commerce-sfcc": "http://localhost:4340/graphql"
}'
```

The BFF composes only the selected commerce service so duplicate commerce schemas do not conflict. Other non-commerce services can stay in the same object, Mars-style.

Use `BFF_COMMERCE_PLATFORM` to select the commerce platform the BFF should request from the commerce subgraph:

```bash
BFF_COMMERCE_PLATFORM=commercetools
```

Supported values are `commercetools`, `shopify`, `bigcommerce`, and `sfcc`. `salesforce` is accepted as an alias for `sfcc`. The BFF forwards this value as `x-csa-commerce-platform`.

## Commerce Services

`apps/commerce` is now a service group:

- `apps/commerce/contract`: Shared CSA commerce GraphQL schema and TypeScript domain types.
- `apps/commerce/commercetools`: commercetools adapter service that calls native commercetools GraphQL APIs and maps responses into the CSA contract.
- `apps/commerce/shopify`, `apps/commerce/bigcommerce`, `apps/commerce/sfcc`: Separate adapter service placeholders for future implementation.

The BFF federates directly with one selected commerce adapter from `FEDERATED_SERVICES`. The BFF-facing models stay the same:

- `Product`
- `Cart`
- `Order`
- `Customer`

Configure the commercetools adapter from `apps/commerce/commercetools/.env.example`. If the commercetools adapter is running without credentials, that adapter falls back to local sample data.

## Workspace Scripts

```bash
pnpm dev        # run all apps in development mode through Turbo
pnpm build      # build all apps and packages
pnpm lint       # run lint checks
pnpm typecheck  # run TypeScript checks
```

Workspace shortcuts:

```bash
pnpm app:webapp
pnpm app:bff
pnpm app:commerce-commercetools
pnpm app:commerce-shopify
pnpm app:commerce-bigcommerce
pnpm app:commerce-sfcc
pnpm app:ai-assist
pnpm lib:ui
pnpm cfg:typescript
pnpm infra:gcp
```

## Terraform

```bash
cd infra/gcp
terraform init
terraform plan \
  -var="project_id=YOUR_GCP_PROJECT" \
  -var="region=us-central1" \
  -var="environment=dev"
```

The Terraform is intentionally a starter layer. It enables the core APIs and declares Cloud Run services, Secret Manager secrets, Cloud SQL, Firestore, Cloud Storage, and BigQuery resources that match the diagram.

## Multi-LLM Support

`apps/ai-assist` supports provider selection per request:

```bash
curl -X POST http://localhost:8080/assist \
  -H "content-type: application/json" \
  -d '{"provider":"openai","message":"Write a short ticket summary"}'
```

Supported provider values:

- `openai`
- `anthropic` or `claude`
- `grok` or `xai`

Configure defaults with:

- `AI_COMMERCE_PLATFORM`
- `DEFAULT_LLM_PROVIDER`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL` when a custom Gateway endpoint is required
- `OPENAI_MODEL` such as `openai/gpt-5.6-luna`
- `ANTHROPIC_MODEL` such as `anthropic/claude-sonnet-4-6`
- `XAI_MODEL` such as `xai/grok-4.5`

The current implementation uses Vercel AI SDK with Vercel AI Gateway behind a small CSA provider router. That gives us a stable application contract while the Gateway handles multi-provider model access through one API key. LangGraph is still a later step, useful when the assistant becomes a stateful workflow with multi-step orchestration, approvals, resumable runs, retries, and persistent memory.

## Monorepo Shape

This repository follows the same broad layout style as the Phoenix MACH monorepo:

- `apps/*` for deployable services and frontends.
- `packages/*` for shared source packages.
- `configs/*` for reusable tool configuration packages.
- `infra/*` for infrastructure workspaces.
- `turbo.json` for task orchestration across workspaces.
