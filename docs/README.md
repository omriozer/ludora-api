# Ludora API Documentation Hub

> **Central navigation for all Ludora Educational Platform API documentation**

## 🚀 Quick Start Paths

### New Developer Setup
1. **[Development Setup Guide](./DEVELOPMENT_SETUP_GUIDE.md)** - Complete environment setup
2. **[API Integration Guide](./API_INTEGRATION_GUIDE.md)** - Start building with the API
3. **[Authentication Reference](./AUTHENTICATION_REFERENCE.md)** - Understand auth flows
4. **[Interactive API Docs](http://localhost:3003/api-docs)** - Live OpenAPI documentation

### Experienced Developer Quick Reference
- **[Rate Limiting Guide](./RATE_LIMITING_GUIDE.md)** - Optimize API usage
- **[Error Handling Reference](./ERROR_HANDLING_REFERENCE.md)** - Handle errors properly
- **[Subscription System Guide](./SUBSCRIPTION_SYSTEM_GUIDE.md)** - Implement subscriptions

---

## 📚 Complete Documentation Library

### 🛠️ Setup & Development

#### **[Development Setup Guide](./DEVELOPMENT_SETUP_GUIDE.md)**
*Complete guide for setting up the development environment*

**What's included:**
- PostgreSQL database setup with 33-table schema
- Firebase authentication configuration
- PayPlus payment integration
- Environment configuration for all stages
- Advanced database operations and testing
- Production deployment considerations
- Comprehensive troubleshooting

**Best for:** New team members, environment setup, database management

---

#### **[API Integration Guide](./API_INTEGRATION_GUIDE.md)**
*Comprehensive developer guide for integrating with Ludora API*

**What's included:**
- Complete integration patterns for all product types (files, games, workshops, courses)
- Authentication flows for teacher and student portals
- Real-world code examples with error handling
- File upload and streaming patterns
- Product creation and management workflows
- Advanced integration scenarios

**Best for:** Frontend developers, API integration, product workflows

---

### 🔐 Authentication & Security

#### **[Authentication Reference](./AUTHENTICATION_REFERENCE.md)**
*Technical reference for multi-portal authentication system*

**What's included:**
- Firebase, Student Access Token, and Anonymous authentication methods
- Portal detection and routing patterns
- Socket.IO authentication with portal-aware context
- Middleware implementation and security patterns
- Token management and session handling
- Authentication troubleshooting

**Best for:** Security implementation, authentication debugging, middleware development

---

### 💳 Business Logic & Features

#### **[Subscription System Guide](./SUBSCRIPTION_SYSTEM_GUIDE.md)**
*Unified guide for the complete subscription management system*

**What's included:**
- Comprehensive system overview and architecture
- PayPlus integration and webhook handling
- Subscription plans, benefits, and access control
- Development setup and testing strategies
- Daily subscription testing for rapid webhook validation
- Production deployment and monitoring
- Complete troubleshooting and debugging guide

**Best for:** Subscription implementation, PayPlus integration, billing workflows

---

### ⚠️ Error Handling & Optimization

#### **[Error Handling Reference](./ERROR_HANDLING_REFERENCE.md)**
*Comprehensive guide for proper error handling across the platform*

**What's included:**
- Standard error response formats and HTTP status codes
- Client-side error handling patterns with React integration
- Rate limiting, validation, and payment error scenarios
- Error recovery strategies and user experience patterns
- Logging and monitoring integration
- Development vs production error handling

**Best for:** Error handling implementation, user experience, debugging

---

#### **[Rate Limiting Guide](./RATE_LIMITING_GUIDE.md)**
*Advanced guide for API rate limiting and performance optimization*

**What's included:**
- Rate limiting policies and configuration
- Client-side handling with request queuing and batching
- Performance optimization strategies
- Monitoring and analytics for rate limit tracking
- Error handling for rate-limited requests
- Production scaling considerations

**Best for:** Performance optimization, scalability planning, rate limit handling

---

## 🔗 Interactive Resources

### **[OpenAPI Documentation](http://localhost:3003/api-docs)**
*Live, interactive API documentation with real-time testing*

**Features:**
- 102+ documented endpoints across 10 major systems
- Real-time API testing interface
- Complete request/response examples
- Authentication integration for testing
- Schema validation and examples

**Access:** Available in development/staging only (hidden in production)

**Quick Links:**
- Authentication endpoints
- Product management (games, files, workshops, courses)
- Subscription and payment systems
- Access control and media streaming
- Real-time gaming and educational content

---

## 🎯 Task-Specific Quick References

### Setting Up Development Environment
```bash
# 1. Clone and install
git clone [repo] && cd ludora-api && npm install

# 2. Database setup
npm run db:setup

# 3. Start development
npm run dev

# 4. View API docs
open http://localhost:3003/api-docs
```
**Full Guide:** [Development Setup Guide](./DEVELOPMENT_SETUP_GUIDE.md)

### Integrating Authentication
```javascript
// Teacher portal authentication
const response = await apiRequest('/auth/firebase-verify', {
  method: 'POST',
  body: { idToken: firebaseToken }
});

// Student portal authentication
const response = await apiRequest('/auth/student-access', {
  method: 'POST',
  body: { privacyCode: 'ABC123' }
});
```
**Full Guide:** [Authentication Reference](./AUTHENTICATION_REFERENCE.md)

### Handling API Errors
```javascript
try {
  const data = await apiRequest('/api/games');
} catch (error) {
  if (error.status === 429) {
    // Rate limit hit - implement backoff
    await handleRateLimit(error);
  } else if (error.status === 402) {
    // Payment required
    await redirectToPayment(error.requiredProduct);
  }
}
```
**Full Guide:** [Error Handling Reference](./ERROR_HANDLING_REFERENCE.md)

### Testing Subscriptions
```bash
# Create daily test subscription for rapid webhook testing
ENABLE_DAILY_SUBSCRIPTION_TESTING=true node scripts/testDailySubscription.js \
  --userId=user_123 --planId=plan_basic --dryRun

# Monitor webhook processing
SELECT * FROM webhooklog WHERE subscription_id = 'sub_123';
```
**Full Guide:** [Subscription System Guide](./SUBSCRIPTION_SYSTEM_GUIDE.md)

---

## 🔍 Troubleshooting Quick Access

### Common Issues

| Problem | Quick Fix | Full Guide |
|---------|-----------|------------|
| Database connection failed | `brew services start postgresql` | [Development Setup](./DEVELOPMENT_SETUP_GUIDE.md#troubleshooting) |
| Firebase auth errors | Check private key format in `.env` | [Authentication Reference](./AUTHENTICATION_REFERENCE.md) |
| Rate limiting errors | Implement exponential backoff | [Rate Limiting Guide](./RATE_LIMITING_GUIDE.md) |
| PayPlus webhook issues | Use daily subscription testing | [Subscription Guide](./SUBSCRIPTION_SYSTEM_GUIDE.md) |
| API 401/403 errors | Verify authentication headers | [Error Handling Reference](./ERROR_HANDLING_REFERENCE.md) |

### Debug Commands
```bash
# View development logs
npm run logs:dev

# Test database connection
npm run db:test

# Check OpenAPI docs
curl http://localhost:3003/api-docs.json

# Lint and test
npm run lint && npm test
```

---

## 🏗️ Architecture Overview

### System Components
- **Frontend:** React 18.2.0 + Vite + TailwindCSS dual-portal design
- **Backend:** Node.js + Express 5.1.0 + Sequelize ORM
- **Database:** PostgreSQL with 33-table schema
- **Authentication:** Firebase + Student Access Tokens + Anonymous access
- **Payments:** PayPlus integration with subscription management
- **Storage:** AWS S3 with API-proxied streaming
- **Real-time:** Socket.IO + Server-Sent Events

### Key Architectural Patterns
- **Polymorphic Product System:** 7 product types with unified marketplace facade
- **Multi-Portal Authentication:** Teacher, Student, and Anonymous access modes
- **Bundle Auto-Purchase:** Automatic individual purchase creation for bundles
- **Database-Backed Sessions:** Full persistence with no in-memory storage
- **Data-Driven Caching:** Event-based cache invalidation (no time-based expiration)

**Detailed Architecture:** See main [/ludora/CLAUDE.md](../CLAUDE.md)

---

## 📝 Documentation Maintenance

### Updating Documentation
When making significant API changes:
1. Update relevant OpenAPI documentation in `/src/openapi/paths/`
2. Update corresponding guide(s) in `/docs/`
3. Test all code examples
4. Update this index if new sections are added

### Documentation Standards
- **Code Examples:** Must be tested and working
- **Error Scenarios:** Include realistic error handling
- **Environment Specific:** Clearly mark dev/staging/production differences
- **Quick Reference:** Each guide should have a quick start section

### Getting Help
- **API Issues:** Check [Error Handling Reference](./ERROR_HANDLING_REFERENCE.md)
- **Setup Problems:** See [Development Setup Guide](./DEVELOPMENT_SETUP_GUIDE.md)
- **Integration Questions:** Consult [API Integration Guide](./API_INTEGRATION_GUIDE.md)
- **Live Testing:** Use [OpenAPI Documentation](http://localhost:3003/api-docs)

---

*Last updated: December 2025 | For the latest documentation, always check this hub*