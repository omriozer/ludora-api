/**
 * Israeli-Optimized Caching Middleware
 *
 * Since all users are from Israel, we can implement aggressive caching policies
 * optimized for single-geography usage without CDN complexity.
 *
 * Features:
 * - Extended cache times for Israeli users
 * - Optimized for Hebrew content
 * - Time-zone aware cache expiration
 * - Mobile-first caching strategy
 * - Browser storage optimization
 */

import moment from 'moment-timezone';

// Cache durations optimized for Israeli users (in seconds)
const ISRAEL_CACHE_DURATIONS = {
  // Static assets (images, icons) - cache very aggressively
  STATIC_ASSETS: 7 * 24 * 60 * 60, // 1 week

  // Marketing videos (public) - cache aggressively
  MARKETING_VIDEOS: 3 * 24 * 60 * 60, // 3 days

  // Audio files (private) - moderate caching
  AUDIO_FILES: 12 * 60 * 60, // 12 hours

  // Documents (PDFs, files) - moderate caching
  DOCUMENTS: 24 * 60 * 60, // 24 hours

  // API responses (dynamic) - short caching
  API_RESPONSES: 15 * 60, // 15 minutes

  // User-specific data - very short caching
  USER_DATA: 5 * 60, // 5 minutes

  // Public metadata - moderate caching
  METADATA: 2 * 60 * 60, // 2 hours
};

// Israeli working hours for cache optimization
const ISRAEL_PEAK_HOURS = {
  start: 8, // 8 AM Israel time
  end: 18   // 6 PM Israel time
};

/**
 * Get Israeli time-aware cache duration
 * Shorter cache during peak hours, longer during off-hours
 *
 * @param {number} baseDuration - Base cache duration in seconds
 * @returns {number} Optimized cache duration
 */
function getIsraeliOptimizedDuration(baseDuration) {
  const israelTime = moment().tz('Asia/Jerusalem');
  const currentHour = israelTime.hour();

  // During Israeli peak hours (8 AM - 6 PM), use shorter cache to ensure fresh content
  const isPeakHours = currentHour >= ISRAEL_PEAK_HOURS.start && currentHour <= ISRAEL_PEAK_HOURS.end;

  if (isPeakHours) {
    // Reduce cache by 25% during peak hours
    return Math.floor(baseDuration * 0.75);
  } else {
    // Increase cache by 50% during off-hours
    return Math.floor(baseDuration * 1.5);
  }
}

/**
 * Generate Israeli-optimized cache headers
 *
 * @param {string} contentType - Type of content being cached
 * @param {Object} options - Caching options
 * @returns {Object} Optimized cache headers
 */
export function generateIsraeliCacheHeaders(contentType, options = {}) {
  let baseDuration;
  let cacheType = 'public';

  // Determine base cache duration based on content type
  switch (contentType) {
    case 'static':
      baseDuration = ISRAEL_CACHE_DURATIONS.STATIC_ASSETS;
      break;
    case 'marketing-video':
      baseDuration = ISRAEL_CACHE_DURATIONS.MARKETING_VIDEOS;
      break;
    case 'audio':
      baseDuration = ISRAEL_CACHE_DURATIONS.AUDIO_FILES;
      cacheType = 'private';
      break;
    case 'document':
      baseDuration = ISRAEL_CACHE_DURATIONS.DOCUMENTS;
      cacheType = 'private';
      break;
    case 'api':
      baseDuration = ISRAEL_CACHE_DURATIONS.API_RESPONSES;
      break;
    case 'metadata':
      baseDuration = ISRAEL_CACHE_DURATIONS.METADATA;
      break;
    case 'user-data':
      baseDuration = ISRAEL_CACHE_DURATIONS.USER_DATA;
      cacheType = 'private';
      break;
    default:
      baseDuration = 60; // 1 minute default
      break;
  }

  // Apply Israeli time optimization
  const optimizedDuration = options.skipTimeOptimization
    ? baseDuration
    : getIsraeliOptimizedDuration(baseDuration);

  // Generate cache headers optimized for Israeli users
  const headers = {
    'Cache-Control': `${cacheType}, max-age=${optimizedDuration}`,
    'Expires': new Date(Date.now() + optimizedDuration * 1000).toUTCString(),
  };

  // Add Israeli-specific optimizations
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

  // Add Israeli timezone information for debugging
  headers['X-Israel-Time'] = moment().tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss z');
  headers['X-Cache-Optimized'] = 'israel';

  return headers;
}

/**
 * Express middleware for Israeli-optimized caching
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

    // Generate optimized headers
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
 * Israeli-specific browser cache optimization middleware
 * Adds headers optimized for Hebrew content and mobile usage patterns
 */
export function hebrewContentCacheMiddleware() {
  return (req, res, next) => {
    // Detect Hebrew content or RTL layouts
    const acceptLanguage = req.headers['accept-language'] || '';
    const isHebrewUser = acceptLanguage.includes('he') || acceptLanguage.includes('iw');

    // Detect mobile devices (Israeli mobile usage is very high)
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
 * Apply Israeli cache headers to existing response
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
  ISRAEL_CACHE_DURATIONS
};