# ==============================================================================
# DEVBOX PRODUCTION DOCKERFILE (Frontend + Backend on Render)
# ==============================================================================

# STAGE 1: Build Frontend (Vite + React)
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# STAGE 2: Install Server Production Dependencies
FROM node:20-alpine AS server-builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

# STAGE 3: Final Production Runtime Image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Render defaults to 10000
ENV PORT=10000
ENV SUPABASE_URL=https://tocdtmbnghwamhodkbel.supabase.co
ENV SUPABASE_SERVICE_ROLE_KEY=sb_publishable_6QPVr0zdlPNYvzXTErhZ8g_0MxBuMAM
ENV AES_MASTER_KEY=vMyvvXhLsy9inBx9U72X3M7uZdyE73fmCdtwgtfYw7ab0kU9AaiUeWN1q2tZXupo
ENV MASTER_PASSWORD=K@s112326
ENV MASTER_TOTP_SECRET=JBSWY3DPEHPK3PXP

# Install curl for container health checks
RUN apk add --no-cache curl

# Non-root user for security best practices
RUN addgroup -S devbox && adduser -S devbox -G devbox

# Copy server code and production node_modules
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/
COPY server/src ./server/src

# Copy compiled frontend SPA bundle into client/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Secure file permissions
RUN chown -R devbox:devbox /app

USER devbox

# Render default port
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-10000}/api/status || exit 1

# Start combined Express API & static frontend server
CMD ["node", "server/src/index.js"]
