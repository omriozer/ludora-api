/**
 * Frontend Error Logging System for Ludora
 *
 * Provides grouped, styled error logging in development
 * and structured console output in production.
 *
 * Groups:
 * - auth: Authentication/authorization errors
 * - payment: Payment, subscription, purchase errors
 * - lobby: Game lobby and session errors
 * - ui: UI/Component rendering errors
 * - api: API communication errors
 * - system: General system errors
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugUser = process.env.DEBUG_USER;
const shouldLog = isDevelopment || isDebugUser;

// Color and style configuration for browser console
const ERROR_GROUPS = {
  auth: {
    color: '#3B82F6', // Blue
    emoji: '🔐',
    label: 'AUTH'
  },
  payment: {
    color: '#10B981', // Green
    emoji: '💳',
    label: 'PAYMENT'
  },
  lobby: {
    color: '#F59E0B', // Yellow/Amber
    emoji: '🎮',
    label: 'LOBBY'
  },
  ui: {
    color: '#EC4899', // Pink
    emoji: '🎨',
    label: 'UI'
  },
  api: {
    color: '#06B6D4', // Cyan
    emoji: '🌐',
    label: 'API'
  },
  system: {
    color: '#EF4444', // Red
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

  // In production, limit stack trace
  if (!isDevelopment) {
    return stackLines
      .filter(line => !line.includes('node_modules'))
      .slice(0, 3)
      .map(line => line.trim())
      .join('\n');
  }

  // In development, show first 5 frames
  return stackLines
    .slice(0, 5)
    .map(line => line.trim())
    .join('\n');
}

/**
 * Format error for development browser console
 */
function formatDevError(group, message, error, context) {
  const config = ERROR_GROUPS[group];
  const timestamp = formatTimestamp();

  // Use browser console styling
  const styles = [
    `color: #6B7280; font-size: 11px;`, // Timestamp (gray)
    `color: ${config.color}; font-weight: bold;`, // Label
    `color: ${config.color};`, // Message
  ];

  const logParts = [
    `%c${timestamp} %c${config.emoji} [${config.label}] %c${message}`,
    ...styles
  ];

  // Log main message with styling
  console.error(...logParts);

  // Add error details if present
  if (error) {
    if (error instanceof Error) {
      console.error('  ⤷ Error:', error.message);
      if (error.stack && isDevelopment) {
        console.error('  Stack trace:\n', extractStackTrace(error));
      }
    } else if (typeof error === 'string') {
      console.error('  ⤷', error);
    } else {
      console.error('  ⤷ Error details:', error);
    }
  }

  // Add context if present
  if (context) {
    console.error('  Context:', context);
  }
}

/**
 * Format error for production browser console
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

  // Log as structured object in production
  console.error('Ludora Error:', logEntry);
}

/**
 * Core logging function
 */
function logError(group, message, error = null, context = null) {
  if (!shouldLog) return;

  if (isDevelopment) {
    // Styled output for development
    formatDevError(group, message, error, context);
  } else {
    // Structured output for production
    formatProdError(group, message, error, context);
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
 * React Error Boundary helper
 * Use this in componentDidCatch or error boundaries
 */
export function logComponentError(error, errorInfo) {
  logError('ui', 'React component error', error, {
    componentStack: errorInfo?.componentStack,
    errorBoundary: true
  });
}

/**
 * API error helper
 * Use this for failed API calls
 */
export function logApiError(endpoint, error, requestData = null) {
  const context = {
    endpoint,
    method: requestData?.method || 'GET',
    ...(requestData && { requestData })
  };

  const message = `API call failed: ${endpoint}`;
  logError('api', message, error, context);
}

export { error };
export default error;