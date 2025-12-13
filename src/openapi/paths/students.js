// OpenAPI documentation for unified student management system
// Comprehensive student management using the unified User model

export default {
  '/students/login': {
    post: {
      tags: ['Student Authentication'],
      summary: 'Student login with privacy code',
      description: `
        **Student Portal Authentication**: Primary login method for students using privacy codes.

        **Authentication Flow:**
        - Students receive privacy codes from their teachers
        - Privacy codes provide secure, non-email-based authentication
        - Creates user sessions with JWT tokens stored as httpOnly cookies
        - Unified User model for all student types

        **Cookie Management:**
        - \`student_access_token\` - 15-minute access token
        - \`student_refresh_token\` - 7-day refresh token
        - \`student_session\` - Legacy 24-hour session (compatibility)

        **Security Features:**
        - Rate limiting (auth limiter)
        - Student access middleware validation
        - Session metadata tracking (IP, user agent, login method)
        - Privacy code obfuscation in responses

        **Unified User System:** All students are Users with \`user_type: 'player'\`

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
                  description: 'Student privacy code provided by teacher or generated during creation',
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
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'user_abc123' },
                      display_name: { type: 'string', example: 'Sarah' },
                      user_type: { type: 'string', example: 'player' },
                      linked_teacher_id: {
                        type: 'string',
                        nullable: true,
                        description: 'ID of associated teacher (null for anonymous students)',
                        example: 'user_teacher123'
                      },
                      achievements: {
                        type: 'array',
                        items: { type: 'object' },
                        description: 'Student achievements and progress'
                      },
                      user_settings: {
                        type: 'object',
                        description: 'Student preferences and settings'
                      },
                      is_active: { type: 'boolean', example: true }
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

  '/students/me': {
    get: {
      tags: ['Student Authentication'],
      summary: 'Get current authenticated student identity',
      description: `
        **Unified Identity Endpoint**: Returns current student authentication status.

        **Unified User System**: All students are Users with \`user_type: 'player'\`

        **Critical Fields:**
        - \`user_type\` - Always 'player' for students
        - \`linked_teacher_id\` - Essential for frontend teacher assignment logic
        - Privacy code excluded from responses for security

        **Use Cases:**
        - Student portal initialization
        - Teacher assignment UI logic
        - Authentication state management

        **Portal Integration:** Works seamlessly with Ludora's dual-portal architecture
      `,
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: 'Current student identity retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  entityType: { type: 'string', enum: ['user'] },
                  id: { type: 'string', example: 'user_student123' },
                  user_type: { type: 'string', enum: ['player'] },
                  full_name: { type: 'string', example: 'Sarah', nullable: true },
                  linked_teacher_id: {
                    type: 'string',
                    nullable: true,
                    description: 'CRITICAL: Required for teacher assignment modal logic',
                    example: 'user_teacher123'
                  },
                  achievements: { type: 'array' },
                  user_settings: { type: 'object' },
                  is_active: { type: 'boolean' },
                  last_seen: { type: 'string', format: 'date-time' },
                  sessionType: { type: 'string', example: 'privacy_code' }
                },
                required: ['entityType', 'id', 'user_type']
              }
            }
          }
        },
        401: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Authentication required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/students/create': {
    post: {
      tags: ['Teacher Student Management'],
      summary: 'Create student user (Teacher)',
      description: `
        **Teacher-Initiated Student Creation**: Allows teachers to create student accounts for their classes.

        **Unified User System Features:**
        - Creates User with \`user_type: 'player'\`
        - Auto-assigns teacher relationship via \`linked_teacher_id\`
        - Generates privacy codes for students
        - Creates managed student accounts

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
                full_name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                  description: 'Student full name',
                  example: 'Sarah Cohen'
                },
                metadata: {
                  type: 'object',
                  description: 'Optional creation metadata',
                  example: { classroom: 'Math 3A', created_by: 'teacher_dashboard' }
                }
              },
              required: ['full_name']
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Student user created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'user_student123' },
                      privacy_code: {
                        type: 'string',
                        description: 'Privacy code for teacher distribution to student',
                        example: 'ABC789'
                      },
                      full_name: { type: 'string', example: 'Sarah Cohen' },
                      user_type: { type: 'string', example: 'player' },
                      linked_teacher_id: { type: 'string', example: 'user_teacher123' },
                      is_active: { type: 'boolean', example: true },
                      created_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid student creation data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Full name is required' }
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

  '/students': {
    get: {
      tags: ['Teacher Student Management'],
      summary: 'Get all students for teacher',
      description: `
        **Teacher Student Roster**: Comprehensive listing of all students assigned to the authenticated teacher.

        **Unified User System**: Returns Users with \`user_type: 'player'\` and matching \`linked_teacher_id\`

        **Filtering Options:**
        - Online students only
        - Pagination with limit/offset
        - Activity status filtering

        **Student Information:**
        - Complete user profiles
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
                  users: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        privacy_code: { type: 'string' },
                        full_name: { type: 'string' },
                        user_type: { type: 'string', example: 'player' },
                        linked_teacher_id: { type: 'string' },
                        achievements: { type: 'array' },
                        user_settings: { type: 'object' },
                        is_active: { type: 'boolean' },
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

  '/students/{userId}': {
    get: {
      tags: ['Teacher Student Management'],
      summary: 'Get specific student details (Teacher)',
      description: `
        **Individual Student Management**: Detailed information for specific student under teacher's management.

        **Teacher Verification:** Ensures teacher owns the requested student before revealing details.

        **Unified User System**: Works with User model where \`user_type: 'player'\`

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
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique identifier of the student user',
          example: 'user_student123'
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
                  full_name: { type: 'string' },
                  user_type: { type: 'string', example: 'player' },
                  linked_teacher_id: { type: 'string' },
                  achievements: { type: 'array' },
                  user_settings: { type: 'object' },
                  is_active: { type: 'boolean' },
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
                  error: { type: 'string', example: 'Access denied: You do not own this student' }
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
                  error: { type: 'string', example: 'Student not found' }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ['Teacher Student Management'],
      summary: 'Update student profile (Teacher)',
      description: `
        **Teacher Student Profile Management**: Allows teachers to modify their students' profiles.

        **Teacher Privileges:**
        - Update student display names
        - Modify achievements and progress
        - Adjust student preferences
        - Administrative profile corrections

        **Ownership Verification:** Ensures teacher can only modify their own students.

        **Unified User System:** Updates User model with \`user_type: 'player'\`
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student user identifier',
          example: 'user_student123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                full_name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                  example: 'Sarah Cohen (Updated)'
                },
                user_settings: {
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
                  full_name: { type: 'string' },
                  user_type: { type: 'string', example: 'player' },
                  linked_teacher_id: { type: 'string' },
                  achievements: { type: 'array' },
                  user_settings: { type: 'object' },
                  is_active: { type: 'boolean' },
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
                  error: { type: 'string', example: 'Full name must not be empty' }
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
                  error: { type: 'string', example: 'Access denied: You do not own this student' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/students/{userId}/regenerate-code': {
    post: {
      tags: ['Teacher Student Management'],
      summary: 'Regenerate student privacy code (Teacher)',
      description: `
        **Privacy Code Reset**: Generates new privacy codes for students when needed.

        **Use Cases:**
        - Student forgot their privacy code
        - Security concerns with current code
        - Code sharing issues in classroom
        - Administrative reset requirements

        **Security:** Only teachers can regenerate codes for their own students.

        **Unified User System:** Updates privacy code in User model \`user_settings\`

        **New Code Distribution:** Teachers receive new privacy codes to share with students.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student user identifier',
          example: 'user_student123'
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
                  user_id: { type: 'string', example: 'user_student123' },
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

  '/students/{userId}/deactivate': {
    post: {
      tags: ['Teacher Student Management'],
      summary: 'Deactivate student (Teacher)',
      description: `
        **Student Account Deactivation**: Safely deactivates student accounts while preserving data integrity.

        **Deactivation Process:**
        - Marks student account as inactive
        - Preserves achievement and progress data
        - Maintains audit trail for compliance
        - Prevents future login attempts

        **Data Preservation:** Student data remains for progress tracking and compliance requirements.

        **Unified User System:** Updates \`is_active\` field in User model

        **Use Cases:** Student leaving class, end of semester cleanup, account management
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Student user identifier to deactivate',
          example: 'user_student123'
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
                  message: { type: 'string', example: 'Student deactivated successfully' },
                  user_id: { type: 'string' }
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
                  error: { type: 'string', example: 'Failed to deactivate student' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/students/online': {
    get: {
      tags: ['Teacher Student Management'],
      summary: 'Get currently online students (Teacher)',
      description: `
        **Real-Time Student Activity Monitoring**: Shows which students are currently active in the platform.

        **Online Status Features:**
        - Real-time activity tracking
        - Session duration monitoring
        - Student engagement analytics
        - Classroom attendance overview

        **Unified User System:** Returns online Users with \`user_type: 'player'\`

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
                  online_users: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        full_name: { type: 'string' },
                        privacy_code: { type: 'string' },
                        user_type: { type: 'string', example: 'player' },
                        is_active: { type: 'boolean', example: true },
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

  '/students/stats': {
    get: {
      tags: ['Teacher Student Management'],
      summary: 'Get student statistics overview (Teacher)',
      description: `
        **Teacher Analytics Dashboard**: Comprehensive statistics about student engagement and performance.

        **Statistics Categories:**
        - Student enrollment and activity metrics
        - Achievement and progress analytics
        - Session duration and frequency
        - Engagement pattern analysis

        **Unified User System:** Analyzes Users with \`user_type: 'player'\`

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
                  message: { type: 'string', example: 'Student statistics retrieved successfully' },
                  teacher_id: { type: 'string' },
                  stats: {
                    type: 'object',
                    properties: {
                      total_students: { type: 'integer', example: 25 },
                      active_students: { type: 'integer', example: 18 },
                      online_students: { type: 'integer', example: 5 },
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
  }
};