# Multi-stage production Dockerfile for Roxstar Node.js Real-Time Backend
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY src ./src

# Create non-root user for security
RUN addgroup -S roxxgroup && adduser -S roxxuser -G roxxgroup
RUN mkdir -p uploads && chown -R roxxuser:roxxgroup uploads /app
USER roxxuser

# Expose HTTP / WebSocket port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/server.js"]
