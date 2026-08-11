FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY apps/admin/package.json apps/admin/package.json
COPY packages/mongodb/package.json packages/mongodb/package.json
COPY configs/typescript/package.json configs/typescript/package.json
RUN pnpm install
COPY configs/typescript configs/typescript
COPY packages/mongodb packages/mongodb
COPY apps/admin apps/admin
RUN pnpm --filter @csa/admin build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/mongodb /app/packages/mongodb
COPY --from=build /app/apps/admin/package.json /app/apps/admin/package.json
COPY --from=build /app/apps/admin/dist /app/apps/admin/dist
CMD ["pnpm", "--filter", "@csa/admin", "start"]
