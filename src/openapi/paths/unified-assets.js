export default {
  '/assets/{entityType}/{entityId}': {
    get: {
      tags: ['Asset Management'],
      summary: 'Check all assets for entity',
      description: `**Comprehensive Asset Inventory System**: Provides complete information about all assets associated with an entity, including existence status, metadata, and access URLs.

**Key Features:**
- Asset discovery for all supported types per entity
- S3 storage integration with metadata retrieval
- Access URL generation for existing assets
- Upload capability assessment for missing assets
- Database-driven filename resolution for documents

**Supported Entity-Asset Combinations:**
- **Workshop**: marketing-video, content-video, image
- **Course**: marketing-video, content-video, image
- **File**: document, marketing-video, image
- **Tool**: marketing-video, content-video, image

**Response Structure**: Returns comprehensive asset inventory with existence status, sizes, content types, and actionable URLs.`,
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['workshop', 'course', 'file', 'tool']
          },
          description: 'Type of entity to check assets for',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
          example: 'ws_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Asset inventory retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      entityType: { type: 'string', example: 'workshop' },
                      entityId: { type: 'string', example: 'ws_123abc' },
                      entity: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          type: { type: 'string' }
                        }
                      },
                      assets: {
                        type: 'object',
                        description: 'Asset inventory by type',
                        additionalProperties: {
                          oneOf: [
                            {
                              type: 'object',
                              title: 'Existing Asset',
                              properties: {
                                exists: { type: 'boolean', example: true },
                                filename: { type: 'string', example: 'video.mp4' },
                                size: { type: 'integer', example: 15728640 },
                                sizeFormatted: { type: 'string', example: '15.0MB' },
                                contentType: { type: 'string', example: 'video/mp4' },
                                lastModified: { type: 'string', format: 'date-time' },
                                url: { type: 'string', example: '/api/assets/workshop/ws_123abc/marketing-video' },
                                canReplace: { type: 'boolean', example: true }
                              }
                            },
                            {
                              type: 'object',
                              title: 'Missing Asset',
                              properties: {
                                exists: { type: 'boolean', example: false },
                                reason: { type: 'string', example: 'Not found in storage' },
                                canUpload: { type: 'boolean', example: true },
                                uploadUrl: { type: 'string', example: '/api/assets/workshop/ws_123abc/content-video' }
                              }
                            }
                          ]
                        }
                      },
                      summary: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer', description: 'Total possible asset types', example: 3 },
                          existing: { type: 'integer', description: 'Assets that exist', example: 1 },
                          missing: { type: 'integer', description: 'Assets that don\'t exist', example: 2 }
                        }
                      }
                    }
                  },
                  requestId: { type: 'string' }
                }
              },
              examples: {
                workshopAssets: {
                  summary: 'Workshop with mixed asset availability',
                  value: {
                    success: true,
                    data: {
                      entityType: 'workshop',
                      entityId: 'ws_123abc',
                      entity: { id: 'ws_123abc', type: 'workshop' },
                      assets: {
                        'marketing-video': {
                          exists: true,
                          filename: 'video.mp4',
                          size: 15728640,
                          sizeFormatted: '15.0MB',
                          contentType: 'video/mp4',
                          lastModified: '2024-12-10T15:30:00Z',
                          url: '/api/assets/workshop/ws_123abc/marketing-video',
                          canReplace: true
                        },
                        'content-video': {
                          exists: false,
                          reason: 'Not found in storage',
                          canUpload: true,
                          uploadUrl: '/api/assets/workshop/ws_123abc/content-video'
                        },
                        'image': {
                          exists: false,
                          reason: 'Not found in storage',
                          canUpload: true,
                          uploadUrl: '/api/assets/workshop/ws_123abc/image'
                        }
                      },
                      summary: {
                        total: 3,
                        existing: 1,
                        missing: 2
                      }
                    },
                    requestId: 'req_789def'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Entity not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    },
    delete: {
      tags: ['Asset Management'],
      summary: 'Delete all assets for entity',
      description: `**Cascade Asset Deletion**: Safely removes ALL assets associated with an entity using atomic transactions.

**Critical Features:**
- **Atomic Operations**: Database transactions ensure all-or-nothing deletion
- **Comprehensive Coverage**: Deletes all supported asset types for entity
- **S3 Integration**: Removes files from cloud storage
- **Database Cleanup**: Updates entity records after successful deletion
- **Rollback Safety**: Automatic rollback on any failure

**Use Cases:**
- Entity deletion cleanup
- Complete asset reset
- Storage space recovery

**⚠️ Warning**: This operation cannot be undone. Use with caution as it removes ALL assets for the entity.`,
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['workshop', 'course', 'file', 'tool']
          },
          description: 'Type of entity to delete assets for',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
          example: 'ws_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Assets deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      entityType: { type: 'string', example: 'workshop' },
                      entityId: { type: 'string', example: 'ws_123abc' },
                      deletionResults: {
                        type: 'object',
                        description: 'Results for each asset type deletion',
                        additionalProperties: {
                          oneOf: [
                            {
                              type: 'object',
                              title: 'Successful Deletion',
                              properties: {
                                deleted: { type: 'boolean', example: true },
                                s3Key: { type: 'string', example: 'private/marketing-video/workshop/ws_123abc/video.mp4' },
                                filename: { type: 'string', example: 'video.mp4' },
                                databaseUpdated: { type: 'boolean', example: true }
                              }
                            },
                            {
                              type: 'object',
                              title: 'Failed Deletion',
                              properties: {
                                deleted: { type: 'boolean', example: false },
                                reason: { type: 'string', example: 'Asset not found in storage' },
                                error: { type: 'string' },
                                s3Key: { type: 'string' }
                              }
                            }
                          ]
                        }
                      },
                      summary: {
                        type: 'object',
                        properties: {
                          totalAssets: { type: 'integer', example: 3 },
                          deleted: { type: 'integer', example: 2 },
                          errors: { type: 'integer', example: 1 },
                          success: { type: 'boolean', example: false }
                        }
                      },
                      message: { type: 'string', example: '2 assets deleted, 1 errors occurred' }
                    }
                  },
                  requestId: { type: 'string' }
                }
              }
            }
          }
        },
        403: {
          description: 'Permission denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        404: {
          description: 'Entity not found',
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

  '/assets/{entityType}/{entityId}/{assetType}': {
    get: {
      tags: ['Asset Management'],
      summary: 'Download/serve specific asset',
      description: `**Intelligent Asset Serving System**: Content-negotiated asset delivery with format-specific optimizations and access control.

**Content Negotiation by Asset Type:**

**📹 Videos (marketing-video, content-video):**
- HTTP range request support for streaming
- Efficient partial content delivery (206 responses)
- Optimized caching headers
- MP4 format with proper MIME types

**🖼️ Images:**
- Direct inline serving with browser caching
- Optimized cache headers (24-hour TTL)
- JPEG format with ETag support

**📄 Documents:**
- Secure download with original filename preservation
- Content-Disposition headers for proper downloads
- Access control integration
- Database-driven filename resolution

**Performance Features:**
- S3 direct streaming (no server buffering)
- Range request support for large files
- Efficient caching strategy per content type
- ETag-based conditional requests`,
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['workshop', 'course', 'file', 'tool']
          },
          description: 'Type of entity',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
          example: 'ws_123abc'
        },
        {
          name: 'assetType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['marketing-video', 'content-video', 'image', 'document']
          },
          description: 'Type of asset to serve',
          example: 'marketing-video'
        },
        {
          name: 'Range',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'HTTP Range header for partial content requests',
          example: 'bytes=0-1023'
        }
      ],
      responses: {
        200: {
          description: 'Asset served successfully (full content)',
          headers: {
            'Content-Type': {
              schema: { type: 'string' },
              description: 'MIME type based on asset type'
            },
            'Content-Length': {
              schema: { type: 'integer' },
              description: 'Size of the asset in bytes'
            },
            'Cache-Control': {
              schema: { type: 'string' },
              description: 'Caching policy based on asset type'
            },
            'ETag': {
              schema: { type: 'string' },
              description: 'Entity tag for caching'
            }
          },
          content: {
            'video/mp4': {
              schema: { type: 'string', format: 'binary' }
            },
            'image/jpeg': {
              schema: { type: 'string', format: 'binary' }
            },
            'application/pdf': {
              schema: { type: 'string', format: 'binary' }
            },
            'application/octet-stream': {
              schema: { type: 'string', format: 'binary' }
            }
          }
        },
        206: {
          description: 'Partial content (range request)',
          headers: {
            'Content-Range': {
              schema: { type: 'string' },
              description: 'Range of bytes served',
              example: 'bytes 0-1023/15728640'
            },
            'Accept-Ranges': {
              schema: { type: 'string', example: 'bytes' }
            },
            'Content-Length': {
              schema: { type: 'integer' },
              description: 'Size of the partial content'
            }
          },
          content: {
            'video/mp4': {
              schema: { type: 'string', format: 'binary' }
            }
          }
        },
        400: {
          description: 'Invalid asset type for entity',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  message: 'Invalid asset type',
                  details: 'Asset type \'document\' is not supported for entity type \'workshop\'',
                  validAssetTypes: ['marketing-video', 'content-video', 'image'],
                  providedAssetType: 'document',
                  entityType: 'workshop'
                }
              }
            }
          }
        },
        404: {
          description: 'Asset not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    },
    post: {
      tags: ['Asset Management'],
      summary: 'Upload/replace specific asset',
      description: `**Unified Asset Upload System**: Comprehensive file upload with validation, processing, and atomic transactions.

**Upload Features:**
- **Multi-format Support**: Videos (MP4), Images (JPEG), Documents (PDF, etc.)
- **Size Validation**: Up to 5GB per file with format-specific limits
- **Content Validation**: MIME type verification and content analysis
- **Atomic Operations**: Database transactions for upload consistency
- **S3 Integration**: Direct cloud storage with metadata preservation
- **Original Name Handling**: Optional preservation of original filenames

**Validation Pipeline:**
1. **Entity Validation**: Verifies entity exists and is accessible
2. **Permission Validation**: Confirms user can upload to entity
3. **Asset Type Validation**: Ensures asset type is supported for entity
4. **File Content Validation**: Validates MIME type and content integrity
5. **Upload Processing**: Atomic S3 upload with database updates

**Transaction Safety**: All operations use database transactions - if any step fails, all changes are rolled back.`,
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['workshop', 'course', 'file', 'tool']
          },
          description: 'Type of entity',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
          example: 'ws_123abc'
        },
        {
          name: 'assetType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['marketing-video', 'content-video', 'image', 'document']
          },
          description: 'Type of asset to upload',
          example: 'marketing-video'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'Asset file to upload (max 5GB)'
                },
                preserveOriginalName: {
                  type: 'string',
                  enum: ['true', 'false'],
                  default: 'false',
                  description: 'Whether to preserve the original filename'
                }
              }
            },
            examples: {
              videoUpload: {
                summary: 'Upload marketing video',
                value: {
                  file: '(binary video file)',
                  preserveOriginalName: 'false'
                }
              },
              documentUpload: {
                summary: 'Upload document with original name',
                value: {
                  file: '(binary document file)',
                  preserveOriginalName: 'true'
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Asset uploaded successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      message: { type: 'string', example: 'Asset uploaded successfully' },
                      asset: {
                        type: 'object',
                        properties: {
                          entityType: { type: 'string', example: 'workshop' },
                          entityId: { type: 'string', example: 'ws_123abc' },
                          assetType: { type: 'string', example: 'marketing-video' },
                          filename: { type: 'string', example: 'video.mp4' },
                          originalName: { type: 'string', example: 'my-marketing-video.mp4' },
                          s3Key: { type: 'string', example: 'private/marketing-video/workshop/ws_123abc/video.mp4' },
                          size: { type: 'integer', example: 15728640 },
                          sizeFormatted: { type: 'string', example: '15.0MB' },
                          mimeType: { type: 'string', example: 'video/mp4' },
                          accessLevel: { type: 'string', example: 'private' },
                          uploadedBy: { type: 'string', example: 'user_456def' },
                          uploadedAt: { type: 'string', format: 'date-time' },
                          url: { type: 'string', example: '/api/assets/workshop/ws_123abc/marketing-video' },
                          downloadUrl: { type: 'string' },
                          etag: { type: 'string' }
                        }
                      },
                      integrity: {
                        type: 'object',
                        description: 'File integrity validation results'
                      },
                      analysis: {
                        type: 'object',
                        description: 'Content analysis results'
                      }
                    }
                  },
                  requestId: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid file or asset type',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                noFile: {
                  summary: 'No file provided',
                  value: {
                    success: false,
                    error: {
                      message: 'No file provided',
                      details: 'File upload requires a file to be attached',
                      field: 'file'
                    }
                  }
                },
                invalidAssetType: {
                  summary: 'Invalid asset type',
                  value: {
                    success: false,
                    error: {
                      message: 'Invalid asset type',
                      details: 'Asset type \'document\' is not supported for entity type \'workshop\'',
                      validAssetTypes: ['marketing-video', 'content-video', 'image']
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Permission denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        413: {
          description: 'File too large',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  message: 'File too large',
                  details: 'File exceeds the maximum allowed size (5GB)',
                  maxSize: '5GB',
                  errorCode: 'LIMIT_FILE_SIZE'
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    },
    put: {
      tags: ['Asset Management'],
      summary: 'Replace specific asset',
      description: `**Semantic Asset Replacement**: Same functionality as POST but with explicit replace semantics for clarity.

This endpoint has identical behavior to the POST method but provides semantic clarity when the intent is to replace an existing asset rather than upload a new one.

**Use Cases:**
- Replacing existing marketing videos with updated versions
- Updating image assets with new versions
- Replacing document files with revised content

**Note**: Internally processed as POST for unified handling.`,
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['workshop', 'course', 'file', 'tool']
          },
          description: 'Type of entity',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
          example: 'ws_123abc'
        },
        {
          name: 'assetType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['marketing-video', 'content-video', 'image', 'document']
          },
          description: 'Type of asset to replace',
          example: 'marketing-video'
        }
      ],
      requestBody: {
        $ref: '#/paths/~1assets~1{entityType}~1{entityId}~1{assetType}/post/requestBody'
      },
      responses: {
        $ref: '#/paths/~1assets~1{entityType}~1{entityId}~1{assetType}/post/responses'
      },
      security: [{ BearerAuth: [] }]
    },
    delete: {
      tags: ['Asset Management'],
      summary: 'Delete specific asset',
      description: `**Selective Asset Deletion**: Safely removes a specific asset type while preserving other assets for the entity.

**Key Features:**
- **Surgical Deletion**: Removes only the specified asset type
- **S3 Integration**: Deletes files from cloud storage
- **Database Consistency**: Updates entity records after successful deletion
- **Transaction Safety**: Atomic operations with automatic rollback on failure
- **Graceful Handling**: Reports success even if asset was already missing

**Use Cases:**
- Remove outdated marketing videos
- Delete temporary uploaded content
- Clean up unused asset types
- Selective storage space recovery

**Safety**: Unlike the entity-level delete, this operation only affects the specified asset type.`,
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['workshop', 'course', 'file', 'tool']
          },
          description: 'Type of entity',
          example: 'workshop'
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
          example: 'ws_123abc'
        },
        {
          name: 'assetType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['marketing-video', 'content-video', 'image', 'document']
          },
          description: 'Type of asset to delete',
          example: 'marketing-video'
        }
      ],
      responses: {
        200: {
          description: 'Asset deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    oneOf: [
                      {
                        type: 'object',
                        title: 'Successful Deletion',
                        properties: {
                          message: { type: 'string', example: 'Asset deleted successfully' },
                          asset: {
                            type: 'object',
                            properties: {
                              entityType: { type: 'string', example: 'workshop' },
                              entityId: { type: 'string', example: 'ws_123abc' },
                              assetType: { type: 'string', example: 'marketing-video' },
                              filename: { type: 'string', example: 'video.mp4' },
                              s3Key: { type: 'string', example: 'private/marketing-video/workshop/ws_123abc/video.mp4' },
                              deletedBy: { type: 'string', example: 'user_456def' },
                              deletedAt: { type: 'string', format: 'date-time' },
                              databaseUpdated: { type: 'boolean', example: true }
                            }
                          }
                        }
                      },
                      {
                        type: 'object',
                        title: 'Already Deleted',
                        properties: {
                          message: { type: 'string', example: 'Asset was not found (already deleted or never uploaded)' },
                          asset: {
                            type: 'object',
                            properties: {
                              entityType: { type: 'string' },
                              entityId: { type: 'string' },
                              assetType: { type: 'string' },
                              deleted: { type: 'boolean', example: false },
                              reason: { type: 'string', example: 'Document not found or file_name is NULL' }
                            }
                          },
                          alreadyDeleted: { type: 'boolean', example: true }
                        }
                      }
                    ]
                  },
                  requestId: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid asset type for entity',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        403: {
          description: 'Permission denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        404: {
          description: 'Entity not found',
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

  '/assets/batch/validate': {
    post: {
      tags: ['Asset Management'],
      summary: 'Batch validate multiple files',
      description: `**Batch File Validation System**: Pre-validates multiple files before upload to provide early feedback without actual upload processing.

**Features:**
- **Pre-upload Validation**: Check files before committing to upload
- **Multi-file Support**: Validate entire upload batches at once
- **Comprehensive Checks**: File type, size, content validation
- **Frontend Integration**: Optimized for upload UI feedback
- **Performance Focused**: Fast validation without S3 operations

**⚠️ Coming Soon**: This endpoint is planned but not yet implemented.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'marketing-video.mp4' },
                      size: { type: 'integer', example: 15728640 },
                      type: { type: 'string', example: 'video/mp4' },
                      entityType: { type: 'string', example: 'workshop' },
                      entityId: { type: 'string', example: 'ws_123abc' },
                      assetType: { type: 'string', example: 'marketing-video' }
                    },
                    required: ['name', 'size', 'type', 'entityType', 'entityId', 'assetType']
                  }
                }
              },
              required: ['files']
            }
          }
        }
      },
      responses: {
        501: {
          description: 'Not implemented',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Not implemented' },
                  message: { type: 'string', example: 'Batch validation endpoint coming soon' }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/assets/batch/upload': {
    post: {
      tags: ['Asset Management'],
      summary: 'Batch upload multiple assets',
      description: `**Atomic Batch Upload System**: Upload multiple assets across different entities in a single atomic transaction.

**Features:**
- **Atomic Transactions**: All uploads succeed or all fail
- **Multi-entity Support**: Upload to different entities in one request
- **Mixed Asset Types**: Different asset types in same batch
- **Progress Tracking**: Detailed results per upload
- **Rollback Safety**: Automatic cleanup on any failure

**⚠️ Coming Soon**: This endpoint is planned but not yet implemented.`,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: {
                    type: 'string',
                    format: 'binary'
                  },
                  description: 'Multiple files to upload'
                },
                metadata: {
                  type: 'string',
                  description: 'JSON metadata mapping files to entities and asset types'
                }
              },
              required: ['files', 'metadata']
            }
          }
        }
      },
      responses: {
        501: {
          description: 'Not implemented',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Not implemented' },
                  message: { type: 'string', example: 'Batch upload endpoint coming soon' }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/assets/batch': {
    delete: {
      tags: ['Asset Management'],
      summary: 'Batch delete multiple assets',
      description: `**Atomic Batch Deletion System**: Delete multiple specific assets across different entities in a single atomic transaction.

**Features:**
- **Atomic Operations**: All deletions succeed or all fail
- **Multi-entity Support**: Delete from different entities in one request
- **Selective Deletion**: Specify exact assets to remove
- **Detailed Results**: Results per deletion attempt
- **Rollback Safety**: Automatic transaction rollback on failures

**⚠️ Coming Soon**: This endpoint is planned but not yet implemented.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                assets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      entityType: { type: 'string', example: 'workshop' },
                      entityId: { type: 'string', example: 'ws_123abc' },
                      assetType: { type: 'string', example: 'marketing-video' }
                    },
                    required: ['entityType', 'entityId', 'assetType']
                  }
                }
              },
              required: ['assets']
            }
          }
        }
      },
      responses: {
        501: {
          description: 'Not implemented',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Not implemented' },
                  message: { type: 'string', example: 'Batch deletion endpoint coming soon' }
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