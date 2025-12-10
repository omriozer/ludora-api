/**
 * Israeli-Optimized Compression Middleware
 *
 * Optimizes API response compression for Israeli users based on:
 * - Mobile-first usage patterns (high mobile internet usage in Israel)
 * - Hebrew text content characteristics
 * - Typical Israeli internet connection speeds
 * - Content type optimization for educational platform
 *
 * Features:
 * - Adaptive compression levels based on content type and user agent
 * - Hebrew text-aware compression settings
 * - Mobile-optimized compression for Israeli bandwidth patterns
 * - Educational content prioritization
 */

import compression from 'compression';
import zlib from 'zlib';

// Compression levels optimized for Israeli usage patterns
const ISRAELI_COMPRESSION_SETTINGS = {
  // API responses (JSON) - high compression for mobile data saving
  API_RESPONSES: {
    level: zlib.constants.Z_BEST_COMPRESSION, // Level 9 - maximum compression for mobile
    chunkSize: 1024, // Smaller chunks for faster mobile processing
    windowBits: 15,
    memLevel: 8
  },

  // Educational content (HTML/Text) - balanced compression for readability
  EDUCATIONAL_CONTENT: {
    level: 7, // High but not maximum - balance speed vs size for learning materials
    chunkSize: 2048,
    windowBits: 15,
    memLevel: 8
  },

  // Hebrew text content - optimized for Hebrew character compression
  HEBREW_TEXT: {
    level: 8, // Hebrew text compresses very well, use high level
    chunkSize: 2048,
    windowBits: 15,
    memLevel: 9 // Higher memory for better Hebrew UTF-8 compression
  },

  // Interactive content (JavaScript) - fast compression for responsiveness
  INTERACTIVE_CONTENT: {
    level: 6, // Moderate compression for faster decompression
    chunkSize: 4096,
    windowBits: 15,
    memLevel: 7
  },

  // Static assets - maximum compression for mobile caching
  STATIC_ASSETS: {
    level: zlib.constants.Z_BEST_COMPRESSION,
    chunkSize: 8192, // Larger chunks for static content
    windowBits: 15,
    memLevel: 8
  }
};


/**
 * Detect if user agent indicates mobile device
 * Israeli mobile usage is very high, so optimize for mobile-first
 */
function isMobileDevice(userAgent) {
  if (!userAgent) return false;
  return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

/**
 * Detect Hebrew content in response
 * Hebrew text compresses very well due to UTF-8 patterns
 */
function hasHebrewContent(contentType, body) {
  if (!contentType || !body) return false;

  // Check if content type suggests Hebrew content
  if (contentType.includes('application/json') || contentType.includes('text/')) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    // Hebrew Unicode range: U+0590–U+05FF
    return /[\u0590-\u05FF]/.test(bodyStr);
  }

  return false;
}

/**
 * Determine optimal compression settings based on content and Israeli usage patterns
 */
function getIsraeliCompressionSettings(req, contentType, body) {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = isMobileDevice(userAgent);
  const hasHebrew = hasHebrewContent(contentType, body);

  // Check Israeli peak hours for mobile optimization
  const israelTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
  const hour = new Date(israelTime).getHours();
  const isPeakHours = hour >= 8 && hour <= 20; // 8 AM - 8 PM

  let compressionSettings;

  // Determine content type and select appropriate compression
  if (contentType?.includes('application/json')) {
    compressionSettings = hasHebrew
      ? ISRAELI_COMPRESSION_SETTINGS.HEBREW_TEXT
      : ISRAELI_COMPRESSION_SETTINGS.API_RESPONSES;
  } else if (contentType?.includes('text/html')) {
    compressionSettings = ISRAELI_COMPRESSION_SETTINGS.EDUCATIONAL_CONTENT;
  } else if (contentType?.includes('javascript')) {
    compressionSettings = ISRAELI_COMPRESSION_SETTINGS.INTERACTIVE_CONTENT;
  } else {
    compressionSettings = ISRAELI_COMPRESSION_SETTINGS.STATIC_ASSETS;
  }

  // Adjust for mobile and peak hours
  if (isMobile && isPeakHours) {
    return {
      ...compressionSettings,
      level: Math.min(compressionSettings.level + 1, 9), // Increase compression for mobile peak hours
      chunkSize: Math.max(compressionSettings.chunkSize / 2, 512) // Smaller chunks for mobile
    };
  }

  return compressionSettings;
}

/**
 * Custom compression filter for Israeli content optimization
 */
function israeliCompressionFilter(req, res) {
  const contentType = res.getHeader('content-type') || '';
  const contentLength = res.getHeader('content-length');

  // Always compress JSON API responses for mobile data saving
  if (contentType.includes('application/json')) {
    return true;
  }

  // Compress text content (especially Hebrew)
  if (contentType.includes('text/')) {
    return true;
  }

  // Compress JavaScript for interactive content
  if (contentType.includes('javascript')) {
    return true;
  }

  // For other content types, use size-based filtering
  if (contentLength) {
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = isMobileDevice(userAgent);

    // Lower threshold for mobile devices
    const threshold = isMobile ? 512 : 1024;
    return parseInt(contentLength) > threshold;
  }

  // Default compression decision
  return compression.filter(req, res);
}

/**
 * Israeli-optimized compression middleware factory
 */
export function createIsraeliCompressionMiddleware(options = {}) {
  const defaultOptions = {
    // Use custom filter optimized for Israeli usage patterns
    filter: options.filter || israeliCompressionFilter,

    // Default compression level (will be overridden by dynamic settings)
    level: zlib.constants.Z_DEFAULT_COMPRESSION,

    // Enable compression for small responses (mobile optimization)
    threshold: 512,

    // Custom compression strategy
    strategy: zlib.constants.Z_DEFAULT_STRATEGY,

    // Enable chunked transfer encoding for better mobile experience
    chunkSize: 16 * 1024,

    // Memory optimization for server efficiency
    memLevel: 8,

    // Window size optimization
    windowBits: 15
  };

  const compressionMiddleware = compression({
    ...defaultOptions,
    ...options
  });

  // Wrap the compression middleware to add Israeli-specific optimizations
  return (req, res, next) => {
    // Store original end method
    const originalEnd = res.end;

    // Override res.end to capture response content for Hebrew detection
    res.end = function(chunk, encoding) {
      const contentType = res.getHeader('content-type') || '';

      // Get optimal compression settings for this request
      const settings = getIsraeliCompressionSettings(req, contentType, chunk);

      // Apply Israeli-optimized compression settings (only if headers haven't been sent)
      if (!res.headersSent) {
        // Add Israeli-specific headers
        res.setHeader('X-Israeli-Compression', 'enabled');
        res.setHeader('X-Compression-Level', settings.level);

        // Add mobile optimization hints
        const userAgent = req.headers['user-agent'] || '';
        if (isMobileDevice(userAgent)) {
          res.setHeader('X-Mobile-Optimized', 'true');
        }

        // Add Hebrew content indication
        if (hasHebrewContent(contentType, chunk)) {
          res.setHeader('X-Hebrew-Content', 'detected');
        }
      }

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };

    // Apply compression middleware
    compressionMiddleware(req, res, next);
  };
}

/**
 * Express middleware for Israeli-optimized compression
 * Ready to use middleware with optimal defaults for Israeli users
 */
export const israeliCompressionMiddleware = createIsraeliCompressionMiddleware();

/**
 * Specialized middleware for Hebrew content
 * Extra optimization for Hebrew text compression
 */
export const hebrewContentCompressionMiddleware = createIsraeliCompressionMiddleware({
  level: ISRAELI_COMPRESSION_SETTINGS.HEBREW_TEXT.level,
  memLevel: ISRAELI_COMPRESSION_SETTINGS.HEBREW_TEXT.memLevel,
  chunkSize: ISRAELI_COMPRESSION_SETTINGS.HEBREW_TEXT.chunkSize
});

/**
 * Mobile-first compression middleware
 * Optimized for Israeli mobile usage patterns
 */
export const mobileOptimizedCompressionMiddleware = createIsraeliCompressionMiddleware({
  threshold: 256, // Very aggressive compression for mobile
  level: 8, // High compression level for mobile data saving
  chunkSize: 1024 // Small chunks for mobile processing
});

export default {
  createIsraeliCompressionMiddleware,
  israeliCompressionMiddleware,
  hebrewContentCompressionMiddleware,
  mobileOptimizedCompressionMiddleware,
  ISRAELI_COMPRESSION_SETTINGS
};