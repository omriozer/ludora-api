export default {
  '/curriculum-linking/suggestions/{productId}': {
    get: {
      tags: ['Curriculum Integration'],
      summary: 'Get curriculum suggestions for product',
      description: `**Intelligent Curriculum Matching System**: Analyzes product grade ranges and subjects to suggest relevant curriculum items for linking.

**Key Features:**
- Automatic matching based on product metadata (grade_range, subjects in type_attributes)
- Returns tiered match quality (perfect, good, partial, suggestions)
- Supports orphaned product access for admin users
- Optimized for educational content alignment

**Matching Algorithm:**
- **Perfect Match**: Exact grade range and subject alignment
- **Good Match**: Overlapping grades with matching subjects
- **Partial Match**: Either grades or subjects match
- **Suggestions**: Related curriculum items for manual review

**Admin Capabilities**: Admin users can access orphaned products (creator_user_id = null) for system-wide curriculum management.`,
      parameters: [
        {
          name: 'productId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Product ID to find curriculum suggestions for',
          example: 'prod_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Curriculum suggestions retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      matches: {
                        type: 'object',
                        properties: {
                          perfect: {
                            type: 'array',
                            description: 'Exact grade range and subject matches',
                            items: { $ref: '#/components/schemas/CurriculumMatch' }
                          },
                          good: {
                            type: 'array',
                            description: 'Overlapping grades with matching subjects',
                            items: { $ref: '#/components/schemas/CurriculumMatch' }
                          },
                          partial: {
                            type: 'array',
                            description: 'Either grades or subjects match',
                            items: { $ref: '#/components/schemas/CurriculumMatch' }
                          },
                          suggestions: {
                            type: 'array',
                            description: 'Related curriculum items for manual review',
                            items: { $ref: '#/components/schemas/CurriculumMatch' }
                          }
                        }
                      },
                      gradeRanges: {
                        type: 'array',
                        description: 'Detected grade ranges from product metadata',
                        items: { type: 'string' }
                      },
                      subjects: {
                        type: 'array',
                        description: 'Detected subjects from product metadata',
                        items: { type: 'string' }
                      },
                      existingLinks: {
                        type: 'array',
                        description: 'Currently linked curriculum items',
                        items: { $ref: '#/components/schemas/CurriculumLink' }
                      }
                    }
                  }
                }
              },
              examples: {
                mathGameSuggestions: {
                  summary: 'Math game curriculum suggestions',
                  value: {
                    success: true,
                    data: {
                      matches: {
                        perfect: [
                          {
                            curriculumId: 'curr_456def',
                            curriculumName: 'Primary Mathematics',
                            curriculumItemId: 'item_789ghi',
                            curriculumItemName: 'Addition and Subtraction',
                            subject: 'mathematics',
                            gradeRange: 'grades_1_3',
                            matchReason: 'Perfect grade range and subject match'
                          }
                        ],
                        good: [
                          {
                            curriculumId: 'curr_567efg',
                            curriculumName: 'Elementary Math Skills',
                            curriculumItemId: 'item_890hij',
                            curriculumItemName: 'Basic Arithmetic',
                            subject: 'mathematics',
                            gradeRange: 'grades_2_4',
                            matchReason: 'Overlapping grade range with subject match'
                          }
                        ],
                        partial: [],
                        suggestions: []
                      },
                      gradeRanges: ['grades_1_3'],
                      subjects: ['mathematics'],
                      existingLinks: []
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Unsupported product type',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: {
                  message: 'Curriculum linking not supported for product type: bundle',
                  code: 'UNSUPPORTED_PRODUCT_TYPE',
                  statusCode: 400
                }
              }
            }
          }
        },
        404: {
          description: 'Product not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/curriculum-linking/existing/{productId}': {
    get: {
      tags: ['Curriculum Integration'],
      summary: 'Get existing curriculum links for product',
      description: `**Curriculum Link Management**: Retrieves all currently active curriculum links for a specific product.

**Features:**
- Complete link details with curriculum metadata
- Ownership validation (admin can access orphaned products)
- Optimized for curriculum management interfaces

**Use Cases:**
- Display current curriculum alignment
- Manage existing educational connections
- Support link removal operations`,
      parameters: [
        {
          name: 'productId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Product ID to retrieve curriculum links for',
          example: 'prod_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Existing curriculum links retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      productId: { type: 'string', example: 'prod_123abc' },
                      links: {
                        type: 'array',
                        description: 'Current curriculum links for the product',
                        items: { $ref: '#/components/schemas/CurriculumLink' }
                      }
                    }
                  }
                }
              },
              examples: {
                existingLinks: {
                  summary: 'Product with curriculum links',
                  value: {
                    success: true,
                    data: {
                      productId: 'prod_123abc',
                      links: [
                        {
                          id: 'cp_111aaa',
                          productId: 'prod_123abc',
                          curriculumItemId: 'item_789ghi',
                          curriculumItemName: 'Addition and Subtraction',
                          curriculumId: 'curr_456def',
                          curriculumName: 'Primary Mathematics',
                          subject: 'mathematics',
                          gradeRange: 'grades_1_3',
                          createdAt: '2024-12-11T10:30:00Z'
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
          description: 'Product not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/curriculum-linking/apply': {
    post: {
      tags: ['Curriculum Integration'],
      summary: 'Apply curriculum links to product',
      description: `**Curriculum Link Application**: Creates connections between products and curriculum items for educational alignment.

**Features:**
- Bulk linking (up to 50 curriculum items per request)
- Duplicate link prevention (automatically skipped)
- Comprehensive validation of curriculum items
- Detailed operation results with success/error/skipped counts

**Business Logic:**
- Only teachers can create curriculum links
- Admin users can link orphaned products
- Supports mixed curriculum types in single request
- Automatic transaction safety for bulk operations`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['productId', 'curriculumItemIds'],
              properties: {
                productId: {
                  type: 'string',
                  description: 'Product to link curriculum items to',
                  example: 'prod_123abc'
                },
                curriculumItemIds: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  maxItems: 50,
                  description: 'Curriculum item IDs to link (1-50 items)',
                  example: ['item_789ghi', 'item_890hij']
                }
              }
            },
            examples: {
              singleLink: {
                summary: 'Link single curriculum item',
                value: {
                  productId: 'prod_123abc',
                  curriculumItemIds: ['item_789ghi']
                }
              },
              multipleLinks: {
                summary: 'Link multiple curriculum items',
                value: {
                  productId: 'prod_123abc',
                  curriculumItemIds: ['item_789ghi', 'item_890hij', 'item_901jkl']
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Curriculum links applied successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'array',
                        description: 'Successfully created links',
                        items: {
                          type: 'object',
                          properties: {
                            curriculumItemId: { type: 'string', example: 'item_789ghi' },
                            curriculumProductId: { type: 'string', example: 'cp_111aaa' },
                            curriculumItemName: { type: 'string', example: 'Addition and Subtraction' }
                          }
                        }
                      },
                      errors: {
                        type: 'array',
                        description: 'Failed link attempts',
                        items: {
                          type: 'object',
                          properties: {
                            curriculumItemId: { type: 'string' },
                            error: { type: 'string' },
                            details: { type: 'string' }
                          }
                        }
                      },
                      skipped: {
                        type: 'array',
                        description: 'Links that already exist',
                        items: {
                          type: 'object',
                          properties: {
                            curriculumItemId: { type: 'string' },
                            reason: { type: 'string', example: 'Link already exists' },
                            existingLinkId: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  message: { type: 'string', example: 'Successfully linked 3 curriculum items' }
                }
              },
              examples: {
                successfulLinking: {
                  summary: 'Successful curriculum linking',
                  value: {
                    success: true,
                    data: {
                      success: [
                        {
                          curriculumItemId: 'item_789ghi',
                          curriculumProductId: 'cp_111aaa',
                          curriculumItemName: 'Addition and Subtraction'
                        }
                      ],
                      errors: [],
                      skipped: [
                        {
                          curriculumItemId: 'item_890hij',
                          reason: 'Link already exists',
                          existingLinkId: 'cp_222bbb'
                        }
                      ]
                    },
                    message: 'Successfully linked 1 curriculum items'
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid curriculum items',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: {
                  message: 'Some curriculum items not found',
                  code: 'CURRICULUM_ITEMS_NOT_FOUND',
                  statusCode: 400,
                  details: {
                    missingIds: ['item_invalid'],
                    foundCount: 2,
                    requestedCount: 3
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Product not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/curriculum-linking/{curriculumProductId}': {
    delete: {
      tags: ['Curriculum Integration'],
      summary: 'Remove curriculum link',
      description: `**Curriculum Link Removal**: Safely removes the connection between a product and curriculum item.

**Features:**
- Ownership validation (only owner or admin can remove)
- Admin access to orphaned product links
- Comprehensive audit logging
- Safe link deletion with referential integrity

**Use Cases:**
- Remove incorrect curriculum alignment
- Update curriculum connections
- Clean up obsolete educational links`,
      parameters: [
        {
          name: 'curriculumProductId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Curriculum link ID to remove',
          example: 'cp_111aaa'
        }
      ],
      responses: {
        200: {
          description: 'Curriculum link removed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Curriculum link removed successfully' }
                }
              }
            }
          }
        },
        404: {
          description: 'Curriculum link not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/curriculum-linking/browse': {
    get: {
      tags: ['Curriculum Integration'],
      summary: 'Browse curricula by subject and grade',
      description: `**Manual Curriculum Browser**: Enables teachers to discover curriculum items through subject/grade filtering when automatic matching isn't sufficient.

**Multi-Mode Operation:**
- **Normal Mode**: Browse curricula with optional subject/grade filters
- **Subjects Mode** (?subjects=true): Get available subjects for filter UI
- **Grade Ranges Mode** (?gradeRanges=true): Get available grade ranges for filter UI

**Features:**
- Flexible filtering by subject (Hebrew/English support)
- Grade range overlap detection (single grade + range curricula)
- Only active curricula and items returned
- Paginated results with configurable limits

**Subject Conversion**: Automatically converts Hebrew display names to database keys for accurate matching.`,
      parameters: [
        {
          name: 'subject',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Filter by subject (supports Hebrew and English)',
          example: 'mathematics'
        },
        {
          name: 'gradeMin',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 12 },
          description: 'Minimum grade level (1-12)',
          example: 3
        },
        {
          name: 'gradeMax',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 12 },
          description: 'Maximum grade level (1-12)',
          example: 5
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          description: 'Maximum results to return (1-100)',
          example: 50
        },
        {
          name: 'subjects',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['true'] },
          description: 'Return available subjects instead of curricula',
          example: 'true'
        },
        {
          name: 'gradeRanges',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['true'] },
          description: 'Return available grade ranges instead of curricula',
          example: 'true'
        }
      ],
      responses: {
        200: {
          description: 'Curricula browsed successfully (response varies by mode)',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    type: 'object',
                    title: 'Normal Browse Results',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          curricula: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/CurriculumBrowseResult' }
                          },
                          searchCriteria: {
                            type: 'object',
                            properties: {
                              subject: { type: 'string' },
                              gradeMin: { type: 'integer' },
                              gradeMax: { type: 'integer' }
                            }
                          },
                          total: { type: 'integer', example: 25 }
                        }
                      }
                    }
                  },
                  {
                    type: 'object',
                    title: 'Subjects List',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          subjects: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['mathematics', 'science', 'language_arts', 'social_studies']
                          }
                        }
                      }
                    }
                  },
                  {
                    type: 'object',
                    title: 'Grade Ranges List',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          gradeRanges: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                min: { type: 'integer', example: 1 },
                                max: { type: 'integer', example: 3 },
                                type: { type: 'string', example: 'range' },
                                display: { type: 'string', example: 'Grades 1-3' },
                                key: { type: 'string', example: 'grades_1_3' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              },
              examples: {
                normalBrowse: {
                  summary: 'Browse math curricula for grades 3-5',
                  value: {
                    success: true,
                    data: {
                      curricula: [
                        {
                          id: 'curr_456def',
                          name: 'Primary Mathematics',
                          description: 'Core math skills for elementary students',
                          subject: 'mathematics',
                          gradeRange: 'grades_3_5',
                          isActive: true,
                          items: [
                            {
                              id: 'item_789ghi',
                              name: 'Addition and Subtraction',
                              description: 'Basic arithmetic operations',
                              order_index: 1,
                              linkedProductsCount: 5
                            }
                          ]
                        }
                      ],
                      searchCriteria: {
                        subject: 'mathematics',
                        gradeMin: 3,
                        gradeMax: 5
                      },
                      total: 1
                    }
                  }
                },
                subjectsList: {
                  summary: 'Available subjects',
                  value: {
                    success: true,
                    data: {
                      subjects: ['mathematics', 'science', 'language_arts', 'social_studies', 'hebrew', 'english']
                    }
                  }
                },
                gradeRangesList: {
                  summary: 'Available grade ranges',
                  value: {
                    success: true,
                    data: {
                      gradeRanges: [
                        { min: 1, max: 3, type: 'range', display: 'Grades 1-3', key: 'grades_1_3' },
                        { min: 4, max: 6, type: 'range', display: 'Grades 4-6', key: 'grades_4_6' },
                        { min: 7, max: 9, type: 'range', display: 'Grades 7-9', key: 'grades_7_9' }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid query parameters',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/curriculum-linking/bulk': {
    post: {
      tags: ['Curriculum Integration'],
      summary: 'Perform bulk curriculum operations',
      description: `**Bulk Curriculum Operations**: Efficiently process multiple curriculum linking operations in a single request.

**Supported Operations:**
- **apply**: Link curriculum items to products
- **remove**: Remove existing curriculum links

**Features:**
- Mixed operation types in single request (up to 20 operations)
- Individual operation success/failure tracking
- Comprehensive ownership validation per operation
- Admin support for orphaned products
- Detailed timing and performance metrics

**Error Handling**: Individual operations can fail without affecting others - detailed error reporting per operation.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['operations'],
              properties: {
                operations: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 20,
                  description: 'List of operations to perform (1-20 operations)',
                  items: {
                    oneOf: [
                      {
                        type: 'object',
                        title: 'Apply Operation',
                        required: ['type', 'productId', 'curriculumItemIds'],
                        properties: {
                          type: { type: 'string', enum: ['apply'] },
                          productId: { type: 'string', example: 'prod_123abc' },
                          curriculumItemIds: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['item_789ghi', 'item_890hij']
                          }
                        }
                      },
                      {
                        type: 'object',
                        title: 'Remove Operation',
                        required: ['type', 'curriculumProductId'],
                        properties: {
                          type: { type: 'string', enum: ['remove'] },
                          curriculumProductId: { type: 'string', example: 'cp_111aaa' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            examples: {
              mixedOperations: {
                summary: 'Mixed apply and remove operations',
                value: {
                  operations: [
                    {
                      type: 'apply',
                      productId: 'prod_123abc',
                      curriculumItemIds: ['item_789ghi', 'item_890hij']
                    },
                    {
                      type: 'remove',
                      curriculumProductId: 'cp_111aaa'
                    },
                    {
                      type: 'apply',
                      productId: 'prod_456def',
                      curriculumItemIds: ['item_901jkl']
                    }
                  ]
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Bulk operations completed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'array',
                        description: 'Successfully completed operations',
                        items: {
                          oneOf: [
                            {
                              type: 'object',
                              title: 'Successful Apply',
                              properties: {
                                type: { type: 'string', example: 'apply' },
                                productId: { type: 'string', example: 'prod_123abc' },
                                result: {
                                  type: 'object',
                                  properties: {
                                    success: { type: 'array' },
                                    errors: { type: 'array' },
                                    skipped: { type: 'array' }
                                  }
                                }
                              }
                            },
                            {
                              type: 'object',
                              title: 'Successful Remove',
                              properties: {
                                type: { type: 'string', example: 'remove' },
                                curriculumProductId: { type: 'string', example: 'cp_111aaa' },
                                success: { type: 'boolean', example: true }
                              }
                            }
                          ]
                        }
                      },
                      errors: {
                        type: 'array',
                        description: 'Failed operations',
                        items: {
                          type: 'object',
                          properties: {
                            operation: { type: 'object' },
                            error: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  message: { type: 'string', example: 'Processed 2 operations successfully, 1 errors' }
                }
              },
              examples: {
                bulkSuccess: {
                  summary: 'Successful bulk operations',
                  value: {
                    success: true,
                    data: {
                      success: [
                        {
                          type: 'apply',
                          productId: 'prod_123abc',
                          result: {
                            success: [
                              {
                                curriculumItemId: 'item_789ghi',
                                curriculumProductId: 'cp_333ccc',
                                curriculumItemName: 'Addition and Subtraction'
                              }
                            ],
                            errors: [],
                            skipped: []
                          }
                        },
                        {
                          type: 'remove',
                          curriculumProductId: 'cp_111aaa',
                          success: true
                        }
                      ],
                      errors: []
                    },
                    message: 'Processed 2 operations successfully, 0 errors'
                  }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  }
};