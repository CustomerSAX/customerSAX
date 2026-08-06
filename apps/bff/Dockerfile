FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json package.json
RUN pnpm install
COPY tsconfig.json tsconfig.json
COPY src src
RUN pnpm build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
CMD ["pnpm", "start"]
