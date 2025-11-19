/**
 * Cookie configuration utility for cross-subdomain authentication
 * Handles proper domain and sameSite settings for teacher/student portals
 */

/**
 * Get the appropriate cookie domain based on environment
 * @returns {string|undefined} Cookie domain or undefined for development
 */
export function getCookieDomain() {
  const environment = process.env.ENVIRONMENT;

  switch (environment) {
    case 'production':
      return '.ludora.app'; // Allows sharing between ludora.app and my.ludora.app
    case 'staging':
      return '.ludora.app'; // Allows sharing between staging subdomains
    case 'development':
    default:
      // For localhost development with cross-port requests (e.g., :5173 → :3003),
      // don't set domain to allow cookies to work across different ports on localhost
      // EventSource requires cookies to be available without explicit domain settings
      return undefined;
  }
}

/**
 * Get the appropriate sameSite setting based on environment
 * @returns {string} sameSite setting
 */
export function getSameSitePolicy() {
  const environment = process.env.ENVIRONMENT;

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

  // Only set domain if we have one (don't set for development)
  if (domain) {
    config.domain = domain;
  }

  return config;
}

/**
 * Create access token cookie configuration (15 minutes)
 * @returns {Object} Access token cookie configuration
 */
export function createAccessTokenConfig() {
  return createAuthCookieConfig({
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
}

/**
 * Create refresh token cookie configuration (7 days)
 * @returns {Object} Refresh token cookie configuration
 */
export function createRefreshTokenConfig() {
  return createAuthCookieConfig({
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

/**
 * Create cookie clear configuration (for logout)
 * @returns {Object} Cookie clear configuration
 */
export function createClearCookieConfig() {
  return createAuthCookieConfig({
    maxAge: 0
  });
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

export default {
  getCookieDomain,
  getSameSitePolicy,
  getSecureSetting,
  createAuthCookieConfig,
  createAccessTokenConfig,
  createRefreshTokenConfig,
  createClearCookieConfig,
  logCookieConfig
};