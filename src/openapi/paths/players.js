// OpenAPI documentation for student authentication and player management
// Comprehensive dual-portal player system with teacher management capabilities

export default {
  '/players/login': {
    post: {
      tags: ['Player Authentication'],
      summary: 'Student login with privacy code',
      description: `
        **Student Portal Authentication**: Primary login method for students using privacy codes.

        **Authentication Flow:**
        - Students receive privacy codes from their teachers
        - Privacy codes provide secure, non-email-based authentication
        - Creates player sessions with JWT tokens stored as httpOnly cookies
        - Supports both assigned and anonymous student players

        **Cookie Management:**
        - \`student_access_token\` - 15-minute access token
        - \`student_refresh_token\` - 7-day refresh token
        - \`student_session\` - Legacy 24-hour session (compatibility)

        **Security Features:**
        - Rate limiting (auth limiter)
        - Student access middleware validation
        - Session metadata tracking (IP, user agent, login method)
        - Privacy code obfuscation in responses

        **Player Types Supported:**
        - Teacher-assigned players (have teacher_id)
        - Anonymous players (teacher_id = null)
        - Both can login using privacy codes

        **Portal Integration:** Designed for Ludora's dual-portal architecture (teacher/student)
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                privacy_code: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 20,
                  description: 'Student privacy code provided by teacher or generated during anonymous creation',
                  example: 'ABC123'
                }
              },
              required: ['privacy_code']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Student login successful',
          headers: {
            'Set-Cookie': {
              schema: { type: 'string' },
              description: 'Sets student_access_token, student_refresh_token, and student_session cookies'
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  player: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'player_abc123' },
                      display_name: { type: 'string', example: 'Sarah' },
                      teacher: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string' },
                          full_name: { type: 'string' },
                          email: { type: 'string' }
                        },
                        description: 'Associated teacher information (null for anonymous players)'
                      },
                      achievements: {
                        type: 'array',
                        items: { type: 'object' },
                        description: 'Player achievements and progress'
                      },
                      preferences: {
                        type: 'object',
                        description: 'Player preferences and settings'
                      },
                      is_online: { type: 'boolean', example: true }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid privacy code or authentication failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid privacy code' }
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
                  error: { type: 'string', example: 'Too many login attempts' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/refresh': {
    post: {
      tags: ['Player Authentication'],
      summary: 'Refresh student access token',
      description: `
        **Token Refresh for Students**: Maintains student session without re-authentication.

        **Refresh Process:**
        - Validates student_refresh_token cookie (7-day expiry)
        - Verifies player still exists and is active
        - Generates new 15-minute access token
        - Updates student_access_token cookie

        **Security Validation:**
        - Token type verification (must be 'player' type)
        - Player existence and status checks
        - JWT signature validation

        **Used By:** Student portal auto-refresh, session extension
      `,
      responses: {
        200: {
          description: 'Token refreshed successfully',
          headers: {
            'Set-Cookie': {
              schema: { type: 'string' },
              description: 'Updates student_access_token cookie'
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  player: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      display_name: { type: 'string' },
                      teacher: { type: 'object', nullable: true },
                      achievements: { type: 'array' },
                      preferences: { type: 'object' },
                      is_online: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid or expired refresh token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid or expired refresh token' }
                }
              }
            }
          }
        },
        404: {
          description: 'Player not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Player not found' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/logout': {
    post: {
      tags: ['Player Authentication'],
      summary: 'Student logout',
      description: `
        **Student Portal Logout**: Secure logout with session cleanup.

        **Logout Process:**
        - Supports unified authentication (players and admin users)
        - Invalidates player sessions in database
        - Clears all student portal cookies
        - Updates player online status

        **Cookie Cleanup:**
        - student_access_token
        - student_refresh_token
        - student_session (legacy)

        **Security Note:** Uses self-contained JWT tokens, so cookie clearing is sufficient for logout
      `,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: 'Logout successful',
          headers: {
            'Set-Cookie': {
              schema: { type: 'string' },
              description: 'Clears all student portal cookies'
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Logged out successfully' }
                }
              }
            }
          }
        },
        500: {
          description: 'Logout failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Logout failed' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/me': {
    get: {
      tags: ['Player Authentication'],
      summary: 'Get current authenticated identity',
      description: `
        **Unified Identity Endpoint**: Returns current authentication status for student portal.

        **Supports Dual Authentication:**
        - **Player Authentication** - Students logged in with privacy codes
        - **User Authentication** - Teachers/admins accessing student portal

        **Critical Fields:**
        - \`entityType\` - Identifies authentication type ('player' or 'user')
        - \`teacher_id\` - Essential for frontend teacher assignment modal logic
        - Privacy code excluded from responses for security

        **Use Cases:**
        - Student portal initialization
        - Teacher assignment UI logic
        - Authentication state management
        - User/player context switching

        **Portal Integration:** Works seamlessly with Ludora's dual-portal architecture
      `,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: 'Current identity retrieved successfully',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    title: 'Player Identity',
                    properties: {
                      entityType: { type: 'string', enum: ['player'] },
                      id: { type: 'string', example: 'player_abc123' },
                      display_name: { type: 'string', example: 'Sarah' },
                      teacher_id: {
                        type: 'string',
                        nullable: true,
                        description: 'CRITICAL: Required for teacher assignment modal logic',
                        example: 'user_teacher123'
                      },
                      teacher: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string' },
                          full_name: { type: 'string' },
                          email: { type: 'string' }
                        }
                      },
                      achievements: { type: 'array' },
                      preferences: { type: 'object' },
                      is_online: { type: 'boolean' },
                      last_seen: { type: 'string', format: 'date-time' },
                      sessionType: { type: 'string', example: 'privacy_code' }
                    },
                    required: ['entityType', 'id', 'display_name']
                  },
                  {
                    type: 'object',
                    title: 'User Identity (Teacher/Admin)',
                    properties: {
                      entityType: { type: 'string', enum: ['user'] },
                      id: { type: 'string', example: 'user_teacher123' },
                      email: { type: 'string', example: 'teacher@school.com' },
                      full_name: { type: 'string', example: 'Dr. Sarah Cohen' },
                      role: { type: 'string', enum: ['admin', 'user'] },
                      user_type: { type: 'string', enum: ['teacher', 'content_creator'] },
                      is_verified: { type: 'boolean' },
                      is_active: { type: 'boolean' }
                    },
                    required: ['entityType', 'id', 'email', 'role']
                  }
                ]
              },
              examples: {
                playerIdentity: {
                  summary: 'Student player identity',
                  value: {
                    entityType: 'player',
                    id: 'player_abc123',
                    display_name: 'Sarah',
                    teacher_id: 'user_teacher123',
                    teacher: {
                      id: 'user_teacher123',
                      full_name: 'Dr. Sarah Cohen',
                      email: 'teacher@school.com'
                    },
                    achievements: [],
                    preferences: {},
                    is_online: true,
                    sessionType: 'privacy_code'
                  }
                },
                teacherIdentity: {
                  summary: 'Teacher accessing student portal',
                  value: {
                    entityType: 'user',
                    id: 'user_teacher123',
                    email: 'teacher@school.com',
                    full_name: 'Dr. Sarah Cohen',
                    role: 'user',
                    user_type: 'teacher',
                    is_verified: true,
                    is_active: true
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'Failed to fetch authentication information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to fetch authentication information' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/create-anonymous': {
    post: {
      tags: ['Player Management'],
      summary: 'Create anonymous student player',
      description: `
        **Anonymous Student Registration**: Allows students to create accounts without teacher pre-registration.

        **Anonymous Player Features:**
        - No teacher assignment required (teacher_id = null)
        - Auto-generated privacy codes for login
        - Full access to student portal functionality
        - Can be assigned to teachers later via teacher assignment flow

        **Use Cases:**
        - Self-registration for public games
        - Student-initiated portal access
        - Teacher-less educational content consumption
        - Later assignment to teacher catalogs

        **Security:**
        - Rate limiting to prevent abuse
        - Session metadata tracking
        - Student access middleware validation

        **Returns Privacy Code:** Essential for immediate login after creation
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
                  description: 'Student display name',
                  example: 'Alex'
                },
                metadata: {
                  type: 'object',
                  description: 'Optional metadata for player creation context',
                  example: { source: 'public_game_access' }
                }
              },
              required: ['display_name']
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Anonymous player created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  player: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'player_anon123' },
                      privacy_code: {
                        type: 'string',
                        description: 'Generated privacy code for immediate login',
                        example: 'XYZ789'
                      },
                      display_name: { type: 'string', example: 'Alex' },
                      teacher_id: {
                        type: 'null',
                        description: 'Always null for anonymous players'
                      },
                      is_online: { type: 'boolean', example: true },
                      created_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid player data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Display name must not be empty' }
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
                  error: { type: 'string', example: 'Too many registration attempts' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/update-profile': {
    put: {
      tags: ['Player Management'],
      summary: 'Update current student profile',
      description: `
        **Student Profile Management**: Allows authenticated students to update their own profiles.

        **Updateable Fields:**
        - Display name modification
        - Preferences and settings
        - Achievements (append-only for security)

        **Security:**
        - Player authentication required
        - Self-service only (students can only update their own profiles)
        - Privacy code remains protected (not returned or updateable)

        **Used By:** Student profile settings, preference management, achievement tracking
      `,
      security: [{ cookieAuth: [] }],
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
                  description: 'Updated display name',
                  example: 'Alex the Great'
                },
                preferences: {
                  type: 'object',
                  description: 'Player preferences and settings',
                  example: { theme: 'dark', language: 'he' }
                },
                achievements: {
                  type: 'array',
                  description: 'Player achievements (append-only)',
                  items: { type: 'object' }
                }
              },
              minProperties: 1
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Profile updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  display_name: { type: 'string' },
                  achievements: { type: 'array' },
                  preferences: { type: 'object' },
                  is_online: { type: 'boolean' },
                  last_seen: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        401: {
          description: 'Player authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Player authentication required' }
                }
              }
            }
          }
        },
        500: {
          description: 'Profile update failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to update player profile' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/assign-teacher': {
    post: {
      tags: ['Player Management'],
      summary: 'Assign teacher to current student',
      description: `
        **Teacher Assignment for Anonymous Students**: Links anonymous students to teacher accounts.

        **Assignment Flow:**
        - Anonymous student enters teacher's catalog or content
        - Student provides teacher ID or invitation code
        - Creates teacher-student relationship
        - Grants access to teacher's content and features

        **Use Cases:**
        - Anonymous students joining teacher catalogs
        - Self-enrollment in teacher content
        - Teacher-student relationship establishment
        - Access to teacher-restricted features

        **Security:** Player authentication required, validates teacher existence
      `,
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                teacher_id: {
                  type: 'string',
                  description: 'ID of teacher to assign to current player',
                  example: 'user_teacher123'
                }
              },
              required: ['teacher_id']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Teacher assigned successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Teacher assigned successfully' },
                  teacher: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      full_name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid teacher assignment',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Teacher not found or invalid' }
                }
              }
            }
          }
        },
        401: {
          description: 'Player authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Player authentication required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/create': {
    post: {
      tags: ['Teacher Player Management'],
      summary: 'Create student player (Teacher)',
      description: `
        **Teacher-Initiated Player Creation**: Allows teachers to create student accounts for their classes.

        **Teacher Creation Features:**
        - Auto-assigns teacher relationship
        - Generates privacy codes for students
        - Creates managed student accounts
        - Provides privacy codes to teachers for distribution

        **Classroom Management:**
        - Batch student creation
        - Organized student rosters
        - Teacher oversight and control
        - Secure privacy code distribution

        **Returns Privacy Code:** Teachers receive privacy codes to share with students
      `,
      security: [{ bearerAuth: [] }],
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
                  example: 'Sarah M.'
                },
                metadata: {
                  type: 'object',
                  description: 'Optional creation metadata',
                  example: { classroom: 'Math 3A', created_by: 'teacher_dashboard' }
                }
              },
              required: ['display_name']
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Student player created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  player: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'player_teacher123' },
                      privacy_code: {
                        type: 'string',
                        description: 'Privacy code for teacher distribution to student',
                        example: 'ABC789'
                      },
                      display_name: { type: 'string', example: 'Sarah M.' },
                      teacher_id: { type: 'string', example: 'user_teacher123' },
                      is_online: { type: 'boolean', example: false },
                      created_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid player creation data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Display name is required' }
                }
              }
            }
          }
        },
        403: {
          description: 'Teacher authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Teacher access required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players': {
    get: {
      tags: ['Teacher Player Management'],
      summary: 'Get all students for teacher',
      description: `
        **Teacher Student Roster**: Comprehensive listing of all students assigned to the authenticated teacher.

        **Filtering Options:**
        - Online students only
        - Pagination with limit/offset
        - Activity status filtering

        **Student Information:**
        - Complete player profiles
        - Online status and activity
        - Privacy codes for teacher reference
        - Achievement and progress tracking

        **Classroom Management:** Essential for teacher dashboards, attendance tracking, progress monitoring
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'online_only',
          in: 'query',
          schema: { type: 'boolean' },
          description: 'Return only currently online students',
          example: false
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          description: 'Maximum number of students to return',
          example: 50
        },
        {
          name: 'offset',
          in: 'query',
          schema: { type: 'integer', minimum: 0, default: 0 },
          description: 'Number of students to skip (pagination)',
          example: 0
        }
      ],
      responses: {
        200: {
          description: 'Student roster retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  players: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        privacy_code: { type: 'string' },
                        display_name: { type: 'string' },
                        teacher_id: { type: 'string' },
                        achievements: { type: 'array' },
                        preferences: { type: 'object' },
                        is_online: { type: 'boolean' },
                        last_seen: { type: 'string', format: 'date-time' },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  count: { type: 'integer', description: 'Number of students returned' },
                  teacher_id: { type: 'string', description: 'ID of authenticated teacher' }
                }
              }
            }
          }
        },
        403: {
          description: 'Teacher authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Teacher access required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/{playerId}': {
    get: {
      tags: ['Teacher Player Management'],
      summary: 'Get specific student details (Teacher)',
      description: `
        **Individual Student Management**: Detailed information for specific student under teacher's management.

        **Teacher Verification:** Ensures teacher owns the requested student before revealing details.

        **Complete Student Profile:**
        - Personal information and preferences
        - Achievement and progress history
        - Privacy code for teacher reference
        - Activity and session information

        **Privacy Code Access:** Teachers receive privacy codes for troubleshooting student login issues.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique identifier of the student',
          example: 'player_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Student details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  privacy_code: { type: 'string', description: 'Privacy code visible to teacher' },
                  display_name: { type: 'string' },
                  teacher_id: { type: 'string' },
                  teacher: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      full_name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  },
                  achievements: { type: 'array' },
                  preferences: { type: 'object' },
                  is_online: { type: 'boolean' },
                  last_seen: { type: 'string', format: 'date-time' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (student not owned by teacher)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not own this player' }
                }
              }
            }
          }
        },
        404: {
          description: 'Student not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Player not found' }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ['Teacher Player Management'],
      summary: 'Update student profile (Teacher)',
      description: `
        **Teacher Student Profile Management**: Allows teachers to modify their students' profiles.

        **Teacher Privileges:**
        - Update student display names
        - Modify achievements and progress
        - Adjust student preferences
        - Administrative profile corrections

        **Ownership Verification:** Ensures teacher can only modify their own students.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student identifier',
          example: 'player_abc123'
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
                  example: 'Sarah M. (Updated)'
                },
                preferences: {
                  type: 'object',
                  example: { difficulty: 'advanced' }
                },
                achievements: {
                  type: 'array',
                  items: { type: 'object' }
                }
              },
              minProperties: 1
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Student profile updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  privacy_code: { type: 'string' },
                  display_name: { type: 'string' },
                  teacher_id: { type: 'string' },
                  achievements: { type: 'array' },
                  preferences: { type: 'object' },
                  is_online: { type: 'boolean' },
                  last_seen: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
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
                  error: { type: 'string', example: 'Display name must not be empty' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (student not owned by teacher)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not own this player' }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      tags: ['Teacher Player Management'],
      summary: 'Deactivate student (Teacher)',
      description: `
        **Student Account Deactivation**: Safely deactivates student accounts while preserving data integrity.

        **Deactivation Process:**
        - Marks student account as inactive
        - Preserves achievement and progress data
        - Maintains audit trail for compliance
        - Prevents future login attempts

        **Data Preservation:** Student data remains for progress tracking and compliance requirements.

        **Use Cases:** Student leaving class, end of semester cleanup, account management
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student identifier to deactivate',
          example: 'player_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Student deactivated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Player deactivated successfully' },
                  player_id: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          description: 'Deactivation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to deactivate player' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/{playerId}/regenerate-code': {
    post: {
      tags: ['Teacher Player Management'],
      summary: 'Regenerate student privacy code (Teacher)',
      description: `
        **Privacy Code Reset**: Generates new privacy codes for students when needed.

        **Use Cases:**
        - Student forgot their privacy code
        - Security concerns with current code
        - Code sharing issues in classroom
        - Administrative reset requirements

        **Security:** Only teachers can regenerate codes for their own students.

        **New Code Distribution:** Teachers receive new privacy codes to share with students.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student identifier',
          example: 'player_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Privacy code regenerated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  player_id: { type: 'string', example: 'player_abc123' },
                  new_privacy_code: {
                    type: 'string',
                    description: 'New privacy code for student login',
                    example: 'XYZ987'
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Code regeneration failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to regenerate privacy code' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/online/list': {
    get: {
      tags: ['Teacher Player Management'],
      summary: 'Get currently online students (Teacher)',
      description: `
        **Real-Time Student Activity Monitoring**: Shows which students are currently active in the platform.

        **Online Status Features:**
        - Real-time activity tracking
        - Session duration monitoring
        - Student engagement analytics
        - Classroom attendance overview

        **Teacher Dashboard Integration:** Essential for monitoring live classroom activities and student participation.
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Online students retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  online_players: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        display_name: { type: 'string' },
                        privacy_code: { type: 'string' },
                        is_online: { type: 'boolean', example: true },
                        last_seen: { type: 'string', format: 'date-time' },
                        session_duration: { type: 'integer', description: 'Session duration in minutes' }
                      }
                    }
                  },
                  count: { type: 'integer', description: 'Number of online students' },
                  teacher_id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/stats/overview': {
    get: {
      tags: ['Teacher Player Management'],
      summary: 'Get student statistics overview (Teacher)',
      description: `
        **Teacher Analytics Dashboard**: Comprehensive statistics about student engagement and performance.

        **Statistics Categories:**
        - Student enrollment and activity metrics
        - Achievement and progress analytics
        - Session duration and frequency
        - Engagement pattern analysis

        **Dashboard Integration:** Powers teacher analytics, progress reports, and classroom insights.
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Student statistics retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Player statistics retrieved successfully' },
                  teacher_id: { type: 'string' },
                  stats: {
                    type: 'object',
                    properties: {
                      total_players: { type: 'integer', example: 25 },
                      active_players: { type: 'integer', example: 18 },
                      online_players: { type: 'integer', example: 5 },
                      avg_session_duration: { type: 'number', example: 32.5 },
                      total_achievements: { type: 'integer', example: 127 },
                      activity_trends: {
                        type: 'object',
                        properties: {
                          daily_active: { type: 'array', items: { type: 'integer' } },
                          weekly_growth: { type: 'number', example: 0.15 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/{playerId}/sessions': {
    get: {
      tags: ['Teacher Session Management'],
      summary: 'Get student session history (Teacher Admin)',
      description: `
        **Student Session Audit**: Detailed session history for individual students.

        **Session Information:**
        - Login/logout timestamps
        - Session duration tracking
        - Device and location metadata
        - Activity during sessions

        **Teacher Administration:** Essential for monitoring student activity, troubleshooting access issues, ensuring appropriate usage.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student identifier',
          example: 'player_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Student session history retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Sessions for player player_abc123 retrieved successfully' },
                  player_id: { type: 'string' },
                  sessions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        login_time: { type: 'string', format: 'date-time' },
                        logout_time: { type: 'string', format: 'date-time', nullable: true },
                        duration: { type: 'integer', description: 'Session duration in minutes' },
                        device_info: { type: 'object' },
                        ip_address: { type: 'string' },
                        is_active: { type: 'boolean' }
                      }
                    }
                  },
                  count: { type: 'integer' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (student not owned by teacher)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not own this player' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/players/{playerId}/logout': {
    post: {
      tags: ['Teacher Session Management'],
      summary: 'Force logout student (Teacher Admin)',
      description: `
        **Administrative Student Logout**: Allows teachers to forcefully logout their students.

        **Force Logout Features:**
        - Immediate session termination
        - Cookie invalidation
        - Online status update
        - Security incident response

        **Use Cases:**
        - Emergency session termination
        - Inappropriate usage intervention
        - End-of-class session cleanup
        - Security breach response

        **Teacher Administration:** Essential for classroom management and security enforcement.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student identifier to logout',
          example: 'player_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Student logged out successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Player player_abc123 logged out successfully' },
                  player_id: { type: 'string' }
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (student not owned by teacher)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access denied: You do not own this player' }
                }
              }
            }
          }
        }
      }
    }
  }
};