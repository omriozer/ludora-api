// OpenAPI documentation for game endpoints
// Comprehensive game management and content integration system

export default {
  '/games/teacher/{code}': {
    get: {
      tags: ['Games'],
      summary: 'Get teacher games by invitation code',
      description: `
        **STUDENT ACCESS**: Get games for a teacher using their invitation code.
        This endpoint is specifically designed for students to access teacher games.

        Features:
        - Student access control middleware
        - Parental consent enforcement for minors
        - Complete game data with product information
        - Lobby information for game sessions
        - Teacher information validation

        Access Control:
        - Requires valid teacher invitation code
        - Enforces student access settings
        - Applies parental consent requirements

        This endpoint supports the student portal's game discovery functionality.
      `,
      parameters: [
        {
          name: 'code',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[A-Za-z0-9]{6}$'
          },
          description: 'Teacher 6-character invitation code',
          example: 'ABC123'
        }
      ],
      responses: {
        200: {
          description: 'Teacher games retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  teacher: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string', example: 'Sarah Johnson' },
                      invitation_code: { type: 'string', example: 'ABC123' }
                    }
                  },
                  games: {
                    type: 'array',
                    items: {
                      allOf: [
                        { $ref: '#/components/schemas/Game' },
                        {
                          type: 'object',
                          properties: {
                            product: { $ref: '#/components/schemas/Product', nullable: true },
                            lobbies: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/GameLobby' }
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Teacher not found or invalid invitation code',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Teacher not found' },
                  message: { type: 'string', example: 'Invalid invitation code or teacher not found' }
                }
              }
            }
          }
        },
        403: {
          description: 'Student access denied or consent required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Student access denied' },
                  reason: { type: 'string', example: 'parental_consent_required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/games': {
    get: {
      tags: ['Games'],
      summary: 'Get games for authenticated user or player',
      description: `
        Get games based on the authenticated entity type:

        **For Users (Teachers):**
        - Returns games owned by the user (via Product ownership)
        - Includes Ludora-owned games (no creator or system games)
        - Admin users see all games

        **For Players (Students):**
        - Returns all available games (no ownership restrictions)
        - Used for game discovery and joining

        Features:
        - Product ownership integration
        - Complete game data with creator information
        - Lobby information for active game sessions
        - Dual authentication support (users and players)

        Returns games sorted by creation date (newest first).
      `,
      security: [{ bearerAuth: [] }, { playerAuth: [] }],
      responses: {
        200: {
          description: 'Games retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/Game' },
                    {
                      type: 'object',
                      properties: {
                        product: { $ref: '#/components/schemas/Product', nullable: true },
                        lobbies: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/GameLobby' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        500: {
          description: 'Server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to fetch games' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['Games'],
      summary: 'Create new game',
      description: `
        **TEACHER ONLY**: Create a new game using the ProductServiceRouter.
        Only authenticated users (teachers) can create games, not players.

        Features:
        - Automatic Product record creation for ownership tracking
        - Complete game entity creation with metadata
        - Creator association and permissions setup
        - Transaction safety for multi-step operations

        The created game will be associated with the authenticated teacher
        and can be managed through the game management endpoints.
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 255,
                  description: 'Game title',
                  example: 'Math Quiz Adventure'
                },
                description: {
                  type: 'string',
                  maxLength: 2000,
                  description: 'Game description',
                  example: 'Interactive math quiz game for elementary students'
                },
                difficulty: {
                  type: 'string',
                  enum: ['easy', 'medium', 'hard'],
                  description: 'Game difficulty level'
                },
                is_published: {
                  type: 'boolean',
                  default: false,
                  description: 'Whether the game is published and available to students'
                },
                game_metadata: {
                  type: 'object',
                  description: 'Game-specific configuration and settings'
                }
              },
              required: ['title']
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Game created successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Game' },
                  {
                    type: 'object',
                    properties: {
                      product: { type: 'null', description: 'New games don\'t have products initially' }
                    }
                  }
                ]
              }
            }
          }
        },
        400: {
          description: 'Invalid game data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Validation error' },
                  details: { type: 'string', example: 'Title is required' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - players cannot create games',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' },
                  message: { type: 'string', example: 'Only teachers can create games' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/games/{id}': {
    get: {
      tags: ['Games'],
      summary: 'Get specific game with product data',
      description: `
        Retrieve a specific game by ID with complete product information.

        **Access Control:**
        - **Users (Teachers)**: Must own the game via Product ownership or be admin
        - **Players (Students)**: Can access any game (no ownership restrictions)

        Returns:
        - Complete game entity data
        - Associated product information (if exists)
        - Creator information for attribution
      `,
      security: [{ bearerAuth: [] }, { playerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID',
          example: 'game_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Game retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Game' },
                  {
                    type: 'object',
                    properties: {
                      product: { $ref: '#/components/schemas/Product', nullable: true }
                    }
                  }
                ]
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - user does not own this game',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' }
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
    put: {
      tags: ['Games'],
      summary: 'Update game',
      description: `
        **TEACHER ONLY**: Update an existing game.
        Requires game ownership via Product table or admin privileges.

        Features:
        - Product ownership validation
        - Complete game data updates
        - Transaction safety for multi-step operations
        - Automatic updated_at timestamp management

        Only authenticated teachers who own the game can perform updates.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID to update',
          example: 'game_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 255,
                  description: 'Updated game title'
                },
                description: {
                  type: 'string',
                  maxLength: 2000,
                  description: 'Updated game description'
                },
                difficulty: {
                  type: 'string',
                  enum: ['easy', 'medium', 'hard'],
                  description: 'Updated difficulty level'
                },
                is_published: {
                  type: 'boolean',
                  description: 'Publication status'
                },
                game_metadata: {
                  type: 'object',
                  description: 'Updated game configuration'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Game updated successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Game' },
                  {
                    type: 'object',
                    properties: {
                      product: { $ref: '#/components/schemas/Product', nullable: true }
                    }
                  }
                ]
              }
            }
          }
        },
        400: {
          description: 'Invalid update data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Validation error' },
                  details: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - ownership required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' },
                  message: { type: 'string', example: 'Only teachers can update games' }
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
    delete: {
      tags: ['Games'],
      summary: 'Delete game',
      description: `
        **TEACHER ONLY**: Delete a game and its associated product record.
        Requires game ownership via Product table or admin privileges.

        **WARNING**: This is a destructive operation that cannot be undone.

        Features:
        - Product ownership validation
        - Complete cleanup (game + product deletion)
        - Transaction safety for multi-step operations
        - Cascade deletion of related content

        Use with caution as this permanently removes the game and all associated data.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID to delete',
          example: 'game_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Game deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Game deleted successfully' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - ownership required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' },
                  message: { type: 'string', example: 'Only teachers can delete games' }
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
    }
  },

  '/games/{gameId}/contents': {
    get: {
      tags: ['Game Content'],
      summary: 'Get all content usage for a game',
      description: `
        Retrieve all educational content associated with a game, including
        populated content data and streaming URLs for media files.

        Features:
        - Complete content usage information with metadata
        - Populated educational content data
        - Media streaming URLs for video/audio content
        - Optional filtering by content usage type
        - Pagination support for large content sets

        Returns comprehensive content data for game content management.
      `,
      security: [{ bearerAuth: [] }, { playerAuth: [] }],
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID to get content for',
          example: 'game_abc123'
        },
        {
          name: 'use_type',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['pair', 'single_content', 'group', 'mixed_edu_contents']
          },
          description: 'Filter by content usage type'
        }
      ],
      responses: {
        200: {
          description: 'Game content retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/EduContentUse' }
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      limit: { type: 'integer' },
                      offset: { type: 'integer', default: 0 }
                    }
                  }
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
        401: { $ref: '#/components/responses/UnauthorizedError' }
      }
    }
  },

  '/games/{gameId}/content-use': {
    post: {
      tags: ['Game Content'],
      summary: 'Create new content usage for a game',
      description: `
        **TEACHER ONLY**: Associate educational content with a game by creating content usage records.

        Features:
        - Multiple content usage types (pair, single, group, mixed)
        - Support for multiple content items (1-10 items)
        - Content validation and existence checking
        - Ownership validation for game access
        - Transaction safety for multi-step operations
        - Detailed usage metadata support

        Content Sources:
        - **eduContent**: Direct educational content items
        - **eduContentUse**: Reusing existing content usage configurations

        This endpoint enables flexible game content composition and reusability.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID to add content to',
          example: 'game_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                use_type: {
                  type: 'string',
                  enum: ['pair', 'single_content', 'group', 'mixed_edu_contents'],
                  description: 'Type of content usage pattern'
                },
                contents: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 10,
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Content ID' },
                      source: {
                        type: 'string',
                        enum: ['eduContent', 'eduContentUse'],
                        description: 'Content source type'
                      }
                    },
                    required: ['id', 'source']
                  },
                  description: 'Array of content items to associate'
                },
                usage_metadata: {
                  type: 'object',
                  description: 'Additional metadata for the content usage',
                  nullable: true
                }
              },
              required: ['use_type', 'contents'],
              example: {
                use_type: 'pair',
                contents: [
                  { id: 'content_123', source: 'eduContent' },
                  { id: 'content_456', source: 'eduContent' }
                ],
                usage_metadata: {
                  difficulty_level: 'medium',
                  estimated_time: 300
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Content usage created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EduContentUse' }
            }
          }
        },
        400: {
          description: 'Invalid content usage data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Validation error' },
                  details: { type: 'string', example: 'use_type must be one of: pair, single_content, group, mixed_edu_contents' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - ownership required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' },
                  message: { type: 'string', example: 'Only teachers can create game content' }
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
    }
  },

  '/games/{gameId}/content-use/{useId}': {
    put: {
      tags: ['Game Content'],
      summary: 'Update existing content usage for a game',
      description: `
        **TEACHER ONLY**: Update an existing content usage record for a game.

        Features:
        - Update content associations and metadata
        - Content validation and existence checking
        - Ownership validation for game and content usage
        - Transaction safety for multi-step operations
        - Preserves content usage type (cannot be changed)

        This endpoint allows teachers to modify content associations
        while maintaining the content usage structure and type.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID',
          example: 'game_abc123'
        },
        {
          name: 'useId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Content usage ID to update',
          example: 'use_def456'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                contents: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 10,
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Content ID' },
                      source: {
                        type: 'string',
                        enum: ['eduContent', 'eduContentUse'],
                        description: 'Content source type'
                      }
                    },
                    required: ['id', 'source']
                  },
                  description: 'Updated content items'
                },
                usage_metadata: {
                  type: 'object',
                  description: 'Updated usage metadata',
                  nullable: true
                }
              },
              required: ['contents']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Content usage updated successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EduContentUse' }
            }
          }
        },
        400: {
          description: 'Invalid update data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Validation error' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - ownership required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' },
                  message: { type: 'string', example: 'Only teachers can update game content' }
                }
              }
            }
          }
        },
        404: {
          description: 'Game or content usage not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Content usage not found' }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      tags: ['Game Content'],
      summary: 'Delete content usage from a game',
      description: `
        **TEACHER ONLY**: Remove content usage association from a game.

        Features:
        - Ownership validation for game access
        - Transaction safety for cleanup operations
        - Preserves educational content (only removes association)
        - Complete audit trail for content management

        This removes the content usage link without deleting the underlying
        educational content, allowing for content reuse across multiple games.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID',
          example: 'game_abc123'
        },
        {
          name: 'useId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Content usage ID to delete',
          example: 'use_def456'
        }
      ],
      responses: {
        200: {
          description: 'Content usage deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Content usage deleted successfully' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Access denied - ownership required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied' },
                  message: { type: 'string', example: 'Only teachers can delete game content' }
                }
              }
            }
          }
        },
        404: {
          description: 'Game or content usage not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Content usage not found' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/games/{gameId}/content-stats': {
    get: {
      tags: ['Game Content'],
      summary: 'Get content statistics for a game',
      description: `
        Retrieve comprehensive content usage statistics for a game.

        Features:
        - Content count by usage type
        - Content source distribution
        - Usage metadata analytics
        - Performance metrics for content effectiveness

        Useful for:
        - Content management dashboards
        - Game analysis and optimization
        - Educational effectiveness tracking
      `,
      security: [{ bearerAuth: [] }, { playerAuth: [] }],
      parameters: [
        {
          name: 'gameId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Game ID to get statistics for',
          example: 'game_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Content statistics retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total_content_uses: { type: 'integer', example: 15 },
                  by_use_type: {
                    type: 'object',
                    properties: {
                      pair: { type: 'integer', example: 5 },
                      single_content: { type: 'integer', example: 8 },
                      group: { type: 'integer', example: 1 },
                      mixed_edu_contents: { type: 'integer', example: 1 }
                    }
                  },
                  by_content_source: {
                    type: 'object',
                    properties: {
                      eduContent: { type: 'integer', example: 12 },
                      eduContentUse: { type: 'integer', example: 3 }
                    }
                  },
                  unique_contents: { type: 'integer', example: 20 },
                  last_updated: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        500: {
          description: 'Server error retrieving statistics',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Internal server error' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' }
      }
    }
  }
};