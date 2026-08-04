FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY apps/commerce/package.json apps/commerce/package.json
COPY configs/typescript/package.json configs/typescript/package.json
RUN pnpm install
COPY configs/typescript configs/typescript
COPY apps/commerce apps/commerce
RUN pnpm --filter @csa/commerce build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/commerce/package.json /app/apps/commerce/package.json
COPY --from=build /app/apps/commerce/dist /app/apps/commerce/dist
CMD ["pnpm", "--filter", "@csa/commerce", "start"]

