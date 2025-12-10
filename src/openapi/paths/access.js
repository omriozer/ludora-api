// OpenAPI documentation for access control endpoints
// Comprehensive access validation, purchase management, and admin access control

export default {
  '/access/check/{entityType}/{entityId}': {
    get: {
      tags: ['Access Control'],
      summary: 'Check user access to entity',
      description: `
        **Core Access Validation**: Determines if authenticated user has access to a specific entity.

        **Critical Architecture Integration:**
        - Converts entity ID to Product ID internally (entities → products mapping)
        - Supports all product types: file, game, workshop, course, tool, lesson_plan, bundle
        - Handles entities without Product records gracefully (system files, templates, etc.)

        **Access Types Detected:**
        - **creator** - User owns the entity through Product.creator_user_id
        - **purchase** - User has valid Purchase record for the entity
        - **subscription_claim** - User accessed via active subscription allowances
        - **student_via_teacher** - Student access through teacher assignment/invitation
        - **none** - No access found

        **Bundle Integration:**
        When user purchases a bundle, individual Purchase records are auto-created for each bundled item.
        This endpoint automatically detects these individual purchases without special handling.

        **Response Includes:**
        - Access status and type identification
        - Permission breakdown (download, preview, play capabilities)
        - Allowance tracking for subscription-based access
        - Access expiration information
        - Debug information for troubleshooting (temporary)

        **Used By:** All protected content endpoints, media streaming, download validation
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle']
          },
          description: 'Type of entity to check access for',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[a-zA-Z0-9_-]+$'
          },
          description: 'Unique identifier of the entity (entity table ID, not Product ID)',
          example: 'workshop_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Access check completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  hasAccess: {
                    type: 'boolean',
                    description: 'Whether user has access to the entity'
                  },
                  accessType: {
                    type: 'string',
                    enum: ['creator', 'purchase', 'subscription_claim', 'student_via_teacher', 'none'],
                    description: 'Type of access detected'
                  },
                  canDownload: {
                    type: 'boolean',
                    description: 'Whether user can download entity files'
                  },
                  canPreview: {
                    type: 'boolean',
                    description: 'Whether user can preview entity content'
                  },
                  canPlay: {
                    type: 'boolean',
                    description: 'Whether user can play/interact with entity (games, workshops)'
                  },
                  remainingAllowances: {
                    type: ['number', 'string'],
                    description: 'Remaining subscription allowances or "unlimited"',
                    example: 15
                  },
                  expiresAt: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                    description: 'When access expires (null for lifetime access)'
                  },
                  reason: {
                    type: 'string',
                    description: 'Human-readable reason for access status'
                  },
                  entityNotProduct: {
                    type: 'boolean',
                    description: 'True if entity has no Product record (system files, templates, etc.)'
                  },
                  _debug: {
                    type: 'object',
                    description: 'Debug information (temporary, will be removed)',
                    properties: {
                      entityId: { type: 'string' },
                      productId: { type: 'string' },
                      entityType: { type: 'string' },
                      userId: { type: 'string' }
                    }
                  }
                },
                required: ['hasAccess', 'accessType', 'reason']
              },
              examples: {
                creatorAccess: {
                  summary: 'Creator has full access',
                  value: {
                    hasAccess: true,
                    accessType: 'creator',
                    canDownload: true,
                    canPreview: true,
                    canPlay: true,
                    remainingAllowances: 'unlimited',
                    expiresAt: null,
                    reason: 'User is the creator of this content'
                  }
                },
                purchaseAccess: {
                  summary: 'User purchased the content',
                  value: {
                    hasAccess: true,
                    accessType: 'purchase',
                    canDownload: true,
                    canPreview: true,
                    canPlay: true,
                    remainingAllowances: 'unlimited',
                    expiresAt: '2025-12-11T23:59:59Z',
                    reason: 'User has valid purchase for this content'
                  }
                },
                subscriptionAccess: {
                  summary: 'Subscription-based access',
                  value: {
                    hasAccess: true,
                    accessType: 'subscription_claim',
                    canDownload: false,
                    canPreview: true,
                    canPlay: true,
                    remainingAllowances: 8,
                    expiresAt: '2025-01-11T23:59:59Z',
                    reason: 'Access via subscription allowances'
                  }
                },
                noAccess: {
                  summary: 'No access found',
                  value: {
                    hasAccess: false,
                    accessType: 'none',
                    canDownload: false,
                    canPreview: false,
                    canPlay: false,
                    remainingAllowances: 0,
                    expiresAt: null,
                    reason: 'No valid access found for this content'
                  }
                },
                systemEntity: {
                  summary: 'System entity (no product record)',
                  value: {
                    hasAccess: false,
                    accessType: 'none',
                    reason: 'Entity is not a claimable product (no Product record)',
                    entityNotProduct: true
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'User not authenticated',
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
        },
        500: {
          description: 'Server error during access check',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Access check failed due to database error' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/access/my-purchases': {
    get: {
      tags: ['Access Control'],
      summary: 'Get user purchase history',
      description: `
        **Purchase History Retrieval**: Lists all purchases and access grants for the authenticated user.

        **Features:**
        - Complete purchase history with entity details
        - Filtering by entity type (file, game, workshop, etc.)
        - Active-only filtering for current valid access
        - Bundle purchase breakdown (shows individual auto-created purchases)
        - Access expiration and status information

        **Bundle Integration:**
        When user purchases a bundle, this endpoint shows:
        - Main bundle purchase record
        - Individual auto-created purchases for each bundled item
        - Clear indication of bundle relationships

        **Used By:** User profile pages, access management UI, purchase verification
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'entityType',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle']
          },
          description: 'Filter purchases by entity type',
          example: 'workshop'
        },
        {
          name: 'activeOnly',
          in: 'query',
          required: false,
          schema: {
            type: 'boolean'
          },
          description: 'Return only active (non-expired) purchases',
          example: true
        }
      ],
      responses: {
        200: {
          description: 'Purchase history retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Purchase ID' },
                    purchasable_type: {
                      type: 'string',
                      enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle']
                    },
                    purchasable_id: { type: 'string', description: 'Entity ID' },
                    payment_status: {
                      type: 'string',
                      enum: ['completed', 'pending', 'failed', 'refunded']
                    },
                    price_paid: { type: 'number', description: 'Amount paid in ILS' },
                    access_expires_at: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      description: 'When access expires (null for lifetime)'
                    },
                    bundle_purchase_id: {
                      type: 'string',
                      nullable: true,
                      description: 'Parent bundle purchase ID (for auto-created items)'
                    },
                    purchased_at: { type: 'string', format: 'date-time' },
                    entity: {
                      type: 'object',
                      nullable: true,
                      description: 'Associated entity details',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        creator_name: { type: 'string' }
                      }
                    },
                    isActive: {
                      type: 'boolean',
                      description: 'Whether purchase is currently active'
                    },
                    daysUntilExpiry: {
                      type: 'number',
                      nullable: true,
                      description: 'Days until expiry (null for lifetime access)'
                    }
                  }
                }
              },
              example: [
                {
                  id: 'purchase_abc123',
                  purchasable_type: 'workshop',
                  purchasable_id: 'workshop_def456',
                  payment_status: 'completed',
                  price_paid: 49.90,
                  access_expires_at: '2025-12-11T23:59:59Z',
                  bundle_purchase_id: null,
                  purchased_at: '2024-11-11T10:30:00Z',
                  entity: {
                    title: 'Introduction to Mathematics',
                    description: 'A comprehensive math workshop',
                    creator_name: 'Dr. Sarah Cohen'
                  },
                  isActive: true,
                  daysUntilExpiry: 30
                }
              ]
            }
          }
        },
        401: {
          description: 'User not authenticated',
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
        },
        500: {
          description: 'Server error retrieving purchases',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to retrieve purchase history' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/access/entity/{entityType}/{entityId}/users': {
    get: {
      tags: ['Access Control', 'Admin'],
      summary: 'Get users with access to entity (Admin)',
      description: `
        **Admin Access Analytics**: Lists all users who have access to a specific entity.

        **Admin-Only Endpoint** - Requires admin privileges for access analytics and management.

        **Access Detection:**
        - Creator ownership through Product records
        - Direct purchases (individual and bundle-derived)
        - Subscription-based access claims
        - Student access via teacher assignments

        **Used By:** Admin dashboards, content analytics, access management tools
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle']
          },
          description: 'Type of entity',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Entity identifier',
          example: 'workshop_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Users with access retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', description: 'User ID' },
                    email: { type: 'string', description: 'User email' },
                    name: { type: 'string', description: 'User display name' },
                    accessType: {
                      type: 'string',
                      enum: ['creator', 'purchase', 'subscription_claim', 'admin_grant'],
                      description: 'How user obtained access'
                    },
                    grantedAt: {
                      type: 'string',
                      format: 'date-time',
                      description: 'When access was granted'
                    },
                    expiresAt: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      description: 'When access expires (null for lifetime)'
                    },
                    isActive: {
                      type: 'boolean',
                      description: 'Whether access is currently valid'
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Not authorized (admin access required)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Admin access required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/access/entity/{entityType}/{entityId}/stats': {
    get: {
      tags: ['Access Control', 'Admin'],
      summary: 'Get entity access statistics (Admin)',
      description: `
        **Admin Analytics Dashboard**: Comprehensive access statistics for entity management.

        **Statistics Provided:**
        - Total users with access (by access type)
        - Revenue analytics (purchases, pricing trends)
        - Access pattern analysis (downloads, usage frequency)
        - Subscription vs purchase breakdown
        - Geographic and temporal access patterns

        **Used By:** Admin analytics, business intelligence, content performance analysis
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle']
          }
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          }
        }
      ],
      responses: {
        200: {
          description: 'Access statistics retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  totalUsersWithAccess: { type: 'integer' },
                  accessBreakdown: {
                    type: 'object',
                    properties: {
                      creators: { type: 'integer' },
                      purchases: { type: 'integer' },
                      subscriptions: { type: 'integer' },
                      adminGrants: { type: 'integer' }
                    }
                  },
                  revenueStats: {
                    type: 'object',
                    properties: {
                      totalRevenue: { type: 'number' },
                      averagePrice: { type: 'number' },
                      purchaseCount: { type: 'integer' }
                    }
                  },
                  accessPatterns: {
                    type: 'object',
                    properties: {
                      lastAccessDate: { type: 'string', format: 'date-time' },
                      averageAccessesPerWeek: { type: 'number' },
                      peakUsageHours: { type: 'array', items: { type: 'integer' } }
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Not authorized (admin access required)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Admin access required' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/access/grant': {
    post: {
      tags: ['Access Control', 'Admin'],
      summary: 'Grant access to user (Admin)',
      description: `
        **Admin Access Management**: Manually grant access to users for content or subscription management.

        **Grant Types:**
        - **Lifetime Access** - Permanent access without expiration
        - **Time-Limited Access** - Access for specified number of days
        - **Subscription Override** - Grant access outside normal subscription limits

        **Creates Purchase Record:**
        Creates a Purchase record with payment_status='completed' to integrate seamlessly
        with existing access control systems. No special handling required.

        **Use Cases:**
        - Customer service access grants
        - Promotional access distribution
        - Content creator collaboration
        - Subscription issue resolution

        **Transaction Safety:** All operations use database transactions for consistency
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                userEmail: {
                  type: 'string',
                  format: 'email',
                  description: 'Email address of user to grant access to'
                },
                entityType: {
                  type: 'string',
                  enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle'],
                  description: 'Type of entity to grant access to'
                },
                entityId: {
                  type: 'string',
                  description: 'Unique identifier of the entity'
                },
                accessDays: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 3650,
                  description: 'Number of days to grant access for (ignored if isLifetimeAccess is true)'
                },
                isLifetimeAccess: {
                  type: 'boolean',
                  default: false,
                  description: 'Grant permanent access without expiration'
                },
                price: {
                  type: 'number',
                  minimum: 0,
                  default: 0,
                  description: 'Price for analytics tracking (default: 0 for admin grants)'
                }
              },
              required: ['userEmail', 'entityType', 'entityId'],
              example: {
                userEmail: 'student@example.com',
                entityType: 'workshop',
                entityId: 'workshop_abc123',
                accessDays: 90,
                isLifetimeAccess: false,
                price: 0
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Access granted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Access granted successfully' },
                  purchase: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Created purchase ID' },
                      userEmail: { type: 'string' },
                      entityType: { type: 'string' },
                      entityId: { type: 'string' },
                      isLifetimeAccess: { type: 'boolean' },
                      expiresAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: 'Expiration date (null for lifetime access)'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'userEmail, entityType, and entityId are required' }
                }
              }
            }
          }
        },
        403: {
          description: 'Not authorized (admin access required)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Admin access required' }
                }
              }
            }
          }
        },
        500: {
          description: 'Server error during access grant',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to grant access due to database error' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/access/revoke': {
    delete: {
      tags: ['Access Control', 'Admin'],
      summary: 'Revoke user access (Admin)',
      description: `
        **Admin Access Revocation**: Remove user access to specific content.

        **Revocation Process:**
        - Finds and deletes Purchase records for the specified user and entity
        - Handles both direct purchases and bundle-derived purchases
        - Returns count of deleted access records for confirmation
        - Maintains audit trail through soft deletion where applicable

        **Important Notes:**
        - Does not affect subscription-based access (use subscription management instead)
        - Cannot revoke creator access (users remain owners of their content)
        - Does not process refunds (financial operations handled separately)

        **Use Cases:**
        - Customer service issue resolution
        - Access policy violations
        - Content removal or privacy requests
        - Administrative cleanup

        **TODO:** Admin role check currently commented out - needs implementation
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                userEmail: {
                  type: 'string',
                  format: 'email',
                  description: 'Email address of user to revoke access from'
                },
                entityType: {
                  type: 'string',
                  enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle'],
                  description: 'Type of entity to revoke access from'
                },
                entityId: {
                  type: 'string',
                  description: 'Unique identifier of the entity'
                }
              },
              required: ['userEmail', 'entityType', 'entityId'],
              example: {
                userEmail: 'user@example.com',
                entityType: 'workshop',
                entityId: 'workshop_abc123'
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Access revoked successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Access revoked successfully' },
                  userEmail: { type: 'string' },
                  entityType: { type: 'string' },
                  entityId: { type: 'string' },
                  deletedCount: {
                    type: 'integer',
                    description: 'Number of access records deleted'
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'userEmail, entityType, and entityId are required' }
                }
              }
            }
          }
        },
        404: {
          description: 'No access found to revoke',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'No active access found for this user and entity' }
                }
              }
            }
          }
        },
        500: {
          description: 'Server error during access revocation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to revoke access due to database error' }
                }
              }
            }
          }
        }
      }
    }
  }
};