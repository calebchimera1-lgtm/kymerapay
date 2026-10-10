# syntax=docker/dockerfile:1
# Build context: repository root (npm workspaces share one lockfile).

# ── build: full dependencies, compiled output ───────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace @app/shared --workspace @app/server --include-workspace-root
COPY shared shared
COPY server server
RUN npm run build -w @app/shared && npm run build -w @app/server

# ── migrate: one-shot job that applies migrations (and can run the seed) ────
FROM build AS migrate
WORKDIR /app/server
CMD ["npx", "prisma", "migrate", "deploy"]

# ── prod-deps: strip dev dependencies ───────────────────────────────────────
FROM build AS prod-deps
RUN npm prune --omit=dev --workspace @app/shared --workspace @app/server

# ── runtime: minimal, non-root API image ────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/shared/package.json shared/
COPY --from=prod-deps --chown=node:node /app/shared/dist shared/dist
COPY --from=prod-deps --chown=node:node /app/server/package.json server/
COPY --from=prod-deps --chown=node:node /app/server/dist server/dist
# Writable directory for uploaded images (mount a volume here in production).
RUN mkdir -p /app/server/uploads && chown node:node /app/server/uploads
USER node
WORKDIR /app/server
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/server.js"]
