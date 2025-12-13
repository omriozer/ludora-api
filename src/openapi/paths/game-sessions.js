// OpenAPI documentation for game session management
// Real-time multiplayer session coordination with state management

export default {
  '/game-sessions/{sessionId}': {
    get: {
      tags: ['Game Sessions', 'Student Access'],
      summary: 'Get detailed session information',
      description: `
        **Real-Time Session Details**: Comprehensive session information for active game participation.

        **Session Information:**
        - Complete participant roster with roles and teams
        - Current game state and progress
        - Session configuration and rules
        - Real-time status updates

        **Access Control:**
        - Session participants (students in the session)
        - Lobby owners and hosts (teachers managing the game)
        - System administrators

        **Used By:** Game clients, session monitoring dashboards, student progress tracking
      `,
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique identifier of the game session',
          example: 'session_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Session details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'session_abc123' },
                  session_number: { type: 'integer', example: 1 },
                  lobby_id: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['pending', 'open', 'active', 'finished'],
                    description: 'Current session status'
                  },
                  participants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Participant ID within session' },
                        display_name: { type: 'string', example: 'Alex' },
                        user_id: { type: 'string', nullable: true },
                        player_id: { type: 'string', nullable: true },
                        guest_token: { type: 'string', nullable: true },
                        isAuthedUser: { type: 'boolean' },
                        team_assignment: { type: 'string', nullable: true },
                        joined_at: { type: 'string', format: 'date-time' },
                        is_ready: { type: 'boolean', description: 'Ready to start game' }
                      }
                    }
                  },
                  current_state: {
                    type: 'object',
                    description: 'Current game state (varies by game type)',
                    properties: {
                      game_phase: { type: 'string', example: 'playing' },
                      round_number: { type: 'integer', example: 3 },
                      scores: { type: 'object' },
                      last_updated: { type: 'string', format: 'date-time' }
                    }
                  },
                  data: {
                    type: 'object',
                    properties: {
                      session_name: { type: 'string', example: 'Memory Game 1' },
                      max_players: { type: 'integer', example: 4 },
                      game_type: { type: 'string', example: 'memory' },
                      session_settings: { type: 'object' }
                    }
                  },
                  lobby: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      lobby_code: { type: 'string' },
                      game: { type: 'object' }
                    }
                  },
                  started_at: { type: 'string', format: 'date-time', nullable: true },
                  finished_at: { type: 'string', format: 'date-time', nullable: true },
                  expires_at: { type: 'string', format: 'date-time', nullable: true }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (not a participant or authorized user)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not have permission to view this session' }
                }
              }
            }
          }
        },
        404: {
          description: 'Session not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Session not found' }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ['Game Sessions', 'Teacher Management'],
      summary: 'Update session settings',
      description: `
        **Session Configuration Management**: Modify session settings during active gameplay.

        **Updateable Settings:**
        - Session metadata (name, description)
        - Game-specific configuration
        - Player limits and rules
        - Timeout and duration settings

        **Access Control:** Only lobby owner, host, and administrators can update session settings

        **Live Updates:** Changes apply immediately to active session and notify all participants
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier to update',
          example: 'session_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                session_settings: {
                  type: 'object',
                  properties: {
                    session_name: {
                      type: 'string',
                      maxLength: 100,
                      example: 'Advanced Memory Challenge'
                    },
                    max_players: {
                      type: 'integer',
                      minimum: 2,
                      maximum: 20
                    },
                    game_rules: {
                      type: 'object',
                      properties: {
                        time_limit: { type: 'integer', description: 'Time limit in seconds' },
                        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                        scoring_mode: { type: 'string', enum: ['points', 'time', 'accuracy'] }
                      }
                    },
                    auto_finish: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean' },
                        timeout_minutes: { type: 'integer', minimum: 5, maximum: 180 }
                      }
                    }
                  }
                }
              },
              example: {
                session_settings: {
                  session_name: 'Advanced Memory Challenge',
                  max_players: 6,
                  game_rules: {
                    time_limit: 300,
                    difficulty: 'hard',
                    scoring_mode: 'points'
                  },
                  auto_finish: {
                    enabled: true,
                    timeout_minutes: 30
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Session settings updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Updated session details with new settings'
              }
            }
          }
        },
        403: {
          description: 'Access denied (only owner or host can update)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Only lobby owner or host can update session settings' }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      tags: ['Game Sessions', 'Teacher Management'],
      summary: 'Close/finish session',
      description: `
        **Session Termination**: Closes active session and finalizes results.

        **Closure Process:**
        - Finishes current game state
        - Saves final scores and progress
        - Removes participants from active session
        - Preserves session data for historical records

        **Access Control:** Only lobby owner, host, session participants, and admins can close sessions

        **Data Preservation:** All session data, scores, and participant progress saved for analytics
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier to close',
          example: 'session_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Session closed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Session closed successfully' },
                  session: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'finished' },
                      finished_at: { type: 'string', format: 'date-time' },
                      final_scores: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Insufficient permissions to close session' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/{sessionId}/participants': {
    get: {
      tags: ['Game Sessions', 'Teacher Management'],
      summary: 'List session participants',
      description: `
        **Participant Roster Management**: View all participants in a game session.

        **Participant Information:**
        - Display names and authentication status
        - Team assignments and roles
        - Join timestamps and readiness status
        - User/player/guest identification

        **Access Control:** Session participants, lobby owner/host, and admins can view participant lists

        **Used By:** Teacher dashboards, participant management, team organization
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier',
          example: 'session_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Participants retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  session_id: { type: 'string' },
                  participants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        display_name: { type: 'string' },
                        user_id: { type: 'string', nullable: true },
                        player_id: { type: 'string', nullable: true },
                        guest_token: { type: 'string', nullable: true },
                        isAuthedUser: { type: 'boolean' },
                        team_assignment: { type: 'string', nullable: true },
                        joined_at: { type: 'string', format: 'date-time' },
                        is_ready: { type: 'boolean' },
                        is_online: { type: 'boolean' }
                      }
                    }
                  },
                  participants_count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['Game Sessions', 'Student Access'],
      summary: 'Add participant to session (Student)',
      description: `
        **Student Session Joining**: Allows students to join active game sessions.

        **Joining Process:**
        - Validates session capacity and availability
        - Checks guest user permissions
        - Assigns participant ID for session management
        - Updates real-time participant roster

        **Authentication Support:**
        - Authenticated students (with teacher connections)
        - Anonymous students (with guest tokens if allowed)
        - Validates user ID matching for authenticated users

        **Capacity Management:** Respects session's maximum player limits and prevents overfilling
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                display_name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                  description: 'Student display name for the session',
                  example: 'Alex'
                },
                user_id: {
                  type: 'string',
                  description: 'Authenticated user ID (must match token)',
                  nullable: true,
                  example: 'user_123abc'
                },
                player_id: {
                  type: 'string',
                  description: 'Authenticated student user ID',
                  nullable: true,
                  example: 'player_456def'
                },
                guest_token: {
                  type: 'string',
                  description: 'Required for anonymous students',
                  nullable: true,
                  example: 'guest_789xyz'
                },
                team_preference: {
                  type: 'string',
                  description: 'Preferred team assignment (if applicable)',
                  nullable: true,
                  example: 'red'
                }
              },
              required: ['display_name'],
              example: {
                display_name: 'Alex',
                guest_token: 'guest_789xyz',
                team_preference: 'blue'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Participant added successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Session ID' },
                  session_number: { type: 'integer' },
                  participants: {
                    type: 'array',
                    description: 'Updated participant list'
                  },
                  participants_count: { type: 'integer' },
                  added_participant: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Generated participant ID' },
                      display_name: { type: 'string' },
                      team_assignment: { type: 'string', nullable: true },
                      isAuthedUser: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid participant data or session full',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                },
                examples: [
                  { error: 'Session is full' },
                  { error: 'Guest users must provide a guest_token' },
                  { error: 'User ID mismatch' }
                ]
              }
            }
          }
        },
        403: {
          description: 'Access restrictions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Guest users are not allowed in this session' }
                }
              }
            }
          }
        },
        409: {
          description: 'Participant already in session',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'User already in session' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/{sessionId}/participants/{participantId}': {
    delete: {
      tags: ['Game Sessions', 'Student Access'],
      summary: 'Remove participant from session (Student)',
      description: `
        **Student Session Leaving**: Allows students to leave active game sessions.

        **Leaving Process:**
        - Removes participant from active roster
        - Updates real-time participant counts
        - Preserves participation history for analytics
        - Handles team rebalancing if applicable

        **Access Control:**
        - Students can remove themselves from sessions
        - Lobby owners/hosts can remove any participant
        - System administrators have full access

        **Session Impact:** May trigger game state updates if minimum players not met
      `,
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier',
          example: 'session_abc123'
        },
        {
          name: 'participantId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Participant identifier within session',
          example: 'participant_def456'
        }
      ],
      responses: {
        200: {
          description: 'Participant removed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  participants: { type: 'array' },
                  participants_count: { type: 'integer' },
                  message: { type: 'string', example: 'Participant removed successfully' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Cannot remove other participants' }
                }
              }
            }
          }
        },
        404: {
          description: 'Participant not found in session',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Participant not found' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/{sessionId}/participants/teacher-add': {
    post: {
      tags: ['Game Sessions', 'Teacher Management'],
      summary: 'Add participant to session (Teacher)',
      description: `
        **Teacher Participant Management**: Allows teachers to add students to game sessions.

        **Teacher Capabilities:**
        - Add students to any session in their lobbies
        - Bypass normal capacity restrictions (with warnings)
        - Assign specific teams or roles
        - Add both authenticated and guest participants

        **Administrative Features:**
        - Override guest user restrictions
        - Force team assignments
        - Add participants to full sessions (with capacity warnings)

        **Access Control:** Only lobby owner, host, and system administrators can add participants
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier',
          example: 'session_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                display_name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                  description: 'Student display name',
                  example: 'Sarah'
                },
                user_id: {
                  type: 'string',
                  description: 'Student user ID (if authenticated)',
                  nullable: true
                },
                player_id: {
                  type: 'string',
                  description: 'Student user ID (if authenticated)',
                  nullable: true
                },
                team_assignment: {
                  type: 'string',
                  description: 'Force specific team assignment',
                  nullable: true,
                  example: 'red'
                },
                role: {
                  type: 'string',
                  description: 'Special role within session',
                  nullable: true,
                  example: 'team_captain'
                }
              },
              required: ['display_name'],
              example: {
                display_name: 'Sarah',
                player_id: 'player_789xyz',
                team_assignment: 'red',
                role: 'team_captain'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Participant added successfully by teacher',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Participant added successfully' },
                  session: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      participants_count: { type: 'integer' },
                      participants: { type: 'array' }
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (not lobby owner or host)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Only lobby owner or host can add participants' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/{sessionId}/state': {
    get: {
      tags: ['Game State Management'],
      summary: 'Get current game state',
      description: `
        **Real-Time Game State**: Retrieves current game state for active session participants.

        **Game State Information:**
        - Current game phase and round
        - Player scores and progress
        - Game-specific data (varies by game type)
        - Last update timestamp
        - Session status

        **Access Control:** Only session participants and authorized users can view game state

        **Real-Time Updates:** Use this endpoint for polling or combine with WebSocket for live updates
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier',
          example: 'session_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Game state retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  session_id: { type: 'string' },
                  current_state: {
                    type: 'object',
                    description: 'Game-specific state data',
                    properties: {
                      game_phase: { type: 'string', example: 'playing' },
                      round_number: { type: 'integer', example: 3 },
                      current_player: { type: 'string', example: 'participant_123' },
                      scores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                        example: { 'participant_123': 150, 'participant_456': 120 }
                      },
                      game_data: {
                        type: 'object',
                        description: 'Game type specific data'
                      },
                      last_action: {
                        type: 'object',
                        properties: {
                          participant_id: { type: 'string' },
                          action_type: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  },
                  last_updated: { type: 'string', format: 'date-time' },
                  status: { type: 'string', enum: ['pending', 'open', 'active', 'finished'] }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (not a session participant)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You are not a participant in this session' }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ['Game State Management'],
      summary: 'Update game state (Real-time)',
      description: `
        **Real-Time Game Updates**: Updates game state during active gameplay.

        **State Update Features:**
        - Atomic game state changes
        - Participant action tracking
        - Score and progress updates
        - Game phase transitions

        **Rate Limiting:** Higher rate limits (60/minute) for responsive gameplay

        **Access Control:** Only active session participants can update game state

        **Auto-Save:** Optional auto-save functionality to preserve game progress

        **Used By:** Game clients for real-time multiplayer interactions
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier',
          example: 'session_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                current_state: {
                  type: 'object',
                  description: 'Updated game state data',
                  properties: {
                    game_phase: { type: 'string', example: 'playing' },
                    round_number: { type: 'integer' },
                    current_player: { type: 'string' },
                    scores: { type: 'object' },
                    game_data: { type: 'object' },
                    player_action: {
                      type: 'object',
                      properties: {
                        action_type: { type: 'string', example: 'card_flip' },
                        action_data: { type: 'object' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                },
                auto_save: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to automatically save state changes'
                },
                update_metadata: {
                  type: 'object',
                  properties: {
                    updated_by: { type: 'string' },
                    update_reason: { type: 'string' },
                    sequence_number: { type: 'integer' }
                  }
                }
              },
              required: ['current_state'],
              example: {
                current_state: {
                  game_phase: 'playing',
                  round_number: 4,
                  current_player: 'participant_456',
                  scores: {
                    'participant_123': 160,
                    'participant_456': 140
                  },
                  game_data: {
                    cards_flipped: ['card_1', 'card_5'],
                    matches_found: 3
                  },
                  player_action: {
                    action_type: 'card_flip',
                    action_data: { card_id: 'card_8' },
                    timestamp: '2025-12-11T14:30:00Z'
                  }
                },
                auto_save: true,
                update_metadata: {
                  update_reason: 'player_move'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Game state updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  session_id: { type: 'string' },
                  current_state: { type: 'object' },
                  last_updated: { type: 'string', format: 'date-time' },
                  message: { type: 'string', example: 'Game state updated successfully' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid state update or session not active',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Cannot update state: Session is not active' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (not a session participant)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You are not a participant in this session' }
                }
              }
            }
          }
        },
        429: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Too many game state updates, please slow down' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/{sessionId}/start': {
    put: {
      tags: ['Game State Management'],
      summary: 'Start pending session',
      description: `
        **Session Activation**: Transitions session from pending to active state.

        **Start Process:**
        - Validates minimum participants
        - Initializes game state
        - Sets session start timestamp
        - Notifies all participants

        **Access Control:** Session participants, lobby owner/host, and admins can start sessions

        **Prerequisites:**
        - Session must be in 'pending' status
        - Minimum participant requirements met
        - All required participants marked as ready (if applicable)

        **Post-Start:** Session becomes active and game state updates become available
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier to start',
          example: 'session_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Session started successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Session started successfully' },
                  session: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'active' },
                      started_at: { type: 'string', format: 'date-time' },
                      participants_count: { type: 'integer' },
                      initial_state: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Session cannot be started',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Cannot start: Session is not pending' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Insufficient permissions to start session' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/{sessionId}/finish': {
    put: {
      tags: ['Game State Management'],
      summary: 'Finish/complete session',
      description: `
        **Session Completion**: Marks session as finished and processes final results.

        **Finish Process:**
        - Saves final game state
        - Calculates final scores and rankings
        - Preserves session results for analytics
        - Updates participant achievements
        - Sends completion notifications

        **Final Data Processing:**
        - Score calculations and rankings
        - Achievement and progress tracking
        - Session statistics compilation
        - Educational content completion records

        **Access Control:** Session participants, lobby owner/host, and admins can finish sessions
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Session identifier to finish',
          example: 'session_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                final_data: {
                  type: 'object',
                  properties: {
                    final_scores: {
                      type: 'object',
                      additionalProperties: { type: 'number' },
                      description: 'Final scores for all participants'
                    },
                    rankings: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          participant_id: { type: 'string' },
                          rank: { type: 'integer' },
                          score: { type: 'number' }
                        }
                      }
                    },
                    game_summary: {
                      type: 'object',
                      description: 'Summary of game events and outcomes'
                    },
                    achievements: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          participant_id: { type: 'string' },
                          achievement_type: { type: 'string' },
                          points: { type: 'number' }
                        }
                      }
                    }
                  }
                },
                reason: {
                  type: 'string',
                  enum: ['completed', 'timeout', 'manual_finish', 'error'],
                  description: 'Reason for session completion'
                },
                save_results: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to save results for analytics'
                }
              },
              required: ['final_data'],
              example: {
                final_data: {
                  final_scores: {
                    'participant_123': 280,
                    'participant_456': 240
                  },
                  rankings: [
                    { participant_id: 'participant_123', rank: 1, score: 280 },
                    { participant_id: 'participant_456', rank: 2, score: 240 }
                  ],
                  game_summary: {
                    total_rounds: 8,
                    duration_seconds: 420,
                    completion_rate: 1.0
                  }
                },
                reason: 'completed',
                save_results: true
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Session finished successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Session finished successfully' },
                  session: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'finished' },
                      finished_at: { type: 'string', format: 'date-time' },
                      final_results: { type: 'object' },
                      duration: { type: 'integer', description: 'Session duration in seconds' }
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Insufficient permissions to finish session' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-sessions/my-active': {
    get: {
      tags: ['Game Sessions', 'Student Access'],
      summary: 'Get user\'s active sessions',
      description: `
        **Personal Session Overview**: Lists all active sessions where the authenticated user is a participant.

        **Active Session Information:**
        - Session details and current status
        - Associated lobby and game information
        - Participant count and session progress
        - Join timestamps and activity status

        **Cross-Lobby Support:** Finds sessions across all lobbies and games where user participates

        **Used By:** Student dashboards, quick session access, activity tracking
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Active sessions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'session_abc123' },
                        session_number: { type: 'integer', example: 2 },
                        status: { type: 'string', enum: ['open', 'active'] },
                        started_at: { type: 'string', format: 'date-time' },
                        participants_count: { type: 'integer', example: 3 },
                        lobby: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            lobby_code: { type: 'string', example: 'MATH01' },
                            game: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                game_type: { type: 'string', example: 'memory' },
                                title: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  total: { type: 'integer', description: 'Total number of active sessions' }
                }
              }
            }
          }
        }
      }
    }
  }
};