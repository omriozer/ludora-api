import helmet from 'helmet';

// HTTPS enforcement middleware
export function enforceHTTPS(req, res, next) {
  // Skip HTTPS enforcement in development
  if (process.env.ENVIRONMENT === 'development') {
    return next();
  }

  // Skip HTTPS enforcement for health checks and internal Fly.io requests
  if (req.path === '/health' || req.path === '/' || req.headers['fly-client-ip']) {
    return next();
  }

  // Check if request is already HTTPS
  const isHTTPS = req.secure ||
                  req.headers['x-forwarded-proto'] === 'https' ||
                  req.headers['x-forwarded-ssl'] === 'on';

  if (!isHTTPS) {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  next();
}

// Comprehensive security headers configuration
export function securityHeaders() {
  return helmet({
    // Content Security Policy - Allow Firebase authentication
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'", "https://www.gstatic.com", "https://apis.google.com"],
        connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://accounts.google.com"],
        frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.ENVIRONMENT !== 'development' ? [] : null,
        blockAllMixedContent: process.env.ENVIRONMENT !== 'development' ? [] : null,
      },
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin"
    },

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // Expect-CT
    expectCt: {
      maxAge: 86400, // 24 hours
      enforce: process.env.ENVIRONMENT === 'production'
    },

    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Allow embedding for development

    // Cross-Origin Opener Policy - Disable for Firebase OAuth authentication
    // Firebase authentication requires cross-origin popup communication with OAuth providers
    crossOriginOpenerPolicy: false,

    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  });
}


// Secure cookie settings middleware
export function secureCookies(req, res, next) {
  // Override res.cookie to set secure defaults
  const originalCookie = res.cookie;

  res.cookie = function(name, value, options = {}) {
    // For auth cookies, use the standardized config
    if (name === 'access_token' || name === 'refresh_token') {
      // Let auth routes handle their own configuration
      return originalCookie.call(this, name, value, options);
    }

    // For other cookies, use secure defaults
    const secureOptions = {
      ...options,
      httpOnly: options.httpOnly !== false, // Default to true
      secure: process.env.ENVIRONMENT !== 'development', // HTTPS only in production
      sameSite: options.sameSite || 'strict', // CSRF protection
      maxAge: options.maxAge || 24 * 60 * 60 * 1000 // 24 hours default
    };

    return originalCookie.call(this, name, value, secureOptions);
  };

  next();
}

// API security headers for JSON responses
export function apiSecurityHeaders(req, res, next) {
  // Prevent caching of sensitive API responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  next();
}

// Request size limiting middleware
export function requestSizeLimiter(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0');

  // Define routes that need higher size limits for file uploads
  const highLimitRoutes = [
    '/api/svg-slides/', // SVG slide uploads
    '/api/assets/', // Asset uploads
    '/api/v2/assets/', // Unified asset uploads
    '/api/media/', // Media uploads
    '/api/videos/' // Video uploads
  ];

  // Check if this request is for a high-limit route
  const isHighLimitRoute = highLimitRoutes.some(route => req.path.startsWith(route));

  // Set appropriate size limits
  const maxSize = isHighLimitRoute
    ? 100 * 1024 * 1024 // 100MB for file uploads
    : process.env.MAX_REQUEST_SIZE || 50 * 1024 * 1024; // 50MB for regular requests

  if (contentLength > maxSize) {
    return res.status(413).json({
      error: {
        message: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: `${maxSize / 1024 / 1024}MB`,
        route: req.path,
        isHighLimitRoute
      }
    });
  }

  next();
}

// Timing attack protection
export function timingAttackProtection() {
  return (req, res, next) => {
    // Add random delay to response to prevent timing attacks
    const delay = Math.random() * 100; // 0-100ms random delay

    const originalEnd = res.end;
    res.end = function(...args) {
      setTimeout(() => {
        originalEnd.apply(this, args);
      }, delay);
    };

    next();
  };
}

// Security audit logging
export function securityAuditLogger(req, res, next) {
  const securityEvents = [];

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /exec\s*\(/i, // Code injection
    /eval\s*\(/i, // Code injection
  ];

  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || '';
  const body = req.body ? JSON.stringify(req.body) : '';

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(userAgent) || pattern.test(body)) {
      securityEvents.push({
        type: 'suspicious_pattern',
        pattern: pattern.toString(),
        url,
        userAgent,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Log security events
  if (securityEvents.length > 0) {
    console.warn('🚨 SECURITY ALERT:', JSON.stringify(securityEvents, null, 2));

    // In production, send to security monitoring service
    if (process.env.ENVIRONMENT === 'production') {
      // TODO: Send to security monitoring service
    }
  }

  next();
}

// Rate limiting bypass detection
export function rateLimitBypassDetection(req, res, next) {
  const { headers } = req;
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-originating-ip',
    'x-cluster-client-ip',
    'cf-connecting-ip'
  ];

  // Check for attempts to manipulate IP headers
  let ipSources = 0;
  for (const header of suspiciousHeaders) {
    if (headers[header]) {
      ipSources++;
    }
  }

  if (ipSources > 2) {
    console.warn('🚨 Potential rate limit bypass attempt detected:', {
      ip: req.ip,
      headers: suspiciousHeaders.reduce((acc, header) => {
        if (headers[header]) acc[header] = headers[header];
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    });
  }

  next();
}

export default {
  enforceHTTPS,
  securityHeaders,
  secureCookies,
  apiSecurityHeaders,
  requestSizeLimiter,
  timingAttackProtection,
  securityAuditLogger,
  rateLimitBypassDetection
};