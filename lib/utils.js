/**
 * Backend utility functions for logging and debugging
 *
 * DEPRECATED: This file is being phased out.
 * - clog() has been removed - use structured error logging instead
 * - cerror() has been removed - use error.group() from errorLogger.js
 *
 * For new code, import { error } from './lib/errorLogger.js'
 */

// Re-export error logger for backwards compatibility during migration
export { error } from './errorLogger.js';