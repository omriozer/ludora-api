/**
 * Backend utility exports for logging and debugging
 *
 * This file provides centralized exports for all logging functionality.
 * The new professional logging system is available via logger.js
 * while maintaining backward compatibility with legacy clog/cerror.
 */

// Export new professional logging API (recommended)
export {
  log,
  error,
  requestLogger,
  errorLogger,
  shouldLog
} from './logger.js';

// Export deprecated legacy functions (for backward compatibility)
export { clog, cerror } from './logger.js';