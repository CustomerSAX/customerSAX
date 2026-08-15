# =============================================================================
# @csa/webapp — Cloud Run image
# -----------------------------------------------------------------------------
# Build context is the REPOSITORY ROOT (same pattern as the backend services
# and apps/docs-site), so pnpm workspace dependencies — @csa/ui, @csa/headers,
# @csa/logger — resolve correctly.
#
#   docker build -f apps/webapp/Dockerfile -t csa-webapp .
# =============================================================================
FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable

# Install with only the manifests needed to resolve the workspace graph.
COPY package.json ./
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY .npmrc .npmrc
COPY apps/webapp/package.json apps/webapp/package.json
COPY packages/headers/package.json packages/headers/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY configs/typescript/package.json configs/typescript/package.json
RUN pnpm install

# Copy sources and build the Next.js app.
COPY configs/typescript configs/typescript
COPY packages/headers packages/headers
COPY packages/logger packages/logger
COPY packages/ui packages/ui
COPY apps/webapp apps/webapp
RUN pnpm --filter @csa/webapp build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/.npmrc /app/.npmrc
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/headers /app/packages/headers
COPY --from=build /app/packages/logger /app/packages/logger
COPY --from=build /app/packages/ui /app/packages/ui
COPY --from=build /app/apps/webapp /app/apps/webapp
CMD ["pnpm", "--filter", "@csa/webapp", "start"]
