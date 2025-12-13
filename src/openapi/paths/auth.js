// OpenAPI documentation for authentication endpoints
// Comprehensive authentication system with dual portal support, student consent management, and admin controls

export default {
  '/auth/register': {
    post: {
      tags: ['Authentication'],
      summary: 'Register a new user account',
      description: `
        Create a new user account in the Ludora system with automatic portal detection
        and session establishment.

        Features:
        - Dual portal support (teacher/student)
        - Automatic welcome email sending
        - Session creation with comprehensive metadata
        - Portal-specific cookie configuration
        - User data validation and sanitization

        The registration process automatically sets portal-specific httpOnly cookies
        for secure authentication management.
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address'
                },
                password: {
                  type: 'string',
                  minLength: 8,
                  description: 'User password (minimum 8 characters)'
                },
                fullName: {
                  type: 'string',
                  minLength: 2,
                  description: 'User full name'
                },
                userType: {
                  type: 'string',
                  enum: ['teacher', 'student'],
                  description: 'Type of user account'
                },
                phone: {
                  type: 'string',
                  nullable: true,
                  description: 'User phone number'
                },
                educationLevel: {
                  type: 'string',
                  nullable: true,
                  description: 'Education level for teachers'
                },
                birthDate: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  description: 'User birth date'
                }
              },
              required: ['email', 'password', 'fullName'],
              example: {
                email: 'teacher@example.com',
                password: 'SecurePass123',
                fullName: 'Sarah Johnson',
                userType: 'teacher',
                phone: '+972-50-123-4567',
                educationLevel: 'Master\'s Degree'
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'User registered successfully',
          headers: {
            'Set-Cookie': {
              description: 'Portal-specific authentication cookies',
              schema: {
                type: 'string',
                example: 'teacher_access_token=jwt_token; HttpOnly; Secure; Path=/'
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  user: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        400: {
          description: 'Registration validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Email already exists' }
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

  '/auth/refresh': {
    post: {
      tags: ['Authentication'],
      summary: 'Refresh access token using refresh token cookie',
      description: `
        Refresh the access token using the portal-specific refresh token cookie.
        Used to maintain authentication without requiring user re-login.

        Features:
        - Portal-aware token refresh
        - Automatic portal detection
        - Session validation and extension
        - New access token generation with extended expiry

        The refresh token is automatically read from portal-specific cookies.
      `,
      security: [{ refreshTokenCookie: [] }],
      responses: {
        200: {
          description: 'Token refreshed successfully',
          headers: {
            'Set-Cookie': {
              description: 'Updated access token cookie',
              schema: {
                type: 'string',
                example: 'teacher_access_token=new_jwt_token; HttpOnly; Secure; Path=/'
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  user: { $ref: '#/components/schemas/User' }
                }
              }
            }
          }
        },
        401: {
          description: 'Refresh token missing or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Refresh token required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/auth/logout': {
    post: {
      tags: ['Authentication'],
      summary: 'Logout user and clear authentication cookies',
      description: `
        Logout the current user with comprehensive session cleanup.

        Features:
        - Portal-specific session invalidation
        - Refresh token revocation from database
        - Complete cookie cleanup with proper domain settings
        - User session tracking and audit logging

        This endpoint safely handles logout even if tokens are invalid or expired.
      `,
      responses: {
        200: {
          description: 'Logout successful',
          headers: {
            'Set-Cookie': {
              description: 'Cleared authentication cookies',
              schema: {
                type: 'array',
                items: { type: 'string' },
                example: [
                  'teacher_access_token=; HttpOnly; Secure; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                  'teacher_refresh_token=; HttpOnly; Secure; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
                ]
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Logged out from teacher portal successfully' }
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

  '/auth/me': {
    get: {
      tags: ['Authentication'],
      summary: 'Get current authenticated user or student information',
      description: `
        Retrieve comprehensive information about the currently authenticated entity.
        Supports both user accounts (teachers/students) and game students.

        **User Authentication:**
        - Complete user profile data
        - Computed onboarding completion status
        - Portal-specific information
        - Automatic student user type assignment for student portal

        **Student Authentication:**
        - Student session information
        - Teacher association data
        - Game-specific student data

        Features:
        - ETag support for efficient caching
        - Comprehensive session metadata
        - Portal-aware data processing
        - Settings-cached computation for performance
      `,
      security: [{ bearerAuth: [] }, { studentAuth: [] }],
      responses: {
        200: {
          description: 'User or student information retrieved successfully',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    description: 'User authentication response',
                    properties: {
                      entityType: { type: 'string', example: 'user' },
                      id: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                      full_name: { type: 'string' },
                      phone: { type: 'string', nullable: true },
                      education_level: { type: 'string', nullable: true },
                      specializations: { type: 'array', items: { type: 'string' } },
                      content_creator_agreement_sign_date: { type: 'string', format: 'date-time', nullable: true },
                      role: { type: 'string', enum: ['user', 'admin', 'sysadmin'] },
                      user_type: { type: 'string', enum: ['teacher', 'student'], nullable: true },
                      is_verified: { type: 'boolean' },
                      is_active: { type: 'boolean' },
                      onboarding_completed: { type: 'boolean', description: 'Computed field based on profile completeness' },
                      birth_date: { type: 'string', format: 'date', nullable: true },
                      invitation_code: { type: 'string', nullable: true },
                      linked_teacher_id: { type: 'string', nullable: true },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' },
                      last_login: { type: 'string', format: 'date-time', nullable: true }
                    }
                  },
                  {
                    type: 'object',
                    description: 'Student authentication response',
                    properties: {
                      entityType: { type: 'string', example: 'user' },
                      id: { type: 'string' },
                      user_type: { type: 'string', example: 'player' },
                      privacy_code: { type: 'string' },
                      display_name: { type: 'string' },
                      linked_teacher_id: { type: 'string', nullable: true },
                      teacher: { $ref: '#/components/schemas/User', nullable: true },
                      achievements: { type: 'object' },
                      user_settings: { type: 'object' },
                      is_active: { type: 'boolean' },
                      sessionType: { type: 'string' }
                    }
                  }
                ]
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
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

  '/auth/verify': {
    post: {
      tags: ['Authentication'],
      summary: 'Verify Firebase ID token and establish session',
      description: `
        Verify a Firebase ID token and establish an authenticated session with comprehensive
        portal integration and automatic user type assignment.

        **Firebase Integration:**
        - Validates Firebase ID tokens
        - Establishes local session with database persistence
        - Portal-aware authentication flow
        - Automatic student type assignment on student portal

        **Session Management:**
        - Creates UserSession records in database
        - Generates access and refresh token pairs
        - Sets portal-specific httpOnly cookies
        - Comprehensive audit logging

        **Student Portal Features:**
        - Automatic user_type='student' assignment for null user types
        - Portal detection and appropriate cookie configuration
        - Student access control integration
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                idToken: {
                  type: 'string',
                  description: 'Firebase ID token from client-side authentication',
                  example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjY4YzU...'
                }
              },
              required: ['idToken']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Token verified successfully, session established',
          headers: {
            'Set-Cookie': {
              description: 'Portal-specific authentication cookies',
              schema: {
                type: 'array',
                items: { type: 'string' },
                example: [
                  'student_access_token=jwt_token; HttpOnly; Secure; Path=/',
                  'student_refresh_token=refresh_token; HttpOnly; Secure; Path=/'
                ]
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean', example: true },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                      full_name: { type: 'string' },
                      role: { type: 'string' },
                      is_verified: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'ID token missing',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'ID token is required' }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid or expired token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Invalid or expired token' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/auth/consent-status': {
    get: {
      tags: ['Student Management'],
      summary: 'Check student consent and teacher linking status',
      description: `
        **STUDENT ONLY**: Check the current consent and teacher linking status for a student account.
        Used by the student portal to determine required onboarding steps.

        **Status Types:**
        - \`complete\` - Student has linked teacher and active parent consent
        - \`needs_teacher\` - Student needs to link to a teacher
        - \`needs_consent\` - Student has teacher but needs parent consent
        - \`consent_revoked\` - Parent consent was revoked
        - \`not_applicable\` - Not a student account

        **Israeli Privacy Law Compliance:**
        This endpoint supports the parental consent system required for students under 18.
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Consent status retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  needs_teacher: { type: 'boolean', description: 'Whether student needs to link to a teacher' },
                  needs_consent: { type: 'boolean', description: 'Whether student needs parent consent' },
                  status: {
                    type: 'string',
                    enum: ['complete', 'needs_teacher', 'needs_consent', 'consent_revoked', 'not_applicable'],
                    description: 'Overall consent status'
                  },
                  linked_teacher_id: { type: 'string', nullable: true, description: 'ID of linked teacher' },
                  has_parent_consent: { type: 'boolean', description: 'Whether student has active parent consent' },
                  has_consent_record: { type: 'boolean', description: 'Whether any consent record exists' },
                  consent_revoked: { type: 'boolean', description: 'Whether consent was revoked' },
                  revocation_info: {
                    type: 'object',
                    nullable: true,
                    description: 'Information about consent revocation if applicable'
                  }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        500: {
          description: 'Failed to check consent status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to check consent status' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/auth/link-teacher': {
    post: {
      tags: ['Student Management'],
      summary: 'Link student to teacher using invitation code',
      description: `
        **STUDENT ONLY**: Link a student account to a teacher using the teacher's 6-character invitation code.

        **Security Features:**
        - Rate limiting (3 attempts per 15 minutes)
        - Invitation code format validation (6 alphanumeric characters)
        - Comprehensive audit logging
        - Transaction safety for database operations

        **Validation:**
        - Student must not already be linked to a teacher
        - Invitation code must be valid and belong to an active teacher
        - Teacher account must be fully set up

        **Privacy Compliance:**
        This is the first step in the student consent process required by Israeli privacy law.
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                invitation_code: {
                  type: 'string',
                  pattern: '^[A-Z0-9]{6}$',
                  description: 'Teacher 6-character invitation code',
                  example: 'ABC123'
                }
              },
              required: ['invitation_code']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Student linked to teacher successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Successfully linked to teacher' },
                  teacher: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      full_name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  },
                  linked_teacher_id: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request or student already linked',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  code: { type: 'string', example: 'ALREADY_LINKED' },
                  current_teacher_id: { type: 'string', nullable: true }
                }
              },
              examples: {
                alreadyLinked: {
                  summary: 'Student already linked',
                  value: {
                    error: 'Student is already linked to a teacher',
                    code: 'ALREADY_LINKED',
                    current_teacher_id: 'teacher_123'
                  }
                },
                invalidFormat: {
                  summary: 'Invalid invitation code format',
                  value: {
                    error: 'Invalid invitation code format. Code must be 6 characters.'
                  }
                },
                teacherNotSetup: {
                  summary: 'Teacher account incomplete',
                  value: {
                    error: 'Teacher account is not fully set up. Please contact your teacher.'
                  }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: {
          description: 'Only students can link to teachers',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Only students can link to teachers' }
                }
              }
            }
          }
        },
        404: {
          description: 'Invalid invitation code',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid invitation code or teacher not found' }
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
                  error: { type: 'string', example: 'Too many invitation code attempts' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/auth/validate-admin-password': {
    post: {
      tags: ['Admin - Access Control'],
      summary: 'Anonymous admin password validation',
      description: `
        **ANONYMOUS ACCESS**: Validate admin password for maintenance mode bypass.
        Used when student portal access is restricted to invite-only mode.

        **Security Features:**
        - Timing-safe password comparison
        - Rate limiting for brute force protection
        - Cryptographically secure token generation
        - Portal-aware audience validation
        - Comprehensive audit logging

        **Token Generation:**
        - 24-hour expiration
        - Unique session ID and nonce
        - JWT with portal-specific audience
        - HttpOnly cookie for XSS protection

        This endpoint enables emergency administrative access when normal authentication is unavailable.
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                password: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 100,
                  description: 'Administrative password'
                }
              },
              required: ['password']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Admin access granted',
          headers: {
            'Set-Cookie': {
              description: 'Anonymous admin token cookie',
              schema: {
                type: 'string',
                example: 'anonymous_admin_token=jwt_token; HttpOnly; Secure; Path=/'
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Admin access granted' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  anonymousAdminToken: { type: 'string', description: 'JWT token for admin access' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid password format',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Invalid password format' }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid admin password',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Invalid admin password' }
                }
              }
            }
          }
        },
        500: {
          description: 'Admin password not configured',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Admin password not configured' }
                }
              }
            }
          }
        }
      }
    }
  }
};