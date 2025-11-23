/**
 * Cookie configuration utility for cross-subdomain authentication
 * Handles proper domain and sameSite settings for teacher/student portals
 */

/**
 * Get the appropriate cookie domain based on environment
 * @returns {string|undefined} Cookie domain or undefined for development
 */
export function getCookieDomain() {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';


  switch (environment) {
    case 'production':
      return '.ludora.app'; // Allows sharing between ludora.app and my.ludora.app
    case 'staging':
      return '.ludora.app'; // Allows sharing between staging subdomains
    case 'development':
    default:
      // CRITICAL FIX: Use .localhost domain for cross-subdomain cookie sharing
      // This enables cookies to be shared between localhost:3003 and my.localhost:5173
      return '.localhost';
  }
}

/**
 * Get the appropriate sameSite setting based on environment
 * @returns {string} sameSite setting
 */
export function getSameSitePolicy() {
  const environment = process.env.ENVIRONMENT || 'development';

  switch (environment) {
    case 'production':
    case 'staging':
      // 'lax' allows same-site subdomain access while maintaining CSRF protection
      return 'lax';
    case 'development':
    default:
      // 'lax' for development to allow subdomain testing
      return 'lax';
  }
}

/**
 * Get secure cookie setting based on environment
 * @returns {boolean} Whether to use secure cookies
 */
export function getSecureSetting() {
  return process.env.ENVIRONMENT !== 'development';
}

/**
 * Create standardized cookie configuration for authentication tokens
 * @param {Object} options - Additional cookie options
 * @returns {Object} Complete cookie configuration
 */
export function createAuthCookieConfig(options = {}) {
  const domain = getCookieDomain();

  const config = {
    httpOnly: true,
    secure: getSecureSetting(),
    sameSite: getSameSitePolicy(),
    ...options
  };

  // Only set domain if we have one (undefined in development for proxy compatibility)
  if (domain) {
    config.domain = domain;
  }

  return config;
}


/**
 * Log cookie configuration for debugging
 * @param {string} action - Action being performed
 * @param {Object} config - Cookie configuration being used
 */
export function logCookieConfig(action, config) {
  if (process.env.ENVIRONMENT === 'development') {
    console.log(`🍪 Cookie Config [${action}]:`, {
      domain: config.domain || 'not set (localhost)',
      sameSite: config.sameSite,
      secure: config.secure,
      httpOnly: config.httpOnly,
      maxAge: config.maxAge ? `${config.maxAge / 1000}s` : 'not set'
    });
  }
}

/**
 * Detect portal from request (host, origin, or referer headers)
 * @param {Object} req - Express request object
 * @returns {string} Portal type: 'teacher' or 'student'
 */
export function detectPortal(req) {
  // Check various headers to determine portal
  const host = req.get('host') || '';
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';

  // Student portal indicators
  const studentIndicators = [
    host.includes('my.ludora.app'),
    origin.includes('my.ludora.app'),
    referer.includes('my.ludora.app'),
    host.includes('localhost:5173'), // Student portal dev port (corrected from 5174)
    origin.includes('localhost:5173'),
    referer.includes('localhost:5173'),
    host.includes('my.localhost'), // Cross-subdomain student portal access
    origin.includes('my.localhost'),
    referer.includes('my.localhost')
  ];

  if (studentIndicators.some(indicator => indicator)) {
    return 'student';
  }

  // Default to teacher portal
  return 'teacher';
}

/**
 * Get portal-specific cookie names
 * @param {string} portal - Portal type ('teacher' or 'student')
 * @returns {Object} Object with access and refresh token cookie names
 */
export function getPortalCookieNames(portal) {
  return {
    accessToken: `${portal}_access_token`,
    refreshToken: `${portal}_refresh_token`
  };
}

/**
 * Create portal-specific access token cookie configuration (15 minutes)
 * @param {string} portal - Portal type ('teacher' or 'student')
 * @returns {Object} Access token cookie configuration
 */
export function createPortalAccessTokenConfig(portal) {
  return createAuthCookieConfig({
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
}

/**
 * Create portal-specific refresh token cookie configuration (7 days)
 * @param {string} portal - Portal type ('teacher' or 'student')
 * @returns {Object} Refresh token cookie configuration
 */
export function createPortalRefreshTokenConfig(portal) {
  return createAuthCookieConfig({
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

/**
 * Create portal-specific cookie clear configuration (for logout)
 * @param {string} portal - Portal type ('teacher' or 'student')
 * @returns {Object} Cookie clear configuration
 */
export function createPortalClearCookieConfig(portal) {
  return createAuthCookieConfig({
    maxAge: 0
  });
}

/**
 * Generic cookie configuration functions (for non-portal use cases like players)
 */

/**
 * Create generic access token cookie configuration (15 minutes)
 * @returns {Object} Access token cookie configuration
 */
export function createAccessTokenConfig() {
  return createAuthCookieConfig({
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
}

/**
 * Create generic refresh token cookie configuration (7 days)
 * @returns {Object} Refresh token cookie configuration
 */
export function createRefreshTokenConfig() {
  return createAuthCookieConfig({
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

/**
 * Create generic cookie clear configuration (for logout)
 * @returns {Object} Cookie clear configuration
 */
export function createClearCookieConfig() {
  return createAuthCookieConfig({
    maxAge: 0
  });
}

export default {
  getCookieDomain,
  getSameSitePolicy,
  getSecureSetting,
  createAuthCookieConfig,
  logCookieConfig,
  detectPortal,
  getPortalCookieNames,
  createPortalAccessTokenConfig,
  createPortalRefreshTokenConfig,
  createPortalClearCookieConfig,
  // Generic versions for non-portal use cases
  createAccessTokenConfig,
  createRefreshTokenConfig,
  createClearCookieConfig
};