# Ludora Fly.io Deployment Plan
**Created**: 2025-09-22
**Status**: In Progress
**Session Recovery**: Use this document to continue deployment if session is interrupted

## Project Overview
- **API**: Node.js/Express with PostgreSQL, Firebase Auth, AWS S3
- **Frontend**: React 18 + Vite, Tailwind CSS, Radix UI
- **Features**: Educational gaming, file uploads, video streaming
- **Target**: Production deployment on Fly.io with custom domain

## Prerequisites Checklist
- [ ] Fly.io account created
- [ ] Custom domain name ready
- [ ] Firebase service account credentials
- [ ] AWS S3 credentials (for file/video storage)

---

## Phase 1: Git Repository Reset & Setup

### Step 1: Delete Existing Git Data
```bash
# Navigate to project root
cd /Users/omri/omri-dev/base44/ludora

# Remove existing git data
rm -rf ludora-api/.git
rm -rf ludora-front/.git
rm -rf .git  # Remove root git if exists
```

### Step 2: Review and Update .gitignore Files

**ludora-api/.gitignore** should include:
```
node_modules/
.env*
!.env.example
logs/
uploads/
dist/
build/
.DS_Store
*.log
pm2-*.log
coverage/
.nyc_output/
.vscode/
.idea/
```

**ludora-front/.gitignore** should include:
```
node_modules/
.env*
!.env.example
dist/
build/
.DS_Store
*.log
.vscode/
.idea/
coverage/
.nyc_output/
```

### Step 3: Initialize New Git Repositories
```bash
# Initialize API repository
cd ludora-api
git init
git add .
git commit -m "init. pre deploy"

# Initialize Frontend repository
cd ../ludora-front
git init
git add .
git commit -m "init. pre deploy"
```

**Status**: [ ] Complete

---

## Phase 2: Fly.io Platform Setup

### Step 4: Install Fly CLI
```bash
# Install Fly CLI (macOS)
curl -L https://fly.io/install.sh | sh

# Add to PATH
export PATH="$HOME/.fly/bin:$PATH"

# Authenticate
flyctl auth login
```

### Step 5: Create PostgreSQL Database
```bash
# Create PostgreSQL cluster
flyctl postgres create --name ludora-db --region ord

# Note the connection details for later use
# Format: postgres://username:password@hostname:5432/database
```

**Status**: [ ] Complete

---

## Phase 3: API Deployment Configuration

### Step 6: Create Production Dockerfile for API

**File**: `ludora-api/Dockerfile`
```dockerfile
# Multi-stage build for Node.js app
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app .

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
```

### Step 7: Create fly.toml for API

**File**: `ludora-api/fly.toml`
```toml
app = "ludora-api"
primary_region = "ord"

[build]

[env]
  ENVIRONMENT = "production"
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    protocol = "http"
    timeout = "5s"

[machine]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1

[[statics]]
  guest_path = "/app/uploads"
  url_prefix = "/uploads"
```

### Step 8: Configure Environment Variables
```bash
# Set database connection
flyctl secrets set DATABASE_URL="postgres://username:password@hostname:5432/database" -a ludora-api

# Set Firebase credentials
flyctl secrets set FIREBASE_PROJECT_ID="your-project-id" -a ludora-api
flyctl secrets set FIREBASE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com" -a ludora-api
flyctl secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..." -a ludora-api

# Set AWS S3 credentials
flyctl secrets set AWS_ACCESS_KEY_ID="your-access-key" -a ludora-api
flyctl secrets set AWS_SECRET_ACCESS_KEY="your-secret-key" -a ludora-api
flyctl secrets set AWS_REGION="us-west-2" -a ludora-api
flyctl secrets set AWS_S3_BUCKET="your-bucket-name" -a ludora-api

# Set JWT secret
flyctl secrets set JWT_SECRET="your-random-jwt-secret" -a ludora-api
```

**Status**: [ ] Complete

---

## Phase 4: API Deployment Execution

### Step 9: Deploy API Service
```bash
cd ludora-api

# Initialize fly app
flyctl apps create ludora-api

# Deploy the API
flyctl deploy

# Run database migrations
flyctl ssh console -a ludora-api
npm run migrate:prod
exit

# Check deployment
flyctl status -a ludora-api
flyctl logs -a ludora-api
```

### Step 10: Verify API Functionality
```bash
# Test health endpoint
curl https://ludora-api.fly.dev/health

# Test API endpoints
curl https://ludora-api.fly.dev/api/health
```

**Status**: [ ] Complete

---

## Phase 5: Frontend Deployment Configuration

### Step 11: Create Production Dockerfile for Frontend

**File**: `ludora-front/Dockerfile`
```dockerfile
# Multi-stage build for React app
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image with Nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Step 12: Create Nginx Configuration

**File**: `ludora-front/nginx.conf`
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

### Step 13: Create fly.toml for Frontend

**File**: `ludora-front/fly.toml`
```toml
app = "ludora-front"
primary_region = "ord"

[build]

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 80
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[machine]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

### Step 14: Update Frontend Environment
**File**: `ludora-front/.env.production`
```
VITE_API_URL=https://ludora-api.fly.dev
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

**Status**: [ ] Complete

---

## Phase 6: Frontend Deployment Execution

### Step 15: Deploy Frontend Service
```bash
cd ludora-front

# Initialize fly app
flyctl apps create ludora-front

# Deploy the frontend
flyctl deploy

# Check deployment
flyctl status -a ludora-front
flyctl logs -a ludora-front
```

### Step 16: Test Frontend
```bash
# Test frontend
curl https://ludora-front.fly.dev
```

**Status**: [ ] Complete

---

## Phase 7: File Storage & Media Configuration

### Step 17: Verify AWS S3 Integration
- Ensure S3 bucket exists and has proper CORS configuration
- Test file upload endpoints
- Verify video streaming functionality

**S3 CORS Configuration**:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["https://yourdomain.com", "https://ludora-front.fly.dev"],
        "ExposeHeaders": []
    }
]
```

**Status**: [ ] Complete

---

## Phase 8: Domain & SSL Configuration

### Step 18: Configure Custom Domain
```bash
# Add custom domain to frontend
flyctl certs create yourdomain.com -a ludora-front
flyctl certs create www.yourdomain.com -a ludora-front

# Add custom domain to API
flyctl certs create api.yourdomain.com -a ludora-api

# Get DNS configuration
flyctl ips list -a ludora-front
flyctl ips list -a ludora-api
```

### Step 19: DNS Configuration
Add these DNS records to your domain:
```
A     yourdomain.com        -> [ludora-front IP]
A     www.yourdomain.com    -> [ludora-front IP]
A     api.yourdomain.com    -> [ludora-api IP]
AAAA  yourdomain.com        -> [ludora-front IPv6]
AAAA  www.yourdomain.com    -> [ludora-front IPv6]
AAAA  api.yourdomain.com    -> [ludora-api IPv6]
```

### Step 20: Update Frontend Environment for Custom Domain
```bash
# Update frontend environment
flyctl secrets set VITE_API_URL="https://api.yourdomain.com" -a ludora-front

# Redeploy frontend
cd ludora-front
flyctl deploy
```

**Status**: [ ] Complete

---

## Phase 9: Final Testing & Validation

### Step 21: Comprehensive Testing Checklist
- [ ] Frontend loads at yourdomain.com
- [ ] API responds at api.yourdomain.com/health
- [ ] User registration works
- [ ] User login works
- [ ] File upload functionality works
- [ ] Video streaming works
- [ ] Database operations work
- [ ] All pages load correctly
- [ ] Mobile responsiveness

### Step 22: Performance Optimization
- [ ] Check Fly.io metrics
- [ ] Monitor response times
- [ ] Verify caching headers
- [ ] Test from different geographic locations

**Status**: [ ] Complete

---

## Troubleshooting Guide

### Common Issues:

1. **Database Connection Issues**
   - Check DATABASE_URL secret
   - Verify PostgreSQL cluster is running
   - Test connection from Fly console

2. **Environment Variables**
   - List secrets: `flyctl secrets list -a app-name`
   - Update secrets: `flyctl secrets set KEY=value -a app-name`

3. **Build Failures**
   - Check Dockerfile syntax
   - Verify package.json dependencies
   - Review build logs: `flyctl logs -a app-name`

4. **SSL Certificate Issues**
   - Check certificate status: `flyctl certs show yourdomain.com -a app-name`
   - Verify DNS propagation
   - Wait for certificate validation (can take up to 24 hours)

5. **File Upload Issues**
   - Verify S3 credentials
   - Check CORS configuration
   - Test S3 bucket permissions

### Useful Commands:
```bash
# View app status
flyctl status -a app-name

# View logs
flyctl logs -a app-name

# SSH into machine
flyctl ssh console -a app-name

# Scale machines
flyctl scale count 2 -a app-name

# Update secrets
flyctl secrets set KEY=value -a app-name

# Redeploy
flyctl deploy -a app-name
```

---

## Session Recovery

If this session is interrupted, continue from the last completed phase. Check the status of each phase and resume from the next uncompleted step.

**Current Progress**: Phase 1 - Creating deployment plan document
**Next Step**: Delete existing git data from both projects

---

## Post-Deployment

### Monitoring
- Set up Fly.io monitoring dashboards
- Configure log aggregation
- Set up error alerting

### Backup Strategy
- PostgreSQL automatic backups enabled
- Document recovery procedures
- Test backup restoration

### Scaling Plan
- Monitor resource usage
- Plan for horizontal scaling
- Consider CDN for static assets

---

**End of Deployment Plan**