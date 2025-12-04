# Backend Development Guidelines for Ludora API

## For architectural concepts and integration patterns, see the main `/ludora/CLAUDE.md` file

This file focuses on backend-specific implementation patterns for the Ludora API.

---

## 1. SERVICE LAYER PATTERNS

### Service Organization
```javascript
// ✅ CORRECT: Thin routes, delegate to services
router.post('/games', authenticateToken, validateBody(schema), async (req, res) => {
  try {
    const game = await EntityService.create('game', req.body, req.user.id);
    res.status(201).json(game);
  } catch (error) {
    next(error);  // Let global error handler manage this
  }
});

// ❌ WRONG: Business logic in routes
router.post('/games', async (req, res) => {
  const game = await models.Game.create(req.body);
  const product = await models.Product.create({
    product_type: 'game',
    entity_id: game.id
    // ❌ This is EntityService's job!
  });
});
```

### Bundle Services (NEW: Nov 2025, Enhanced: Nov 29-30)

**Bundle products use specialized services with auto-purchase pattern:**

```javascript
// ✅ CORRECT: Bundle purchase with auto-creation of individual purchases
import BundlePurchaseService from '../services/BundlePurchaseService.js';

// When processing bundle purchase (e.g., in PayPlus webhook)
if (product.type_attributes?.is_bundle) {
  const { bundlePurchase, individualPurchases } = await BundlePurchaseService.createBundlePurchase(
    product,           // Bundle Product record
    buyerId,          // User purchasing the bundle
    paymentData,      // Payment transaction details
    transaction       // Optional Sequelize transaction
  );
  // Returns main bundle purchase + array of auto-created individual purchases
}

// ✅ CORRECT: Bundle validation before creation
import BundleValidationService from '../services/BundleValidationService.js';

const validationResult = await BundleValidationService.validateBundle(
  bundleItems,      // Array of { product_type, product_id }
  bundlePrice,      // Proposed bundle price
  creatorId,        // User creating the bundle
  userRole          // User role for ownership checks
);

if (!validationResult.valid) {
  throw new BadRequestError(validationResult.errors.join(', '));
}

// ✅ CORRECT: Bundle refund cascades to individual purchases
await BundlePurchaseService.refundBundlePurchase(bundlePurchaseId);
// Automatically refunds all individual purchases created from this bundle
```

**Bundle Publishing Validation (CRITICAL FIX - Nov 29, 2025):**

```javascript
// EntityService.js - Proper bundle validation at service layer
async create(productType, data, creatorId, options = {}) {
  // Bundle-specific validation path
  if (productType === 'bundle' && data.type_attributes?.is_bundle) {
    // Skip file validation for bundles - they don't have uploaded files
    // Validate bundle composition instead
    const validationResult = await BundleValidationService.validateBundle(
      data.type_attributes.bundle_items,
      data.price,
      creatorId,
      userRole
    );

    if (!validationResult.valid) {
      throw new BadRequestError(validationResult.errors.join(', '));
    }

    // Create bundle product without entity table record
    const product = await models.Product.create({
      product_type: 'bundle',
      entity_id: null,  // Bundles have no entity table
      creator_user_id: creatorId,
      type_attributes: data.type_attributes,
      // ... other fields
    });

    return product;
  }

  // Regular entity creation for non-bundles...
}

// Product model beforeSave hook - Proper type-specific validation
beforeSave: async (product) => {
  // Bundle validation - check linked products
  if (product.product_type === 'bundle' && product.type_attributes?.is_bundle) {
    if (!product.type_attributes.bundle_items?.length) {
      throw new Error('Bundle products must contain items');
    }
    // Validate bundle_items structure, pricing, etc.
  }
  // File validation - check uploaded files
  else if (product.product_type === 'file') {
    if (!product.type_attributes?.file_s3_keys?.length) {
      throw new Error('File products require uploaded files');
    }
  }
  // Other product type validations...
}
```

**Bundle Architecture Principles:**
- **No AccessControlService changes**: Individual purchases grant access automatically
- **Transaction safety**: All bundle operations use database transactions
- **Validation at EntityService level**: Bundle rules enforced during CRUD operations with proper type checking
- **No entity table**: Bundles exist only in Product table with type_attributes
- **Type-specific validation**: Bundles validate linked products, not uploaded files
- **Mixed product types**: Bundles can contain file + game + workshop together (max 50 items)

### Model Access Patterns
```javascript
// Import models correctly
import models from '../models/index.js';

// ✅ For non-product entities (direct access)
const user = await models.User.findByPk(userId);
const purchases = await models.Purchase.findAll({
  where: { buyer_user_id: userId }
});

// ✅ For product entities (use EntityService)
const game = await EntityService.create('game', gameData, userId);
const games = await EntityService.find('game', { creator_user_id: userId });

// ❌ WRONG: Don't mix patterns
await EntityService.create('game', data, userId);
await models.Game.findOne({ where: { id: gameId } });  // Redundant!
```

---

## 2. DATABASE PATTERNS

### Model Definitions (43 total models)

**Product Entities (use with EntityService):**
- File, Game, Workshop, Course, Tool, LessonPlan
- **Bundle** (special: no entity table, uses Product.type_attributes only)

**Business Models (direct access):**
- User, Purchase, Subscription, Classroom, Curriculum
- **Purchase** (enhanced with bundle_purchase_id for auto-created bundle items)

**NEW: Subscription System Models (Nov 2025):**
- SubscriptionPurchase - Allowance tracking with JSONB usage_tracking

**Content Models:**
- EduContent, EduContentUse, GameSession, GameLobby

**Authentication Models (direct access):**
- RefreshToken, UserSession

**System Models:**
- Settings, Logs, Category, SystemTemplate

### Sequelize Usage Patterns
```javascript
// ✅ CORRECT: Transaction safety for multi-step operations
const transaction = await models.sequelize.transaction();
try {
  const entity = await models.Entity.create(data, { transaction });
  const product = await models.Product.create(productData, { transaction });
  await transaction.commit();
  return { entity, product };
} catch (error) {
  await transaction.rollback();
  throw error;
}

// ✅ CORRECT: Associations and includes
const game = await models.Game.findOne({
  where: { id: gameId },
  include: [
    { model: models.EduContentUse, as: 'contentUses' },
    { model: models.GameSession, as: 'sessions' }
  ]
});

// ✅ CORRECT: Bulk operations with limits
const results = await models.Entity.findAll({
  limit: Math.min(req.query.limit || 50, 1000),  // Max 1000
  offset: req.query.offset || 0,
  order: [['createdAt', 'DESC']]
});
```

### Migration Patterns
```javascript
// ✅ CORRECT: Safe migration structure
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if column exists before adding
    const tableDescription = await queryInterface.describeTable('Games');
    if (!tableDescription.new_field) {
      await queryInterface.addColumn('Games', 'new_field', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Games', 'new_field');
  }
};
```

---

## 3. API DESIGN PATTERNS

### Route Organization
```
/ludora-api/routes/
├── entities.js         # Generic CRUD for all entities (26 routes)
├── auth.js            # Authentication endpoints
├── access.js          # Access control validation
├── media.js           # File streaming endpoints
├── payments.js        # PayPlus integration
├── sse.js             # Server-sent events
└── admin.js           # Admin-specific endpoints
```

### Request/Response Standards
```javascript
// ✅ CORRECT: Error response format
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "details": [{"field": "title", "message": "Required"}],
    "requestId": "req_123abc"
  }
}

// ✅ CORRECT: Success response formats
// Simple data
res.json({ id: 'game_123', title: 'Math Game' });

// List data with metadata
res.json({
  data: games,
  pagination: { total: 150, page: 1, limit: 50 }
});

// Operation confirmation
res.json({ success: true, message: 'Game deleted successfully' });
```

### Validation Patterns
```javascript
// ✅ CORRECT: Joi validation schemas
const gameCreateSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().allow('').max(2000),
  difficulty: Joi.string().valid('easy', 'medium', 'hard'),
  is_published: Joi.boolean().default(false)
});

// Apply validation middleware
router.post('/games', validateBody(gameCreateSchema), handler);

// ✅ CORRECT: Bulk operation validation
const bulkSchema = Joi.object({
  items: Joi.array().min(1).max(100).required(),  // Max 100 items
  operation: Joi.string().valid('create', 'update', 'delete').required()
});

// ✅ CORRECT: Multi-layer validation pattern (CRITICAL for security-sensitive features)
// Example: Watermark template validation (Dec 2025 security fix)

// Layer 1: Route-level validation function
function validateWatermarkTemplateData(templateData) {
  // Count total elements to prevent empty templates (security bypass)
  let totalElements = 0;
  if (templateData.elements) {
    totalElements = Object.values(templateData.elements).reduce((sum, arr) =>
      sum + (Array.isArray(arr) ? arr.length : 0), 0);
  }
  if (totalElements === 0) {
    throw new Error('Template must contain at least one element');
  }
  // Additional validation...
}

// Layer 2: Model-level validation method
SystemTemplate.prototype.validateWatermarkTemplateData = function() {
  // Duplicate validation at model level for defense in depth
  // This catches issues even if route validation is bypassed
  const totalElements = countElements(this.template_data);
  if (totalElements === 0) {
    throw new Error('Empty watermark templates are not allowed');
  }
}

// ❌ WRONG: Single validation layer (can be bypassed)
// Only validating in routes OR only in models creates security risk
```

### Validation Best Practices (Dec 2025 Update)

**Critical Security Pattern**: Implement multi-layer validation for security-sensitive features:

1. **Route-level validation**: First line of defense, validates API input
2. **Model-level validation**: Catches issues during direct model operations
3. **Business logic validation**: Service layer checks for complex rules

**Example Security Fix**: Watermark template validation
- **Problem**: Empty templates bypassed content protection
- **Solution**: Dual validation in both routes and models
- **Impact**: Prevents unwatermarked preview content access

**When to use multi-layer validation**:
- Content protection features (watermarks, access control)
- Payment/subscription operations
- File upload and processing
- User permission changes

---

## 4. SECURITY IMPLEMENTATION

### Rate Limiting Patterns
```javascript
// Current rate limits (per IP)
const rateLimits = {
  global: '1000 requests/15min',
  auth: '10 attempts/15min',
  fileUpload: '50 uploads/15min',
  email: '200 emails/1hour',
  sse: '100 connections/1min'
};

// ✅ Custom rate limiting for specific operations
const gameCreationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,  // 20 games per 15 minutes
  message: { error: 'Too many games created. Try again later.' }
});

router.post('/games', gameCreationLimit, authenticateToken, handler);
```

### Input Sanitization
```javascript
// ✅ CORRECT: HTML sanitization
const sanitize = require('../utils/sanitize');

const sanitizedContent = sanitize(req.body.content, {
  allowedTags: ['p', 'br', 'strong', 'em'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard'
});

// ✅ CORRECT: File upload validation
const multerConfig = {
  limits: {
    fileSize: 500 * 1024 * 1024,  // 500MB for videos
    files: 5  // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
};
```

### Authentication & Authorization
```javascript
// ✅ CORRECT: Authentication middleware chain
router.post('/games',
  authenticateToken,           // Verify JWT token
  requireUserType('teacher'),  // Check user type
  validateBody(schema),        // Validate input
  requireOwnership,           // Check ownership for updates
  handler
);

// ✅ CORRECT: Ownership validation for entities
const requireGameOwnership = async (req, res, next) => {
  try {
    const hasAccess = await validateGameOwnership(
      req.params.gameId,
      req.user.id,
      req.user.role
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied. You do not own this game.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
```

---

## 5. SESSION MANAGEMENT SYSTEM

### Database-Based Session Persistence (Nov 2025)

**CRITICAL: Ludora uses FULL DATABASE PERSISTENCE for both refresh tokens AND user sessions.**

```javascript
// ✅ CORRECT: Complete database-based authentication system
// - RefreshToken model: Persistent refresh tokens with metadata
// - UserSession model: Persistent user sessions with lifecycle management
// - AuthService: Database operations for all session management

// ALL session operations are async and database-backed:
const sessionId = await authService.createSession(userId, metadata);
const session = await authService.validateSession(sessionId);
await authService.invalidateSession(sessionId);
await authService.invalidateUserSessions(userId);
```

### UserSession Model Usage

```javascript
// ✅ CORRECT: Database session lifecycle management
import models from '../models/index.js';

// Create persistent session
const session = await models.UserSession.create({
  id: sessionId,
  user_id: userId,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  is_active: true,
  metadata: { userAgent, ipAddress, loginMethod }
});

// Validate and refresh session
const activeSession = await models.UserSession.findByPk(sessionId);
if (activeSession && activeSession.isActive()) {
  await activeSession.updateLastAccessed();
}

// Cleanup expired sessions
const cleanedCount = await models.UserSession.cleanupExpired();

// Invalidate all user sessions
const invalidatedCount = await models.UserSession.invalidateUserSessions(userId);
```

### AuthService Session Patterns

```javascript
// ✅ CORRECT: AuthService with database sessions
class AuthService {
  // NO in-memory storage - everything persists to database

  async createSession(userId, metadata = {}) {
    // Creates UserSession record in database
    const sessionData = { id: sessionId, user_id: userId, ... };
    await models.UserSession.create(sessionData);
    return sessionId;
  }

  async validateSession(sessionId) {
    // Queries database for session validation
    const session = await models.UserSession.findByPk(sessionId);
    if (!session || !session.isActive()) return null;
    await session.updateLastAccessed();
    return session.toJSON();
  }
}

// ❌ WRONG: In-memory session storage (old approach)
// this.sessionStore = new Map(); // NEVER use in-memory for sessions
```

### Session Persistence Benefits

**✅ Survives Server Restarts:** Sessions persist in database across deployments
**✅ Handles Multiple Server Instances:** No memory conflicts between servers
**✅ Comprehensive Analytics:** Database queries for session statistics
**✅ Secure Lifecycle Management:** Soft deletes, expiration tracking, metadata
**✅ Scalable Architecture:** Works with load balancers and horizontal scaling

---

## 6. REAL-TIME FEATURES

### Server-Sent Events (SSE) Implementation
```javascript
// ✅ CORRECT: SSE connection management
const SSEBroadcaster = require('../services/SSEBroadcaster');

router.get('/sse/events', studentsAccessMiddleware, (req, res) => {
  const connection = SSEBroadcaster.createConnection(req, res, {
    userId: req.user?.id,
    sessionContext: req.sessionContext,
    priority: calculatePriority(req.user, req.sessionContext)
  });

  // Handle connection cleanup
  req.on('close', () => {
    SSEBroadcaster.removeConnection(connection.id);
  });
});

// ✅ CORRECT: Broadcasting events
SSEBroadcaster.broadcast('game:gameId', {
  type: 'player_joined',
  data: { playerId: userId, playerName: user.name },
  timestamp: new Date().toISOString()
});
```

### Game Session Management
```javascript
// ✅ CORRECT: Session state management
const GameSessionService = {
  async createSession(gameId, hostId, settings) {
    const transaction = await models.sequelize.transaction();

    try {
      const session = await models.GameSession.create({
        game_id: gameId,
        host_user_id: hostId,
        status: 'waiting',
        settings: settings,
        created_at: new Date()
      }, { transaction });

      // Broadcast session creation
      SSEBroadcaster.broadcast(`game:${gameId}`, {
        type: 'session_created',
        data: session
      });

      await transaction.commit();
      return session;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
```

---

## 6. TESTING PATTERNS

### Test Organization
```
/ludora-api/tests/
├── unit/              # Service and utility tests
├── integration/       # Route and API tests
├── fixtures/          # Test data
└── setup.js           # Test configuration
```

### Jest Test Patterns
```javascript
// ✅ CORRECT: Integration test structure
describe('POST /api/games', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    await resetDatabase();
    testUser = await createTestUser();
    authToken = generateTestToken(testUser);
  });

  it('should create game successfully', async () => {
    const gameData = {
      title: 'Test Game',
      description: 'A test game',
      difficulty: 'easy'
    };

    const response = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send(gameData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('Test Game');

    // Verify database state
    const game = await models.Game.findByPk(response.body.id);
    expect(game).toBeTruthy();

    // Verify product was created
    const product = await models.Product.findOne({
      where: { product_type: 'game', entity_id: response.body.id }
    });
    expect(product).toBeTruthy();
  });
});
```

---

## 7. PERFORMANCE PATTERNS

### Database Optimization
```javascript
// ✅ CORRECT: Connection pooling configuration
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  pool: {
    max: process.env.NODE_ENV === 'production' ? 20 : 5,
    min: 0,
    idle: 10000
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

// ✅ CORRECT: Efficient querying
const getGamesWithContent = async (userId, limit = 50) => {
  return await models.Game.findAll({
    limit: Math.min(limit, 1000),
    include: [
      {
        model: models.EduContentUse,
        attributes: ['id', 'use_type'],  // Only needed fields
        limit: 10  // Limit nested results
      }
    ],
    where: {
      '$Product.creator_user_id$': userId
    },
    include: [{
      model: models.Product,
      attributes: []  // Don't include Product fields in result
    }]
  });
};
```

### Caching Patterns (CRITICAL: Data-Driven Only)

**🚨 HARD RULE: Never use time-based cache expiration. This blocks PR approval.**

**🚨 MANDATORY: New API endpoints must be consulted regarding ETag implementation.**

### ESLint Automated Enforcement (NEW)

**🚨 CRITICAL: ESLint rules now automatically detect and block time-based caching patterns.**

```bash
# Run linting before ANY code submission
npm run lint        # Check for violations
npm run lint:fix    # Auto-fix where possible
```

**Ludora Custom ESLint Rules:**
- **`ludora/no-time-based-caching`** (Error) - BLOCKS PR APPROVAL
- **`ludora/require-data-driven-cache`** (Warning) - Suggests proper patterns
- **`ludora/no-unused-cache-keys`** (Warning) - Detects orphaned cache operations
- **`ludora/no-console-log`** (Error) - Enforces ludlog/luderror usage

**See `/ludora-utils/eslint-plugin-ludora/README.md` for full documentation.**

```javascript
// ❌ PROHIBITED: Time-based cache expiration (BLOCKS PR)
const cache = new Map();
const getGameTypes = async () => {
  cache.set('types', types);
  setTimeout(() => cache.delete('types'), 3600000); // ❌ NEVER DO THIS
  return types;
};

// ✅ REQUIRED: Data-driven cache invalidation
const gameTypesCache = new Map();

const getGameTypes = async () => {
  // Include data version in cache key
  const configVersion = await models.SystemConfig.findOne({
    where: { key: 'game_types_version' }
  });
  const cacheKey = `types:${configVersion?.value || 'default'}`;

  if (gameTypesCache.has(cacheKey)) {
    return gameTypesCache.get(cacheKey);
  }

  const types = require('../config/gameTypes.js');
  gameTypesCache.set(cacheKey, types);

  return types;
};

// ✅ CORRECT: Event-driven cache clearing
models.SystemConfig.addHook('afterUpdate', (instance) => {
  if (instance.key === 'game_types_version') {
    gameTypesCache.clear(); // Clear on config change
  }
});

// ✅ CORRECT: Database-driven cache validation
class CachedService {
  async getCachedData(key) {
    const maxUpdated = await models.DataTable.max('updated_at');
    const cacheKey = `${key}:${maxUpdated}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const freshData = await this.fetchData(key);
    this.cache.set(cacheKey, freshData);
    return freshData;
  }
}
```

---

## 8. SUBSCRIPTION SYSTEM PATTERNS (Nov 2025, Enhanced: Nov 29-30)

### SubscriptionPurchase Model Usage

**NEW: Dedicated subscription allowance tracking with flexible JSONB usage_tracking:**
```javascript
// ✅ CORRECT: Creating subscription purchases
const subscriptionPurchase = await models.SubscriptionPurchase.create({
  subscription_history_id: activeSubscription.id,
  purchasable_type: 'workshop',
  purchasable_id: workshopId,
  usage_tracking: {
    monthly_claims: 1,
    total_usage: 5,
    last_accessed: new Date().toISOString(),
    custom_metadata: { source: 'subscription_claim' }
  }
});

// ✅ CORRECT: Updating usage tracking
await models.SubscriptionPurchase.update({
  usage_tracking: models.sequelize.literal(`
    jsonb_set(
      usage_tracking,
      '{total_usage}',
      to_jsonb((usage_tracking->>'total_usage')::int + 1)
    )
  `)
}, {
  where: { id: subscriptionPurchaseId }
});

// ✅ CORRECT: Querying with JSONB operations
const subscriptionPurchases = await models.SubscriptionPurchase.findAll({
  where: {
    subscription_history_id: subscriptionId,
    [models.sequelize.Op.and]: [
      models.sequelize.literal(`usage_tracking->>'monthly_claims' < '5'`)
    ]
  }
});
```

### Subscription Service Patterns

```javascript
// ✅ CORRECT: Service-layer subscription operations
class SubscriptionService {
  async claimProduct(userId, productType, productId) {
    const transaction = await models.sequelize.transaction();

    try {
      // Check active subscription
      const activeSubscription = await models.SubscriptionHistory.findOne({
        where: { user_id: userId, status: 'active' }
      });

      if (!activeSubscription) {
        throw new Error('No active subscription found');
      }

      // Create subscription purchase claim
      const claim = await models.SubscriptionPurchase.create({
        subscription_history_id: activeSubscription.id,
        purchasable_type: productType,
        purchasable_id: productId,
        usage_tracking: {
          monthly_claims: 1,
          claimed_at: new Date().toISOString()
        }
      }, { transaction });

      await transaction.commit();
      return claim;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

**CRITICAL: Legacy Purchase-based subscription logic removed (Nov 2025):**
- ❌ **REMOVED**: Purchase-based subscription logic from `PaymentService`
- ❌ **REMOVED**: Subscription access from `videoAccessControl.js`
- ✅ **Current**: Clean separation between purchases and subscriptions
- ✅ **Future**: SubscriptionPurchase model for allowance tracking

### Subscription Payment Status Service (NEW: Nov 29-30, 2025)

**Automatic detection and handling of abandoned subscription payment pages:**

```javascript
import SubscriptionPaymentStatusService from '../services/SubscriptionPaymentStatusService.js';

// Check and handle subscription payment page status
const result = await SubscriptionPaymentStatusService.checkAndHandleSubscriptionPaymentPageStatus(
  subscriptionId,
  {
    attemptNumber: 1,
    maxAttempts: 6  // Grace period for PayPlus processing delays
  }
);

// Service features:
// - Detects abandoned payment pages → cancels subscription
// - Detects completed payments → activates subscription
// - Detects failed payments → cancels subscription
// - Handles PayPlus processing delays with retry logic
// - Supports renewal detection via subscription UID fallback

// Bulk check for user's pending subscriptions
const userResult = await SubscriptionPaymentStatusService.checkUserPendingSubscriptions(userId);
// Returns: { activated: 2, cancelled: 1, errors: 0, skipped: 0 }

// Critical fix for renewals via polling (fallback strategy)
// If primary page lookup fails, tries subscription UID renewal detection
// Creates Transaction records for detected renewals
```

### Subscription Activation with Webhook URL Fix

**CRITICAL FIX (Nov 30, 2025): Added missing webhook URL to subscription payments:**

```javascript
// PaymentService.js - Fixed subscription payment page creation
const pageData = {
  // ... other fields
  payment_page_webhook: PAYPLUS_WEBHOOK_URL,  // ✅ CRITICAL: Was missing for subscriptions
  // This ensures PayPlus sends webhooks for subscription payments
  // Without this, only polling would detect subscription payments
};
```

---

## 9. JOB SCHEDULER PATTERNS (REDIS-BACKED PERSISTENCE)

### JobScheduler Service Architecture (NEW: Dec 2025)

**CRITICAL: Replace ALL setTimeout/setInterval patterns with JobScheduler for production-grade reliability:**

```javascript
// ❌ WRONG: Lost on server restart
setTimeout(() => pollPaymentStatus(id), 5000);
setInterval(() => cleanupSessions(), 12 * 60 * 60 * 1000);

// ✅ CORRECT: Persistent Redis-backed jobs
import jobScheduler from '../services/JobScheduler.js';

// Schedule one-time job with delay
await jobScheduler.scheduleJob('SUBSCRIPTION_PAYMENT_CHECK', {
  subscriptionId: 'sub_123',
  attemptNumber: 1
}, {
  delay: 5000,
  priority: 100
});

// Schedule recurring job with cron
await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP',
  { type: 'light', batchSize: 500 },
  '0 */2 * * *',  // Every 2 hours
  { priority: 60 }
);
```

### Job Type Implementation Pattern

```javascript
// In JobScheduler.js - Add new job processor
async processCustomJob(data) {
  const { customParam1, customParam2 } = data;

  try {
    ludlog.generic('Processing custom job', { customParam1 });

    // Import services dynamically to avoid circular dependencies
    const MyService = (await import('./MyService.js')).default;

    // Perform job logic
    const result = await MyService.doWork(customParam1, customParam2);

    // Chain next job if needed
    if (result.needsRetry) {
      await this.scheduleJob('CUSTOM_JOB', {
        ...data,
        attemptNumber: (data.attemptNumber || 1) + 1
      }, {
        delay: 10000,
        priority: 50
      });
    }

    return { success: true, result };

  } catch (error) {
    luderror.generic('Custom job failed:', error);
    throw error; // Triggers retry logic
  }
}
```

### Service Integration Pattern

```javascript
// ✅ CORRECT: Service using JobScheduler
class PaymentService {
  async initiatePaymentPolling(transactionId) {
    // Schedule immediate check
    await jobScheduler.scheduleJob('PAYMENT_STATUS_CHECK', {
      checkType: 'single_transaction',
      transactionId,
      attemptNumber: 1,
      maxAttempts: 10
    }, {
      priority: 90
    });
  }
}

// ✅ CORRECT: Replacing old setInterval patterns
class AuthService {
  async initializeSessionCleanupJobs() {
    // Light cleanup every 2 hours
    await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP',
      { type: 'light' },
      '0 */2 * * *'
    );

    // Deep cleanup twice daily
    await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP',
      { type: 'full' },
      '0 2,14 * * *'
    );
  }
}
```

### Development Mode Handling

```javascript
// JobScheduler gracefully handles Redis unavailability in development
if (isDevelopment && !redisAvailable) {
  // Server starts normally
  // Jobs can be triggered manually via admin API
  // No errors thrown

  // Manual execution still works:
  // POST /api/jobs/schedule
  // { "type": "SESSION_CLEANUP", "data": {} }
}
```

### Job Priority Guidelines

```javascript
// Priority ranges by business impact
const PRIORITY_RANGES = {
  CRITICAL: [90, 100],  // Revenue-impacting (payments, subscriptions)
  HIGH: [60, 89],       // Security & user-facing (sessions, monitoring)
  MEDIUM: [30, 59],     // Maintenance (cleanup, optimization)
  LOW: [1, 29]          // Background (analytics, reporting)
};

// Set priority based on business impact
await jobScheduler.scheduleJob('PAYMENT_CHECK', data, {
  priority: 100  // Critical - revenue impact
});
```

---

## 10. COMMON BACKEND ANTI-PATTERNS

### ❌ Direct Model Access for Products
```javascript
// ❌ WRONG: Creating products without EntityService
const game = await models.Game.create(gameData);
const product = await models.Product.create({
  product_type: 'game',
  entity_id: game.id
});

// ✅ CORRECT: Use EntityService
const game = await EntityService.create('game', gameData, userId);
```

### ❌ Missing Transaction Safety
```javascript
// ❌ WRONG: Multi-step operations without transactions
await models.Entity.update(data, { where: { id } });
await models.Product.update(productData, { where: { entity_id: id } });
// If second operation fails, first succeeds = inconsistent state

// ✅ CORRECT: Use transactions
const transaction = await models.sequelize.transaction();
try {
  await models.Entity.update(data, { where: { id }, transaction });
  await models.Product.update(productData, { where: { entity_id: id }, transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

### ❌ Using setTimeout/setInterval for Recurring Tasks
```javascript
// ❌ WRONG: In-memory timers (lost on server restart)
setTimeout(() => pollPaymentStatus(id), 5000);
setInterval(() => cleanupExpiredSessions(), 12 * 60 * 60 * 1000);

// ✅ CORRECT: Redis-backed persistent jobs
await jobScheduler.scheduleJob('PAYMENT_STATUS_CHECK', data, { delay: 5000 });
await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP', data, '0 */12 * * *');
```

### ❌ In-Memory Session Storage
```javascript
// ❌ WRONG: In-memory session storage (lost on server restart)
class AuthService {
  constructor() {
    this.sessionStore = new Map(); // ❌ NEVER use in-memory for sessions
    this.refreshTokenStore = new Map(); // ❌ NEVER use in-memory for tokens
  }
}

// ✅ CORRECT: Database-backed session persistence
class AuthService {
  async createSession(userId, metadata) {
    await models.UserSession.create(sessionData); // ✅ Database persistence
  }

  async validateSession(sessionId) {
    return await models.UserSession.findByPk(sessionId); // ✅ Database query
  }
}
```

### ❌ Security Bypasses
```javascript
// ❌ WRONG: Hardcoded access checks
if (req.user.id === game.creator_user_id) {
  // Allow access
}

// ✅ CORRECT: Use service layer validation
const hasAccess = await AccessControlService.checkAccess(
  req.user.id, 'game', gameId
);
```

---

## 9. KEY API ENDPOINTS REFERENCE

### Essential Routes
- `GET /api/entities/:type` - Generic entity listing
- `POST /api/entities/:type` - Generic entity creation
- `GET/PUT/DELETE /api/entities/:type/:id` - Generic entity operations
- `POST /api/access/check` - Access validation
- `GET /api/videos/:id/stream` - Video streaming with access control
- `GET /api/sse/events` - Server-sent events connection

### File Locations
- **EntityService**: `/services/EntityService.js` (1,309 lines)
- **AccessControlService**: `/services/AccessControlService.js`
- **Middleware**: `/middleware/` (auth, validation, security, error handling)
- **Models**: `/models/` (41 model files)
- **Routes**: `/routes/` (26 route files)

---

## Backend Development Checklist

**Before implementing:**
- [ ] Check if EntityService handles this entity type
- [ ] Determine if custom transaction logic is needed
- [ ] Identify required middleware (auth, validation, ownership)
- [ ] Plan error handling and response format

**During implementation:**
- [ ] Use appropriate service layer (EntityService vs direct models)
- [ ] Implement proper validation with Joi schemas
- [ ] Add transaction safety for multi-step operations
- [ ] Follow rate limiting patterns for resource-intensive operations

**Before claiming done:**
- [ ] Test API endpoints with real data
- [ ] Verify error handling works correctly
- [ ] Check that ownership validation is enforced
- [ ] Confirm transaction safety and rollback behavior
- [ ] Test rate limiting and security middleware

**Remember:** The backend serves both teacher and student portals - ensure your APIs work for both contexts and follow the access control patterns defined in the main architecture file.