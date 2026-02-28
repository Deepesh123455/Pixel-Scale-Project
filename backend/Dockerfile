# --- STAGE 1: Install Dependencies & Compile C++ Modules ---
FROM node:22-alpine AS deps
WORKDIR /app

# [FIX] Install tools required for bcrypt compilation
# libc6-compat: Fixes memory alignment issues
# python3, make, g++: Required to compile bcrypt from source
RUN apk add --no-cache libc6-compat python3 make g++

COPY package*.json ./

# install dependencies (compiles bcrypt automatically here)
RUN npm ci

# --- STAGE 2: Build the App ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- STAGE 3: Prepare Production Dependencies ---
# We need a fresh stage to remove 'devDependencies' but KEEP 'bcrypt'
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++  # Needed again for rebuilding prod-only deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- STAGE 4: Final Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

# Install Tini for process management
RUN apk add --no-cache tini

ENV NODE_ENV=production

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built artifacts
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 4500

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=768", "dist/server.js"] 