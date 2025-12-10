// OpenAPI documentation for products endpoints
// Unified product creation system for all product types

export default {
  '/products': {
    post: {
      tags: ['Products'],
      summary: 'Create a new product',
      description: `
        **CONTENT CREATORS ONLY**: Unified endpoint for creating products of any type.
        Supports all product types in Ludora's polymorphic product system.

        **Supported Product Types:**
        - **file** - File-based content (documents, PDFs, etc.)
        - **lesson_plan** - Educational lesson plans
        - **game** - Interactive educational games
        - **workshop** - Workshop content and sessions
        - **course** - Full course materials
        - **tool** - Educational tools and utilities
        - **bundle** - Collections of multiple products

        **Content Creator Requirements:**
        - Must be a signed content creator (content_creator_agreement_sign_date required)
        - Specific permissions checked based on product type
        - Admin/sysadmin users bypass content creator requirements

        **Settings-Based Permissions:**
        Each product type has a corresponding setting that controls whether content creators
        can create that type of product:
        - Files/Tools: \`allow_content_creator_files\`
        - Games: \`allow_content_creator_games\`
        - Workshops: \`allow_content_creator_workshops\`
        - Courses: \`allow_content_creator_courses\`
        - Lesson Plans: \`allow_content_creator_lesson_plans\`

        **Admin Features:**
        - Admins can create Ludora-owned products (no creator_user_id) using \`is_ludora_creator: true\`
        - Admins bypass all content creator permission checks
        - System products are available to all users

        **Architecture Integration:**
        - Uses ProductServiceRouter for type-specific handling
        - Creates both entity record and Product record
        - Maintains ownership through Product.creator_user_id
        - Transaction safety for multi-step operations
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                product_type: {
                  type: 'string',
                  enum: ['file', 'lesson_plan', 'game', 'workshop', 'course', 'tool', 'bundle'],
                  description: 'Type of product to create'
                },
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 255,
                  description: 'Product title'
                },
                description: {
                  type: 'string',
                  maxLength: 2000,
                  description: 'Product description'
                },
                price: {
                  type: 'number',
                  minimum: 0,
                  description: 'Product price in Israeli Shekels',
                  example: 29.90
                },
                is_published: {
                  type: 'boolean',
                  default: false,
                  description: 'Whether the product is published and available for purchase'
                },
                is_ludora_creator: {
                  type: 'boolean',
                  default: false,
                  description: '**ADMIN ONLY**: Create as Ludora-owned product (no specific creator)'
                },
                difficulty: {
                  type: 'string',
                  enum: ['easy', 'medium', 'hard'],
                  description: 'Product difficulty level (for educational content)'
                },
                category: {
                  type: 'string',
                  description: 'Product category or subject area'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags for product discovery and categorization'
                },
                type_attributes: {
                  type: 'object',
                  description: 'Product type-specific attributes and metadata',
                  properties: {
                    // Bundle-specific attributes
                    is_bundle: {
                      type: 'boolean',
                      description: 'For bundle products: indicates this is a bundle'
                    },
                    bundle_items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          product_type: { type: 'string' },
                          product_id: { type: 'string' }
                        }
                      },
                      description: 'For bundle products: items included in the bundle'
                    },
                    // File-specific attributes
                    file_s3_keys: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'For file products: S3 keys of uploaded files'
                    },
                    // Game-specific attributes
                    game_config: {
                      type: 'object',
                      description: 'For game products: game configuration and settings'
                    },
                    // Workshop/Course-specific attributes
                    duration_minutes: {
                      type: 'integer',
                      description: 'For workshop/course products: estimated duration'
                    },
                    prerequisite_products: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Product IDs of required prerequisite products'
                    }
                  }
                }
              },
              required: ['product_type'],
              example: {
                product_type: 'workshop',
                title: 'Introduction to Mathematics',
                description: 'A comprehensive workshop covering basic mathematical concepts',
                price: 49.90,
                is_published: false,
                difficulty: 'medium',
                category: 'mathematics',
                tags: ['math', 'elementary', 'basics'],
                type_attributes: {
                  duration_minutes: 120,
                  prerequisite_products: []
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Product created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Created product with entity data',
                properties: {
                  id: { type: 'string', description: 'Product ID' },
                  product_type: { type: 'string' },
                  entity_id: { type: 'string', description: 'Associated entity ID (null for bundles)' },
                  creator_user_id: { type: 'string', nullable: true, description: 'Creator ID (null for Ludora products)' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  is_published: { type: 'boolean' },
                  type_attributes: { type: 'object' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  entity: {
                    type: 'object',
                    nullable: true,
                    description: 'Associated entity data (varies by product type)'
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
                  error: { type: 'string' },
                  allowedTypes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Available product types (for invalid type errors)'
                  }
                }
              },
              examples: {
                missingType: {
                  summary: 'Missing product type',
                  value: {
                    error: 'product_type is required'
                  }
                },
                invalidType: {
                  summary: 'Invalid product type',
                  value: {
                    error: 'Invalid product_type: invalid_type',
                    allowedTypes: ['file', 'lesson_plan', 'game', 'workshop', 'course', 'tool', 'bundle']
                  }
                },
                validationError: {
                  summary: 'Validation error',
                  value: {
                    error: 'Title is required for published products'
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - user not authenticated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'User not found' }
                }
              }
            }
          }
        },
        403: {
          description: 'Forbidden - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                }
              },
              examples: {
                notContentCreator: {
                  summary: 'Not a content creator',
                  value: {
                    error: 'Only signed content creators can create products'
                  }
                },
                productTypeDisabled: {
                  summary: 'Product type disabled for content creators',
                  value: {
                    error: 'Content creators are not allowed to create workshops'
                  }
                },
                permissionError: {
                  summary: 'Permission checking failed',
                  value: {
                    error: 'Error checking permissions'
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'Server error during product creation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Database transaction failed' }
                }
              }
            }
          }
        }
      }
    }
  }
};