// OpenAPI documentation for game lobby management
// Comprehensive multiplayer lobby system with real-time session coordination

export default {
  '/games/{gameId}/lobbies': {
    get: {
      tags: ['Game Lobbies', 'Student Access'],
      summary: 'List active lobbies for a game',
      description: `
        **Student-Facing Game Discovery**: Lists available lobbies for students to join games.

        **Dual Access Model:**
        - **Authenticated Users** - Teachers/admins get full lobby details with ownership validation
        - **Anonymous Students** - Get filtered lobby information for safe public access

        **Lobby Status Types:**
        - **open** - Active lobby accepting new participants
        - **open_indefinitely** - Lobby without expiration date
        - **closed** - Lobby no longer accepting participants
        - **expired** - Lobby past expiration date

        **Access Control Features:**
        - Student access middleware with consent enforcement
        - Owner/creator permission validation for authenticated users
        - Anonymous access for public game discovery
        - Filtered sensitive data for anonymous users

        **Used By:** Student game browsers, teacher lobby management dashboards
      `,
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique identifier of the game',
          example: 'game_memory123'
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          description: 'Maximum number of lobbies to return',
          example: 20
        },
        {
          name: 'offset',
          in: 'query',
          schema: { type: 'integer', minimum: 0, default: 0 },
          description: 'Number of lobbies to skip for pagination',
          example: 0
        },
        {
          name: 'expired',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Filter by expiration status (true=expired only, false=active only)',
          example: false
        }
      ],
      responses: {
        200: {
          description: 'Lobbies retrieved successfully',
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
                        id: { type: 'string', example: 'lobby_abc123' },
                        lobby_code: { type: 'string', example: 'MATH01' },
                        game_id: { type: 'string' },
                        status: {
                          type: 'string',
                          enum: ['open', 'open_indefinitely', 'closed', 'expired'],
                          description: 'Computed lobby status'
                        },
                        created_at: { type: 'string', format: 'date-time' },
                        expires_at: {
                          type: 'string',
                          format: 'date-time',
                          nullable: true,
                          description: 'Lobby expiration (null for indefinite)'
                        },
                        settings: {
                          type: 'object',
                          properties: {
                            allow_guest_users: { type: 'boolean' },
                            max_players_per_session: { type: 'integer' },
                            invitation_type: {
                              type: 'string',
                              enum: ['manual_selection', 'order'],
                              description: 'How students join sessions'
                            }
                          },
                          description: 'Lobby configuration (filtered for anonymous users)'
                        },
                        owner: {
                          type: 'object',
                          description: 'Only visible to authenticated users',
                          properties: {
                            id: { type: 'string' },
                            full_name: { type: 'string' }
                          }
                        },
                        active_sessions_count: {
                          type: 'integer',
                          description: 'Number of active sessions (authenticated users only)'
                        }
                      }
                    }
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      limit: { type: 'integer' },
                      offset: { type: 'integer' },
                      has_more: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied for authenticated users',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not own this game' }
                }
              }
            }
          }
        },
        404: {
          description: 'Game not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Game not found' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['Game Lobbies', 'Teacher Management'],
      summary: 'Create new game lobby',
      description: `
        **Teacher Lobby Creation**: Allows teachers to create multiplayer game lobbies for their students.

        **Lobby Configuration:**
        - **Expiration Management** - Set lobby duration and automatic closure
        - **Invitation Types** - Control how students join sessions
        - **Guest Access** - Allow anonymous student participation
        - **Session Limits** - Configure maximum concurrent sessions

        **Invitation Types:**
        - **manual_selection** - Students choose which session to join from a list
        - **order** - Students are automatically assigned to sessions in order

        **Ownership Validation:** Only game owners/creators and admins can create lobbies

        **Rate Limiting:** Protected against lobby spam with rate limiting
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique identifier of the game',
          example: 'game_memory123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                lobby_code: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 20,
                  pattern: '^[A-Z0-9]+$',
                  description: 'Unique lobby code for students to join (auto-generated if not provided)',
                  example: 'MATH01'
                },
                expires_at: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When lobby should automatically close (omit for indefinite)',
                  example: '2025-12-11T16:00:00Z'
                },
                settings: {
                  type: 'object',
                  properties: {
                    invitation_type: {
                      type: 'string',
                      enum: ['manual_selection', 'order'],
                      default: 'manual_selection',
                      description: 'How students join sessions in this lobby'
                    },
                    allow_guest_users: {
                      type: 'boolean',
                      default: true,
                      description: 'Allow anonymous students to participate'
                    },
                    max_players_per_session: {
                      type: 'integer',
                      minimum: 2,
                      maximum: 20,
                      default: 4,
                      description: 'Maximum students per game session'
                    },
                    max_sessions: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 50,
                      default: 10,
                      description: 'Maximum concurrent sessions in lobby'
                    }
                  }
                }
              },
              example: {
                lobby_code: 'MATH01',
                expires_at: '2025-12-11T16:00:00Z',
                settings: {
                  invitation_type: 'manual_selection',
                  allow_guest_users: true,
                  max_players_per_session: 4,
                  max_sessions: 10
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Lobby created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'lobby_abc123' },
                  lobby_code: { type: 'string', example: 'MATH01' },
                  game_id: { type: 'string' },
                  owner_user_id: { type: 'string' },
                  host_user_id: { type: 'string' },
                  status: { type: 'string', example: 'open' },
                  expires_at: { type: 'string', format: 'date-time', nullable: true },
                  settings: { type: 'object' },
                  created_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid lobby configuration',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Lobby code already exists for this game' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (not game owner)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not own this game' }
                }
              }
            }
          }
        },
        404: {
          description: 'Game not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Game not found' }
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
                  error: { type: 'string', example: 'Too many lobby requests, please try again later' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-lobbies/{lobbyId}': {
    get: {
      tags: ['Game Lobbies', 'Teacher Management'],
      summary: 'Get detailed lobby information',
      description: `
        **Detailed Lobby Management**: Comprehensive lobby information for teachers and admins.

        **Complete Lobby Details:**
        - Lobby configuration and settings
        - Associated game information
        - Owner and host details
        - Active sessions with participant counts
        - Computed status and expiration info

        **Access Control:** Only lobby owners, hosts, game owners, and admins can view full details

        **Used By:** Teacher dashboard, lobby management UI, admin tools
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'lobbyId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique identifier of the lobby',
          example: 'lobby_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Lobby details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  lobby_code: { type: 'string' },
                  game_id: { type: 'string' },
                  computed_status: {
                    type: 'string',
                    enum: ['open', 'open_indefinitely', 'closed', 'expired']
                  },
                  settings: {
                    type: 'object',
                    properties: {
                      invitation_type: { type: 'string' },
                      allow_guest_users: { type: 'boolean' },
                      max_players_per_session: { type: 'integer' },
                      max_sessions: { type: 'integer' }
                    }
                  },
                  game: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      game_type: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' }
                    }
                  },
                  owner: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      full_name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  },
                  host: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      full_name: { type: 'string' }
                    }
                  },
                  active_sessions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        session_number: { type: 'integer' },
                        participants_count: { type: 'integer' },
                        status: { type: 'string' },
                        started_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  created_at: { type: 'string', format: 'date-time' },
                  expires_at: { type: 'string', format: 'date-time', nullable: true }
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
                  error: { type: 'string', example: 'Access denied: You do not have permission to view this lobby' }
                }
              }
            }
          }
        },
        404: {
          description: 'Lobby not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Lobby not found' }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ['Game Lobbies', 'Teacher Management'],
      summary: 'Update lobby settings',
      description: `
        **Lobby Configuration Updates**: Modify lobby settings for active lobbies.

        **Updateable Settings:**
        - Invitation type changes
        - Guest access permissions
        - Player limits per session
        - Maximum session counts

        **Access Control:** Only lobby owner, host, and admins can update settings

        **Live Updates:** Changes apply immediately to active lobby without disrupting ongoing sessions
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'lobbyId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Lobby identifier',
          example: 'lobby_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                settings: {
                  type: 'object',
                  properties: {
                    invitation_type: {
                      type: 'string',
                      enum: ['manual_selection', 'order']
                    },
                    allow_guest_users: { type: 'boolean' },
                    max_players_per_session: {
                      type: 'integer',
                      minimum: 2,
                      maximum: 20
                    },
                    max_sessions: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 50
                    }
                  }
                }
              },
              example: {
                settings: {
                  invitation_type: 'order',
                  allow_guest_users: false,
                  max_players_per_session: 6
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Lobby settings updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Updated lobby details with new settings'
              }
            }
          }
        },
        403: {
          description: 'Access denied (not owner or host)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: Only lobby owner or host can update settings' }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      tags: ['Game Lobbies', 'Teacher Management'],
      summary: 'Close/delete lobby',
      description: `
        **Lobby Closure**: Permanently closes lobby and ends all active sessions.

        **Closure Process:**
        - Marks lobby as closed
        - Finishes all active sessions
        - Prevents new participants from joining
        - Preserves session data for historical records

        **Access Control:** Only lobby owner, host, and admins can close lobbies

        **Data Preservation:** Session results and participant data remain for analytics
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'lobbyId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Lobby identifier to close',
          example: 'lobby_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Lobby closed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Lobby closed successfully' },
                  lobby: {
                    type: 'object',
                    description: 'Closed lobby details'
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
                  error: { type: 'string', example: 'Access denied: Only lobby owner or host can close lobby' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-lobbies/{lobbyId}/activate': {
    put: {
      tags: ['Game Lobbies', 'Teacher Management'],
      summary: 'Activate lobby with enhanced settings',
      description: `
        **Lobby Activation**: Transitions lobby from draft to active state with enhanced configuration.

        **Activation Features:**
        - Set custom expiration times
        - Configure maximum session limits
        - Enable session management features
        - Apply final configuration settings

        **Enhanced Configuration:**
        - Custom session duration limits
        - Advanced participant management
        - Real-time session monitoring
        - Automatic session cleanup

        **Access Control:** Only lobby owner, host, and admins can activate lobbies
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'lobbyId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Lobby identifier to activate',
          example: 'lobby_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                expires_at: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Custom expiration time (omit for indefinite)',
                  example: '2025-12-11T17:00:00Z'
                },
                max_sessions: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 50,
                  description: 'Maximum concurrent sessions for this activation'
                },
                session_settings: {
                  type: 'object',
                  properties: {
                    auto_start_delay: {
                      type: 'integer',
                      description: 'Seconds to wait before auto-starting sessions'
                    },
                    session_timeout: {
                      type: 'integer',
                      description: 'Session timeout in minutes'
                    }
                  }
                }
              },
              example: {
                expires_at: '2025-12-11T17:00:00Z',
                max_sessions: 15,
                session_settings: {
                  auto_start_delay: 30,
                  session_timeout: 60
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Lobby activated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Activated lobby with enhanced settings'
              }
            }
          }
        },
        400: {
          description: 'Invalid activation settings',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Max sessions exceeds game limit of 30' }
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
                  error: { type: 'string', example: 'Access denied: Only lobby owner can activate' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-lobbies/join-by-code': {
    post: {
      tags: ['Game Lobbies', 'Student Access'],
      summary: 'Join lobby using lobby code',
      description: `
        **Student Lobby Discovery**: Primary method for students to find and validate lobbies before joining.

        **Authentication Model:**
        - **Authenticated Players** - Uses player authentication with teacher connection validation
        - **Anonymous Students** - Supported if lobby allows guest users
        - **Teacher Connection Requirement** - Authenticated players must have teacher assignments

        **Lobby Validation:**
        - Verifies lobby code exists and is active
        - Checks guest user permissions
        - Validates lobby status (open/expired)
        - Returns lobby info for manual session selection

        **Response Based on Invitation Type:**
        - **manual_selection** - Returns lobby details with available sessions
        - **order** - Returns basic lobby info for automatic assignment

        **Used By:** Student lobby browser, join game workflow
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                lobby_code: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 20,
                  pattern: '^[A-Z0-9]+$',
                  description: 'Lobby code to join',
                  example: 'MATH01'
                },
                participant: {
                  type: 'object',
                  properties: {
                    display_name: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 100,
                      description: 'Student display name (used if not authenticated)',
                      example: 'Alex'
                    },
                    guest_token: {
                      type: 'string',
                      description: 'Unique guest identifier for anonymous students'
                    }
                  },
                  description: 'Participant data (used for anonymous students)',
                  required: ['display_name']
                }
              },
              required: ['lobby_code'],
              example: {
                lobby_code: 'MATH01',
                participant: {
                  display_name: 'Alex',
                  guest_token: 'guest_abc123'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Lobby found and available for joining',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Lobby found and available for joining' },
                  lobby: {
                    oneOf: [
                      {
                        title: 'Manual Selection Lobby',
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          lobby_code: { type: 'string' },
                          game: { type: 'object' },
                          settings: { type: 'object' },
                          active_sessions: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                session_number: { type: 'integer' },
                                participants_count: { type: 'integer' },
                                max_players: { type: 'integer' },
                                available_spots: { type: 'integer' }
                              }
                            },
                            description: 'Available sessions for manual selection'
                          }
                        }
                      },
                      {
                        title: 'Order Assignment Lobby',
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          lobby_code: { type: 'string' },
                          game: { type: 'object' },
                          status: { type: 'string' },
                          settings: { type: 'object' },
                          can_join: { type: 'boolean', example: true }
                        }
                      }
                    ]
                  }
                }
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
                  error: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' }
                },
                examples: [
                  {
                    error: 'Teacher connection required',
                    message: 'You must be connected to a teacher before accessing content',
                    code: 'TEACHER_CONNECTION_REQUIRED'
                  },
                  {
                    error: 'Guest users are not allowed in this lobby',
                    message: 'Please log in to join this lobby'
                  }
                ]
              }
            }
          }
        },
        404: {
          description: 'Lobby not found or not available',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Lobby not found or not available for joining' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/game-lobbies/{lobbyId}/join': {
    post: {
      tags: ['Game Lobbies', 'Student Access'],
      summary: 'Join specific lobby with session creation',
      description: `
        **Smart Lobby Joining**: Joins lobby with automatic session assignment based on invitation type.

        **Invitation Type Handling:**
        - **manual_selection** - Requires session_id parameter, joins specified session
        - **order** - Automatic assignment to first available session or creates new session

        **Session Creation Logic:**
        - Finds sessions with available spots
        - Creates new sessions when existing ones are full
        - Respects lobby's maximum session limits
        - Auto-increments session numbers

        **Authentication Integration:**
        - Uses authenticated player data when available
        - Falls back to participant data for anonymous users
        - Validates teacher connections for authenticated players
        - Supports guest tokens for anonymous access

        **Real-Time Updates:** Returns complete participant information with generated IDs for session management
      `,
      parameters: [
        {
          name: 'lobbyId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Lobby identifier to join',
          example: 'lobby_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                participant: {
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
                      description: 'Authenticated user ID (if applicable)',
                      nullable: true
                    },
                    guest_token: {
                      type: 'string',
                      description: 'Guest identifier for anonymous students',
                      nullable: true
                    }
                  },
                  required: ['display_name']
                },
                session_id: {
                  type: 'string',
                  description: 'Required for manual_selection lobbies - session to join',
                  example: 'session_def456'
                }
              },
              required: ['participant'],
              example: {
                participant: {
                  display_name: 'Sarah',
                  guest_token: 'guest_xyz789'
                },
                session_id: 'session_def456'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Successfully joined lobby',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Successfully joined lobby' },
                  lobby: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      lobby_code: { type: 'string' },
                      invitation_type: { type: 'string' },
                      game: { type: 'object' }
                    }
                  },
                  session: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'session_def456' },
                      session_number: { type: 'integer', example: 1 },
                      participants_count: { type: 'integer', example: 2 },
                      created: {
                        type: 'boolean',
                        description: 'True if session was created during join process'
                      }
                    }
                  },
                  participant: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Generated participant ID for session' },
                      display_name: { type: 'string' },
                      isAuthedUser: { type: 'boolean' },
                      team_assignment: { type: 'string', nullable: true }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid join request',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                },
                examples: [
                  { error: 'Session ID required for manual selection invitation type' },
                  { error: 'Maximum number of sessions (10) reached for this lobby' }
                ]
              }
            }
          }
        },
        403: {
          description: 'Join restrictions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' }
                },
                examples: [
                  {
                    error: 'Teacher connection required',
                    message: 'You must be connected to a teacher before joining games',
                    code: 'TEACHER_CONNECTION_REQUIRED'
                  },
                  {
                    error: 'Lobby is not open for joining (status: closed)'
                  }
                ]
              }
            }
          }
        },
        404: {
          description: 'Lobby or session not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Specified session not found' }
                }
              }
            }
          }
        }
      }
    }
  }
};