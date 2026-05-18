FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# ===== Dev stage =====
FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ===== Build stage =====
FROM base AS build
COPY . .
RUN pnpm build

# ===== Prod stage =====
FROM node:20-alpine AS prod
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["pnpm", "start"]
