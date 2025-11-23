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

### Model Definitions (42 total models)

**Product Entities (use with EntityService):**
- File, Game, Workshop, Course, Tool, LessonPlan

**Business Models (direct access):**
- User, Purchase, Subscription, Classroom, Curriculum

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
```

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

## 8. COMMON BACKEND ANTI-PATTERNS

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