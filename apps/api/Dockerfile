# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/prisma apps/api/prisma

RUN pnpm install --filter api... --frozen-lockfile

FROM deps AS build

COPY apps/api apps/api
COPY packages/contracts packages/contracts

RUN pnpm --filter api build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3000

CMD ["node", "apps/api/dist/apps/api/src/main.js"]
