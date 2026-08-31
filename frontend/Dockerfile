FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app

RUN bun add -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["bunx", "serve", "-s", "dist", "-l", "3000"]
