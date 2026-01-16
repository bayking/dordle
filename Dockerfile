FROM oven/bun:1.3 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules node_modules
COPY src ./src
COPY tsconfig.json drizzle.config.ts ./

ENV NODE_ENV=production

USER bun
EXPOSE 3000/tcp

ENTRYPOINT ["bun", "run", "src/index.ts"]
