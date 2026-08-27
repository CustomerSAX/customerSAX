# =============================================================================
# @csa/docs-site — Cloud Run image
# -----------------------------------------------------------------------------
# Build context is the REPOSITORY ROOT (same pattern as apps/ai-assist and the
# other backend services), so pnpm workspace dependencies — notably @csa/ui,
# whose design tokens this site consumes — resolve correctly.
#
#   docker build -f apps/docs-site/Dockerfile -t csa-docs-site .
#
# Intended domain: docs.customersax.com
# =============================================================================
FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable

# Install with only the manifests needed to resolve the workspace graph.
COPY package.json ./
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY .npmrc .npmrc
COPY apps/docs-site/package.json apps/docs-site/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY configs/typescript/package.json configs/typescript/package.json
RUN pnpm install

# Copy sources and build the Next.js app.
COPY configs/typescript configs/typescript
COPY packages/ui packages/ui
COPY apps/docs-site apps/docs-site
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @csa/docs-site build

# -----------------------------------------------------------------------------
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/.npmrc /app/.npmrc
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/ui /app/packages/ui
COPY --from=build /app/configs/typescript /app/configs/typescript
COPY --from=build /app/apps/docs-site /app/apps/docs-site

# Cloud Run provides $PORT (default 8080); fall back to 3001 for local runs.
ENV PORT=8080
CMD ["sh", "-c", "cd apps/docs-site && pnpm exec next start -p ${PORT:-3001} -H 0.0.0.0"]
