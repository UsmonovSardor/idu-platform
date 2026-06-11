# ── Builder stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install production deps only
COPY idu-backend/package*.json ./idu-backend/
RUN cd idu-backend && npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as non-root
RUN addgroup -S idu && adduser -S idu -G idu

WORKDIR /app

# Copy backend deps from builder
COPY --from=builder /app/idu-backend/node_modules ./idu-backend/node_modules

# Copy source
COPY idu-backend/ ./idu-backend/
COPY idu-frontend/ ./idu-frontend/

# Upload directory for local dev fallback
RUN mkdir -p /app/uploads && chown idu:idu /app/uploads

USER idu

WORKDIR /app/idu-backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
