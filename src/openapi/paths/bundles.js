// OpenAPI documentation for product bundling system
// Advanced product packaging with mixed content types and automatic purchase distribution

export default {
  '/bundles/available-products/{type}': {
    get: {
      tags: ['Product Bundles', 'Content Creation'],
      summary: 'Get products available for bundling',
      description: `
        **Bundle Creation Discovery**: Retrieves products that can be included in bundle packages.

        **Product Filtering:**
        - Only shows products owned by the authenticated user
        - Filters by product type (file, game, workshop, course, tool, lesson_plan)
        - Excludes already bundled products to prevent circular references
        - Shows only published products suitable for bundling

        **Ownership Validation:**
        - Content creators see their own products
        - Admin users see all system products
        - Products must be published and available for purchase

        **Bundle Rules:**
        - Mixed product types allowed in same bundle
        - Minimum 2 products, maximum 50 products per bundle
        - No nested bundles (bundles cannot contain other bundles)
        - Product creators must have bundling permissions

        **Used By:** Bundle creation UI, product selection interfaces
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'type',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'all']
          },
          description: 'Product type to filter by, or "all" for all types',
          example: 'workshop'
        }
      ],
      responses: {
        200: {
          description: 'Available products retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'product_abc123' },
                        title: { type: 'string', example: 'Introduction to Mathematics' },
                        description: { type: 'string' },
                        product_type: {
                          type: 'string',
                          enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan']
                        },
                        price: { type: 'number', example: 49.90 },
                        entity_id: { type: 'string' },
                        creator_user_id: { type: 'string' },
                        is_published: { type: 'boolean', example: true },
                        image_filename: { type: 'string', nullable: true },
                        has_image: { type: 'boolean' },
                        category: { type: 'string', example: 'mathematics' },
                        tags: { type: 'array', items: { type: 'string' } },
                        created_at: { type: 'string', format: 'date-time' },
                        bundling_eligible: {
                          type: 'boolean',
                          description: 'Whether product can be included in bundles'
                        }
                      }
                    }
                  },
                  count: { type: 'integer', description: 'Number of available products' }
                }
              }
            }
          }
        },
        403: {
          description: 'Content creator authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Content creator access required for bundling' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/bundles/validate': {
    post: {
      tags: ['Product Bundles', 'Content Creation'],
      summary: 'Validate bundle composition and pricing',
      description: `
        **Bundle Validation Engine**: Comprehensive validation of bundle composition before creation.

        **Validation Rules:**
        - **Product Limits** - Minimum 2 products, maximum 50 products per bundle
        - **Ownership Validation** - All products must be owned by creator
        - **Pricing Rules** - Bundle price must be less than sum of individual prices
        - **Savings Requirements** - Minimum 5% savings required for bundle
        - **Product Availability** - All products must be published and available

        **Mixed Product Support:**
        Bundles can contain any combination of product types:
        - Educational files (PDFs, documents)
        - Interactive games (memory, puzzle games)
        - Workshop content and sessions
        - Course materials and lessons
        - Educational tools and utilities

        **Pricing Validation:**
        - Calculates original total price
        - Validates minimum savings percentage
        - Provides detailed pricing breakdown
        - Ensures bundle represents value for customers

        **Returns Detailed Feedback:** Complete validation results with specific error messages and pricing information
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                bundleItems: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 50,
                  items: {
                    type: 'object',
                    properties: {
                      product_id: { type: 'string', example: 'product_abc123' },
                      product_type: {
                        type: 'string',
                        enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan']
                      },
                      title: { type: 'string', example: 'Math Workshop 1' },
                      price: { type: 'number', example: 29.90 }
                    },
                    required: ['product_id', 'product_type', 'title', 'price']
                  },
                  description: 'Array of products to include in bundle'
                },
                bundlePrice: {
                  type: 'number',
                  minimum: 0,
                  description: 'Proposed bundle price in Israeli Shekels',
                  example: 79.90
                }
              },
              required: ['bundleItems', 'bundlePrice'],
              example: {
                bundleItems: [
                  {
                    product_id: 'product_abc123',
                    product_type: 'workshop',
                    title: 'Introduction to Mathematics',
                    price: 49.90
                  },
                  {
                    product_id: 'product_def456',
                    product_type: 'file',
                    title: 'Math Exercise PDF',
                    price: 19.90
                  },
                  {
                    product_id: 'product_ghi789',
                    product_type: 'game',
                    title: 'Math Memory Game',
                    price: 29.90
                  }
                ],
                bundlePrice: 79.90
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Bundle validation completed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean', description: 'Whether bundle passes all validation rules' },
                  errors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Validation error messages (empty if valid)'
                  },
                  pricingInfo: {
                    type: 'object',
                    properties: {
                      originalTotal: {
                        type: 'number',
                        description: 'Sum of individual product prices',
                        example: 99.70
                      },
                      bundlePrice: { type: 'number', example: 79.90 },
                      savings: {
                        type: 'number',
                        description: 'Total savings amount',
                        example: 19.80
                      },
                      savingsPercentage: {
                        type: 'number',
                        description: 'Percentage savings',
                        example: 19.86
                      },
                      meetsMinimumSavings: {
                        type: 'boolean',
                        description: 'Whether bundle meets minimum 5% savings requirement'
                      }
                    }
                  },
                  warnings: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Non-blocking warnings about bundle composition'
                  }
                }
              },
              examples: {
                validBundle: {
                  summary: 'Valid bundle with good savings',
                  value: {
                    valid: true,
                    errors: [],
                    pricingInfo: {
                      originalTotal: 99.70,
                      bundlePrice: 79.90,
                      savings: 19.80,
                      savingsPercentage: 19.86,
                      meetsMinimumSavings: true
                    },
                    warnings: []
                  }
                },
                invalidBundle: {
                  summary: 'Invalid bundle with insufficient savings',
                  value: {
                    valid: false,
                    errors: [
                      'Bundle price must be at least 5% less than individual prices',
                      'Product product_xyz789 is not owned by user'
                    ],
                    pricingInfo: {
                      originalTotal: 99.70,
                      bundlePrice: 95.00,
                      savings: 4.70,
                      savingsPercentage: 4.71,
                      meetsMinimumSavings: false
                    },
                    warnings: []
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid bundle validation request',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean', example: false },
                  errors: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['bundleItems חייב להיות מערך של מוצרים']
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/bundles/create': {
    post: {
      tags: ['Product Bundles', 'Content Creation'],
      summary: 'Create bundle product',
      description: `
        **Bundle Product Creation**: Creates a new bundle product with automatic purchase distribution.

        **Bundle Creation Process:**
        1. **Validation** - Re-validates bundle composition and pricing
        2. **Entity Creation** - Creates dummy entity for Product table compatibility
        3. **Product Record** - Creates Product with bundle-specific metadata
        4. **Metadata Storage** - Stores complete bundle composition in type_attributes

        **Auto-Purchase Architecture:**
        When users purchase bundles, the system automatically creates individual Purchase records
        for each bundled item. This enables seamless access control without modifying existing
        access validation systems.

        **Bundle Metadata:**
        - Complete product composition with original prices
        - Calculated savings and discount information
        - Bundle type classification
        - Creator ownership tracking

        **Draft Status:** Bundles are created as unpublished drafts, requiring manual publication

        **Used By:** Content creator bundle builder, product management interfaces
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
                  description: 'Bundle display name',
                  example: 'Complete Mathematics Learning Package'
                },
                description: {
                  type: 'string',
                  maxLength: 2000,
                  description: 'Bundle description and value proposition',
                  example: 'Comprehensive math learning bundle with interactive games, worksheets, and video content'
                },
                category: {
                  type: 'string',
                  description: 'Educational category for bundle',
                  example: 'mathematics'
                },
                bundleItems: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 50,
                  items: {
                    type: 'object',
                    properties: {
                      product_id: { type: 'string' },
                      entity_id: { type: 'string' },
                      title: { type: 'string' },
                      price: { type: 'number' }
                    },
                    required: ['product_id', 'entity_id', 'title', 'price']
                  },
                  description: 'Products to include in bundle (must pass validation)'
                },
                bundlePrice: {
                  type: 'number',
                  minimum: 0,
                  description: 'Bundle price (must provide minimum 5% savings)',
                  example: 79.90
                },
                productType: {
                  type: 'string',
                  enum: ['bundle'],
                  description: 'Product type (always "bundle" for bundles)',
                  example: 'bundle'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Search tags for bundle discovery',
                  example: ['math', 'interactive', 'comprehensive']
                },
                target_audience: {
                  type: 'string',
                  description: 'Target student audience',
                  example: 'elementary'
                },
                image_filename: {
                  type: 'string',
                  description: 'Bundle thumbnail image filename',
                  nullable: true
                },
                has_image: {
                  type: 'boolean',
                  description: 'Whether bundle has associated image',
                  default: false
                }
              },
              required: ['title', 'bundleItems', 'bundlePrice', 'productType'],
              example: {
                title: 'Complete Mathematics Learning Package',
                description: 'Everything you need to master basic mathematics - games, worksheets, and interactive content',
                category: 'mathematics',
                bundleItems: [
                  {
                    product_id: 'product_abc123',
                    entity_id: 'workshop_def456',
                    title: 'Introduction to Mathematics',
                    price: 49.90
                  },
                  {
                    product_id: 'product_ghi789',
                    entity_id: 'file_jkl012',
                    title: 'Math Exercise PDF',
                    price: 19.90
                  }
                ],
                bundlePrice: 59.90,
                productType: 'bundle',
                tags: ['math', 'elementary', 'interactive'],
                target_audience: 'elementary'
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Bundle product created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'product_bundle123' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  product_type: { type: 'string', example: 'bundle' },
                  price: { type: 'number' },
                  is_published: { type: 'boolean', example: false },
                  creator_user_id: { type: 'string' },
                  type_attributes: {
                    type: 'object',
                    properties: {
                      is_bundle: { type: 'boolean', example: true },
                      bundle_type: { type: 'string', example: 'bundle' },
                      bundle_items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            product_id: { type: 'string' },
                            entity_id: { type: 'string' },
                            title: { type: 'string' },
                            price: { type: 'number' }
                          }
                        }
                      },
                      original_total_price: { type: 'number', example: 99.70 },
                      savings: { type: 'number', example: 19.80 },
                      savings_percentage: { type: 'number', example: 19.86 }
                    }
                  },
                  bundleItems: { type: 'integer', description: 'Number of items in bundle' },
                  savings: { type: 'number', description: 'Total savings amount' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        400: {
          description: 'Bundle validation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Bundle validation failed' },
                  errors: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                      'Bundle price must be at least 5% less than individual prices',
                      'Minimum 2 products required for bundle'
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/bundles/{id}/contents': {
    get: {
      tags: ['Product Bundles', 'Public Access'],
      summary: 'Get bundle contents for display',
      description: `
        **Bundle Content Discovery**: Public endpoint for viewing bundle composition and pricing.

        **Bundle Information:**
        - Complete list of bundled products with details
        - Pricing breakdown and savings calculation
        - Product thumbnails and descriptions
        - Educational category and audience information

        **Product Details for Each Item:**
        - Product title, description, and type
        - Original individual pricing
        - Product images and metadata
        - Educational categorization

        **Pricing Transparency:**
        - Original total price (sum of individual items)
        - Bundle discount price
        - Total savings amount and percentage
        - Clear value proposition display

        **Public Access:** No authentication required for bundle browsing

        **Used By:** Bundle marketplace, product discovery, purchase decision interfaces
      `,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Bundle product identifier',
          example: 'product_bundle123'
        }
      ],
      responses: {
        200: {
          description: 'Bundle contents retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  bundle: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string', example: 'Complete Mathematics Learning Package' },
                      description: { type: 'string' },
                      price: { type: 'number', description: 'Bundle price', example: 79.90 },
                      original_total_price: {
                        type: 'number',
                        description: 'Sum of individual product prices',
                        example: 99.70
                      },
                      savings: {
                        type: 'number',
                        description: 'Total savings amount',
                        example: 19.80
                      },
                      savings_percentage: {
                        type: 'number',
                        description: 'Percentage discount',
                        example: 19.86
                      }
                    }
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string' },
                        entity_id: { type: 'string' },
                        title: { type: 'string', example: 'Introduction to Mathematics' },
                        description: { type: 'string' },
                        product_type: {
                          type: 'string',
                          enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan']
                        },
                        price: { type: 'number', description: 'Individual product price', example: 49.90 },
                        image_filename: { type: 'string', nullable: true },
                        has_image: { type: 'boolean' },
                        is_published: { type: 'boolean' },
                        category: { type: 'string' }
                      }
                    }
                  },
                  itemCount: { type: 'integer', description: 'Total number of items in bundle' }
                }
              },
              example: {
                bundle: {
                  id: 'product_bundle123',
                  title: 'Complete Mathematics Learning Package',
                  description: 'Everything you need to master basic mathematics',
                  price: 79.90,
                  original_total_price: 99.70,
                  savings: 19.80,
                  savings_percentage: 19.86
                },
                items: [
                  {
                    product_id: 'product_abc123',
                    title: 'Introduction to Mathematics',
                    product_type: 'workshop',
                    price: 49.90,
                    has_image: true,
                    is_published: true
                  },
                  {
                    product_id: 'product_def456',
                    title: 'Math Exercise PDF',
                    product_type: 'file',
                    price: 19.90,
                    has_image: false,
                    is_published: true
                  }
                ],
                itemCount: 2
              }
            }
          }
        },
        400: {
          description: 'Product is not a bundle',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Product is not a bundle' }
                }
              }
            }
          }
        },
        404: {
          description: 'Bundle not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Bundle not found' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/bundles/purchase/{id}': {
    get: {
      tags: ['Product Bundles', 'Purchase Management'],
      summary: 'Get bundle purchase details',
      description: `
        **Bundle Purchase Analytics**: Detailed breakdown of bundle purchases including auto-generated individual purchases.

        **Auto-Purchase Architecture Visualization:**
        When users purchase bundles, the system automatically creates individual Purchase records
        for each bundled item. This endpoint shows both the main bundle purchase and all
        related individual purchases.

        **Purchase Information:**
        - **Main Bundle Purchase** - Original bundle transaction record
        - **Individual Purchases** - Auto-created purchases for each bundled item
        - **Payment Status** - Complete payment processing status
        - **Access Grants** - Individual access records for each bundled product

        **Access Control:**
        - Purchase owners can view their own bundle purchases
        - Admin users can view all bundle purchases
        - Includes complete audit trail for customer service

        **Used By:** Purchase history, customer service, access troubleshooting, analytics dashboards
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Bundle purchase identifier (main purchase ID)',
          example: 'purchase_bundle123'
        }
      ],
      responses: {
        200: {
          description: 'Bundle purchase details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  bundlePurchase: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Main bundle purchase ID' },
                      buyer_user_id: { type: 'string' },
                      purchasable_type: { type: 'string', example: 'bundle' },
                      purchasable_id: { type: 'string' },
                      payment_status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
                      price_paid: { type: 'number', example: 79.90 },
                      purchased_at: { type: 'string', format: 'date-time' },
                      bundle_purchase_id: { type: 'null', description: 'Null for main bundle purchase' }
                    }
                  },
                  bundleProduct: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      original_total_price: { type: 'number', example: 99.70 },
                      savings: { type: 'number', example: 19.80 },
                      savings_percentage: { type: 'number', example: 19.86 }
                    }
                  },
                  individualPurchases: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Individual purchase ID' },
                        purchasable_type: {
                          type: 'string',
                          enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan']
                        },
                        purchasable_id: { type: 'string' },
                        product_title: { type: 'string' },
                        original_price: { type: 'number' },
                        payment_status: { type: 'string', example: 'completed' },
                        bundle_purchase_id: { type: 'string', description: 'Reference to main bundle purchase' },
                        access_expires_at: {
                          type: 'string',
                          format: 'date-time',
                          nullable: true,
                          description: 'When individual access expires (null for lifetime)'
                        },
                        purchased_at: { type: 'string', format: 'date-time' }
                      }
                    },
                    description: 'Auto-created individual purchases for each bundled item'
                  },
                  purchaseSummary: {
                    type: 'object',
                    properties: {
                      totalItems: { type: 'integer', description: 'Number of individual items' },
                      totalOriginalValue: { type: 'number', description: 'Sum of individual prices' },
                      amountPaid: { type: 'number', description: 'Actual bundle price paid' },
                      totalSavings: { type: 'number', description: 'Total savings achieved' },
                      allItemsAccessible: {
                        type: 'boolean',
                        description: 'Whether user has access to all bundled items'
                      }
                    }
                  }
                }
              },
              example: {
                bundlePurchase: {
                  id: 'purchase_bundle123',
                  buyer_user_id: 'user_456def',
                  purchasable_type: 'bundle',
                  payment_status: 'completed',
                  price_paid: 79.90,
                  purchased_at: '2025-12-11T10:30:00Z'
                },
                bundleProduct: {
                  title: 'Complete Mathematics Learning Package',
                  original_total_price: 99.70,
                  savings: 19.80,
                  savings_percentage: 19.86
                },
                individualPurchases: [
                  {
                    id: 'purchase_item1',
                    purchasable_type: 'workshop',
                    product_title: 'Introduction to Mathematics',
                    original_price: 49.90,
                    payment_status: 'completed',
                    bundle_purchase_id: 'purchase_bundle123'
                  },
                  {
                    id: 'purchase_item2',
                    purchasable_type: 'file',
                    product_title: 'Math Exercise PDF',
                    original_price: 19.90,
                    payment_status: 'completed',
                    bundle_purchase_id: 'purchase_bundle123'
                  }
                ],
                purchaseSummary: {
                  totalItems: 2,
                  totalOriginalValue: 99.70,
                  amountPaid: 79.90,
                  totalSavings: 19.80,
                  allItemsAccessible: true
                }
              }
            }
          }
        },
        403: {
          description: 'Access denied (not purchase owner or admin)',
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
          description: 'Bundle purchase not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Purchase not found' }
                }
              }
            }
          }
        }
      }
    }
  }
};