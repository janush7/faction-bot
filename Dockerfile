# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S botgroup && adduser -S botuser -G botgroup
USER botuser

CMD ["node", "src/index.js"]
