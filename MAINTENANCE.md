# Ludora API - Maintenance Guide

This guide covers all maintenance tasks for the Ludora API server, including PM2 process management, log management, and system monitoring.

## Table of Contents

1. [PM2 Process Management](#pm2-process-management)
2. [Log Management](#log-management)
3. [Health Monitoring](#health-monitoring)
4. [Maintenance Tasks](#maintenance-tasks)
5. [Troubleshooting](#troubleshooting)
6. [Environment Management](#environment-management)

---

## PM2 Process Management

### Starting the Server

```bash
# Development environment
npm run pm2:start

# Staging environment
npm run pm2:start:staging

# Production environment
npm run pm2:start:prod

# Alternative: Direct PM2 commands
pm2 start ecosystem.config.js --only ludora-api-dev
pm2 start ecosystem.config.js --only ludora-api-staging
pm2 start ecosystem.config.js --only ludora-api-prod
```

### Stopping the Server

```bash
# Development environment
npm run pm2:stop

# Staging environment
npm run pm2:stop:staging

# Production environment
npm run pm2:stop:prod

# Alternative: Direct PM2 commands
pm2 stop ludora-api-dev
pm2 stop ludora-api-staging
pm2 stop ludora-api-prod
```

### Restarting the Server

```bash
# Hard restart (stops then starts)
npm run pm2:restart
npm run pm2:restart:staging
npm run pm2:restart:prod

# Graceful reload (zero-downtime, production recommended)
npm run pm2:reload
npm run pm2:reload:staging
npm run pm2:reload:prod
```

### Checking Server Status

```bash
# View all processes
npm run pm2:status
# or
pm2 status

# View detailed process information
pm2 show ludora-api-dev
pm2 show ludora-api-staging
pm2 show ludora-api-prod

# Real-time monitoring
npm run pm2:monit
# or
pm2 monit
```

### Deleting Processes

```bash
# Delete specific process
npm run pm2:delete

# Delete all processes (use with caution!)
npm run pm2:delete:all
# or
pm2 delete all
```

---

## Log Management

### Viewing Logs

```bash
# Follow live logs
npm run pm2:logs              # Development
npm run pm2:logs:staging      # Staging
npm run pm2:logs:prod         # Production

# Alternative methods
npm run logs:tail             # Tail combined log
npm run logs:tail:error       # Tail error log only
npm run logs:view:recent      # View last 100 lines
npm run logs:view:errors      # View recent errors
```

### Log File Locations

```
logs/
├── pm2-combined-0.log        # Development combined logs
├── pm2-out-0.log            # Development stdout logs
├── pm2-error-0.log          # Development error logs
├── staging-combined.log      # Staging combined logs
├── staging-out.log          # Staging stdout logs
├── staging-error.log        # Staging error logs
├── production-combined.log   # Production combined logs
├── production-out.log       # Production stdout logs
├── production-error.log     # Production error logs
└── backup-YYYYMMDD/         # Backup directories
```

### Log Rotation Configuration

Our PM2 log rotation is configured with:
- **Max file size**: 50MB per log file
- **Retention**: 7 rotated files kept
- **Compression**: Enabled (gzip)
- **Rotation schedule**: Daily at midnight (0 0 * * *)
- **Date format**: YYYY-MM-DD_HH-mm-ss

```bash
# View current log rotation settings
npm run logs:logrotate:config
# or
pm2 conf pm2-logrotate

# Force immediate log rotation
npm run logs:logrotate:force
# or
pm2 trigger pm2-logrotate rotate

# Reload logs (clears log files)
npm run logs:rotate
# or
pm2 reloadLogs
```

### Manual Log Management

```bash
# Check log sizes
npm run logs:size

# Create backup before cleanup
npm run logs:backup

# Clean logs (truncate to 0 bytes)
npm run logs:clean

# Flush all PM2 logs
npm run pm2:flush

# Complete maintenance cleanup
npm run maintenance:cleanup
```

---

## Health Monitoring

### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3003/health

# With JSON formatting (requires jq)
npm run maintenance:health

# API info endpoint
curl http://localhost:3003/api
```

### System Status Check

```bash
# Complete system status
npm run maintenance:status

# This runs:
# 1. PM2 process status
# 2. Log file sizes
# 3. System resource usage
```

### Port Management

The API runs on different ports per environment:
- **Development**: Port 3003
- **Staging**: Port 3003
- **Production**: Port 3005

Check if ports are in use:
```bash
lsof -i :3003  # Development
lsof -i :3003  # Staging
lsof -i :3005  # Production
```

---

## Maintenance Tasks

### Daily Tasks

1. **Check process status**:
   ```bash
   npm run maintenance:status
   ```

2. **Review error logs**:
   ```bash
   npm run logs:view:errors
   ```

3. **Verify health endpoints**:
   ```bash
   npm run maintenance:health
   ```

### Weekly Tasks

1. **Log cleanup and rotation**:
   ```bash
   npm run maintenance:cleanup
   ```

2. **Review log sizes**:
   ```bash
   npm run logs:size
   ```

3. **Check system resources**:
   ```bash
   npm run pm2:monit
   ```

### Monthly Tasks

1. **Review and archive old backups**:
   ```bash
   ls -la logs/backup-*
   # Remove old backups manually if needed
   ```

2. **Update log rotation settings if needed**:
   ```bash
   pm2 set pm2-logrotate:max_size 50M
   pm2 set pm2-logrotate:retain 7
   ```

---

## Troubleshooting

### Common Issues

#### 1. Process Won't Start

```bash
# Check for syntax errors
node index.js

# Check environment variables
cat development.env

# Check port availability
lsof -i :3003
```

#### 2. High Memory Usage

```bash
# Check memory usage
npm run pm2:monit

# Restart process to free memory
npm run pm2:restart

# Check for memory leaks in logs
npm run logs:view:recent | grep -i memory
```

#### 3. Log Files Growing Too Large

```bash
# Check current sizes
npm run logs:size

# Force log rotation
npm run logs:logrotate:force

# Clean up immediately
npm run logs:backup
npm run logs:clean
```

#### 4. Process Keeps Crashing

```bash
# Check error logs
npm run logs:tail:error

# View recent crashes
pm2 show ludora-api-dev

# Check for specific error patterns
npm run logs:view:errors
```

### Emergency Recovery

If the server is completely unresponsive:

1. **Kill all PM2 processes**:
   ```bash
   pm2 kill
   ```

2. **Clean up logs**:
   ```bash
   npm run logs:backup
   npm run logs:clean
   ```

3. **Restart from scratch**:
   ```bash
   npm run pm2:start
   ```

4. **Verify functionality**:
   ```bash
   npm run maintenance:health
   npm run maintenance:status
   ```

---

## Environment Management

### Environment Variables

Each environment loads from its respective `.env` file:
- Development: `development.env`
- Staging: `staging.env`
- Production: `.env`

### Database Configuration

```bash
# Setup database for each environment
npm run db:setup              # Development
npm run db:setup:staging       # Staging
npm run db:setup:prod         # Production

# Run migrations
npm run migrate               # Development
npm run migrate:staging       # Staging
npm run migrate:prod         # Production
```

### Environment-Specific Commands

All PM2 and log commands have environment-specific versions:
- Development: `npm run [command]`
- Staging: `npm run [command]:staging`
- Production: `npm run [command]:prod`

---

## Advanced Configuration

### Custom PM2 Configuration

Edit `ecosystem.config.js` to modify:
- Process settings (memory limits, restart policies)
- Log file locations and formats
- Environment variables
- Cluster mode settings (production)

### Log Rotation Customization

```bash
# Modify log rotation settings
pm2 set pm2-logrotate:max_size 100M    # Increase max file size
pm2 set pm2-logrotate:retain 14        # Keep 14 days of logs
pm2 set pm2-logrotate:compress true    # Enable compression
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Daily at midnight
```

### Monitoring Integration

For production environments, consider integrating with:
- PM2 Plus (monitoring dashboard)
- Log aggregation services (ELK stack, Splunk)
- Alert systems (PagerDuty, Slack)

---

## Security Considerations

1. **Log files may contain sensitive information**
   - Review logs before sharing
   - Use log rotation to prevent long-term storage of sensitive data
   - Consider log sanitization for production

2. **Process management security**
   - Restrict PM2 access to authorized users
   - Use proper file permissions for log files
   - Monitor process restart patterns for security incidents

3. **Health check endpoints**
   - Consider authentication for detailed health checks in production
   - Monitor access to health endpoints
   - Use HTTPS in production

---

## Support and Escalation

### Log Analysis Commands

```bash
# Find specific error patterns
grep -i "database\|connection\|timeout" logs/pm2-combined-0.log | tail -20

# Check authentication errors
grep -i "auth\|token\|unauthorized" logs/pm2-combined-0.log | tail -20

# Monitor API response times
grep -E "GET|POST|PUT|DELETE" logs/pm2-combined-0.log | grep -E "[0-9]+ms" | tail -20
```

### Performance Monitoring

```bash
# Watch real-time logs for performance issues
npm run logs:tail | grep -E "slow|timeout|error|warning"

# Monitor resource usage
npm run pm2:monit
```

### Contact Information

- **Development Issues**: Check application logs and PM2 status
- **Production Issues**: Follow emergency recovery procedures
- **Log Analysis**: Use the provided grep commands for common patterns
- **Performance Issues**: Use PM2 monitoring and log analysis

---

*Last updated: September 2025*
*Version: 1.0.0*