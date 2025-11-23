/**
 * Player Authentication Error Types
 *
 * Provides specific error types for player authentication failures,
 * enabling better debugging and frontend error handling.
 *
 * COOKIE PERSISTENCE FIX: These error codes help the frontend
 * distinguish between recoverable and non-recoverable auth failures.
 */

/**
 * Custom error class for player authentication failures
 */
export class PlayerAuthError extends Error {
  constructor(message, code, statusCode = 401) {
    super(message);
    this.name = 'PlayerAuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.isPlayerAuthError = true; // Easy type checking
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode
    };
  }
}

/**
 * Pre-defined player authentication error types
 */
export const PLAYER_AUTH_ERRORS = {
  // Token errors (401)
  TOKEN_EXPIRED: 'PLAYER_TOKEN_EXPIRED',
  TOKEN_INVALID: 'PLAYER_TOKEN_INVALID',
  TOKEN_REVOKED: 'PLAYER_TOKEN_REVOKED',
  TOKEN_MISSING: 'PLAYER_TOKEN_MISSING',

  // Player state errors
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  PLAYER_INACTIVE: 'PLAYER_INACTIVE',

  // Teacher/session errors
  TEACHER_INACTIVE: 'TEACHER_INACTIVE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',

  // Network/server errors
  REFRESH_FAILED: 'PLAYER_REFRESH_FAILED',
  SERVER_ERROR: 'PLAYER_AUTH_SERVER_ERROR'
};

/**
 * Factory functions to create specific error instances
 */
export const createPlayerAuthError = {
  tokenExpired: () =>
    new PlayerAuthError('Player access token has expired', PLAYER_AUTH_ERRORS.TOKEN_EXPIRED, 401),

  tokenInvalid: (detail = '') =>
    new PlayerAuthError(`Invalid player token${detail ? `: ${detail}` : ''}`, PLAYER_AUTH_ERRORS.TOKEN_INVALID, 401),

  tokenRevoked: () =>
    new PlayerAuthError('Player token has been revoked', PLAYER_AUTH_ERRORS.TOKEN_REVOKED, 401),

  tokenMissing: () =>
    new PlayerAuthError('Player access token is required', PLAYER_AUTH_ERRORS.TOKEN_MISSING, 401),

  playerNotFound: (playerId = '') =>
    new PlayerAuthError(`Player not found${playerId ? `: ${playerId}` : ''}`, PLAYER_AUTH_ERRORS.PLAYER_NOT_FOUND, 404),

  playerInactive: () =>
    new PlayerAuthError('Player account is inactive', PLAYER_AUTH_ERRORS.PLAYER_INACTIVE, 403),

  teacherInactive: () =>
    new PlayerAuthError('Teacher account is inactive', PLAYER_AUTH_ERRORS.TEACHER_INACTIVE, 403),

  sessionExpired: () =>
    new PlayerAuthError('Player session has expired', PLAYER_AUTH_ERRORS.SESSION_EXPIRED, 401),

  sessionInvalid: () =>
    new PlayerAuthError('Player session is invalid', PLAYER_AUTH_ERRORS.SESSION_INVALID, 401),

  refreshFailed: (reason = '') =>
    new PlayerAuthError(`Token refresh failed${reason ? `: ${reason}` : ''}`, PLAYER_AUTH_ERRORS.REFRESH_FAILED, 401),

  serverError: (detail = '') =>
    new PlayerAuthError(`Authentication server error${detail ? `: ${detail}` : ''}`, PLAYER_AUTH_ERRORS.SERVER_ERROR, 500)
};

/**
 * Check if an error is a player auth error
 */
export function isPlayerAuthError(error) {
  return error?.isPlayerAuthError === true || error instanceof PlayerAuthError;
}

/**
 * Get error code from any error (player auth or generic)
 */
export function getPlayerAuthErrorCode(error) {
  if (isPlayerAuthError(error)) {
    return error.code;
  }
  // Map common JWT errors to player auth codes
  if (error?.name === 'TokenExpiredError') {
    return PLAYER_AUTH_ERRORS.TOKEN_EXPIRED;
  }
  if (error?.name === 'JsonWebTokenError') {
    return PLAYER_AUTH_ERRORS.TOKEN_INVALID;
  }
  return null;
}

/**
 * Check if the error code indicates a recoverable auth failure
 * (i.e., can be fixed by refreshing the token)
 */
export function isRecoverableAuthError(errorCode) {
  return [
    PLAYER_AUTH_ERRORS.TOKEN_EXPIRED,
    PLAYER_AUTH_ERRORS.SESSION_EXPIRED
  ].includes(errorCode);
}

/**
 * Check if the error code indicates a terminal auth failure
 * (i.e., user must re-authenticate)
 */
export function isTerminalAuthError(errorCode) {
  return [
    PLAYER_AUTH_ERRORS.TOKEN_REVOKED,
    PLAYER_AUTH_ERRORS.PLAYER_NOT_FOUND,
    PLAYER_AUTH_ERRORS.PLAYER_INACTIVE,
    PLAYER_AUTH_ERRORS.TEACHER_INACTIVE,
    PLAYER_AUTH_ERRORS.TOKEN_INVALID
  ].includes(errorCode);
}

export default {
  PlayerAuthError,
  PLAYER_AUTH_ERRORS,
  createPlayerAuthError,
  isPlayerAuthError,
  getPlayerAuthErrorCode,
  isRecoverableAuthError,
  isTerminalAuthError
};
