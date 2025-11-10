/**
 * Smart Response Processor Middleware
 *
 * Unified response processing system that combines all response-related middleware
 * into a single smart processor with conditional processing and optimization.
 *
 * Replaces 4 separate middlewares:
 * - dynamicCors (CORS configuration)
 * - israeliCompressionMiddleware (Israeli-optimized compression)
 * - hebrewContentCompressionMiddleware (Hebrew text compression)
 * - express.json/urlencoded (body parsers)
 */

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import moment from 'moment-timezone';

// Smart caching for optimization
const hebrewContentCache = new Map();
const compressionCache = new Map();
const corsCache = new Map();

// Configuration constants
const COMPRESSION_CONFIG = {
  hebrew: {
    level: 8, // Maximum compression for Hebrew text
    threshold: 512, // Compress files > 512 bytes
    filter: (req, res) => isHebrewContent(req, res)
  },
  standard: {
    level: 6, // Standard compression
    threshold: 1024,
    filter: (req, res) => shouldCompress(req, res)
  }
};

const CORS_CONFIG = {
  origin: function(origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://ludora.app',
      'https://www.ludora.app',
      'https://ludora-af706.web.app',
      'https://ludora-staging.web.app',
      'https://staging.ludora.app'
    ];

    // Allow same-origin requests
    if (!origin) return callback(null, true);

    // Check cache first
    const cacheKey = `cors-${origin}`;
    if (corsCache.has(cacheKey)) {
      return callback(null, corsCache.get(cacheKey));
    }

    const isAllowed = allowedOrigins.includes(origin) ||
                     (process.env.NODE_ENV === 'development' && origin.includes('localhost'));

    // Cache result for 5 minutes
    setTimeout(() => corsCache.delete(cacheKey), 300000);
    corsCache.set(cacheKey, isAllowed);

    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Request-ID',
    'X-Israeli-Context',
    'Accept-Language',
    'Content-Language'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Israeli-Time',
    'X-Hebrew-Support',
    'X-RTL-Formatted',
    'X-Compression-Type',
    'X-Cache-Status'
  ]
};

/**
 * Smart Response Processor Main Middleware
 * Replaces 4 separate response processing middlewares
 */
export function smartResponseProcessor() {
  // Pre-initialize compression and CORS middleware
  const hebrewCompression = compression(COMPRESSION_CONFIG.hebrew);
  const standardCompression = compression(COMPRESSION_CONFIG.standard);
  const corsMiddleware = cors(CORS_CONFIG);

  return (req, res, next) => {
    const startTime = Date.now();

    try {
      // Analyze request context for smart processing
      const context = analyzeRequestContext(req);

      // Apply CORS (always needed)
      applyCors(req, res, context, corsMiddleware);

      // Apply body parsing (conditional)
      applyBodyParsing(req, res, context);

      // Apply compression (conditional)
      applySmartCompression(req, res, context, hebrewCompression, standardCompression);

      // Add response headers for debugging
      addProcessingHeaders(req, res, context, startTime);

    } catch (error) {
      console.error('Smart Response Processor error:', error);
      // Don't block request on processing errors
    }

    next();
  };
}

/**
 * Analyze request context for smart processing decisions
 */
function analyzeRequestContext(req) {
  const israelTime = moment().tz('Asia/Jerusalem');

  return {
    // Hebrew content indicators
    hasHebrewLanguage: req.headers['accept-language']?.includes('he') ||
                       req.headers['content-language'] === 'he',
    hebrewInPath: req.path.includes('hebrew') || req.path.includes('he'),
    hebrewInQuery: req.query.locale === 'he' || req.query.lang === 'he',

    // Israeli context indicators
    israeliUser: req.user?.location === 'Israel',
    israeliContext: req.headers['x-israeli-context'] === 'true',
    educationalContent: isEducationalPath(req.path),

    // Performance context
    isPeakHours: isIsraeliPeakHours(israelTime.hour()),
    isSchoolHours: isIsraeliSchoolHours(israelTime),

    // Request characteristics
    isLargePayload: parseInt(req.headers['content-length']) > 1000000, // > 1MB
    expectsJson: req.headers.accept?.includes('application/json'),
    methodNeedsBodyParsing: ['POST', 'PUT', 'PATCH'].includes(req.method),

    // Optimization flags
    needsHebrewOptimization: false, // Will be calculated
    needsHighCompression: false,    // Will be calculated
    needsSpecialCors: false,        // Will be calculated

    // Timestamps
    israelTime: israelTime.toISOString(),
    timestamp: Date.now()
  };
}

/**
 * Apply CORS with smart caching
 */
function applyCors(req, res, context, corsMiddleware) {
  // Check if special CORS handling is needed
  context.needsSpecialCors = context.educationalContent ||
                            context.hasHebrewLanguage ||
                            context.israeliContext;

  if (context.needsSpecialCors) {
    // Add Israeli-specific CORS headers
    if (!res.headersSent) {
      res.header('X-Israeli-Context', 'enabled');
      res.header('X-Hebrew-Support', context.hasHebrewLanguage ? 'enabled' : 'disabled');
      res.header('X-Educational-Content', context.educationalContent ? 'true' : 'false');
    }
  }

  // Apply standard CORS
  corsMiddleware(req, res, () => {
    // CORS applied, continue processing
  });
}

/**
 * Apply body parsing conditionally
 */
function applyBodyParsing(req, res, context) {
  // Only parse body if method requires it
  if (!context.methodNeedsBodyParsing) {
    return;
  }

  // Configure parsers based on context
  const jsonLimit = context.isLargePayload ? '100mb' : '50mb';
  const urlencodedLimit = context.isLargePayload ? '100mb' : '10mb';

  // Apply JSON parser
  if (context.expectsJson || req.headers['content-type']?.includes('json')) {
    const jsonParser = express.json({
      limit: jsonLimit,
      verify: (req, res, buf) => {
        // Track Hebrew content in body
        if (context.hasHebrewLanguage) {
          context.hebrewInBody = hasHebrewContent(buf.toString());
        }
      }
    });

    jsonParser(req, res, () => {
      // JSON parsing complete
    });
  }

  // Apply URL-encoded parser
  const urlencodedParser = express.urlencoded({
    extended: true,
    limit: urlencodedLimit,
    verify: (req, res, buf) => {
      // Track form data size
      context.formDataSize = buf.length;
    }
  });

  urlencodedParser(req, res, () => {
    // URL-encoded parsing complete
  });
}

/**
 * Apply smart compression based on content analysis
 */
function applySmartCompression(req, res, context, hebrewCompression, standardCompression) {
  // Determine if Hebrew optimization is needed
  context.needsHebrewOptimization = context.hasHebrewLanguage ||
                                   context.hebrewInPath ||
                                   context.hebrewInQuery ||
                                   context.hebrewInBody;

  // Determine if high compression is needed
  context.needsHighCompression = context.isPeakHours ||
                                context.isLargePayload ||
                                context.needsHebrewOptimization;

  // Override response methods to detect Hebrew content in response
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  // Single response override for all compression logic
  res.json = function(obj) {
    if (obj && typeof obj === 'object') {
      const content = JSON.stringify(obj);
      context.responseHasHebrew = hasHebrewContent(content);

      // Apply compression headers
      applyCompressionHeaders(this, context);

      // Use Hebrew compression if needed
      if (context.responseHasHebrew || context.needsHebrewOptimization) {
        hebrewCompression(req, this, () => {
          originalJson.call(this, obj);
        });
      } else {
        standardCompression(req, this, () => {
          originalJson.call(this, obj);
        });
      }
    } else {
      originalJson.call(this, obj);
    }
  };

  res.send = function(body) {
    if (typeof body === 'string') {
      context.responseHasHebrew = hasHebrewContent(body);

      // Apply compression headers
      applyCompressionHeaders(this, context);

      // Use appropriate compression
      if (context.responseHasHebrew || context.needsHebrewOptimization) {
        hebrewCompression(req, this, () => {
          originalSend.call(this, body);
        });
      } else {
        standardCompression(req, this, () => {
          originalSend.call(this, body);
        });
      }
    } else {
      originalSend.call(this, body);
    }
  };
}

/**
 * Apply compression headers based on context
 */
function applyCompressionHeaders(res, context) {
  if (!res.headersSent) {
    if (context.responseHasHebrew || context.needsHebrewOptimization) {
      res.header('X-Compression-Type', 'hebrew-optimized');
      res.header('X-RTL-Formatted', 'true');
    } else {
      res.header('X-Compression-Type', 'standard');
    }

    if (context.needsHighCompression) {
      res.header('X-Compression-Level', 'high');
    }
  }
}

/**
 * Add processing headers for debugging and monitoring
 */
function addProcessingHeaders(req, res, context, startTime) {
  if (process.env.NODE_ENV === 'development' && !res.headersSent) {
    res.header('X-Smart-Processor', 'enabled');
    res.header('X-Processing-Time', Date.now() - startTime);
    res.header('X-Hebrew-Detected', context.needsHebrewOptimization ? 'true' : 'false');
    res.header('X-Peak-Hours', context.isPeakHours ? 'true' : 'false');
    res.header('X-Israeli-Time', context.israelTime);
  }
}

/**
 * Check if Hebrew content is present (with caching)
 */
function hasHebrewContent(text) {
  if (!text || typeof text !== 'string') return false;

  // Use first 200 characters for cache key
  const cacheKey = text.substring(0, 200);

  if (hebrewContentCache.has(cacheKey)) {
    return hebrewContentCache.get(cacheKey);
  }

  // Hebrew Unicode range: U+0590 to U+05FF
  const hasHebrew = /[\u0590-\u05FF]/.test(text);

  // Cache for 10 minutes
  setTimeout(() => hebrewContentCache.delete(cacheKey), 600000);
  hebrewContentCache.set(cacheKey, hasHebrew);

  return hasHebrew;
}

/**
 * Check if path is educational content
 */
function isEducationalPath(path) {
  const educationalPaths = [
    '/api/entities/',
    '/api/products/',
    '/api/games/',
    '/api/tools/',
    '/api/dashboard/',
    '/api/workshops/',
    '/api/courses/'
  ];
  return educationalPaths.some(edPath => path?.includes(edPath));
}

/**
 * Israeli time context helpers
 */
function isIsraeliPeakHours(hour) {
  return (hour >= 7 && hour <= 9) ||    // Morning rush
         (hour >= 12 && hour <= 14) ||  // Lunch break
         (hour >= 16 && hour <= 18) ||  // After school
         (hour >= 19 && hour <= 22);    // Evening study
}

function isIsraeliSchoolHours(israelTime) {
  const hour = israelTime.hour();
  const day = israelTime.day();
  return (day >= 0 && day <= 4) && (hour >= 8 && hour <= 16);
}

/**
 * Determine if response should be compressed
 */
function shouldCompress(req, res) {
  // Don't compress if already compressed
  if (res.getHeader('content-encoding')) return false;

  // Don't compress images, videos, audio
  const contentType = res.getHeader('content-type') || '';
  if (contentType.match(/^(image|video|audio)\//)) return false;

  // Don't compress already small responses
  const contentLength = parseInt(res.getHeader('content-length')) || 0;
  if (contentLength < 1024) return false; // < 1KB

  return true;
}

/**
 * Enhanced Hebrew content detection for responses
 */
function isHebrewContent(req, res) {
  // Check request indicators
  if (req.headers['accept-language']?.includes('he')) return true;
  if (req.headers['content-language'] === 'he') return true;
  if (req.path.includes('hebrew')) return true;

  // Check response content type
  const contentType = res.getHeader('content-type') || '';
  if (contentType.includes('charset=utf-8') && req.headers['x-hebrew-content']) return true;

  return false;
}

/**
 * Smart Response Dashboard for monitoring
 */
export function smartResponseDashboard() {
  return (req, res, next) => {
    if (!req.user?.role === 'admin') {
      return next();
    }

    if (req.path === '/api/admin/response-processor/stats') {
      try {
        const stats = {
          cacheStats: {
            hebrewContentCache: hebrewContentCache.size,
            compressionCache: compressionCache.size,
            corsCache: corsCache.size
          },
          processingStats: {
            hebrewOptimizedRequests: 0, // Would track in production
            standardCompressionRequests: 0,
            corsRequestsProcessed: 0,
            bodyParsingRequests: 0
          },
          performance: {
            avgProcessingTime: 0, // Would calculate from metrics
            cacheHitRate: 0,
            compressionRatio: 0
          },
          israeliContext: {
            israelTime: moment().tz('Asia/Jerusalem').format('DD/MM/YYYY HH:mm:ss'),
            isPeakHours: isIsraeliPeakHours(moment().tz('Asia/Jerusalem').hour()),
            isSchoolHours: isIsraeliSchoolHours(moment().tz('Asia/Jerusalem'))
          }
        };

        return res.json({
          success: true,
          data: stats,
          timestamp: moment().tz('Asia/Jerusalem').toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Smart Response Processor Stats Error',
          message: error.message
        });
      }
    }

    next();
  };
}

/**
 * Cleanup function
 */
export function cleanupSmartResponseProcessor() {
  console.log('🔧 Shutting down Smart Response Processor...');

  // Clear all caches
  hebrewContentCache.clear();
  compressionCache.clear();
  corsCache.clear();

  console.log('✅ Smart Response Processor cleanup complete');
}

/**
 * Cache management - periodic cleanup
 */
setInterval(() => {
  const now = Date.now();

  // Log cache sizes for monitoring
  console.log(`📊 Smart Response Processor cache sizes: Hebrew=${hebrewContentCache.size}, Compression=${compressionCache.size}, CORS=${corsCache.size}`);

  // Implement additional cache cleanup if needed
  // (Individual TTL cleanup is handled in the functions)
}, 300000); // Every 5 minutes

export default {
  smartResponseProcessor,
  smartResponseDashboard,
  cleanupSmartResponseProcessor,
  hasHebrewContent, // Export for testing
  isEducationalPath, // Export for testing
  isIsraeliPeakHours, // Export for testing
  analyzeRequestContext // Export for testing
};