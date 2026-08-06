FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json package.json
RUN pnpm install
COPY next.config.mjs next.config.mjs
COPY postcss.config.mjs postcss.config.mjs
COPY tailwind.config.ts tailwind.config.ts
COPY tsconfig.json tsconfig.json
COPY next-env.d.ts next-env.d.ts
COPY src src
RUN pnpm build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/.next .next
COPY --from=build /app/next.config.mjs next.config.mjs
CMD ["pnpm", "start"]
