// Ludora API Server - Enhanced Security Version
import dotenv from 'dotenv';

// Load environment files with proper cascading: base .env first, then environment-specific overrides
const env = process.env.ENVIRONMENT || 'production';

// For cloud deployments (Heroku, etc.), .env files might not exist but environment variables are set
// This is normal and expected behavior
const isCloudDeployment = process.env.PORT && process.env.DATABASE_URL;

// Load base .env file first (defaults) - only warn if missing in local development
const baseResult = dotenv.config({ path: '.env' });
if (baseResult.error) {
  if (!isCloudDeployment) {
    console.warn(`⚠️  Failed to load base .env:`, baseResult.error);
  }
}

// Load environment-specific .env file (overrides) - only if not production
if (env !== 'production') {
  const envFile = `.env.${env}`;
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    if (!isCloudDeployment) {
      console.warn(`⚠️  Failed to load ${envFile}:`, envResult.error);
    }
  }
}

// Validate critical environment variables are available
const criticalVars = ['JWT_SECRET'];
const missingVars = criticalVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Critical environment variables missing: ${missingVars.join(', ')}`);
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}


// Now import other modules after environment is loaded
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cookie from 'cookie';

// Initialize secrets service (validates critical secrets)
import SecretsService from './services/SecretsService.js';
const secretsService = new SecretsService();

// Initialize Firebase (this must come before importing routes that use it)
import './config/firebase.js';

// Import security middleware
import {
  enforceHTTPS,
  securityHeaders,
  secureCookies,
  apiSecurityHeaders,
  requestSizeLimiter,
  securityAuditLogger,
  rateLimitBypassDetection
} from './middleware/security.js';

// Import CORS configuration
import { dynamicCors } from './middleware/cors.js';

// Import compression optimization
import { israeliCompressionMiddleware, hebrewContentCompressionMiddleware } from './middleware/israeliCompression.js';

// Import Israeli compliance middleware (reduced)
import { israeliPrivacyCompliance } from './middleware/israeliCompliance.js';

// REMOVED: Israeli performance monitoring middleware - files deleted

// REMOVED: Israeli cost optimization middleware - files deleted

// REMOVED: Israeli market alerts middleware - files deleted

// Import error handling and validation middleware
import {
  globalErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  requestLogger,
  healthCheckErrorHandler
} from './middleware/errorHandler.js';
import { rateLimiters } from './middleware/validation.js';

// Import route modules
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import paymentsRoutes from './routes/payments.js';
import integrationRoutes from './routes/integrations.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import assetsRoutes from './routes/assets.js';
import unifiedAssetsRoutes from './routes/unifiedAssets.js';
import accessRoutes from './routes/access.js';
import mediaRoutes from './routes/media.js';
import logsRoutes from './routes/logs.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import toolRoutes from './routes/tools.js';
import subscriptionRoutes from './routes/subscriptions.js';
import publicApisRoutes from './routes/publicApis.js';
import gamesRoutes from './routes/games.js';
import gameLobbiesRoutes from './routes/gameLobbies.js';
import gameSessionsRoutes from './routes/gameSessions.js';
import productsRoutes from './routes/products.js';
import svgSlidesRoutes from './routes/svgSlides.js';
import systemTemplatesRoutes from './routes/system-templates.js';
import eduContentRoutes from './routes/eduContent.js';
import settingsRoutes from './routes/settings.js';
import playersRoutes from './routes/players.js';

// Import services and utilities for Socket.IO authentication
import AuthService from './services/AuthService.js';
import PlayerService from './services/PlayerService.js';
import SettingsService from './services/SettingsService.js';
import { detectPortal, getPortalCookieNames } from './utils/cookieConfig.js';
import { STUDENTS_ACCESS_MODES } from './constants/settingsKeys.js';
import { clog, cerror } from './lib/utils.js';

// Initialize services for Socket.IO authentication
const socketAuthService = new AuthService();
const socketPlayerService = new PlayerService();

// Socket.IO Portal Authentication Constants
const SOCKET_PORTAL_TYPES = {
  TEACHER: 'teacher',
  STUDENT: 'student'
};

const SOCKET_CREDENTIAL_POLICIES = {
  WITH_CREDENTIALS: 'with_credentials',
  WITHOUT_CREDENTIALS: 'without_credentials',
  TRY_BOTH: 'try_both'
};

const app = express();

// Create HTTP server for Socket.IO integration
const httpServer = createServer(app);

// 1. HTTPS Enforcement (must be first in production)
if (process.env.ENVIRONMENT === 'production') {
  app.use(enforceHTTPS);
}

// 2. Security headers (comprehensive protection)
app.use(securityHeaders());

// 3. Request size limiting (prevent DoS attacks)
app.use(requestSizeLimiter);

// 4. Security audit logging (detect malicious patterns)
app.use(securityAuditLogger);

// 5. Rate limit bypass detection
app.use(rateLimitBypassDetection);

// 6. Request tracking
app.use(requestIdMiddleware);

// 7. Request logging
if (process.env.ENVIRONMENT !== 'test') {
  app.use(requestLogger);
}

// 8. Dynamic CORS with webhook support (MUST come before rate limiting)
app.use(dynamicCors);

// 9. Rate limiting (global with enhanced security)
// Temporarily disabled in development for testing
if (process.env.ENVIRONMENT !== 'development') {
  app.use(rateLimiters.general);
}

// 10. Israeli-optimized response compression
app.use(israeliCompressionMiddleware);

// 11. Secure cookie configuration
app.use(secureCookies);

// 12. API-specific security headers
app.use('/api', apiSecurityHeaders);

// 13. Israeli compliance - REDUCED to only child protection
app.use('/api', israeliPrivacyCompliance());

// REMOVED: Israeli performance monitoring middleware - deleted

// REMOVED: Israeli cost optimization middleware - deleted

// REMOVED: Israeli market alerts middleware - deleted

// Body parsing middleware
app.use(express.json({
  limit: '100mb', // Increased to match file upload limits
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // Increased to match file upload limits

// Cookie parsing middleware
app.use(cookieParser());

// API Routes (protected by frontend CORS)
// Apply Hebrew-optimized compression for routes likely to contain Hebrew content
app.use('/api/entities', hebrewContentCompressionMiddleware);
app.use('/api/products', hebrewContentCompressionMiddleware);
app.use('/api/dashboard', hebrewContentCompressionMiddleware);

// REMOVED: All Israeli dashboard endpoints - middleware deleted

app.use('/api/auth', authRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/v2/assets', unifiedAssetsRoutes); // Unified REST API structure
app.use('/api/access', accessRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/public', publicApisRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api', gameLobbiesRoutes);
app.use('/api', gameSessionsRoutes);
app.use('/api/edu-content', eduContentRoutes);
app.use('/api/svg-slides', svgSlidesRoutes);
app.use('/api/system-templates', systemTemplatesRoutes);
app.use('/api/settings', settingsRoutes);

// Webhook Routes (separate CORS policy for external providers)
app.use('/api/webhooks', webhookRoutes);

// REMOVED: Israeli market alerts webhook - middleware deleted

// Health check endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Ludora API is running',
    environment: env,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    status: 'healthy',
    deploymentTest: 'deploy-action-test-2025-10-09'
  });
});

app.get('/health', healthCheckErrorHandler);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Ludora API',
    version: process.env.npm_package_version || '1.0.0',
    environment: env,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      players: '/api/players',
      entities: '/api/entities',
      products: '/api/products',
      functions: '/api/functions',
      payments: '/api/payments',
      integrations: '/api/integrations',
      videos: '/api/videos',
      assets: '/api/assets', // Legacy file operations
      'assets-v2': '/api/v2/assets', // Unified REST API for file management
      access: '/api/access',
      dashboard: '/api/dashboard',
      tools: '/api/tools',
      subscriptions: '/api/subscriptions',
      public: '/api/public',
      games: '/api/games',
      'game-lobbies': '/api/game-lobbies',
      'game-sessions': '/api/game-sessions',
      'edu-content': '/api/edu-content',
      'svg-slides': '/api/svg-slides',
      'system-templates': '/api/system-templates'
    },
    documentation: process.env.API_DOCS_URL || 'No documentation URL configured'
  });
});

// Static file serving for local uploads
app.use('/uploads', express.static('./uploads'));

// REMOVED: Israeli compliance audit logging - middleware deleted

// 404 handler (must come before global error handler)
app.use(notFoundHandler);

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

const PORT = process.env.PORT || process.env.DEFAULT_PORT || 3000;

// Configure Socket.IO server with CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Use same CORS logic as the main API
      const frontendUrls = [];

      // Get frontend URLs from environment (same logic as dynamicCors)
      if (process.env.FRONTEND_URL) {
        frontendUrls.push(process.env.FRONTEND_URL);
      }

      if (process.env.ADDITIONAL_FRONTEND_URLS) {
        const additionalUrls = process.env.ADDITIONAL_FRONTEND_URLS.split(',')
          .map(url => url.trim())
          .filter(url => url.length > 0);
        frontendUrls.push(...additionalUrls);
      }

      // Default development URLs (both teacher and student portal ports)
      if (frontendUrls.length === 0) {
        frontendUrls.push('http://localhost:5173', 'http://localhost:5174', `http://localhost:${PORT}`);
      }

      // Development override
      if (process.env.CORS_DEV_OVERRIDE === 'true') {
        return callback(null, true);
      }

      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is allowed
      if (frontendUrls.includes(origin)) {
        return callback(null, true);
      }

      console.warn('🚨 Socket.IO CORS: Unauthorized origin attempt:', {
        origin,
        allowedOrigins: frontendUrls,
        timestamp: new Date().toISOString()
      });

      callback(new Error('Not allowed by CORS policy'));
    },
    credentials: true, // Support cookie authentication
    methods: ['GET', 'POST']
  },
  allowEIO3: true // Support older Socket.IO clients
});

// =============================================
// SOCKET.IO PORTAL-AWARE AUTHENTICATION MIDDLEWARE
// =============================================

/**
 * Parse portal context from Socket.IO handshake query parameters
 * @param {Object} socket - Socket.IO socket object
 * @returns {Object} Parsed portal context
 */
function parseSocketPortalContext(socket) {
  const query = socket.handshake.query || {};
  const auth = socket.handshake.auth || {};

  // Merge query and auth objects (auth takes precedence)
  const combined = { ...query, ...auth };

  // TODO remove debug - update Socket.IO server for portal-aware authentication
  clog('🔌 [SocketAuth] Parsing portal context from handshake:', {
    query: Object.keys(query),
    auth: Object.keys(auth)
  });

  return {
    portalType: combined.portalType || SOCKET_PORTAL_TYPES.TEACHER,
    credentialPolicy: combined.credentialPolicy || SOCKET_CREDENTIAL_POLICIES.WITH_CREDENTIALS,
    studentsAccessMode: combined.studentsAccessMode || null,
    authMethod: combined.authMethod || 'firebase'
  };
}

/**
 * Detect portal type from Socket.IO handshake headers
 * Similar to HTTP request portal detection but for Socket.IO
 * @param {Object} socket - Socket.IO socket object
 * @returns {string} Portal type: 'teacher' or 'student'
 */
function detectSocketPortal(socket) {
  const origin = socket.handshake.headers.origin || '';
  const referer = socket.handshake.headers.referer || '';

  // Student portal indicators
  const studentIndicators = [
    origin.includes('my.ludora.app'),
    referer.includes('my.ludora.app'),
    origin.includes('localhost:5174'),
    referer.includes('localhost:5174')
  ];

  if (studentIndicators.some(indicator => indicator)) {
    return SOCKET_PORTAL_TYPES.STUDENT;
  }

  return SOCKET_PORTAL_TYPES.TEACHER;
}

/**
 * Attempt to authenticate socket using Firebase cookies
 * @param {Object} socket - Socket.IO socket object
 * @param {string} portalType - Portal type for cookie name selection
 * @returns {Promise<Object|null>} User data or null if not authenticated
 */
async function authenticateSocketWithFirebase(socket, portalType) {
  try {
    // Parse cookies from handshake headers
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookies = cookie.parse(cookieHeader);

    // Get portal-specific cookie names
    const cookieNames = getPortalCookieNames(portalType);
    const accessToken = cookies[cookieNames.accessToken];

    if (!accessToken) {
      // TODO remove debug - update Socket.IO server for portal-aware authentication
      clog('🔌 [SocketAuth] No access token cookie found for portal:', portalType);
      return null;
    }

    // Verify the token
    const tokenData = await socketAuthService.verifyToken(accessToken);

    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 [SocketAuth] Firebase authentication successful:', {
      userId: tokenData.id || tokenData.user?.id,
      portalType
    });

    return tokenData;
  } catch (error) {
    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 [SocketAuth] Firebase authentication failed:', error.message);
    return null;
  }
}

/**
 * Attempt to authenticate socket using player tokens (NEW SYSTEM)
 * @param {Object} socket - Socket.IO socket object
 * @returns {Promise<Object|null>} Player data or null if not authenticated
 */
async function authenticateSocketWithPlayerTokens(socket) {
  try {
    // Parse cookies from handshake headers
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookies = cookie.parse(cookieHeader);
    const playerAccessToken = cookies.student_access_token;
    const playerRefreshToken = cookies.student_refresh_token;

    // Try access token first
    if (playerAccessToken) {
      try {
        const tokenData = await socketAuthService.verifyToken(playerAccessToken);

        if (tokenData.type === 'player') {
          // Get full player data
          const player = await socketPlayerService.getPlayer(tokenData.id, true);
          if (player) {
            // TODO remove debug - update Socket.IO server for portal-aware authentication
            clog('🔌 [SocketAuth] Player token authentication successful:', {
              playerId: player.id,
              displayName: player.display_name
            });

            return {
              player: {
                id: player.id,
                display_name: player.display_name,
                teacher_id: player.teacher_id,
                teacher: player.teacher,
                achievements: player.achievements,
                preferences: player.preferences,
                is_online: player.is_online
              },
              sessionType: 'player_token'
            };
          }
        }
      } catch (tokenError) {
        // Access token invalid, try refresh token
        // TODO remove debug - update Socket.IO server for portal-aware authentication
        clog('🔌 [SocketAuth] Player access token invalid, trying refresh token');
      }
    }

    // Try refresh token if access token failed
    if (playerRefreshToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const refreshPayload = jwt.default.verify(playerRefreshToken, process.env.JWT_SECRET);

        if (refreshPayload.type === 'player') {
          const player = await socketPlayerService.getPlayer(refreshPayload.id, true);
          if (player) {
            // TODO remove debug - update Socket.IO server for portal-aware authentication
            clog('🔌 [SocketAuth] Player refresh token authentication successful:', {
              playerId: player.id,
              displayName: player.display_name
            });

            return {
              player: {
                id: player.id,
                display_name: player.display_name,
                teacher_id: player.teacher_id,
                teacher: player.teacher,
                achievements: player.achievements,
                preferences: player.preferences,
                is_online: player.is_online
              },
              sessionType: 'player_token'
            };
          }
        }
      } catch (refreshError) {
        // TODO remove debug - update Socket.IO server for portal-aware authentication
        clog('🔌 [SocketAuth] Player refresh token authentication failed:', refreshError.message);
      }
    }

    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 [SocketAuth] No valid player tokens found');
    return null;
  } catch (error) {
    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 [SocketAuth] Player token authentication failed:', error.message);
    return null;
  }
}

/**
 * Validate students access mode against current settings
 * @param {string} requestedMode - Mode requested by client
 * @returns {Promise<boolean>} True if the requested mode matches settings
 */
async function validateStudentsAccessMode(requestedMode) {
  try {
    const currentMode = await SettingsService.getStudentsAccessMode();
    return currentMode === requestedMode;
  } catch (error) {
    cerror('🔌 [SocketAuth] Error validating students access mode:', error);
    return false;
  }
}

/**
 * Socket.IO authentication middleware
 * Validates connections based on portal context and credential policy
 */
io.use(async (socket, next) => {
  try {
    // Parse portal context from client handshake
    const portalContext = parseSocketPortalContext(socket);

    // Also detect portal from headers for validation
    const detectedPortal = detectSocketPortal(socket);

    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 [SocketAuth] Connection attempt:', {
      socketId: socket.id,
      portalContext,
      detectedPortal,
      origin: socket.handshake.headers.origin
    });

    // Initialize socket authentication context
    socket.portalContext = portalContext;
    socket.isAuthenticated = false;
    socket.user = null;
    socket.player = null;

    // Validate based on credential policy
    const { credentialPolicy, portalType, studentsAccessMode } = portalContext;

    switch (credentialPolicy) {
      case SOCKET_CREDENTIAL_POLICIES.WITH_CREDENTIALS: {
        // Firebase authentication required
        const userData = await authenticateSocketWithFirebase(socket, portalType);

        if (!userData) {
          // TODO remove debug - update Socket.IO server for portal-aware authentication
          clog('🔌 [SocketAuth] Rejecting connection: Firebase auth required but not provided');
          return next(new Error('Authentication required'));
        }

        socket.isAuthenticated = true;
        socket.user = userData;
        socket.authMethod = 'firebase';

        // TODO remove debug - update Socket.IO server for portal-aware authentication
        clog('🔌 [SocketAuth] Connection authenticated via Firebase');
        break;
      }

      case SOCKET_CREDENTIAL_POLICIES.WITHOUT_CREDENTIALS: {
        // Anonymous connection allowed (for student portal invite_only mode)
        // Verify this is actually a student portal connection
        if (portalType === SOCKET_PORTAL_TYPES.TEACHER) {
          // TODO remove debug - update Socket.IO server for portal-aware authentication
          clog('🔌 [SocketAuth] Rejecting: Teacher portal cannot use anonymous connections');
          return next(new Error('Teacher portal requires authentication'));
        }

        // For student portal, allow anonymous but check for optional player tokens
        const playerData = await authenticateSocketWithPlayerTokens(socket);

        if (playerData) {
          socket.player = playerData;
          socket.authMethod = 'student_access_token';
          // TODO remove debug - update Socket.IO server for portal-aware authentication
          clog('🔌 [SocketAuth] Anonymous connection with player session:', playerData.player?.display_name);
        } else {
          socket.authMethod = 'anonymous';
          // TODO remove debug - update Socket.IO server for portal-aware authentication
          clog('🔌 [SocketAuth] Fully anonymous connection allowed');
        }

        // Anonymous connections are allowed, mark as not authenticated but valid
        socket.isAuthenticated = false;
        break;
      }

      case SOCKET_CREDENTIAL_POLICIES.TRY_BOTH: {
        // Try Firebase first, then fall back to player session, then allow anonymous
        const userData = await authenticateSocketWithFirebase(socket, portalType);

        if (userData) {
          socket.isAuthenticated = true;
          socket.user = userData;
          socket.authMethod = 'firebase';
          // TODO remove debug - update Socket.IO server for portal-aware authentication
          clog('🔌 [SocketAuth] TRY_BOTH: Authenticated via Firebase');
        } else {
          // Try player tokens
          const playerData = await authenticateSocketWithPlayerTokens(socket);

          if (playerData) {
            socket.player = playerData;
            socket.authMethod = 'student_access_token';
            socket.isAuthenticated = true; // Player authentication succeeded!
            // TODO remove debug - update Socket.IO server for portal-aware authentication
            clog('🔌 [SocketAuth] TRY_BOTH: Authenticated via player tokens');
          } else {
            // Allow anonymous for student portal
            if (portalType === SOCKET_PORTAL_TYPES.STUDENT) {
              socket.authMethod = 'anonymous';
              socket.isAuthenticated = false; // Anonymous connection
              // TODO remove debug - update Socket.IO server for portal-aware authentication
              clog('🔌 [SocketAuth] TRY_BOTH: Anonymous connection allowed for student portal');
            } else {
              // Teacher portal requires authentication
              // TODO remove debug - update Socket.IO server for portal-aware authentication
              clog('🔌 [SocketAuth] TRY_BOTH: Rejecting anonymous teacher portal connection');
              return next(new Error('Teacher portal requires authentication'));
            }
          }
        }
        break;
      }

      default: {
        // Unknown credential policy - default to requiring authentication
        // TODO remove debug - update Socket.IO server for portal-aware authentication
        clog('🔌 [SocketAuth] Unknown credential policy, requiring authentication:', credentialPolicy);

        const userData = await authenticateSocketWithFirebase(socket, portalType);

        if (!userData) {
          return next(new Error('Authentication required'));
        }

        socket.isAuthenticated = true;
        socket.user = userData;
        socket.authMethod = 'firebase';
      }
    }

    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 [SocketAuth] Connection authorized:', {
      socketId: socket.id,
      portalType,
      authMethod: socket.authMethod,
      isAuthenticated: socket.isAuthenticated,
      userId: socket.user?.id || socket.user?.user?.id || null,
      playerId: socket.player?.player?.id || null
    });

    next();
  } catch (error) {
    cerror('🔌 [SocketAuth] Authentication middleware error:', error);
    next(new Error('Authentication failed'));
  }
});

// =============================================
// SOCKET.IO CONNECTION HANDLING
// =============================================

// Socket.IO connection handling with portal-aware context
io.on('connection', (socket) => {
  // TODO remove debug - update Socket.IO server for portal-aware authentication
  clog('🔌 Socket.IO client connected:', {
    id: socket.id,
    origin: socket.handshake.headers.origin,
    portalType: socket.portalContext?.portalType,
    authMethod: socket.authMethod,
    isAuthenticated: socket.isAuthenticated,
    userId: socket.user?.id || socket.user?.user?.id || null,
    playerId: socket.player?.player?.id || null
  });

  // Join lobby updates channel
  socket.on('join-lobby-updates', () => {
    socket.join('lobby-updates');
    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog(`🔌 Socket ${socket.id} joined lobby-updates channel (auth: ${socket.authMethod})`);
  });

  // Legacy event handler for backward compatibility
  socket.on('join', (channel) => {
    if (channel === 'lobby-updates') {
      socket.join('lobby-updates');
      // TODO remove debug - update Socket.IO server for portal-aware authentication
      clog(`🔌 Socket ${socket.id} joined ${channel} via legacy 'join' event`);
    }
  });

  // Leave lobby updates channel
  socket.on('leave-lobby-updates', () => {
    socket.leave('lobby-updates');
    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog(`🔌 Socket ${socket.id} left lobby-updates channel`);
  });

  // Legacy event handler for backward compatibility
  socket.on('leave', (channel) => {
    if (channel === 'lobby-updates') {
      socket.leave('lobby-updates');
      // TODO remove debug - update Socket.IO server for portal-aware authentication
      clog(`🔌 Socket ${socket.id} left ${channel} via legacy 'leave' event`);
    }
  });

  // Handle test messages (for debugging)
  socket.on('test', (data) => {
    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 Socket test message received:', {
      socketId: socket.id,
      data,
      authMethod: socket.authMethod
    });
  });

  socket.on('disconnect', (reason) => {
    // TODO remove debug - update Socket.IO server for portal-aware authentication
    clog('🔌 Socket.IO client disconnected:', {
      id: socket.id,
      reason,
      portalType: socket.portalContext?.portalType,
      authMethod: socket.authMethod,
      timestamp: new Date().toISOString()
    });
  });

  // Handle connection errors
  socket.on('error', (error) => {
    cerror('🔌 Socket.IO error:', {
      socketId: socket.id,
      error: error.message
    });
  });
});

// Export io instance for use in other services
global.io = io;

// Initialize database before starting server
async function startServer() {
  try {
    // Initialize database schema and seeders
    const DatabaseInitService = await import('./services/DatabaseInitService.js');
    await DatabaseInitService.default.initialize();

    // Extend recently active sessions to prevent logout during deploy
    try {
      const models = await import('./models/index.js');
      await models.default.UserSession.extendRecentlyActiveSessions();
    } catch (sessionError) {
      console.warn('⚠️ Failed to extend active sessions during startup:', sessionError.message);
      // Don't fail server startup if session extension fails
    }

    const server = httpServer.listen(PORT, () => {
      console.log(`Ludora API Server with Socket.IO running on port ${PORT} (${env})`);
    });

    // Start background services
    try {

    } catch (error) {
      // Don't fail server startup if background services fail
    }

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

const server = await startServer();

// Ensure the server stays alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Stop background services
  try {
    // No background services to stop - Israeli middleware removed
  } catch (error) {
    // Log critical shutdown errors only
  }

  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');

  // Stop background services
  try {
    // No background services to stop - Israeli middleware removed
  } catch (error) {
    // Log critical shutdown errors only
  }

  server.close(() => {
    process.exit(0);
  });
});

