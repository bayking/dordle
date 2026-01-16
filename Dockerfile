FROM oven/bun:1.3 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules node_modules
COPY src ./src
COPY tsconfig.json drizzle.config.ts ./

RUN mkdir -p /app/data && chown -R bun:bun /app/data

ENV NODE_ENV=production

USER bun

ENTRYPOINT ["bun", "run", "src/index.ts"]
