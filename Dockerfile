# Multi-stage build for optimal size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install system dependencies for wake-on-lan
RUN apk add --no-cache \
    curl \
    iputils \
    net-tools

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

LABEL name="SPARK - Server Power Automated Remote Kontrol"
LABEL description="Web-based server power management with Wake-on-LAN"

CMD ["node", "dist/server.js"]
