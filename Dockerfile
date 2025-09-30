# Multi-stage build for Node.js app
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage (if needed)
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV ENVIRONMENT=production

# Create nodejs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy node_modules from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
# Copy application code
COPY --from=builder --chown=nodejs:nodejs /app .

# Create necessary directories with proper permissions
RUN mkdir -p logs uploads && chown -R nodejs:nodejs logs uploads

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || '3000'; require('http').get('http://localhost:' + port + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]