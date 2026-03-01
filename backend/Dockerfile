# syntax=docker/dockerfile:1
# --- STAGE 1: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app

# 1. Copy package files first for layer caching
COPY package*.json ./

# 2. Cache npm downloads so we don't fetch from the internet every build
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 3. Copy source and build your TypeScript app
COPY . .
RUN npm run build

# 4. Remove devDependencies (leaving only pure JS prod dependencies)
RUN npm prune --production

# --- STAGE 2: Final Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 1. Install Tini for process management (Cached)
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache tini

# 2. Use the built-in 'node' user from the official image
# Copy artifacts and assign ownership in a single layer
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# 3. Drop privileges to the non-root user
USER node

EXPOSE 4500

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=768", "dist/server.js"]