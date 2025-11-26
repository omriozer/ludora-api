/**
 * Backend utility exports for logging and debugging
 *
 * This file provides centralized exports for the new ludlog logging system.
 * The old logger.js exports have been removed - use ludlog instead.
 */

// Export ludlog functions (the only logging system now)
export { ludlog, luderror } from './ludlog.js';