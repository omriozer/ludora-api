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
import sseRoutes from './routes/sse.js';

const app = express();

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

// 8. Rate limiting (global with enhanced security)
app.use(rateLimiters.general);

// 9. Dynamic CORS with webhook support
app.use(dynamicCors);

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
app.use('/api/sse', sseRoutes);
app.use('/api/edu-content', eduContentRoutes);
app.use('/api/svg-slides', svgSlidesRoutes);
app.use('/api/system-templates', systemTemplatesRoutes);

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
      'sse': '/api/sse',
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

// Initialize database before starting server
async function startServer() {
  try {
    // Initialize database schema and seeders
    const DatabaseInitService = await import('./services/DatabaseInitService.js');
    await DatabaseInitService.default.initialize();

    const server = app.listen(PORT, () => {
      console.log(`Ludora API Server running on port ${PORT} (${env})`);
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

