# Customer Service Accelerator

Enterprise-grade customer service operations platform built on GCP — AI-powered support, commerce integration, and real-time analytics in a single monorepo.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTENDS                                │
│  Studio (3000)  │  Marketing (3100)  │  Docs (3200)            │
└───────┬─────────┴────────────────────┴──────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│                     BFF / API GATEWAY                           │
│  Apollo Federation Gateway (4000)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Commerce │ │ Ticketing│ │  Admin   │ │ AI Assist│          │
│  │  (4310)  │ │  (4350)  │ │  (4360)  │ │  (8080)  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│                     DATA / INFRA (GCP)                          │
│  MongoDB  │  Cloud SQL  │  Firestore  │  BigQuery  │  GCS      │
└─────────────────────────────────────────────────────────────────┘
```

## What's Included

### Frontends
| App | Path | Port | Description |
|-----|------|------|-------------|
| **Studio** | `apps/studio` | 3000 | Next.js dashboard — tickets, orders, customers, AI assistant |
| **Marketing** | `apps/marketing` | 3100 | Next.js 16 marketing/landing site |
| **Docs** | `apps/docs-site` | 3200 | Fumadocs-powered API & architecture docs |

### Backend Services
| Service | Path | Port | Description |
|---------|------|------|-------------|
| **BFF** | `apps/bff` | 4000 | Apollo Federation gateway |
| **Auth** | `apps/auth` | 4100 | JWT authentication service |
| **Commerce** | `apps/commerce/*` | 4310–4340 | Multi-platform commerce adapters |
| **Ticketing** | `apps/ticketing` | 4350 | MongoDB-backed ticket subgraph |
| **Admin** | `apps/admin` | 4360 | Admin operations subgraph |
| **AI Assist** | `apps/ai-assist` | 8080 | Multi-LLM AI assistant (Vercel AI SDK) |

### Shared Packages
| Package | Path | Description |
|---------|------|-------------|
| `@csa/ui` | `packages/ui` | Shared React UI primitives, design tokens, Tailwind preset |
| `@csa/config` | `packages/config` | Environment configuration utilities |
| `@csa/logger` | `packages/logger` | Structured logging (Pino) |
| `@csa/mongodb` | `packages/mongodb` | MongoDB client + field encryption |
| `@csa/cache` | `packages/cache` | Redis/memory cache layer |
| `@csa/headers` | `packages/headers` | CSA HTTP header utilities |
| `@csa/service-bootstrap` | `packages/service-bootstrap` | Service startup helpers |

### Infrastructure
| Path | Description |
|------|-------------|
| `infra/gcp` | Terraform root — Cloud Run, Secret Manager, Cloud SQL, BigQuery |
| `apps/*/terraform` | Per-service Terraform modules (portable) |
| `.github/workflows` | CI/CD — GitHub Actions → Cloud Build → Cloud Run |

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Terraform** 1.7+
- **Google Cloud SDK** (`gcloud`)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env files
cp apps/studio/.env.example apps/studio/.env
cp apps/bff/.env.example apps/bff/.env
# ... repeat for each app

# 3. Start core stack (Studio + BFF + Auth + Commerce + Ticketing)
pnpm dev:studio

# 4. Or start everything
pnpm dev:all
```

## Commands

### Clean & Install

| Command | Description |
|---------|-------------|
| `pnpm clean` | Remove `dist/` and `.next/` build artifacts |
| `pnpm clean:all` | ↑ plus delete **all `node_modules/`** and `.turbo` cache |
| `pnpm fresh` | Nuclear reset — `clean:all` → `install` → `build` |

### Build

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all 23 packages via Turbo |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | Run lint checks across all packages |

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages with `dev` script |
| `pnpm dev:all` | All backends + Studio + Marketing + Docs |
| `pnpm dev:studio` | Studio + BFF + Auth + Commerce + Ticketing (core stack) |
| `pnpm dev:marketing` | Marketing site only |
| `pnpm dev:docs` | Docs site only |

### Production

| Command | Description |
|---------|-------------|
| `pnpm start` | Start all apps in production mode |
| `pnpm start:all` | Studio + Marketing + Docs (frontend trio) |

### App Shortcuts

```bash
pnpm app:studio              # @csa/studio
pnpm app:bff                 # @csa/bff
pnpm app:auth                # @csa/auth
pnpm app:ai-assist            # @csa/ai-assist
pnpm app:admin                # @csa/admin
pnpm app:ticketing            # @csa/ticketing
pnpm app:commerce-commercetools
pnpm app:commerce-shopify
pnpm app:commerce-bigcommerce
pnpm app:commerce-sfcc
pnpm app:marketing            # marketing
pnpm app:docs                 # @csa/docs-site
```

## Local URLs

| App | URL |
|-----|-----|
| Studio | http://localhost:3000 |
| Marketing | http://localhost:3100 |
| Docs | http://localhost:3200 |
| BFF GraphQL | http://localhost:4000/graphql |
| Auth | http://localhost:4100 |
| Commerce (commercetools) | http://localhost:4310/graphql |
| Ticketing | http://localhost:4350/graphql |
| Admin | http://localhost:4360/graphql |
| AI Assist | http://localhost:8080 |

## Federated BFF

The Studio app uses Apollo Client and reads `NEXT_PUBLIC_GRAPHQL_URL` to call the BFF.

`apps/bff` runs as a local hello-world GraphQL server by default. When `FEDERATED_SERVICES` is set, it starts as an Apollo Federation gateway and introspects the configured subgraphs.

```bash
FEDERATED_SERVICES='{
  "commerce-commercetools": "http://localhost:4310/graphql",
  "commerce-shopify": "http://localhost:4320/graphql",
  "commerce-bigcommerce": "http://localhost:4330/graphql",
  "commerce-sfcc": "http://localhost:4340/graphql",
  "ticketing": "http://localhost:4350/graphql"
}'
```

Use `BFF_COMMERCE_PLATFORM` to select the active commerce adapter:

```bash
BFF_COMMERCE_PLATFORM=commercetools
```

Supported: `commercetools`, `shopify`, `bigcommerce`, `sfcc` (alias: `salesforce`).

## Commerce Services

`apps/commerce` is a service group with a shared contract:

- **`apps/commerce/contract`** — Shared CSA commerce GraphQL schema and TypeScript domain types
- **`apps/commerce/commercetools`** — commercetools adapter (fully implemented)
- **`apps/commerce/shopify`** — Shopify adapter placeholder
- **`apps/commerce/bigcommerce`** — BigCommerce adapter placeholder
- **`apps/commerce/sfcc`** — Salesforce Commerce Cloud adapter placeholder

Each adapter is independently deployable with its own `Dockerfile` and Terraform module.

## Ticketing Service

`apps/ticketing` is a standalone MongoDB-backed Apollo subgraph:

```
Studio → BFF GraphQL → Ticketing subgraph → MongoDB
```

Configure from `apps/ticketing/.env.example`:

```env
TICKETING_PORT=4350
MONGO_URI=
MONGO_DB_NAME=csa
MONGO_TICKETS_COLLECTION=Tickets
TICKETING_PROJECT_KEY=default
```

## Multi-LLM Support

`apps/ai-assist` supports multiple LLM providers via Vercel AI Gateway:

```bash
curl -X POST http://localhost:8080/assist \
  -H "content-type: application/json" \
  -d '{"provider":"openai","message":"Write a short ticket summary"}'
```

Supported providers: `openai`, `anthropic`/`claude`, `grok`/`xai`

Key env vars:
- `DEFAULT_LLM_PROVIDER` — default provider
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key
- `OPENAI_MODEL` — e.g. `openai/gpt-5.6-luna`
- `ANTHROPIC_MODEL` — e.g. `anthropic/claude-sonnet-4-6`
- `XAI_MODEL` — e.g. `xai/grok-4.5`

## Terraform / Infrastructure

```bash
cd infra/gcp
terraform init
terraform plan \
  -var="project_id=YOUR_GCP_PROJECT" \
  -var="region=us-central1" \
  -var="environment=dev"
```

Per-service Terraform modules live beside each deployable service:

```
apps/bff/terraform
apps/ai-assist/terraform
apps/ticketing/terraform
apps/auth/terraform
apps/admin/terraform
apps/studio/terraform
apps/commerce/commercetools/terraform
apps/commerce/shopify/terraform
apps/commerce/bigcommerce/terraform
apps/commerce/sfcc/terraform
```

## Design System

The UI uses a 3-layer token system defined in `packages/ui`:

- **Brand Yellow** `#F5A624` — CTA buttons, active highlights
- **Brand Blue** `#1B4BEB` — Sidebar, accent backgrounds
- **Navy** `#07103D` — Text, dark surfaces

Components are built with **shadcn/ui** + **Tailwind CSS** via a shared preset (`@csa/ui/preset`).

## Monorepo Shape

```
customerSAX/
├── apps/
│   ├── studio/          # Next.js 14 dashboard (Vercel)
│   ├── marketing/       # Next.js 16 landing site
│   ├── docs-site/       # Fumadocs documentation
│   ├── bff/             # Apollo Federation gateway
│   ├── auth/            # JWT auth service
│   ├── admin/           # Admin operations subgraph
│   ├── ai-assist/       # Multi-LLM AI assistant
│   ├── ticketing/       # Ticket management subgraph
│   └── commerce/
│       ├── contract/    # Shared GraphQL schema
│       ├── commercetools/
│       ├── shopify/
│       ├── bigcommerce/
│       └── sfcc/
├── packages/
│   ├── ui/              # Design tokens, components, Tailwind preset
│   ├── config/          # Env utilities
│   ├── logger/          # Pino logger
│   ├── mongodb/         # MongoDB client + encryption
│   ├── cache/           # Cache layer
│   ├── headers/         # HTTP header utilities
│   └── service-bootstrap/
├── infra/gcp/           # Terraform root module
├── .github/workflows/   # CI/CD pipeline
├── turbo.json           # Turborepo task config
└── package.json         # Root workspace scripts
```

## License

Private — © 2026 Royal Cyber
