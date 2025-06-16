# Multi-stage build for faster builds and smaller final image
FROM node:20-alpine AS builder

WORKDIR /app

# Update npm to latest version to avoid warnings
RUN npm install -g npm@latest

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Build the application
RUN npm run build

# Production stage - smaller and more secure
FROM node:20-alpine AS production

WORKDIR /app

# Update npm in production stage too
RUN npm install -g npm@latest

# Install runtime dependencies (WoL tools optional - SPARK has built-in UDP)
RUN apk add --no-cache \
    curl \
    iputils \
    net-tools \
    openssh-client \
    netcat-openbsd \
    bash \
    ethtool \
    iproute2

# Copy package files
COPY package*.json ./

# Install only production dependencies and clean cache
RUN npm install --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create directories with proper permissions
RUN mkdir -p /app/logs /app/.ssh && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set up SSH directory with correct permissions
RUN chmod 700 /app/.ssh

EXPOSE 3000

LABEL name="SPARK - Server Power Automated Remote Kontrol" \
      description="Web-based server power management with Wake-on-LAN" \
      version="1.0.0"

CMD ["node", "dist/server.js"]