# Use Node.js 18 Alpine
FROM node:18-alpine

WORKDIR /app

# Install system dependencies for wake-on-lan
RUN apk add --no-cache \
    curl \
    iputils \
    net-tools \
    openssh-client

# Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create logs and SSH directories with proper permissions
RUN mkdir -p /app/logs /app/.ssh && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set up SSH directory with correct permissions
RUN chmod 700 /app/.ssh

EXPOSE 3000

LABEL name="SPARK - Server Power Automated Remote Kontrol"
LABEL description="Web-based server power management with Wake-on-LAN"

CMD ["node", "dist/server.js"]