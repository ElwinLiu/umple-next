FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

FROM oven/bun:1-alpine

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/src ./src

USER bun

EXPOSE 3002

CMD ["bun", "run", "src/server.ts"]
