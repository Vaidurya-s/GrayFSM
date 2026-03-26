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

# Copy source code
COPY frontend/src ./src
COPY frontend/public ./public
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

# Copy nginx configuration
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/default.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 101 -S nginx && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

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
