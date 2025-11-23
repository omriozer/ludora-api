/**
 * Simplified HTTP Caching Middleware
 *
 * Provides consistent HTTP cache headers for different content types
 * without time-zone dependent variations.
 *
 * Features:
 * - Consistent cache durations for all users
 * - Content-type specific cache policies
 * - Mobile-first caching strategy
 * - Browser storage optimization
 */

// Cache durations for different content types (in seconds)
const SIMPLE_CACHE_DURATIONS = {
  // Static assets (images, icons) - cache aggressively
  STATIC_ASSETS: 7 * 24 * 60 * 60, // 1 week (consistent)

  // Marketing videos (public) - cache aggressively
  MARKETING_VIDEOS: 3 * 24 * 60 * 60, // 3 days (consistent)

  // Audio files (private) - moderate caching
  AUDIO_FILES: 12 * 60 * 60, // 12 hours (consistent)

  // Documents (PDFs, files) - moderate caching
  DOCUMENTS: 24 * 60 * 60, // 24 hours (consistent)

  // API responses (dynamic) - short caching
  API_RESPONSES: 15 * 60, // 15 minutes (consistent)

  // User-specific data - very short caching
  USER_DATA: 5 * 60, // 5 minutes (consistent)

  // Public metadata - moderate caching
  METADATA: 2 * 60 * 60, // 2 hours (consistent)
};

/**
 * Generate cache headers for HTTP responses
 *
 * @param {string} contentType - Type of content being cached
 * @param {Object} options - Caching options
 * @returns {Object} Cache headers
 */
export function generateIsraeliCacheHeaders(contentType, options = {}) {
  let baseDuration;
  let cacheType = 'public';

  // Determine cache duration based on content type
  switch (contentType) {
    case 'static':
      baseDuration = SIMPLE_CACHE_DURATIONS.STATIC_ASSETS;
      break;
    case 'marketing-video':
      baseDuration = SIMPLE_CACHE_DURATIONS.MARKETING_VIDEOS;
      break;
    case 'audio':
      baseDuration = SIMPLE_CACHE_DURATIONS.AUDIO_FILES;
      cacheType = 'private';
      break;
    case 'document':
      baseDuration = SIMPLE_CACHE_DURATIONS.DOCUMENTS;
      cacheType = 'private';
      break;
    case 'api':
      baseDuration = SIMPLE_CACHE_DURATIONS.API_RESPONSES;
      break;
    case 'metadata':
      baseDuration = SIMPLE_CACHE_DURATIONS.METADATA;
      break;
    case 'user-data':
      baseDuration = SIMPLE_CACHE_DURATIONS.USER_DATA;
      cacheType = 'private';
      break;
    default:
      baseDuration = 60; // 1 minute default
      break;
  }

  // Use consistent duration (no time-zone adjustments)
  const cacheDuration = baseDuration;

  // Generate cache headers
  const headers = {
    'Cache-Control': `${cacheType}, max-age=${cacheDuration}`,
    'Expires': new Date(Date.now() + cacheDuration * 1000).toUTCString(),
  };

  // Add optimization directives for specific content types
  if (contentType === 'static' || contentType === 'marketing-video') {
    // For public content, add immutable directive for better browser caching
    headers['Cache-Control'] += ', immutable';
  }

  if (contentType === 'audio' || contentType === 'document') {
    // For private content, allow stale-while-revalidate for better UX
    headers['Cache-Control'] += ', stale-while-revalidate=3600';
  }

  // Add ETag for better cache validation
  if (options.etag) {
    headers['ETag'] = options.etag;
  }

  // Add Last-Modified for better cache validation
  if (options.lastModified) {
    headers['Last-Modified'] = options.lastModified;
  }

  return headers;
}

/**
 * Express middleware for HTTP caching
 *
 * @param {string} contentType - Type of content
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
export function israeliCacheMiddleware(contentType, options = {}) {
  return (req, res, next) => {
    // Skip caching for development
    if (process.env.ENVIRONMENT === 'development' && !options.forceDev) {
      return next();
    }

    // Generate cache headers
    const cacheHeaders = generateIsraeliCacheHeaders(contentType, {
      etag: options.etag,
      lastModified: options.lastModified,
      skipTimeOptimization: options.skipTimeOptimization
    });

    // Apply headers
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      res.set(key, value);
    });

    // Check for conditional requests (304 Not Modified)
    if (options.etag && req.headers['if-none-match'] === options.etag) {
      return res.status(304).end();
    }

    if (options.lastModified && req.headers['if-modified-since']) {
      const ifModifiedSince = new Date(req.headers['if-modified-since']);
      const lastModified = new Date(options.lastModified);

      if (ifModifiedSince >= lastModified) {
        return res.status(304).end();
      }
    }

    next();
  };
}

/**
 * Hebrew content optimization middleware
 * Adds headers optimized for Hebrew content and mobile usage patterns
 */
export function hebrewContentCacheMiddleware() {
  return (req, res, next) => {
    // Detect Hebrew content or RTL layouts
    const acceptLanguage = req.headers['accept-language'] || '';
    const isHebrewUser = acceptLanguage.includes('he') || acceptLanguage.includes('iw');

    // Detect mobile devices
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);

    if (isHebrewUser || isMobile) {
      // Optimize for Hebrew/RTL and mobile usage
      res.set({
        'X-Hebrew-Optimized': isHebrewUser ? 'true' : 'false',
        'X-Mobile-Optimized': isMobile ? 'true' : 'false',
        // Add service worker hints for better caching
        'Service-Worker-Allowed': '/',
        // Optimize for mobile data saving
        'Accept-CH': 'Save-Data, RTT, Downlink'
      });

      // Add preload hints for Hebrew fonts if needed
      if (isHebrewUser) {
        res.set('Link', '</fonts/hebrew-font.woff2>; rel=preload; as=font; type=font/woff2; crossorigin');
      }
    }

    next();
  };
}

/**
 * Apply cache headers to existing response
 * Utility function for routes that need dynamic cache header application
 */
export function applyIsraeliCaching(res, contentType, options = {}) {
  const headers = generateIsraeliCacheHeaders(contentType, options);
  Object.entries(headers).forEach(([key, value]) => {
    res.set(key, value);
  });
}

export default {
  generateIsraeliCacheHeaders,
  israeliCacheMiddleware,
  hebrewContentCacheMiddleware,
  applyIsraeliCaching,
  ISRAEL_CACHE_DURATIONS: SIMPLE_CACHE_DURATIONS // Export with original name for compatibility
};