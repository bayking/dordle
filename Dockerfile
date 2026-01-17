FROM oven/bun:1.3 AS base
WORKDIR /app

# Install fonts for chart rendering
RUN apt-get update && apt-get install -y fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

FROM base AS install
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules node_modules
COPY src ./src
COPY tsconfig.json drizzle.config.ts ./

ENV NODE_ENV=production

CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]
