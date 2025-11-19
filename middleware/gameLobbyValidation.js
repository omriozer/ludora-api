// middleware/gameLobbyValidation.js
// Joi validation schemas for GameLobby-related requests

import Joi from 'joi';

/**
 * Validation schemas for GameLobby operations
 * Following existing ludora-api validation patterns
 */

// Lobby Settings Schema (reusable)
const lobbySettingsSchema = Joi.object({
  max_players: Joi.number().integer().min(2).max(50).default(12)
    .messages({
      'number.min': 'Max players must be at least 2',
      'number.max': 'Max players cannot exceed 50'
    }),

  session_time_limit: Joi.number().integer().min(5).max(120).default(30)
    .messages({
      'number.min': 'Session time limit must be at least 5 minutes',
      'number.max': 'Session time limit cannot exceed 120 minutes'
    }),

  allow_guest_users: Joi.boolean().default(true),

  invitation_type: Joi.string()
    .valid('manual_selection', 'teacher_assignment', 'random', 'order')
    .default('manual_selection')
    .messages({
      'any.only': 'Invitation type must be one of: manual_selection, teacher_assignment, random, order'
    }),

  auto_close_after: Joi.number().integer().min(10).max(1440).default(60)
    .messages({
      'number.min': 'Auto close time must be at least 10 minutes',
      'number.max': 'Auto close time cannot exceed 1440 minutes (24 hours)'
    }),

  // Allow additional custom settings
  team_mode: Joi.boolean().optional(),
  scoring_mode: Joi.string().valid('individual', 'team', 'collaborative').optional(),
  difficulty_level: Joi.string().valid('easy', 'medium', 'hard').optional(),
  time_pressure: Joi.boolean().optional()
}).options({ stripUnknown: false }); // Allow additional properties

// Create Lobby Schema
const createLobbySchema = Joi.object({
  settings: lobbySettingsSchema.required()
    .messages({
      'any.required': 'Lobby settings are required'
    }),

  expires_at: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Expiration time must be in the future'
    })
});

// Update Lobby Settings Schema
const updateLobbySchema = Joi.object({
  settings: lobbySettingsSchema.optional()
});

// Activate Lobby Schema (Enhanced)
const activateLobbySchema = Joi.object({
  // Expiration/Duration settings
  duration: Joi.alternatives()
    .try(
      Joi.number().integer().min(1).max(43800), // Max 1 month (43800 minutes)
      Joi.string().valid('indefinite'),
      Joi.allow(null)
    )
    .optional()
    .messages({
      'number.min': 'Duration must be at least 1 minute',
      'number.max': 'Duration cannot exceed 43800 minutes (1 month)',
      'any.only': 'Duration must be a number, "indefinite", or null'
    }),

  expires_at: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Expiration time must be in the future'
    }),

  // Lobby player settings
  max_players: Joi.number()
    .integer()
    .min(2)
    .max(100) // Will be validated against game type limits
    .optional()
    .messages({
      'number.min': 'Max players must be at least 2',
      'number.max': 'Max players cannot exceed 100'
    }),

  // Session management settings
  session_config: Joi.object({
    auto_create_sessions: Joi.boolean()
      .default(true)
      .optional(),

    session_count: Joi.number()
      .integer()
      .min(1)
      .max(50) // Will be validated against max_players
      .optional()
      .messages({
        'number.min': 'Session count must be at least 1',
        'number.max': 'Session count cannot exceed 50'
      }),

    players_per_session: Joi.number()
      .integer()
      .min(1)
      .max(20) // Will be validated against game type limits
      .optional()
      .messages({
        'number.min': 'Players per session must be at least 1',
        'number.max': 'Players per session cannot exceed 20'
      }),

    session_names: Joi.array()
      .items(Joi.string().max(50))
      .optional()
      .messages({
        'string.max': 'Session name cannot exceed 50 characters'
      })
  })
  .optional()
});

// Set Lobby Expiration Schema
const setLobbyExpirationSchema = Joi.object({
  expires_at: Joi.alternatives()
    .try(
      Joi.date().greater('now'),
      Joi.allow(null)
    )
    .required()
    .messages({
      'date.greater': 'Expiration time must be in the future',
      'any.required': 'Expiration time is required (use null to set as pending)'
    })
});

// Join by Code Schema
const joinByCodeSchema = Joi.object({
  lobby_code: Joi.string()
    .length(6)
    .pattern(/^[A-Z0-9]+$/)
    .optional() // Made optional for direct lobby join
    .messages({
      'string.length': 'Lobby code must be exactly 6 characters',
      'string.pattern.base': 'Lobby code must contain only uppercase letters and numbers'
    }),

  session_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Session ID must be a valid UUID'
    }),

  participant: Joi.object({
    display_name: Joi.string()
      .min(1)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.min': 'Display name cannot be empty',
        'string.max': 'Display name cannot exceed 50 characters',
        'any.required': 'Display name is required'
      }),

    user_id: Joi.string().uuid().allow(null).strip(),

    guest_token: Joi.string()
      .pattern(/^guest_[a-zA-Z0-9]{8,}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid guest token format'
      }),

    team_assignment: Joi.string()
      .max(10)
      .optional()
      .messages({
        'string.max': 'Team assignment cannot exceed 10 characters'
      })
  })
  .xor('user_id', 'guest_token') // Must have either user_id OR guest_token, not both
  .required()
  .messages({
    'object.xor': 'Participant must have either user_id or guest_token',
    'any.required': 'Participant information is required'
  })
});

// Path Parameters Schema
const lobbyIdParamSchema = Joi.object({
  lobbyId: Joi.string()
    .length(6)
    .pattern(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]{6}$/)
    .required()
    .messages({
      'string.length': 'Lobby ID must be exactly 6 characters',
      'string.pattern.base': 'Invalid lobby ID format (must be 6 alphanumeric characters)',
      'any.required': 'Lobby ID is required'
    })
});

const gameIdParamSchema = Joi.object({
  gameId: Joi.string()
    .pattern(/^[A-Za-z0-9]{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid game ID format (must be 6 alphanumeric characters)',
      'any.required': 'Game ID is required'
    })
});

/**
 * Validation middleware functions
 */

// Validate lobby creation request
export const validateCreateLobby = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = gameIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = createLobbySchema.validate(req.body);
  if (bodyError) {
    return res.status(400).json({
      error: 'Validation error',
      details: bodyError.details[0].message
    });
  }

  req.validatedParams = paramValue;
  req.validatedData = bodyValue;
  next();
};

// Validate lobby update request
export const validateUpdateLobby = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = lobbyIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = updateLobbySchema.validate(req.body);
  if (bodyError) {
    return res.status(400).json({
      error: 'Validation error',
      details: bodyError.details[0].message
    });
  }

  req.validatedParams = paramValue;
  req.validatedData = bodyValue;
  next();
};

// Validate lobby activation request
export const validateActivateLobby = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = lobbyIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = activateLobbySchema.validate(req.body);
  if (bodyError) {
    return res.status(400).json({
      error: 'Validation error',
      details: bodyError.details[0].message
    });
  }

  req.validatedParams = paramValue;
  req.validatedData = bodyValue;
  next();
};

// Validate lobby close request (no body validation needed)
export const validateCloseLobby = (req, res, next) => {
  // Validate path parameters only
  const { error: paramError, value: paramValue } = lobbyIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  req.validatedParams = paramValue;
  next();
};

// Validate set lobby expiration request
export const validateSetLobbyExpiration = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = lobbyIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = setLobbyExpirationSchema.validate(req.body);
  if (bodyError) {
    return res.status(400).json({
      error: 'Validation error',
      details: bodyError.details[0].message
    });
  }

  req.validatedParams = paramValue;
  req.validatedData = bodyValue;
  next();
};

// Validate join by code request
export const validateJoinByCode = (req, res, next) => {
  const { error, value } = joinByCodeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  req.validatedData = value;
  next();
};

// Validate lobby ID parameter
export const validateLobbyId = (req, res, next) => {
  const { error, value } = lobbyIdParamSchema.validate(req.params);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  req.validatedParams = value;
  next();
};

// Validate game ID parameter
export const validateGameId = (req, res, next) => {
  const { error, value } = gameIdParamSchema.validate(req.params);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  req.validatedParams = value;
  next();
};

// Validate lobby query parameters for listing
export const validateLobbyListQuery = (req, res, next) => {
  const querySchema = Joi.object({
    // Status is now computed on-the-fly, not filterable via query
    // Clients should filter computed status client-side
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),

    // Optional filters for game-related queries
    game_id: Joi.string()
      .pattern(/^[A-Za-z0-9]{6}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid game ID format (must be 6 alphanumeric characters)'
      }),

    owner_user_id: Joi.string().uuid().optional(),
    host_user_id: Joi.string().uuid().optional(),

    // Support expiration-based filtering
    expired: Joi.boolean().optional() // true = only expired, false = only active, undefined = all
  });

  const { error, value } = querySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  req.validatedQuery = value;
  next();
};

// Export schemas for potential reuse
export {
  createLobbySchema,
  updateLobbySchema,
  activateLobbySchema,
  setLobbyExpirationSchema,
  joinByCodeSchema,
  lobbySettingsSchema
};