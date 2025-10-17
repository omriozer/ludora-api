// Ludora API Server - Enhanced Security Version
import dotenv from 'dotenv';

// Load environment-specific .env file FIRST before any other imports
const env = process.env.ENVIRONMENT || 'production';
const envFile = env === 'production' ? '.env' : `.env.${env}`;
console.log(`===starting api===`);
console.log(`🔧 Loading environment from: ${envFile}`);
const result = dotenv.config({ path: envFile });
if (result.error) {
  console.error(`❌ Failed to load ${envFile}:`, result.error);
} else {
  console.log(`✅ Successfully loaded ${envFile}`);
  console.log(`🔑 JWT_SECRET found: ${process.env.JWT_SECRET ? 'YES' : 'NO'}`);
}

// Now import other modules after environment is loaded
import express from 'express';

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
import integrationRoutes from './routes/integrations.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import assetsRoutes from './routes/assets.js';
import accessRoutes from './routes/access.js';
import mediaRoutes from './routes/media.js';
import gameContentTemplatesRoutes from './routes/gameContentTemplates.js';
import gameContentUsageRoutes from './routes/gameContentUsage.js';
import logsRoutes from './routes/logs.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payments.js';
import dashboardRoutes from './routes/dashboard.js';
import toolRoutes from './routes/tools.js';

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

// 10. Secure cookie configuration
app.use(secureCookies);

// 11. API-specific security headers
app.use('/api', apiSecurityHeaders);

// Body parsing middleware
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes (protected by frontend CORS)
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/game-content-templates', gameContentTemplatesRoutes);
app.use('/api/games', gameContentUsageRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tools', toolRoutes);

// Webhook Routes (separate CORS policy for external providers)
app.use('/api/webhooks', webhookRoutes);

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
      functions: '/api/functions',
      integrations: '/api/integrations',
      videos: '/api/videos',
      access: '/api/access',
      payments: '/api/payments',
      dashboard: '/api/dashboard',
      tools: '/api/tools',
      'game-content-templates': '/api/game-content-templates',
      'game-content-usage': '/api/games'
    },
    documentation: process.env.API_DOCS_URL || 'No documentation URL configured'
  });
});

// Static file serving for local uploads
app.use('/uploads', express.static('./uploads'));

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
      console.log(`🚀 Ludora API Server running on port ${PORT}`);
      console.log(`📁 Environment: ${env}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`✅ Server successfully started with updated environment variables ${new Date().toISOString()}`);
    });

    // Start background services
    try {
      // Import and start transaction cleanup service
      const TransactionCleanupService = await import('./services/TransactionCleanupService.js');
      TransactionCleanupService.default.start();
    } catch (error) {
      console.error('⚠️  Failed to start background services:', error);
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
    const TransactionCleanupService = await import('./services/TransactionCleanupService.js');
    TransactionCleanupService.default.stop();
  } catch (error) {
    console.error('⚠️  Error stopping background services:', error);
  }

  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');

  // Stop background services
  try {
    const TransactionCleanupService = await import('./services/TransactionCleanupService.js');
    TransactionCleanupService.default.stop();
  } catch (error) {
    console.error('⚠️  Error stopping background services:', error);
  }

  server.close(() => {
    process.exit(0);
  });
});

