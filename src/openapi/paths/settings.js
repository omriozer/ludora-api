// OpenAPI documentation for system settings endpoints
// Enhanced configuration management with ETag caching and public access patterns

export default {
  '/settings': {
    get: {
      tags: ['Settings'],
      summary: 'Get enhanced system settings',
      description: `
        **Enhanced System Configuration**: Comprehensive settings endpoint with built-in configuration enhancements and ETag support.

        **Ludora Settings Architecture:**
        - **Data-Driven Caching**: Uses ETag middleware for optimal performance
        - **Settings Validation**: System integrity checks for missing configuration keys
        - **Enhanced Configuration**: Merges core settings with static configuration data
        - **Optional Authentication**: Works for both authenticated and anonymous users

        **Settings Categories:**

        **Core Platform Settings:**
        - Student access control modes (invite_only, authed_only, all)
        - Content creator permissions (files, games, workshops, courses, lesson plans)
        - Portal management (onboarding, consent requirements)
        - Payment and subscription system toggles

        **Enhanced Configuration Data:**
        - **file_types_config** - Supported file types for upload validation
        - **study_subjects** - Educational subject categories
        - **audiance_targets** - Target audience definitions
        - **school_grades** - Grade level classifications
        - **game_types** - Available game type configurations
        - **language_options** - Supported interface languages

        **ETag Caching Integration:**
        - Automatic cache validation based on settings version
        - Client-side cache management with 304 Not Modified responses
        - Data-driven cache invalidation (never time-based expiration)

        **System Integrity Monitoring:**
        - Validates all required settings keys exist
        - Adds validation warnings to response headers for debugging
        - Graceful handling of missing configuration

        **Used By:** Frontend initialization, portal configuration, feature toggles, upload validation
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'If-None-Match',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'ETag value for cache validation (returns 304 if unchanged)',
          example: '"settings-v1.2.3-abc123"'
        }
      ],
      responses: {
        200: {
          description: 'Settings retrieved successfully',
          headers: {
            ETag: {
              schema: { type: 'string' },
              description: 'Settings version identifier for caching',
              example: '"settings-v1.2.3-def456"'
            },
            'X-Settings-Validation-Warning': {
              schema: { type: 'string' },
              description: 'System validation warning (if missing configuration keys detected)',
              example: '3 missing keys'
            },
            'Cache-Control': {
              schema: { type: 'string' },
              description: 'Cache control directives for client-side caching',
              example: 'public, max-age=300, must-revalidate'
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Complete system settings with enhanced configuration',
                properties: {
                  // Core Platform Settings
                  students_access: {
                    type: 'string',
                    enum: ['invite_only', 'authed_only', 'all'],
                    description: 'Student access control mode',
                    example: 'authed_only'
                  },
                  student_onboarding_enabled: {
                    type: 'boolean',
                    description: 'Whether student portal onboarding is enabled',
                    example: true
                  },
                  teacher_onboarding_enabled: {
                    type: 'boolean',
                    description: 'Whether teacher portal onboarding is enabled',
                    example: true
                  },
                  parent_consent_required: {
                    type: 'boolean',
                    description: 'Whether parent consent is required for under-18 students',
                    example: true
                  },
                  subscription_system_enabled: {
                    type: 'boolean',
                    description: 'Whether subscription system is active',
                    example: true
                  },

                  // Content Creator Permissions
                  allow_content_creator_files: {
                    type: 'boolean',
                    description: 'Allow content creators to create file products',
                    example: true
                  },
                  allow_content_creator_games: {
                    type: 'boolean',
                    description: 'Allow content creators to create game products',
                    example: true
                  },
                  allow_content_creator_workshops: {
                    type: 'boolean',
                    description: 'Allow content creators to create workshop products',
                    example: false
                  },
                  allow_content_creator_courses: {
                    type: 'boolean',
                    description: 'Allow content creators to create course products',
                    example: false
                  },
                  allow_content_creator_lesson_plans: {
                    type: 'boolean',
                    description: 'Allow content creators to create lesson plan products',
                    example: true
                  },

                  // Enhanced Configuration Data
                  file_types_config: {
                    type: 'object',
                    description: 'Comprehensive file type configuration for uploads',
                    properties: {
                      allowed_extensions: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['pdf', 'docx', 'pptx', 'jpg', 'png', 'mp4']
                      },
                      max_file_sizes: {
                        type: 'object',
                        properties: {
                          document: { type: 'integer', example: 52428800 },
                          image: { type: 'integer', example: 10485760 },
                          video: { type: 'integer', example: 524288000 }
                        }
                      },
                      mime_types: {
                        type: 'object',
                        description: 'MIME type mappings for validation'
                      }
                    }
                  },
                  study_subjects: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'math' },
                        name_he: { type: 'string', example: 'מתמטיקה' },
                        name_en: { type: 'string', example: 'Mathematics' },
                        emoji: { type: 'string', example: '🔢' }
                      }
                    },
                    description: 'Available educational subjects'
                  },
                  audiance_targets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'elementary' },
                        name_he: { type: 'string', example: 'יסודי' },
                        name_en: { type: 'string', example: 'Elementary' },
                        age_range: { type: 'string', example: '6-12' }
                      }
                    },
                    description: 'Target audience definitions'
                  },
                  school_grades: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'grade_3' },
                        name_he: { type: 'string', example: 'כיתה ג' },
                        name_en: { type: 'string', example: 'Grade 3' },
                        level: { type: 'integer', example: 3 }
                      }
                    },
                    description: 'School grade classifications'
                  },
                  game_types: {
                    type: 'object',
                    description: 'Available game type configurations',
                    properties: {
                      memory: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'memory' },
                          name_he: { type: 'string', example: 'משחק זיכרון' },
                          name_en: { type: 'string', example: 'Memory Game' },
                          description: { type: 'string' },
                          settings_schema: { type: 'object' }
                        }
                      }
                    }
                  },
                  languade_options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'he' },
                        name: { type: 'string', example: 'עברית' },
                        direction: { type: 'string', enum: ['ltr', 'rtl'], example: 'rtl' }
                      }
                    },
                    description: 'Supported interface languages'
                  }
                },
                example: {
                  students_access: 'authed_only',
                  student_onboarding_enabled: true,
                  teacher_onboarding_enabled: true,
                  parent_consent_required: true,
                  subscription_system_enabled: true,
                  allow_content_creator_files: true,
                  allow_content_creator_games: true,
                  allow_content_creator_workshops: false,
                  allow_content_creator_courses: false,
                  allow_content_creator_lesson_plans: true,
                  file_types_config: {
                    allowed_extensions: ['pdf', 'docx', 'pptx', 'jpg', 'png', 'mp4'],
                    max_file_sizes: {
                      document: 52428800,
                      image: 10485760,
                      video: 524288000
                    }
                  },
                  study_subjects: [
                    { id: 'math', name_he: 'מתמטיקה', name_en: 'Mathematics', emoji: '🔢' }
                  ]
                }
              }
            }
          }
        },
        304: {
          description: 'Settings unchanged (ETag matched)',
          headers: {
            ETag: {
              schema: { type: 'string' },
              description: 'Current settings version identifier'
            }
          }
        },
        500: {
          description: 'Server error retrieving settings',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to retrieve system settings' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/settings/public': {
    get: {
      tags: ['Settings', 'Public'],
      summary: 'Get public settings for Socket.IO client',
      description: `
        **Public Settings Access**: Provides essential configuration for unauthenticated Socket.IO clients.

        **Purpose:**
        - **Socket.IO Integration** - Client configuration without authentication
        - **Student Access Control** - Determines portal access requirements
        - **Privacy Compliance** - Safe fallback to most permissive setting

        **Key Setting:**
        - **students_access** - Controls how students can access the platform
          - \`invite_only\` - Requires lobby_code/session_id/teacher_invitation_code
          - \`authed_only\` - Requires user authentication
          - \`all\` - Allows anonymous and authenticated access

        **Security Features:**
        - No authentication required (public endpoint)
        - Minimal data exposure (only essential access control settings)
        - Safe fallback behavior on errors (defaults to 'all' for privacy compliance)
        - Rate limiting protection applied

        **Used By:**
        - Socket.IO client initialization
        - Student portal access validation
        - Anonymous user experience configuration
      `,
      responses: {
        200: {
          description: 'Public settings retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  students_access: {
                    type: 'string',
                    enum: ['invite_only', 'authed_only', 'all'],
                    description: 'Student access control mode for the platform'
                  }
                },
                required: ['students_access'],
                example: {
                  students_access: 'authed_only'
                }
              }
            }
          }
        },
        500: {
          description: 'Server error with safe fallback',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Failed to fetch public settings'
                  },
                  students_access: {
                    type: 'string',
                    enum: ['all'],
                    example: 'all',
                    description: 'Safe fallback value for privacy compliance'
                  }
                },
                required: ['students_access']
              }
            }
          }
        }
      }
    }
  }
};