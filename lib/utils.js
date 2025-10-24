/**
 * Backend utility functions for logging and debugging
 */

/**
 * Conditional console.log - only logs in development or when DEBUG_USER is set
 * @param {...any} args - Arguments to log
 */
export function clog(...args) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_USER) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}

/**
 * Conditional console.error - only logs in development or when DEBUG_USER is set
 * @param {...any} args - Arguments to log as errors
 */
export function cerror(...args) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_USER) {
        // eslint-disable-next-line no-console
        console.error(...args);
    }
}