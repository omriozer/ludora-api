/**
 * Environment Variable Validation Utility
 * Validates critical environment variables are set correctly
 */

import { ludlog, luderror } from '../lib/ludlog.js';
import { getEnv, isDev } from '../src/utils/environment.js';

/**
 * Validate required environment variables
 * @returns {Object} Validation results with warnings and errors
 */
export function validateEnvironmentVariables() {
  const results = {
    errors: [],
    warnings: [],
    isValid: true
  };

  // Critical variables that MUST be set in production/staging
  const criticalVars = {
    production: [
      'API_URL',
      'DATABASE_URL',
      'JWT_SECRET',
      'PAYPLUS_API_KEY',
      'PAYPLUS_SECRET_KEY',
      'PAYPLUS_TERMINAL_UID',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY'
    ],
    staging: [
      'API_URL',
      'DATABASE_URL',
      'JWT_SECRET',
      'PAYPLUS_API_KEY',
      'PAYPLUS_SECRET_KEY',
      'PAYPLUS_TERMINAL_UID',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY'
    ],
    development: [
      // Less strict in development
      'DATABASE_URL',
      'JWT_SECRET'
    ]
  };

  const environment = getEnv() || 'development';
  const requiredVars = criticalVars[environment] || criticalVars.development;

  // Check critical variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      results.errors.push(`Missing critical environment variable: ${varName}`);
      results.isValid = false;
    }
  });

  // Validate API_URL format if present
  if (process.env.API_URL) {
    const apiUrl = process.env.API_URL;

    // Check for common mistakes
    if (apiUrl.endsWith('/')) {
      results.warnings.push(`API_URL should not end with a trailing slash: ${apiUrl}`);
    }

    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      results.errors.push(`API_URL must start with http:// or https://: ${apiUrl}`);
      results.isValid = false;
    }

    // Check for environment-specific URLs
    if (environment === 'production' && !apiUrl.includes('api.ludora.app')) {
      results.warnings.push(`Production API_URL doesn't match expected domain: ${apiUrl}`);
    }

    if (environment === 'staging' && !apiUrl.includes('api-staging.ludora.app')) {
      results.warnings.push(`Staging API_URL doesn't match expected domain: ${apiUrl}`);
    }
  }

  // Check FRONTEND_URL
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.endsWith('/')) {
    results.warnings.push(`FRONTEND_URL should not end with a trailing slash: ${process.env.FRONTEND_URL}`);
  }

  return results;
}

/**
 * Log environment validation results
 * @param {Object} results - Validation results from validateEnvironmentVariables
 */
export function logEnvironmentValidation(results) {
  if (results.errors.length > 0) {
    luderror.system('❌ Environment Variable Errors:');
    results.errors.forEach(err => luderror.system(`  - ${err}`));
  }

  if (results.warnings.length > 0) {
    ludlog.system('⚠️  Environment Variable Warnings:');
    results.warnings.forEach(warning => ludlog.system(`  - ${warning}`));
  }

  if (results.isValid && results.errors.length === 0 && results.warnings.length === 0) {
    ludlog.system('✅ All environment variables validated successfully');
  }

  return results.isValid;
}

/**
 * Validate environment on startup (call from index.js)
 * @param {boolean} exitOnError - Whether to exit process on critical errors
 * @returns {boolean} Whether environment is valid
 */
export function validateEnvironmentOnStartup(exitOnError = true) {
  const results = validateEnvironmentVariables();
  const isValid = logEnvironmentValidation(results);

  if (!isValid && exitOnError && !isDev()) {
    luderror.system('🛑 Critical environment variables missing. Server startup aborted.');
    luderror.system('Please set the required environment variables and restart the server.');
    process.exit(1);
  }

  return isValid;
}

export default {
  validateEnvironmentVariables,
  logEnvironmentValidation,
  validateEnvironmentOnStartup
};