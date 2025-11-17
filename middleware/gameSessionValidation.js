// middleware/gameSessionValidation.js
// Joi validation schemas for GameSession-related requests

import Joi from 'joi';

/**
 * Validation schemas for GameSession operations
 * Following existing ludora-api validation patterns
 */

// Participant Schema (reusable)
const participantSchema = Joi.object({
  user_id: Joi.string().uuid().optional(),

  guest_token: Joi.string()
    .pattern(/^guest_[a-zA-Z0-9]{8,}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid guest token format'
    }),

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

  team_assignment: Joi.string()
    .max(10)
    .optional()
    .messages({
      'string.max': 'Team assignment cannot exceed 10 characters'
    })
}).xor('user_id', 'guest_token') // Must have either user_id OR guest_token
  .messages({
    'object.xor': 'Participant must have either user_id or guest_token'
  });

// Create Session Schema
const createSessionSchema = Joi.object({
  participants: Joi.array()
    .items(participantSchema)
    .min(0)
    .max(50)
    .default([])
    .messages({
      'array.min': 'Participants array cannot be empty if provided',
      'array.max': 'Cannot exceed 50 participants'
    }),

  auto_start: Joi.boolean().default(false),

  // Optional session-specific settings that override lobby defaults
  session_settings: Joi.object({
    time_limit: Joi.number().integer().min(5).max(120).optional(),
    team_mode: Joi.boolean().optional(),
    scoring_mode: Joi.string().valid('individual', 'team', 'collaborative').optional()
  }).optional()
});

// Add Participant Schema
const addParticipantSchema = Joi.object({
  user_id: Joi.string().uuid().optional(),

  guest_token: Joi.string()
    .pattern(/^guest_[a-zA-Z0-9]{8,}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid guest token format'
    }),

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

  team_assignment: Joi.string()
    .max(10)
    .optional()
    .messages({
      'string.max': 'Team assignment cannot exceed 10 characters'
    })
}).xor('user_id', 'guest_token') // Must have either user_id OR guest_token
  .messages({
    'object.xor': 'Must have either user_id or guest_token'
  });

// Update Game State Schema
const updateGameStateSchema = Joi.object({
  current_state: Joi.object().required()
    .messages({
      'any.required': 'Game state data is required'
    }),

  auto_save: Joi.boolean().default(true),

  // Optional metadata for the state update
  update_metadata: Joi.object({
    action_type: Joi.string().max(50).optional(),
    player_action: Joi.string().max(100).optional(),
    timestamp: Joi.date().default(Date.now).optional()
  }).optional()
});

// Finish Session Schema
const finishSessionSchema = Joi.object({
  final_data: Joi.object().default({}),

  reason: Joi.string()
    .valid('completed', 'aborted', 'timeout', 'error')
    .default('completed')
    .messages({
      'any.only': 'Reason must be one of: completed, aborted, timeout, error'
    }),

  save_results: Joi.boolean().default(true)
});

// Update Session Settings Schema
const updateSessionSchema = Joi.object({
  session_settings: Joi.object({
    time_limit: Joi.number().integer().min(5).max(120).optional(),
    team_mode: Joi.boolean().optional(),
    scoring_mode: Joi.string().valid('individual', 'team', 'collaborative').optional(),
    difficulty_level: Joi.string().valid('easy', 'medium', 'hard').optional()
  }).min(1).required()
    .messages({
      'object.min': 'At least one setting must be provided',
      'any.required': 'Session settings are required'
    })
});

// Path Parameters Schemas
const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().uuid().required()
    .messages({
      'string.uuid': 'Invalid session ID format',
      'any.required': 'Session ID is required'
    })
});

const lobbyIdParamSchema = Joi.object({
  lobbyId: Joi.string().uuid().required()
    .messages({
      'string.uuid': 'Invalid lobby ID format',
      'any.required': 'Lobby ID is required'
    })
});

const participantIdParamSchema = Joi.object({
  participantId: Joi.string().required()
    .messages({
      'any.required': 'Participant ID is required'
    })
});

/**
 * Validation middleware functions
 */

// Validate session creation request
export const validateCreateSession = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = lobbyIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = createSessionSchema.validate(req.body);
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

// Validate add participant request
export const validateAddParticipant = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = sessionIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = addParticipantSchema.validate(req.body);
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

// Validate remove participant request
export const validateRemoveParticipant = (req, res, next) => {
  // Validate session ID
  const { error: sessionError, value: sessionValue } = sessionIdParamSchema.validate({
    sessionId: req.params.sessionId
  });
  if (sessionError) {
    return res.status(400).json({
      error: 'Validation error',
      details: sessionError.details[0].message
    });
  }

  // Validate participant ID
  const { error: participantError, value: participantValue } = participantIdParamSchema.validate({
    participantId: req.params.participantId
  });
  if (participantError) {
    return res.status(400).json({
      error: 'Validation error',
      details: participantError.details[0].message
    });
  }

  req.validatedParams = { ...sessionValue, ...participantValue };
  next();
};

// Validate update game state request
export const validateUpdateGameState = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = sessionIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = updateGameStateSchema.validate(req.body);
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

// Validate finish session request
export const validateFinishSession = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = sessionIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = finishSessionSchema.validate(req.body);
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

// Validate session update request
export const validateUpdateSession = (req, res, next) => {
  // Validate path parameters
  const { error: paramError, value: paramValue } = sessionIdParamSchema.validate(req.params);
  if (paramError) {
    return res.status(400).json({
      error: 'Validation error',
      details: paramError.details[0].message
    });
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = updateSessionSchema.validate(req.body);
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

// Validate session ID parameter only
export const validateSessionId = (req, res, next) => {
  const { error, value } = sessionIdParamSchema.validate(req.params);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }

  req.validatedParams = value;
  next();
};

// Validate lobby ID parameter only
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

// Validate session query parameters for listing
export const validateSessionListQuery = (req, res, next) => {
  const querySchema = Joi.object({
    // Status is now computed on-the-fly, not filterable via query
    // Clients should filter computed status client-side
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    include_participants: Joi.boolean().default(false),

    // Optional filters for session-related queries
    lobby_id: Joi.string().uuid().optional(),

    // Support expiration-based filtering
    expired: Joi.boolean().optional(), // true = only expired, false = only active, undefined = all
    finished: Joi.boolean().optional() // true = only finished, false = only ongoing, undefined = all
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
  createSessionSchema,
  addParticipantSchema,
  updateGameStateSchema,
  finishSessionSchema,
  updateSessionSchema,
  participantSchema
};