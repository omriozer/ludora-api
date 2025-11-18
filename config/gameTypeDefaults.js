// config/gameTypeDefaults.js
// Configuration for game-type-specific defaults and limits

/**
 * Game Type Configuration
 * Defines default and maximum values for different game types
 */
export const gameTypeDefaults = {
  // Memory Game Configuration
  memory_game: {
    lobby: {
      max_players_default: 40,
      max_players_max: 40,
      session_duration_default: 40, // minutes
      auto_sessions: true // Automatically create sessions when lobby opens
    },
    session: {
      players_per_session_default: 2,
      players_per_session_max: 2,
      session_name_hebrew: 'חדר משחק זיכרון'
    }
  },

  // Scatter Game Configuration
  scatter_game: {
    lobby: {
      max_players_default: 40,
      max_players_max: 40,
      session_duration_default: 40,
      auto_sessions: true
    },
    session: {
      players_per_session_default: 6,
      players_per_session_max: 8,
      session_name_hebrew: 'חדר משחק פיזור'
    }
  },

  // Sharp and Smooth Game Configuration
  sharp_and_smooth: {
    lobby: {
      max_players_default: 40,
      max_players_max: 40,
      session_duration_default: 40,
      auto_sessions: true
    },
    session: {
      players_per_session_default: 4,
      players_per_session_max: 6,
      session_name_hebrew: 'חדר משחק חד וחלק'
    }
  },

  // AR Up There Game Configuration
  ar_up_there: {
    lobby: {
      max_players_default: 40,
      max_players_max: 40,
      session_duration_default: 40,
      auto_sessions: true
    },
    session: {
      players_per_session_default: 4,
      players_per_session_max: 6,
      session_name_hebrew: 'חדר משחק AR'
    }
  },

  // Default fallback for unknown game types
  default: {
    lobby: {
      max_players_default: 40,
      max_players_max: 40,
      session_duration_default: 40,
      auto_sessions: true
    },
    session: {
      players_per_session_default: 4,
      players_per_session_max: 6,
      session_name_hebrew: 'חדר משחק'
    }
  }
};

/**
 * Get configuration for a specific game type
 * @param {string} gameType - The game type (e.g., 'memory_game')
 * @returns {Object} Configuration object for the game type
 */
export function getGameTypeConfig(gameType) {
  return gameTypeDefaults[gameType] || gameTypeDefaults.default;
}

/**
 * Get lobby defaults for a specific game type
 * @param {string} gameType - The game type
 * @returns {Object} Lobby defaults
 */
export function getLobbyDefaults(gameType) {
  const config = getGameTypeConfig(gameType);
  return {
    max_players: config.lobby.max_players_default,
    session_duration_minutes: config.lobby.session_duration_default,
    auto_create_sessions: config.lobby.auto_sessions
  };
}

/**
 * Get session defaults for a specific game type
 * @param {string} gameType - The game type
 * @returns {Object} Session defaults
 */
export function getSessionDefaults(gameType) {
  const config = getGameTypeConfig(gameType);
  return {
    players_per_session: config.session.players_per_session_default,
    max_players_per_session: config.session.players_per_session_max,
    session_name: config.session.session_name_hebrew
  };
}

/**
 * Get maximum values for validation
 * @param {string} gameType - The game type
 * @returns {Object} Maximum limits
 */
export function getGameTypeLimits(gameType) {
  const config = getGameTypeConfig(gameType);
  return {
    max_players_limit: config.lobby.max_players_max,
    max_players_per_session_limit: config.session.players_per_session_max
  };
}

/**
 * Calculate optimal session distribution
 * @param {number} totalPlayers - Total number of players
 * @param {string} gameType - The game type
 * @returns {Object} Session distribution plan
 */
export function calculateSessionDistribution(totalPlayers, gameType) {
  const sessionDefaults = getSessionDefaults(gameType);
  const playersPerSession = sessionDefaults.players_per_session;

  const idealSessions = Math.ceil(totalPlayers / playersPerSession);
  const actualPlayersPerSession = Math.ceil(totalPlayers / idealSessions);

  return {
    recommended_sessions: idealSessions,
    players_per_session: actualPlayersPerSession,
    total_capacity: idealSessions * actualPlayersPerSession,
    game_type: gameType,
    session_name: sessionDefaults.session_name
  };
}