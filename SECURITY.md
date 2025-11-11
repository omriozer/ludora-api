# Security Implementation Guide

## Overview

The Ludora API has been enhanced with comprehensive security measures to protect against common web application vulnerabilities and attacks. This document outlines the security implementations and configurations.

## Security Features Implemented

### 1. Authentication & Authorization

- **JWT Secret Validation**: Requires `JWT_SECRET` environment variable (no fallback)
- **Development Token Protection**: Development tokens only work in development environment
- **Multi-layer Auth**: Supports JWT, Firebase Auth, with secure fallbacks
- **Role-based Access Control**: `user`, `admin`, `sysadmin` roles with hierarchy
- **Resource Ownership Validation**: Users can only access their own resources

### 2. Input Validation & Sanitization

- **Joi Validation**: Comprehensive schemas for all endpoints
- **HTML Sanitization**: XSS protection for user-generated content
- **File Upload Validation**: Type, size, and security checks
- **Request Size Limiting**: Prevents DoS attacks via large payloads

### 3. Security Headers

- **Content Security Policy (CSP)**: Prevents XSS and injection attacks
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME sniffing attacks
- **Referrer Policy**: Controls referrer information leakage
- **HTTPS Enforcement**: Automatic HTTP to HTTPS redirects in production

### 4. CORS Configuration

- **Strict Origin Control**: Only allows configured frontend URLs
- **Webhook Support**: Separate CORS policy for webhook endpoints
- **Dynamic CORS**: Automatic route-based CORS selection
- **Credential Support**: Secure cookie and auth header handling

### 5. Rate Limiting

- **Tiered Limits**: Different limits for auth, general, and upload endpoints
- **Production Enforcement**: Stricter limits in production environments
- **Violation Logging**: Security alerts for rate limit violations
- **Bypass Detection**: Monitors for IP header manipulation attempts

### 6. Secrets Management

- **Environment Validation**: Validates secret strength and presence
- **Firebase Integration**: Secure service account handling via environment variables
- **No Hardcoded Secrets**: All sensitive data externalized
- **Security Auditing**: Built-in secrets strength validation

### 7. Error Handling

- **Information Disclosure Prevention**: No sensitive data in production errors
- **Security Logging**: Comprehensive audit trail
- **Request Tracking**: Unique request IDs for debugging
- **Attack Pattern Detection**: Monitors for malicious request patterns

### 8. Additional Security Measures

- **Timing Attack Protection**: Random delays to prevent timing attacks
- **Secure Cookies**: HttpOnly, Secure, SameSite cookie configuration
- **Security Audit Logging**: Real-time attack pattern detection
- **Firebase Security**: Removed service account files from codebase

## Environment Variables Required

### Critical Secrets (Must be set)

```bash
# JWT Authentication
JWT_SECRET=your-strong-jwt-secret-here-minimum-32-chars

# Database
DB_PASSWORD=your-database-password

# Firebase (JSON string or base64 encoded)
FIREBASE_SERVICE_ACCOUNT=your-firebase-service-account-json
```

### Optional Secrets

```bash
# AWS S3
AWS_SECRET_ACCESS_KEY=your-aws-secret

# External APIs
ANTHROPIC_API_KEY=your-anthropic-key

# Email
EMAIL_PASSWORD=your-email-password
```

### Security Configuration

```bash
# Frontend URLs (comma-separated for multiple)
FRONTEND_URL=https://yourdomain.com
ADDITIONAL_FRONTEND_URLS=https://app.yourdomain.com,https://admin.yourdomain.com

# Webhook Origins (optional, if not set allows all)
WEBHOOK_ALLOWED_ORIGINS=https://webhook-provider.com

# Debug (development only)
DEBUG_ERRORS=true

# CORS override for development
CORS_DEV_OVERRIDE=true
```

## Security Best Practices

### Production Deployment

1. **HTTPS Only**: Ensure all traffic uses HTTPS
2. **Strong Secrets**: Use cryptographically secure random secrets
3. **Environment Isolation**: Separate secrets for dev/staging/prod
4. **Regular Updates**: Keep dependencies updated
5. **Monitoring**: Implement security monitoring and alerting

### Development

1. **Local HTTPS**: Use HTTPS even in development when possible
2. **Separate Secrets**: Never use production secrets in development
3. **Security Testing**: Regular security scans and penetration testing
4. **Code Review**: Security-focused code reviews

## Security Checklist

### Pre-Production

- [ ] All required environment variables set
- [ ] JWT_SECRET is strong (32+ chars, complex)
- [ ] FRONTEND_URL points to production domain
- [ ] No development tokens in production
- [ ] Firebase service account files removed from codebase
- [ ] HTTPS enforcement enabled
- [ ] Security headers configured
- [ ] Rate limiting active
- [ ] Error messages sanitized

### Monitoring

- [ ] Security audit logs configured
- [ ] Rate limit violations monitoring
- [ ] Suspicious pattern detection
- [ ] Failed authentication monitoring
- [ ] Unusual request pattern alerts

## Security Incident Response

1. **Immediate**: Check security audit logs
2. **Investigate**: Analyze request patterns and origins
3. **Contain**: Temporarily block suspicious IPs if needed
4. **Review**: Check for potential data exposure
5. **Update**: Rotate secrets if compromise suspected

## Compliance

This implementation addresses common security frameworks:

- **OWASP Top 10**: Protection against most common web vulnerabilities
- **NIST Cybersecurity Framework**: Risk management and protection
- **SOC 2**: Security controls for service organizations

## Support

For security questions or to report vulnerabilities:
- Review security logs: Check console output for security warnings
- Test configuration: Use the built-in security validation tools
- Monitor metrics: Watch rate limiting and error patterns

Remember: Security is an ongoing process. Regularly review and update these configurations as your application evolves.