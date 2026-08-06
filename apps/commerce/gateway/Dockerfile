FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY apps/commerce/contract/package.json apps/commerce/contract/package.json
COPY apps/commerce/gateway/package.json apps/commerce/gateway/package.json
COPY configs/typescript/package.json configs/typescript/package.json
RUN pnpm install
COPY configs/typescript configs/typescript
COPY apps/commerce/contract apps/commerce/contract
COPY apps/commerce/gateway apps/commerce/gateway
RUN pnpm --filter @csa/commerce-contract build
RUN pnpm --filter @csa/commerce-gateway build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/commerce/contract/package.json /app/apps/commerce/contract/package.json
COPY --from=build /app/apps/commerce/contract/dist /app/apps/commerce/contract/dist
COPY --from=build /app/apps/commerce/gateway/package.json /app/apps/commerce/gateway/package.json
COPY --from=build /app/apps/commerce/gateway/dist /app/apps/commerce/gateway/dist
CMD ["pnpm", "--filter", "@csa/commerce-gateway", "start"]
