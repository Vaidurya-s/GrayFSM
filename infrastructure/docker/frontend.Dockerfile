# Multi-stage Dockerfile for React Frontend
# Stage 1: Build
FROM node:20-alpine as builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code and config files
COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig.json ./
COPY frontend/tsconfig.node.json ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/.eslintrc.cjs ./

# Build application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy nginx configuration. default.conf is rendered from a template at
# container start: the nginx entrypoint runs envsubst on /etc/nginx/templates/*.
# Only BACKEND_* vars are substituted (NGINX_ENVSUBST_FILTER) so nginx's own
# $host/$uri/etc. are left intact. Defaults target docker-compose; override
# BACKEND_PROXY_PASS + BACKEND_HOST when the backend is a separate service.
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/default.conf.template /etc/nginx/templates/default.conf.template

ENV BACKEND_PROXY_PASS=http://backend:8000 \
    BACKEND_HOST=backend \
    NGINX_ENVSUBST_FILTER=BACKEND_

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Change ownership
RUN chown -R nginx:nginx /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
