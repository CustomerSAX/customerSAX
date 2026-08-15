# @csa/docs-site

The public documentation portal for **customerSAX**, built with
[Fumadocs](https://fumadocs.dev) on Next.js (App Router).

- **Dev port:** 3001 (the webapp uses 3000)
- **Intended domain:** `docs.customersax.com`
- **Content:** MDX under [`content/docs`](./content/docs)
- **Theme:** the CSA blue/yellow palette, consumed from the shared
  [`@csa/ui`](../../packages/ui) design tokens (no hardcoded hex — see below)

## Run locally

```bash
pnpm install                       # from the repo root (links the workspace)
pnpm --filter @csa/docs-site dev   # http://localhost:3001
```

Other scripts:

```bash
pnpm --filter @csa/docs-site build       # production build
pnpm --filter @csa/docs-site start       # serve the production build (port 3001)
pnpm --filter @csa/docs-site typecheck   # tsc --noEmit
```

> `fumadocs-mdx` runs on `postinstall` / `predev` / `prebuild` to generate the
> `.source` directory from `content/docs`. If page lookups fail after a fresh
> checkout, run `pnpm --filter @csa/docs-site exec fumadocs-mdx` once.

## How the theme works

Fumadocs colors everything through its `--color-fd-*` CSS variable family. This
app **does not hardcode** the palette — instead:

1. `app/layout.tsx` imports `@csa/ui/styles/tokens.css` (the single source of
   truth for the CSA palette: `--csa-blue-500` `#2563EB`, `--csa-yellow-500`
   `#F5A624`, and the full scale).
2. `app/csa-theme.css` maps the Fumadocs variables onto those tokens
   (`--color-fd-primary: var(--csa-blue-500)`, etc.), for both light and dark
   themes, and layers yellow brand accents on top.

Re-value a token in `@csa/ui` and this site follows automatically.

## Content structure

```
content/docs/
  index.mdx                 Introduction / value prop
  getting-started/          Local dev, service map, ports
  architecture/             Topology (Mermaid), commerce seam, resolution flow
  api-reference/            GraphQL BFF, ai-assist /chat, auth REST
  services/                 One page per service
  guides/                   Task-oriented walkthroughs
```

Diagrams/screenshots go in [`public/img`](./public/img) and are referenced with
root-relative paths (e.g. `/img/architecture/topology.png`).

## Deployment (Cloud Run)

The [`Dockerfile`](./Dockerfile) follows the repo's Cloud Run pattern (build
context = repository root, so workspace deps like `@csa/ui` resolve):

```bash
docker build -f apps/docs-site/Dockerfile -t csa-docs-site .
```

The container honors Cloud Run's `$PORT`. Point `docs.customersax.com` at the
resulting Cloud Run service (or any Node host that can run `next start`).
```
