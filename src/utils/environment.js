/**
 * Environment Utility Functions
 *
 * Provides consistent environment checking across the Ludora API.
 * Use these functions instead of directly checking process.env.NODE_ENV.
 */

/**
 * Check if running in development environment
 * @returns {boolean} true if environment is 'development'
 */
function isDev() {
  const env = getEnv();
  return env === 'development';
}

/**
 * Check if running in staging environment
 * @returns {boolean} true if environment is 'staging'
 */
function isStaging() {
  const env = getEnv();
  return env === 'staging';
}

/**
 * Check if running in production environment
 * @returns {boolean} true if environment is 'production'
 */
function isProd() {
  const env = getEnv();
  return env === 'production';
}

/**
 * Get current environment name
 * Checks both ENVIRONMENT and NODE_ENV variables (ENVIRONMENT takes priority)
 * @returns {string} Current environment ('development', 'staging', 'production', or 'unknown')
 */
function getEnv() {
  // Check ENVIRONMENT first (Ludora's standard), then NODE_ENV
  return process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown';
}

/**
 * Check if running in a non-production environment (dev or staging)
 * @returns {boolean} true if not in production
 */
function isNonProd() {
  return isDev() || isStaging();
}

export {
  isDev,
  isStaging,
  isProd,
  getEnv,
  isNonProd
};