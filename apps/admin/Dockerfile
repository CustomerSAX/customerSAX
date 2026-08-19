FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY apps/admin/package.json apps/admin/package.json
COPY packages/cache/package.json packages/cache/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/headers/package.json packages/headers/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/mongodb/package.json packages/mongodb/package.json
COPY packages/service-bootstrap/package.json packages/service-bootstrap/package.json
COPY configs/typescript/package.json configs/typescript/package.json
RUN pnpm install
COPY configs/typescript configs/typescript
COPY packages/cache packages/cache
COPY packages/config packages/config
COPY packages/headers packages/headers
COPY packages/logger packages/logger
COPY packages/mongodb packages/mongodb
COPY packages/service-bootstrap packages/service-bootstrap
COPY apps/admin apps/admin
RUN pnpm --filter @csa/admin... --if-present build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/cache /app/packages/cache
COPY --from=build /app/packages/config /app/packages/config
COPY --from=build /app/packages/headers /app/packages/headers
COPY --from=build /app/packages/logger /app/packages/logger
COPY --from=build /app/packages/mongodb /app/packages/mongodb
COPY --from=build /app/packages/service-bootstrap /app/packages/service-bootstrap
COPY --from=build /app/apps/admin/node_modules /app/apps/admin/node_modules
COPY --from=build /app/apps/admin/package.json /app/apps/admin/package.json
COPY --from=build /app/apps/admin/src /app/apps/admin/src
COPY --from=build /app/apps/admin/dist /app/apps/admin/dist
CMD ["pnpm", "--filter", "@csa/admin", "start"]
