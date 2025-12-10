# Ludora API Integration Guide

> **Comprehensive developer guide for integrating with the Ludora Educational Platform API**

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Core Concepts](#core-concepts)
4. [API Endpoints](#api-endpoints)
5. [Common Integration Patterns](#common-integration-patterns)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Testing](#testing)

---

## Quick Start

### Base URLs

```bash
# Production
https://api.ludora.app

# Staging
https://staging-api.ludora.app

# Development
http://localhost:3003
```

### API Documentation

- **Interactive Docs** (Development/Staging): `{base_url}/api-docs`
- **OpenAPI Spec** (Development/Staging): `{base_url}/api-docs.json`

### Essential Headers

```http
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
X-Portal-Type: teacher|student
```

---

## Authentication

### 1. Firebase Authentication (Primary)

The Ludora API uses Firebase Authentication as the primary authentication mechanism.

#### Teacher Portal Authentication

```javascript
// Frontend - Firebase login
import { signInWithEmailAndPassword } from 'firebase/auth';

const userCredential = await signInWithEmailAndPassword(auth, email, password);
const idToken = await userCredential.user.getIdToken();

// API calls
const response = await fetch('/api/entities', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    'X-Portal-Type': 'teacher'
  }
});
```

#### Student Portal Authentication

```javascript
// Three authentication methods for students:

// 1. Firebase (authenticated students)
const response = await fetch('/api/games', {
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'X-Portal-Type': 'student'
  }
});

// 2. Student Access Tokens (player system)
// Uses cookies: student_access_token, student_refresh_token
const response = await fetch('/api/games', {
  credentials: 'include', // Important: includes cookies
  headers: {
    'X-Portal-Type': 'student'
  }
});

// 3. Anonymous (invite-only mode)
const response = await fetch('/api/games/join', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Type': 'student'
  },
  body: JSON.stringify({
    lobby_code: '123456',
    display_name: 'Player 1'
  })
});
```

### 2. API Client Usage (Recommended)

**Always use the API client instead of direct fetch calls:**

```javascript
// ✅ CORRECT: Use API client
import { apiRequest } from '../utils/apiClient';

const games = await apiRequest('/entities/game', {
  method: 'GET'
});

// ❌ WRONG: Direct fetch bypasses authentication
const response = await fetch('/api/entities/game');
```

### 3. Authentication Middleware

The API automatically handles authentication based on portal type and request context:

```http
# Teacher endpoints - require Firebase auth
GET /api/entities/game
Authorization: Bearer <firebase_token>

# Student endpoints - flexible authentication
GET /api/games/join
# Can use: Firebase auth, student tokens, or anonymous (based on settings)
```

---

## Core Concepts

### 1. Polymorphic Product System

Ludora uses a unified product system supporting 7 product types:

```javascript
// Product types
const PRODUCT_TYPES = [
  'file',        // Downloadable resources
  'lesson_plan', // Interactive lesson plans
  'game',        // Educational games
  'workshop',    // Live workshops
  'course',      // Multi-part courses
  'tool',        // Educational tools
  'bundle'       // Product bundles
];

// Product structure
{
  "id": "prod_123abc",
  "product_type": "game",
  "entity_id": "game_456def",     // Points to Game table
  "creator_user_id": "user_789",  // Ownership
  "title": "Math Adventure",
  "description": "Learn math through gameplay",
  "price": 49.90,
  "is_published": true,
  "type_attributes": {
    // Product-specific metadata in JSONB
    "difficulty": "easy",
    "age_range": "6-10"
  }
}
```

### 2. Entity Service Pattern

**Always use EntityService for product CRUD operations:**

```javascript
// ✅ CORRECT: Creating products
const game = await EntityService.create('game', gameData, userId);
// Auto-creates: Game record + Product record

// ✅ CORRECT: Querying products
const games = await EntityService.find('game', {
  is_published: true
});

// ❌ WRONG: Direct model access
const game = await models.Game.create(gameData);
```

### 3. Access Control System

Multi-tier access validation:

```javascript
// Check user access to any entity
const access = await AccessControlService.checkAccess(
  userId,
  'game',
  gameId
);

// Returns:
{
  "hasAccess": true,
  "accessType": "purchase", // creator|purchase|subscription_claim
  "canDownload": true,
  "canPreview": true,
  "expiresAt": null,
  "reason": "Valid purchase found"
}
```

### 4. Subscription System

Ludora supports subscription-based access with allowance tracking:

```javascript
// Check subscription benefits
GET /api/subscriptions/user/benefits

// Claim product with subscription
POST /api/subscriptions/claim
{
  "product_type": "workshop",
  "product_id": "ws_123abc"
}
```

---

## API Endpoints

### 1. Products & Entities

```http
# List products
GET /api/entities/{type}?limit=50&offset=0&is_published=true

# Get single product
GET /api/entities/{type}/{id}

# Create product
POST /api/entities/{type}
{
  "title": "Product Name",
  "description": "Product description",
  "price": 29.90,
  "type_attributes": {}
}

# Update product
PUT /api/entities/{type}/{id}

# Delete product
DELETE /api/entities/{type}/{id}
```

### 2. Access Control

```http
# Check user access
POST /api/access/check
{
  "entity_type": "game",
  "entity_id": "game_123abc"
}

# Get user purchases
GET /api/access/purchases?user_id={userId}

# Get user access history
GET /api/access/history?user_id={userId}&limit=50
```

### 3. Payments

```http
# Create payment page
POST /api/payments/createPayplusPaymentPage
{
  "items": [
    {
      "purchasable_type": "game",
      "purchasable_id": "game_123abc",
      "price": 49.90
    }
  ]
}

# Check payment status
GET /api/payments/check-payment-page-status?transaction_id={txnId}

# Get user purchases
GET /api/payments/purchases?user_id={userId}
```

### 4. Game Sessions

```http
# Create game lobby
POST /api/game-lobbies
{
  "name": "Math Challenge Room",
  "game_id": "game_123abc",
  "max_participants": 30
}

# Join game lobby (student)
POST /api/game-lobbies/{lobbyId}/join
{
  "display_name": "Player 1"
}

# Get lobby info by code
GET /api/game-lobbies/by-code/{lobbyCode}
```

### 5. File Assets

```http
# Upload file asset
POST /api/v2/assets/{entityType}/{entityId}/{assetType}
Content-Type: multipart/form-data

# Get asset inventory
GET /api/v2/assets/{entityType}/{entityId}

# Stream asset (with access control)
GET /api/v2/assets/{entityType}/{entityId}/{assetType}
```

---

## Common Integration Patterns

### 1. Product Catalog Integration

```javascript
// Get published products with pagination
async function getProductCatalog(productType, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const products = await apiRequest(`/entities/${productType}`, {
    method: 'GET',
    params: {
      is_published: true,
      limit,
      offset,
      include: ['creator', 'access_info'] // Rich product data
    }
  });

  return products;
}

// Filter products by criteria
async function searchProducts(query, filters = {}) {
  return await apiRequest('/entities/product/search', {
    method: 'POST',
    data: {
      query,
      filters,
      include_access_info: true
    }
  });
}
```

### 2. Purchase Flow Integration

```javascript
// Complete purchase flow
async function purchaseProduct(productType, productId, price) {
  try {
    // 1. Create payment page
    const paymentData = await apiRequest('/payments/createPayplusPaymentPage', {
      method: 'POST',
      data: {
        items: [{
          purchasable_type: productType,
          purchasable_id: productId,
          price: price
        }]
      }
    });

    // 2. Redirect to payment page
    window.location.href = paymentData.payment_page_url;

    // 3. Handle webhook/polling for completion
    // (PayPlus handles the actual payment processing)

  } catch (error) {
    console.error('Purchase failed:', error);
    throw error;
  }
}

// Check payment completion (polling)
async function checkPaymentStatus(transactionId) {
  return await apiRequest('/payments/check-payment-page-status', {
    method: 'GET',
    params: { transaction_id: transactionId }
  });
}
```

### 3. Game Session Integration

```javascript
// Complete game session flow
async function createAndJoinGameSession(gameId, settings = {}) {
  try {
    // 1. Create lobby
    const lobby = await apiRequest('/game-lobbies', {
      method: 'POST',
      data: {
        name: `Game Session ${Date.now()}`,
        game_id: gameId,
        max_participants: 30,
        settings
      }
    });

    // 2. Start Socket.IO connection with authentication
    const socket = io(API_BASE_URL, {
      auth: {
        portalType: 'student',
        credentialPolicy: 'try_both'
      },
      withCredentials: true
    });

    // 3. Join lobby updates
    socket.emit('join-lobby-updates');

    // 4. Listen for game events
    socket.on('lobby_updated', handleLobbyUpdate);
    socket.on('game_started', handleGameStart);

    return { lobby, socket };

  } catch (error) {
    console.error('Game session creation failed:', error);
    throw error;
  }
}
```

### 4. File Upload Integration

```javascript
// Upload file with proper error handling
async function uploadFileAsset(entityType, entityId, assetType, file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const result = await apiRequest(`/v2/assets/${entityType}/${entityId}/${assetType}`, {
      method: 'POST',
      data: formData,
      headers: {
        // Don't set Content-Type - let browser set with boundary
      }
    });

    return result;

  } catch (error) {
    if (error.code === 'FILE_TOO_LARGE') {
      throw new Error(`File too large. Maximum size: ${error.maxSize}`);
    }
    if (error.code === 'INVALID_FILE_TYPE') {
      throw new Error(`Invalid file type. Allowed: ${error.allowedTypes.join(', ')}`);
    }
    throw error;
  }
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ],
    "requestId": "req_123abc"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| `PAYMENT_REQUIRED` | 402 | Purchase required for access |

### Error Handling Pattern

```javascript
// Robust error handling
async function handleApiRequest(endpoint, options = {}) {
  try {
    return await apiRequest(endpoint, options);
  } catch (error) {
    // Handle specific error codes
    switch (error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        window.location.href = '/login';
        break;

      case 'PAYMENT_REQUIRED':
        // Show purchase dialog
        showPurchaseDialog(error.details.product_id);
        break;

      case 'RATE_LIMITED':
        // Show rate limit warning
        showRateLimitWarning(error.details.retry_after);
        break;

      case 'VALIDATION_ERROR':
        // Show form validation errors
        showValidationErrors(error.details);
        break;

      default:
        // Generic error handling
        console.error('API Error:', error);
        showGenericError(error.message);
    }

    throw error; // Re-throw for caller to handle
  }
}
```

---

## Rate Limiting

### Current Rate Limits

| Endpoint | Limit | Window |
|----------|-------|---------|
| Global | 1000 requests | 15 minutes |
| Authentication | 10 attempts | 15 minutes |
| File Upload | 50 uploads | 15 minutes |
| Email | 200 emails | 1 hour |
| Game Creation | 20 games | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1670000000
X-RateLimit-Window: 900
```

### Handling Rate Limits

```javascript
async function makeRateLimitedRequest(endpoint, options = {}) {
  try {
    return await apiRequest(endpoint, options);
  } catch (error) {
    if (error.status === 429) {
      const retryAfter = error.headers['retry-after'] || 60;

      // Show user-friendly message
      console.warn(`Rate limited. Retrying in ${retryAfter} seconds...`);

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return makeRateLimitedRequest(endpoint, options);
    }
    throw error;
  }
}
```

---

## Testing

### Development Environment

```bash
# Start development server
ENVIRONMENT=development npm start

# API available at
http://localhost:3003

# Interactive docs at
http://localhost:3003/api-docs
```

### Test Data

```javascript
// Create test user
const testUser = {
  email: 'test@example.com',
  password: 'testpass123',
  role: 'teacher'
};

// Create test product
const testGame = {
  title: 'Test Math Game',
  description: 'A test game for API integration',
  price: 9.99,
  is_published: true,
  type_attributes: {
    difficulty: 'easy',
    subject: 'math'
  }
};
```

### Integration Testing Pattern

```javascript
describe('Ludora API Integration', () => {
  let authToken;
  let testProductId;

  beforeAll(async () => {
    // Setup authentication
    authToken = await authenticateTestUser();
  });

  test('should create product', async () => {
    const product = await apiRequest('/entities/game', {
      method: 'POST',
      data: testGame,
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(product.id).toBeDefined();
    expect(product.title).toBe(testGame.title);
    testProductId = product.id;
  });

  test('should check access control', async () => {
    const access = await apiRequest('/access/check', {
      method: 'POST',
      data: {
        entity_type: 'game',
        entity_id: testProductId
      },
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(access.hasAccess).toBe(true);
    expect(access.accessType).toBe('creator');
  });
});
```

---

## Additional Resources

- **OpenAPI Documentation**: Available at `/api-docs` (development/staging)
- **Architecture Guide**: `/CLAUDE.md`
- **Backend Patterns**: `/ludora-api/CLAUDE.md`
- **Frontend Patterns**: `/ludora-front/CLAUDE.md`
- **Webhook Documentation**: `/docs/WEBHOOK_HANDLER_ANALYSIS.md`
- **Subscription Guide**: `/docs/DAILY_SUBSCRIPTION_QUICK_START.md`

---

## Support

For API integration support:

1. **Check interactive documentation** at `/api-docs`
2. **Review error responses** for specific guidance
3. **Test in development environment** first
4. **Follow established patterns** from this guide

**Remember**: Always use the API client wrapper instead of direct fetch calls for proper authentication and error handling.