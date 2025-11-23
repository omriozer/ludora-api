/**
 * Structured Error Logging System for Ludora
 *
 * Provides grouped, colored error logging in development
 * and structured JSON logging in production.
 *
 * Groups:
 * - auth: Authentication/authorization errors (blue)
 * - payment: Payment, subscription, purchase errors (green)
 * - lobby: Game lobby and session errors (yellow)
 * - template: Template editor and email template errors (magenta)
 * - api: General API and route errors (cyan)
 * - system: Infrastructure, database, file system errors (red)
 */

import chalk from 'chalk';
import { inspect } from 'util';

const isDevelopment = process.env.NODE_ENV !== 'production';
const isDebugUser = process.env.DEBUG_USER;
const shouldLog = isDevelopment || isDebugUser;

// Color configuration for each error group
const ERROR_GROUPS = {
  auth: {
    color: chalk.blue,
    emoji: '🔐',
    label: 'AUTH'
  },
  payment: {
    color: chalk.green,
    emoji: '💳',
    label: 'PAYMENT'
  },
  lobby: {
    color: chalk.yellow,
    emoji: '🎮',
    label: 'LOBBY'
  },
  template: {
    color: chalk.magenta,
    emoji: '📝',
    label: 'TEMPLATE'
  },
  api: {
    color: chalk.cyan,
    emoji: '🌐',
    label: 'API'
  },
  system: {
    color: chalk.red,
    emoji: '⚙️',
    label: 'SYSTEM'
  }
};

/**
 * Format timestamp for development logs
 */
function formatTimestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

/**
 * Extract clean stack trace from error
 */
function extractStackTrace(error) {
  if (!error || !error.stack) return null;

  // Remove the error message from stack (first line)
  const stackLines = error.stack.split('\n').slice(1);

  // Filter out node internals and modules in production
  if (!isDevelopment) {
    return stackLines
      .filter(line => !line.includes('node_modules') && !line.includes('node:internal'))
      .slice(0, 5) // Limit to 5 relevant frames
      .map(line => line.trim())
      .join('\n');
  }

  // In development, show first 10 frames
  return stackLines
    .slice(0, 10)
    .map(line => line.trim())
    .join('\n');
}

/**
 * Format error for development console output
 */
function formatDevError(group, message, error, context) {
  const config = ERROR_GROUPS[group];
  const timestamp = chalk.gray(formatTimestamp());
  const label = config.color.bold(`[${config.label}]`);
  const emoji = config.emoji;

  // Build formatted output
  let output = `${timestamp} ${emoji} ${label} ${config.color(message)}`;

  // Add error details if present
  if (error) {
    if (error instanceof Error) {
      output += '\n' + chalk.red(`  ⤷ Error: ${error.message}`);

      const stack = extractStackTrace(error);
      if (stack) {
        output += '\n' + chalk.gray(stack.split('\n').map(line => '    ' + line).join('\n'));
      }
    } else if (typeof error === 'string') {
      output += '\n' + chalk.red(`  ⤷ ${error}`);
    } else {
      // Format object errors nicely
      output += '\n' + chalk.red('  ⤷ ' + inspect(error, { colors: true, depth: 2 }));
    }
  }

  // Add context if present
  if (context) {
    output += '\n' + chalk.gray('  Context:');
    if (typeof context === 'object') {
      Object.entries(context).forEach(([key, value]) => {
        const formattedValue = typeof value === 'object'
          ? inspect(value, { colors: true, depth: 1, compact: true })
          : value;
        output += '\n' + chalk.gray(`    ${key}: ${formattedValue}`);
      });
    } else {
      output += '\n' + chalk.gray(`    ${context}`);
    }
  }

  return output;
}

/**
 * Format error for production JSON output
 */
function formatProdError(group, message, error, context) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    group,
    message,
    ...(context && { context })
  };

  // Add error details
  if (error) {
    if (error instanceof Error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: extractStackTrace(error),
        ...(error.code && { code: error.code }),
        ...(error.statusCode && { statusCode: error.statusCode })
      };
    } else if (typeof error === 'string') {
      logEntry.error = { message: error };
    } else {
      logEntry.error = error;
    }
  }

  // Add request ID if available (from Express context)
  if (global.currentRequestId) {
    logEntry.requestId = global.currentRequestId;
  }

  return JSON.stringify(logEntry);
}

/**
 * Core logging function
 */
function logError(group, message, error = null, context = null) {
  if (!shouldLog) return;

  if (isDevelopment) {
    // Beautiful colored output for development
    console.error(formatDevError(group, message, error, context));
  } else {
    // Structured JSON for production
    console.error(formatProdError(group, message, error, context));
  }
}

/**
 * Create error logging API
 */
const error = {};

// Generate methods for each error group
Object.keys(ERROR_GROUPS).forEach(group => {
  error[group] = (message, error = null, context = null) => {
    logError(group, message, error, context);
  };
});

/**
 * Generic error method for uncategorized errors
 * (Fallback to system group)
 */
error.log = (message, error = null, context = null) => {
  logError('system', message, error, context);
};

/**
 * Request ID middleware integration
 * Call this in Express middleware to enable request correlation
 */
export function setRequestId(requestId) {
  global.currentRequestId = requestId;
}

/**
 * Clear request ID after request completes
 */
export function clearRequestId() {
  delete global.currentRequestId;
}

export { error };
export default error;