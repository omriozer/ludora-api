import cors from 'cors';

// Enhanced CORS configuration with webhook support
class CORSConfig {
  constructor() {
    this.frontendUrls = this.getFrontendUrls();
    this.webhookOrigins = this.getWebhookOrigins();
  }

  // Get frontend URLs from environment
  getFrontendUrls() {
    const urls = [];

    // Primary frontend URL
    if (process.env.FRONTEND_URL) {
      urls.push(process.env.FRONTEND_URL);
    }

    // Additional frontend URLs (comma-separated)
    if (process.env.ADDITIONAL_FRONTEND_URLS) {
      const additionalUrls = process.env.ADDITIONAL_FRONTEND_URLS.split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
      urls.push(...additionalUrls);
    }

    // Default fallback for development
    if (urls.length === 0) {
      urls.push('http://localhost:5173', 'http://localhost:3000');
    }

    console.log('✅ Configured frontend URLs:', urls);
    return urls;
  }

  // Get webhook allowed origins
  getWebhookOrigins() {
    const origins = [];

    // Webhook specific origins (future feature)
    if (process.env.WEBHOOK_ALLOWED_ORIGINS) {
      const webhookUrls = process.env.WEBHOOK_ALLOWED_ORIGINS.split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
      origins.push(...webhookUrls);
    }

    console.log('🔗 Configured webhook origins:', origins.length > 0 ? origins : 'All origins allowed for webhooks');
    return origins;
  }

  // Main CORS configuration for API routes
  getMainCorsConfig() {
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed frontend URLs
        if (this.frontendUrls.includes(origin)) {
          return callback(null, true);
        }

        // Log unauthorized access attempts
        console.warn('🚨 CORS: Unauthorized origin attempt:', {
          origin,
          allowedOrigins: this.frontendUrls,
          timestamp: new Date().toISOString()
        });

        callback(new Error('Not allowed by CORS policy'));
      },
      credentials: true, // Allow cookies/auth headers
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'content-type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Request-ID',
        'Cache-Control',
        'Pragma'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
      ],
      maxAge: 86400 // 24 hours cache for preflight requests
    });
  }

  // CORS configuration for webhook endpoints
  getWebhookCorsConfig() {
    return cors({
      origin: (origin, callback) => {
        // If no webhook origins configured, allow all (with warning)
        if (this.webhookOrigins.length === 0) {
          console.warn('⚠️ WEBHOOK CORS: No specific origins configured, allowing all origins');
          return callback(null, true);
        }

        // Allow requests with no origin (server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed webhook origins
        if (this.webhookOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Log unauthorized webhook attempts
        console.warn('🚨 WEBHOOK CORS: Unauthorized origin attempt:', {
          origin,
          allowedOrigins: this.webhookOrigins,
          timestamp: new Date().toISOString()
        });

        callback(new Error('Webhook origin not allowed by CORS policy'));
      },
      credentials: false, // Webhooks typically don't need credentials
      optionsSuccessStatus: 200,
      methods: ['POST', 'PUT', 'OPTIONS'], // Typical webhook methods
      allowedHeaders: [
        'Content-Type',
        'X-Webhook-Signature',
        'X-Hub-Signature',
        'X-GitHub-Event',
        'X-Stripe-Signature',
        'User-Agent'
      ],
      maxAge: 3600 // 1 hour cache for webhook preflight
    });
  }

  // Development CORS (more permissive)
  getDevelopmentCorsConfig() {
    if (process.env.ENVIRONMENT !== 'development') {
      throw new Error('Development CORS config should only be used in development');
    }

    return cors({
      origin: true, // Allow all origins in development
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'content-type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Request-ID',
        'Cache-Control',
        'Pragma',
        'X-Custom-Header',
        '*'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset',
        '*'
      ]
    });
  }

  // Middleware factory for different route types
  createCorsMiddleware(type = 'main') {
    switch (type) {
      case 'main':
        return this.getMainCorsConfig();
      case 'webhook':
        return this.getWebhookCorsConfig();
      case 'development':
        return this.getDevelopmentCorsConfig();
      default:
        throw new Error(`Unknown CORS type: ${type}`);
    }
  }

  // Dynamic CORS based on route path
  dynamicCorsMiddleware() {
    const mainCors = this.createCorsMiddleware('main');
    const webhookCors = this.createCorsMiddleware('webhook');
    const devCors = process.env.ENVIRONMENT === 'development'
      ? this.createCorsMiddleware('development')
      : null;

    return (req, res, next) => {
      // Development override
      if (devCors && process.env.CORS_DEV_OVERRIDE === 'true') {
        console.log('🔧 CORS: Using DEVELOPMENT CORS for', req.method, req.path, 'from origin:', req.headers.origin);
        return devCors(req, res, next);
      }

      // Webhook routes
      if (req.path.startsWith('/api/webhooks/') || req.path.includes('/webhook')) {
        console.log('🔧 CORS: Using WEBHOOK CORS for', req.method, req.path, 'from origin:', req.headers.origin);
        return webhookCors(req, res, next);
      }

      // Default to main CORS
      console.log('🔧 CORS: Using MAIN CORS for', req.method, req.path, 'from origin:', req.headers.origin);
      return mainCors(req, res, next);
    };
  }

  // Validate CORS configuration
  validateConfig() {
    const issues = [];

    if (this.frontendUrls.length === 0) {
      issues.push('No frontend URLs configured');
    }

    // Check for localhost in production
    if (process.env.ENVIRONMENT === 'production') {
      const localhostUrls = this.frontendUrls.filter(url =>
        url.includes('localhost') || url.includes('127.0.0.1')
      );
      if (localhostUrls.length > 0) {
        issues.push(`Localhost URLs in production: ${localhostUrls.join(', ')}`);
      }
    }

    // Check for HTTP in production
    if (process.env.ENVIRONMENT === 'production') {
      const httpUrls = this.frontendUrls.filter(url => url.startsWith('http://'));
      if (httpUrls.length > 0) {
        issues.push(`HTTP URLs in production (should be HTTPS): ${httpUrls.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      console.warn('⚠️ CORS Configuration Issues:', issues);
      if (process.env.ENVIRONMENT === 'production') {
        throw new Error(`Critical CORS issues in production: ${issues.join(', ')}`);
      }
    } else {
      console.log('✅ CORS configuration validated successfully');
    }

    return issues;
  }
}

// Create singleton instance
const corsConfig = new CORSConfig();

// Validate configuration on startup
corsConfig.validateConfig();

// Export middleware functions
export const mainCors = corsConfig.createCorsMiddleware('main');
export const webhookCors = corsConfig.createCorsMiddleware('webhook');
export const dynamicCors = corsConfig.dynamicCorsMiddleware();

// Export class for advanced usage
export { CORSConfig };

export default corsConfig;