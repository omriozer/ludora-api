// OpenAPI documentation for educational content management
// Comprehensive content creation, file uploads, and streaming with analytics

export default {
  '/edu-content': {
    get: {
      tags: ['Educational Content'],
      summary: 'List and search educational content',
      description: `
        **Educational Content Discovery**: Search and browse educational content with advanced filtering.

        **Content Types Supported:**
        - **data** - Text-based educational content and information
        - **playing_card_complete** - Complete playing card designs for memory games
        - **playing_card_bg** - Playing card background templates

        **Search Features:**
        - Full-text search across content fields
        - Element type filtering for specific content categories
        - Pagination with configurable limits
        - Relevance-based result ordering

        **Public Access:** No authentication required for content browsing

        **Used By:** Content discovery interfaces, game content selection, educational resource browsers
      `,
      parameters: [
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string', maxLength: 100 },
          description: 'Search term for content discovery',
          example: 'mathematics'
        },
        {
          name: 'element_type',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['data', 'playing_card_complete', 'playing_card_bg']
          },
          description: 'Filter by content element type',
          example: 'playing_card_complete'
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Maximum number of results to return',
          example: 20
        },
        {
          name: 'offset',
          in: 'query',
          schema: { type: 'integer', minimum: 0, default: 0 },
          description: 'Number of results to skip for pagination',
          example: 0
        }
      ],
      responses: {
        200: {
          description: 'Educational content retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'edu_content_abc123' },
                        element_type: {
                          type: 'string',
                          enum: ['data', 'playing_card_complete', 'playing_card_bg'],
                          description: 'Type of educational content'
                        },
                        content: {
                          type: 'string',
                          description: 'Content text or description',
                          example: 'Basic addition facts for elementary students'
                        },
                        content_metadata: {
                          type: 'object',
                          description: 'Additional metadata specific to content type',
                          properties: {
                            subject: { type: 'string', example: 'mathematics' },
                            grade_level: { type: 'string', example: '2nd grade' },
                            difficulty: { type: 'string', example: 'beginner' },
                            tags: { type: 'array', items: { type: 'string' } }
                          }
                        },
                        file_url: {
                          type: 'string',
                          nullable: true,
                          description: 'URL for streaming associated file',
                          example: '/api/edu-content/abc123/file'
                        },
                        has_file: { type: 'boolean', description: 'Whether content has associated file' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                        creator_info: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' }
                          },
                          description: 'Information about content creator'
                        }
                      }
                    }
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer', description: 'Total number of matching items' },
                      limit: { type: 'integer' },
                      offset: { type: 'integer' },
                      has_more: { type: 'boolean' }
                    }
                  },
                  filters_applied: {
                    type: 'object',
                    properties: {
                      search: { type: 'string', nullable: true },
                      element_type: { type: 'string', nullable: true }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid search parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Validation error' },
                  details: { type: 'string', example: 'search must be less than 100 characters' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['Educational Content', 'Content Creation'],
      summary: 'Create text-based educational content',
      description: `
        **Educational Content Creation**: Create new text-based educational content items.

        **Content Creation Features:**
        - Text-based educational content without file attachments
        - Structured metadata for educational categorization
        - Element type classification for content organization
        - Creator attribution and ownership tracking

        **Rate Limiting:** 50 content items per 15 minutes per user to prevent spam

        **Content Validation:**
        - Maximum 1000 characters for content text
        - Required element type specification
        - Structured metadata validation

        **Authentication Required:** Only authenticated users can create content

        **Used By:** Content creator tools, educational resource builders, game content editors
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                element_type: {
                  type: 'string',
                  enum: ['data', 'playing_card_complete', 'playing_card_bg'],
                  description: 'Type of educational content being created'
                },
                content: {
                  type: 'string',
                  maxLength: 1000,
                  description: 'Educational content text or description',
                  example: 'Introduction to basic arithmetic operations for second grade students'
                },
                content_metadata: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string', example: 'mathematics' },
                    grade_level: { type: 'string', example: '2nd grade' },
                    difficulty: { type: 'string', example: 'beginner' },
                    learning_objectives: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Understand addition', 'Practice number recognition']
                    },
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['math', 'elementary', 'addition']
                    }
                  },
                  description: 'Educational metadata and categorization',
                  default: {}
                }
              },
              required: ['element_type', 'content'],
              example: {
                element_type: 'data',
                content: 'Basic addition facts: 2+2=4, 3+3=6, 4+4=8',
                content_metadata: {
                  subject: 'mathematics',
                  grade_level: '2nd grade',
                  difficulty: 'beginner',
                  learning_objectives: ['Addition facts', 'Number patterns'],
                  tags: ['math', 'addition', 'elementary']
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Educational content created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'edu_content_abc123' },
                  element_type: { type: 'string' },
                  content: { type: 'string' },
                  content_metadata: { type: 'object' },
                  has_file: { type: 'boolean', example: false },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  creator_id: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid content data',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Validation error' },
                  details: { type: 'string', example: 'element_type must be one of: data, playing_card_complete, playing_card_bg' }
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
                  error: { type: 'string', example: 'Too many content creation requests, please try again later' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/edu-content/upload': {
    post: {
      tags: ['Educational Content', 'File Upload'],
      summary: 'Create educational content with file upload',
      description: `
        **Educational Content with File Upload**: Create content items with associated files such as images or documents.

        **Supported File Types:**
        - **Images** - JPEG, PNG, SVG, WebP for visual educational content
        - **Documents** - PDF for educational materials and worksheets
        - **Text Files** - Plain text for structured educational data

        **File Size Limits:**
        - Maximum 50MB per file
        - Automatic file type validation
        - S3 storage integration for secure file handling

        **Upload Process:**
        - File upload with content metadata
        - Transaction safety for file and database operations
        - Automatic file cleanup on creation failure
        - Content metadata parsing from form data

        **Educational Applications:**
        - Playing card images for memory games
        - Worksheet PDFs for educational activities
        - Visual learning materials and diagrams

        **Rate Limiting:** Same rate limits as text content creation (50/15min)
      `,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'Educational content file (image, PDF, or text)'
                },
                element_type: {
                  type: 'string',
                  enum: ['data', 'playing_card_complete', 'playing_card_bg'],
                  description: 'Type of educational content'
                },
                content: {
                  type: 'string',
                  maxLength: 1000,
                  description: 'Content description or text'
                },
                content_metadata: {
                  type: 'string',
                  description: 'JSON string containing educational metadata',
                  example: '{"subject":"mathematics","grade_level":"2nd grade","difficulty":"beginner"}'
                }
              },
              required: ['file', 'element_type', 'content']
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Educational content with file created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'edu_content_def456' },
                  element_type: { type: 'string', example: 'playing_card_complete' },
                  content: { type: 'string' },
                  content_metadata: { type: 'object' },
                  has_file: { type: 'boolean', example: true },
                  file_info: {
                    type: 'object',
                    properties: {
                      filename: { type: 'string', example: 'math_card.png' },
                      mimetype: { type: 'string', example: 'image/png' },
                      size: { type: 'integer', example: 245760 },
                      s3_key: { type: 'string', description: 'S3 storage key' }
                    }
                  },
                  file_url: {
                    type: 'string',
                    example: '/api/edu-content/def456/file',
                    description: 'URL for streaming the uploaded file'
                  },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  creator_id: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          description: 'File upload validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  message: { type: 'string' }
                },
                examples: [
                  { error: 'No file uploaded' },
                  { error: 'File validation error', message: 'File type image/gif not allowed' },
                  { error: 'File too large', message: 'File size must be less than 50MB' }
                ]
              }
            }
          }
        }
      }
    }
  },

  '/edu-content/{id}': {
    get: {
      tags: ['Educational Content'],
      summary: 'Get single educational content item',
      description: `
        **Educational Content Details**: Retrieve complete information for a specific educational content item.

        **Content Information:**
        - Complete content metadata and educational categorization
        - File information and streaming URLs (if applicable)
        - Creator attribution and timestamps
        - Usage statistics and analytics data

        **Public Access:** No authentication required for content viewing

        **Used By:** Content viewers, educational games, lesson plan integration
      `,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Educational content identifier',
          example: 'edu_content_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Educational content retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  element_type: {
                    type: 'string',
                    enum: ['data', 'playing_card_complete', 'playing_card_bg']
                  },
                  content: { type: 'string' },
                  content_metadata: {
                    type: 'object',
                    description: 'Educational metadata and categorization'
                  },
                  has_file: { type: 'boolean' },
                  file_info: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      filename: { type: 'string' },
                      mimetype: { type: 'string' },
                      size: { type: 'integer' }
                    }
                  },
                  file_url: {
                    type: 'string',
                    nullable: true,
                    description: 'URL for streaming associated file'
                  },
                  usage_stats: {
                    type: 'object',
                    properties: {
                      view_count: { type: 'integer' },
                      download_count: { type: 'integer' },
                      last_accessed: { type: 'string', format: 'date-time' }
                    }
                  },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  creator_info: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Educational content not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Content not found' }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ['Educational Content', 'Content Management'],
      summary: 'Update educational content metadata',
      description: `
        **Content Metadata Updates**: Modify educational content information and categorization.

        **Updateable Fields:**
        - Content text and descriptions
        - Educational metadata and categorization
        - Learning objectives and tags
        - Difficulty and grade level assignments

        **File Preservation:** File uploads cannot be changed through this endpoint (files are immutable)

        **Access Control:** Only content creators and administrators can update content

        **Transaction Safety:** All updates use database transactions for consistency
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Educational content identifier to update',
          example: 'edu_content_abc123'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  maxLength: 1000,
                  description: 'Updated content text or description',
                  example: 'Advanced addition facts with carrying for third grade students'
                },
                content_metadata: {
                  type: 'object',
                  description: 'Updated educational metadata',
                  properties: {
                    subject: { type: 'string' },
                    grade_level: { type: 'string' },
                    difficulty: { type: 'string' },
                    learning_objectives: { type: 'array', items: { type: 'string' } },
                    tags: { type: 'array', items: { type: 'string' } }
                  },
                  example: {
                    subject: 'mathematics',
                    grade_level: '3rd grade',
                    difficulty: 'intermediate',
                    learning_objectives: ['Addition with carrying', 'Multi-digit arithmetic'],
                    tags: ['math', 'addition', 'carrying', 'intermediate']
                  }
                }
              },
              minProperties: 1
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Educational content updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  element_type: { type: 'string' },
                  content: { type: 'string' },
                  content_metadata: { type: 'object' },
                  updated_at: { type: 'string', format: 'date-time' },
                  last_modified_by: { type: 'string' }
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
                  error: { type: 'string', example: 'Validation error' },
                  details: { type: 'string', example: 'content must be less than 1000 characters' }
                }
              }
            }
          }
        },
        404: {
          description: 'Content not found or access denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Content not found' }
                }
              }
            }
          }
        }
      }
    },
    delete: {
      tags: ['Educational Content', 'Content Management'],
      summary: 'Delete educational content',
      description: `
        **Content Deletion with Cleanup**: Permanently removes educational content and associated files.

        **Deletion Process:**
        - Removes content record from database
        - Deletes associated files from S3 storage
        - Cleans up all related usage tracking data
        - Maintains referential integrity with related systems

        **Transaction Safety:** All deletion operations use database transactions

        **Access Control:** Only content creators and administrators can delete content

        **Data Preservation:** Consider archiving important educational content instead of deletion

        **Used By:** Content management interfaces, cleanup processes, content moderation
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Educational content identifier to delete',
          example: 'edu_content_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Educational content deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Content deleted successfully' },
                  deleted_content_id: { type: 'string' },
                  files_deleted: {
                    type: 'boolean',
                    description: 'Whether associated files were removed from storage'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Content not found or access denied',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Content not found' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/edu-content/{id}/file': {
    get: {
      tags: ['Educational Content', 'File Streaming'],
      summary: 'Stream educational content file',
      description: `
        **Educational File Streaming**: Secure file streaming for educational content files.

        **Streaming Features:**
        - Direct file streaming from S3 storage
        - Automatic content-type detection
        - Byte-range support for large files
        - Secure access without exposing S3 URLs

        **Supported File Types:**
        - Images (JPEG, PNG, SVG, WebP) for visual educational content
        - PDFs for educational documents and worksheets
        - Text files for structured educational data

        **Public Access:** No authentication required for file streaming

        **Used By:** Educational games, content viewers, lesson plan displays, card game interfaces

        **Performance:** Optimized for educational applications with caching headers
      `,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Educational content identifier',
          example: 'edu_content_abc123'
        }
      ],
      responses: {
        200: {
          description: 'File streamed successfully',
          headers: {
            'Content-Type': {
              schema: { type: 'string' },
              description: 'MIME type of the educational file',
              example: 'image/png'
            },
            'Content-Length': {
              schema: { type: 'integer' },
              description: 'File size in bytes'
            },
            'Content-Disposition': {
              schema: { type: 'string' },
              description: 'File download disposition',
              example: 'inline; filename="math_card.png"'
            },
            'Cache-Control': {
              schema: { type: 'string' },
              description: 'Caching directives for educational content',
              example: 'public, max-age=3600'
            }
          },
          content: {
            'application/octet-stream': {
              schema: {
                type: 'string',
                format: 'binary',
                description: 'Educational content file data'
              }
            }
          }
        },
        404: {
          description: 'Content or file not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                },
                examples: [
                  { error: 'Content not found' },
                  { error: 'File not found for this content' }
                ]
              }
            }
          }
        }
      }
    }
  },

  '/edu-content/{id}/usage': {
    get: {
      tags: ['Educational Content', 'Analytics'],
      summary: 'Get content usage statistics',
      description: `
        **Educational Content Analytics**: Comprehensive usage statistics for educational content tracking.

        **Usage Statistics:**
        - **View Counts** - Number of times content was accessed
        - **Download Statistics** - File download frequency and patterns
        - **Game Integration** - Usage in educational games and activities
        - **Time-based Analytics** - Access patterns and peak usage times

        **Educational Insights:**
        - Content effectiveness measurements
        - Student engagement analytics
        - Popular educational categories
        - Learning outcome correlations

        **Public Access:** No authentication required for basic usage statistics

        **Used By:** Educational dashboards, content creators, learning analytics, administration reports
      `,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Educational content identifier',
          example: 'edu_content_abc123'
        }
      ],
      responses: {
        200: {
          description: 'Usage statistics retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content_id: { type: 'string' },
                  content_type: { type: 'string' },
                  usage_summary: {
                    type: 'object',
                    properties: {
                      total_views: { type: 'integer', example: 1247 },
                      total_downloads: { type: 'integer', example: 89 },
                      unique_users: { type: 'integer', example: 156 },
                      total_game_uses: { type: 'integer', example: 78 }
                    }
                  },
                  time_analytics: {
                    type: 'object',
                    properties: {
                      first_accessed: { type: 'string', format: 'date-time' },
                      last_accessed: { type: 'string', format: 'date-time' },
                      peak_usage_day: { type: 'string', example: 'Tuesday' },
                      peak_usage_hour: { type: 'integer', example: 14 }
                    }
                  },
                  educational_metrics: {
                    type: 'object',
                    properties: {
                      games_created: {
                        type: 'integer',
                        description: 'Number of games using this content'
                      },
                      lesson_plans_referenced: {
                        type: 'integer',
                        description: 'Number of lesson plans including this content'
                      },
                      student_interactions: {
                        type: 'integer',
                        description: 'Total student interactions with this content'
                      }
                    }
                  },
                  content_effectiveness: {
                    type: 'object',
                    properties: {
                      average_session_duration: {
                        type: 'number',
                        description: 'Average time spent with this content (minutes)'
                      },
                      completion_rate: {
                        type: 'number',
                        description: 'Percentage of users who fully engaged with content'
                      },
                      educational_impact_score: {
                        type: 'number',
                        description: 'Calculated educational effectiveness score (0-100)'
                      }
                    }
                  },
                  recent_usage: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string', format: 'date' },
                        views: { type: 'integer' },
                        downloads: { type: 'integer' },
                        game_uses: { type: 'integer' }
                      }
                    },
                    description: 'Daily usage statistics for the past 30 days'
                  }
                }
              },
              example: {
                content_id: 'edu_content_abc123',
                content_type: 'playing_card_complete',
                usage_summary: {
                  total_views: 1247,
                  total_downloads: 89,
                  unique_users: 156,
                  total_game_uses: 78
                },
                educational_metrics: {
                  games_created: 12,
                  lesson_plans_referenced: 5,
                  student_interactions: 892
                },
                content_effectiveness: {
                  average_session_duration: 8.5,
                  completion_rate: 0.73,
                  educational_impact_score: 85.2
                }
              }
            }
          }
        }
      }
    }
  }
};