export default {
  '/system-templates': {
    get: {
      tags: ['System Templates'],
      summary: 'Get system templates with filtering',
      description: `**Universal Template Discovery System**: Retrieve system templates with advanced filtering capabilities for cross-format branding and watermark management.

**Template Types:**
- **Branding Templates**: Universal layout and styling configurations for both PDF documents and SVG lesson plans
- **Watermark Templates**: Universal content protection with text/logo overlays for both PDF documents and SVG lesson plans

**Cross-Format Architecture:**
Templates are **format-agnostic** - the same template data works across multiple formats with format-specific rendering.

**Target Formats:**
- **PDF Formats**: pdf-a4-landscape, pdf-a4-portrait (for PDF documents)
- **SVG Formats**: svg-lessonplan (for lesson plan SVG files)

**Admin Features:**
- Complete template access including inactive templates
- Template usage analytics and management capabilities
- Default template identification for each type/format combination

**Filtering System**: Supports filtering by template type and target format for efficient template discovery.`,
      parameters: [
        {
          name: 'type',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['branding', 'watermark']
          },
          description: 'Filter by template type',
          example: 'watermark'
        },
        {
          name: 'format',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan']
          },
          description: 'Filter by target format',
          example: 'svg-lessonplan'
        },
        {
          name: 'include_inactive',
          in: 'query',
          required: false,
          schema: { type: 'boolean' },
          description: 'Include inactive templates (admin only)',
          example: false
        }
      ],
      responses: {
        200: {
          description: 'Templates retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SystemTemplate' }
                  },
                  meta: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer', example: 15 },
                      type: { type: 'string', example: 'watermark' },
                      format: { type: 'string', example: 'svg-lessonplan' }
                    }
                  }
                }
              },
              examples: {
                watermarkTemplates: {
                  summary: 'Watermark templates for lesson plans',
                  value: {
                    success: true,
                    data: [
                      {
                        id: 'tpl_123abc',
                        name: 'Default Lesson Plan Watermark',
                        description: 'Standard watermark with teacher name and date',
                        template_type: 'watermark',
                        target_format: 'svg-lessonplan',
                        template_data: {
                          elements: {
                            'watermark-text': [
                              {
                                id: 'teacher-name',
                                type: 'watermark-text',
                                content: '{{user}}',
                                pattern: 'single',
                                position: { x: 10, y: 10 },
                                style: { fontSize: 12, opacity: 0.5 },
                                visible: true
                              }
                            ]
                          }
                        },
                        is_default: true,
                        created_by: 'system_migration',
                        createdAt: '2024-12-01T10:00:00Z'
                      }
                    ],
                    meta: {
                      total: 1,
                      type: 'watermark',
                      format: 'svg-lessonplan'
                    }
                  }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    },
    post: {
      tags: ['System Templates'],
      summary: 'Create system template',
      description: `**Universal Template Creation System**: Create new cross-format system templates with comprehensive validation and automatic default management.

**Template Types & Validation:**
- **Branding Templates**: Universal layout configurations with positioning and styling for both PDF documents and SVG lesson plans
- **Watermark Templates**: Universal content protection with text/logo elements and pattern support for both PDF documents and SVG lesson plans

**Critical Security Feature (Dec 2025):**
Empty watermark templates are **strictly prohibited** to prevent content protection bypasses. All watermark templates must contain at least one watermark element.

**Default Management:**
- Automatic default uniqueness enforcement per template type
- Default template designation with seamless transitions
- System template protection and validation

**Element Types Supported:**
- **Text Elements**: watermark-text, free-text with variable substitution
- **Logo Elements**: watermark-logo, logo with multiple source options
- **Patterns**: single, grid, scattered placement options`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'template_type', 'target_format', 'template_data'],
              properties: {
                name: {
                  type: 'string',
                  description: 'Template name',
                  example: 'Custom Watermark Template'
                },
                description: {
                  type: 'string',
                  description: 'Template description',
                  example: 'Watermark with company logo and user info'
                },
                template_type: {
                  type: 'string',
                  enum: ['branding', 'watermark'],
                  description: 'Type of template',
                  example: 'watermark'
                },
                target_format: {
                  type: 'string',
                  enum: ['pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan'],
                  description: 'Target format for template',
                  example: 'svg-lessonplan'
                },
                template_data: {
                  type: 'object',
                  description: 'Template configuration data',
                  properties: {
                    elements: {
                      type: 'object',
                      description: 'Template elements organized by type',
                      additionalProperties: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['id', 'type', 'position', 'style'],
                          properties: {
                            id: { type: 'string', example: 'element_1' },
                            type: { type: 'string', example: 'watermark-text' },
                            content: { type: 'string', example: '{{user}} - {{date}}' },
                            pattern: {
                              type: 'string',
                              enum: ['single', 'grid', 'scattered'],
                              example: 'single'
                            },
                            position: {
                              type: 'object',
                              properties: {
                                x: { type: 'number', example: 50 },
                                y: { type: 'number', example: 50 }
                              }
                            },
                            style: {
                              type: 'object',
                              properties: {
                                fontSize: { type: 'number', example: 14 },
                                opacity: { type: 'number', example: 0.3 },
                                color: { type: 'string', example: '#666666' }
                              }
                            },
                            visible: { type: 'boolean', example: true }
                          }
                        }
                      }
                    },
                    globalSettings: {
                      type: 'object',
                      description: 'Global template settings'
                    }
                  }
                },
                is_default: {
                  type: 'boolean',
                  description: 'Set as default template for this type',
                  default: false,
                  example: false
                }
              }
            },
            examples: {
              watermarkTemplate: {
                summary: 'Create watermark template',
                value: {
                  name: 'Teacher Watermark',
                  description: 'Watermark with teacher name and lesson info',
                  template_type: 'watermark',
                  target_format: 'svg-lessonplan',
                  template_data: {
                    elements: {
                      'watermark-text': [
                        {
                          id: 'teacher-info',
                          type: 'watermark-text',
                          content: 'Created by: {{user}} on {{date}}',
                          pattern: 'single',
                          position: { x: 10, y: 580 },
                          style: {
                            fontSize: 12,
                            opacity: 0.4,
                            color: '#333333'
                          },
                          visible: true
                        }
                      ]
                    }
                  },
                  is_default: false
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Template created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' },
                  message: { type: 'string', example: 'Template created successfully' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid template data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                emptyWatermark: {
                  summary: 'Empty watermark template rejected',
                  value: {
                    error: 'Invalid watermark template data: Watermark template must contain at least one watermark element (text, logo, etc.). Empty watermark templates are not allowed.'
                  }
                },
                invalidType: {
                  summary: 'Invalid template type',
                  value: {
                    error: 'Invalid template type. Must be one of: branding, watermark'
                  }
                }
              }
            }
          }
        },
        409: {
          description: 'Default template conflict',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'A default template already exists for this type'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/{id}': {
    get: {
      tags: ['System Templates'],
      summary: 'Get template by ID',
      description: `**Template Retrieval System**: Retrieve a specific system template with comprehensive validation and error handling.

**ID Validation Features:**
- Format validation to prevent unnecessary database queries
- Minimum length requirement (6+ characters)
- Type detection to redirect template type requests
- Clear error messages for invalid requests

**Access Control**: All authenticated users can view templates, with admin users having additional capabilities for template management.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', minLength: 6 },
          description: 'Template ID (minimum 6 characters)',
          example: 'tpl_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Template retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid template ID format',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                shortId: {
                  summary: 'ID too short',
                  value: {
                    error: 'Invalid template ID format - ID too short'
                  }
                },
                typeRequest: {
                  summary: 'Template type instead of ID',
                  value: {
                    error: 'Use /api/system-templates/type/watermark for template type requests'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Template not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'Template not found',
                details: 'The template ID does not exist in the system'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    },
    put: {
      tags: ['System Templates'],
      summary: 'Update system template',
      description: `**Template Modification System**: Update existing system templates with comprehensive validation and default management.

**Update Capabilities:**
- **Template Data**: Modify template configuration while maintaining type compatibility
- **Metadata**: Update name, description, target format
- **Default Status**: Change default designation with automatic conflict resolution
- **Validation**: Full template data validation on updates

**Default Management Rules:**
- Cannot remove default status unless another default exists
- Automatic default uniqueness enforcement
- System templates retain default protection

**Security**: Admin-only operation with comprehensive validation to prevent template corruption.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Template ID to update',
          example: 'tpl_123abc'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Updated template name',
                  example: 'Updated Watermark Template'
                },
                description: {
                  type: 'string',
                  description: 'Updated template description'
                },
                target_format: {
                  type: 'string',
                  enum: ['pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan'],
                  description: 'Updated target format'
                },
                template_data: {
                  type: 'object',
                  description: 'Updated template configuration'
                },
                is_default: {
                  type: 'boolean',
                  description: 'Update default status'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Template updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' },
                  message: { type: 'string', example: 'Template updated successfully' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid update data or default constraint violation',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'Cannot remove default status - at least one default template must exist for each type'
              }
            }
          }
        },
        404: {
          description: 'Template not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    },
    delete: {
      tags: ['System Templates'],
      summary: 'Delete system template',
      description: `**Safe Template Deletion System**: Delete system templates with comprehensive safety checks and usage validation.

**Deletion Safety Checks:**
1. **Usage Validation**: Prevents deletion of templates actively used by files
2. **Default Protection**: Ensures at least one default template exists per type
3. **System Protection**: Prevents deletion of system-created default templates
4. **Reference Integrity**: Checks branding_template_id and watermark_template_id usage

**Protection Rules:**
- System default templates can be edited but **never deleted**
- Cannot delete the only default template for a type
- Cannot delete templates with active file associations
- Comprehensive usage counting before deletion

**Admin Safety**: Multiple validation layers prevent accidental deletion of critical templates.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Template ID to delete',
          example: 'tpl_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Template deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Template deleted successfully' }
                }
              }
            }
          }
        },
        400: {
          description: 'Cannot delete template due to constraints',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'Cannot delete the only default template for this type'
              }
            }
          }
        },
        403: {
          description: 'Cannot delete system default template',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'Cannot delete system default templates. System default templates can be edited but not deleted.'
              }
            }
          }
        },
        409: {
          description: 'Template is in use',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'Cannot delete template - it is being used by 15 file(s)'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/type/{templateType}': {
    get: {
      tags: ['System Templates'],
      summary: 'Get templates by type',
      description: `**Type-Based Template Discovery**: Retrieve all templates of a specific type with optional format filtering and default template identification.

**Features:**
- **Type Filtering**: Get all branding or watermark templates
- **Format Filtering**: Optionally filter by target format
- **Default Identification**: Clearly identifies default templates for each format
- **Usage Statistics**: Template counts and default template mapping

**Response Enhancement**: Includes metadata about default templates for easy identification and template management interfaces.`,
      parameters: [
        {
          name: 'templateType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['branding', 'watermark']
          },
          description: 'Type of templates to retrieve',
          example: 'watermark'
        },
        {
          name: 'format',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan']
          },
          description: 'Filter by target format',
          example: 'svg-lessonplan'
        }
      ],
      responses: {
        200: {
          description: 'Templates retrieved by type successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SystemTemplate' }
                  },
                  meta: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer', example: 8 },
                      default_templates: {
                        type: 'array',
                        description: 'Default templates for this type',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', example: 'tpl_123abc' },
                            format: { type: 'string', example: 'svg-lessonplan' }
                          }
                        }
                      },
                      type: { type: 'string', example: 'watermark' },
                      format: { type: 'string', example: 'svg-lessonplan' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid template type',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'Invalid template type. Must be one of: branding, watermark'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/system-templates/default/{templateType}': {
    get: {
      tags: ['System Templates'],
      summary: 'Get default template for type',
      description: `**Default Template Resolution**: Retrieve the default template for a specific template type.

**Default Resolution Logic:**
- Returns the primary default template for the specified type
- Handles multiple format scenarios
- Provides fallback for template selection

**Use Cases:**
- Template selection in creation workflows
- Default template application
- System initialization with templates`,
      parameters: [
        {
          name: 'templateType',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: ['branding', 'watermark']
          },
          description: 'Template type to get default for',
          example: 'watermark'
        }
      ],
      responses: {
        200: {
          description: 'Default template retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' }
                }
              }
            }
          }
        },
        404: {
          description: 'No default template found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'No default template found for type: watermark'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/system-templates/{id}/set-default': {
    post: {
      tags: ['System Templates'],
      summary: 'Set template as default',
      description: `**Default Template Management**: Set a specific template as the default for its type with automatic conflict resolution.

**Default Management Features:**
- **Uniqueness Enforcement**: Automatically removes default status from other templates of the same type
- **Validation**: Ensures template exists and is valid for default assignment
- **Atomic Operations**: Database transaction safety for consistent state
- **Type-Specific Defaults**: Maintains default per template type independently

**Business Logic**: Each template type (branding, watermark) can have only one default template at a time.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Template ID to set as default',
          example: 'tpl_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Template set as default successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' },
                  message: { type: 'string', example: 'Template set as default successfully' }
                }
              }
            }
          }
        },
        404: {
          description: 'Template not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/{id}/duplicate': {
    post: {
      tags: ['System Templates'],
      summary: 'Duplicate template',
      description: `**Template Duplication System**: Create a copy of an existing template for customization and modification.

**Duplication Features:**
- **Complete Data Copy**: Copies all template data and configuration
- **Name Customization**: Optional custom name or automatic "Copy" suffix
- **Non-Default Creation**: Duplicated templates are never set as default
- **Independence**: Duplicated templates are independent of the source

**Use Cases:**
- Creating template variations
- Starting point for new template creation
- Backup template creation before modifications
- Template sharing between environments`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Template ID to duplicate',
          example: 'tpl_123abc'
        }
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name for the duplicated template (optional)',
                  example: 'Custom Watermark Template'
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Template duplicated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' },
                  message: { type: 'string', example: 'Template duplicated successfully' }
                }
              }
            }
          }
        },
        404: {
          description: 'Source template not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/save-from-file/{fileId}': {
    post: {
      tags: ['System Templates'],
      summary: 'Save file branding as template',
      description: `**File-to-Template Conversion**: Extract branding configuration from an existing file and create a reusable system template.

**Conversion Process:**
1. **File Branding Extraction**: Retrieves effective branding configuration from file
2. **Template Merging**: Combines template data with file-specific overrides
3. **Default Fallback**: Uses system default if file has no specific branding
4. **Template Creation**: Creates new system template with extracted configuration

**Use Cases:**
- Creating templates from successful file configurations
- Standardizing branding across multiple files
- Template library building from existing content
- Configuration sharing between files

**Data Sources**: Supports files with custom templates or default template applications.`,
      parameters: [
        {
          name: 'fileId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'File ID to extract branding configuration from',
          example: 'file_123abc'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  description: 'Name for the new template',
                  example: 'Math Worksheet Branding'
                },
                description: {
                  type: 'string',
                  description: 'Description for the new template',
                  example: 'Branding configuration from successful math worksheet'
                },
                target_format: {
                  type: 'string',
                  enum: ['pdf-a4-landscape', 'pdf-a4-portrait', 'svg-lessonplan'],
                  default: 'pdf-a4-portrait',
                  description: 'Target format for the template'
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Template created from file successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' },
                  message: { type: 'string', example: 'Template created successfully from file branding configuration' }
                }
              }
            }
          }
        },
        400: {
          description: 'No branding configuration found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                error: 'No branding configuration found for this file'
              }
            }
          }
        },
        404: {
          description: 'File not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/{id}/preview-watermark': {
    post: {
      tags: ['System Templates'],
      summary: 'Preview watermark template',
      description: `**Universal Watermark Template Preview System**: Generate preview of watermark template with sample content and variable substitution across different formats.

**Preview Capabilities:**
- **SVG Preview**: Direct visual preview with merged watermark elements for lesson plan SVG files
- **PDF Preview**: Configuration preview with variable substitution for PDF documents
- **Variable Testing**: Real-time variable substitution with sample data across both formats
- **Sample Content**: Optional custom content or generated samples

**Variable Support**:
- **System Variables**: filename, user, date, time
- **Content Variables**: slideId, lessonPlan (content-specific)
- **Custom Variables**: User-provided additional variables

**Content Types**: Supports both SVG (visual preview for lesson plans) and PDF (configuration preview for documents) rendering modes, demonstrating the template's cross-format capabilities.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Watermark template ID to preview',
          example: 'tpl_123abc'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['contentType'],
              properties: {
                contentType: {
                  type: 'string',
                  enum: ['svg', 'pdf'],
                  description: 'Type of preview content',
                  example: 'svg'
                },
                sampleContent: {
                  type: 'string',
                  description: 'Sample content for preview (optional - generates default if not provided)'
                },
                variables: {
                  type: 'object',
                  description: 'Additional variables for substitution',
                  additionalProperties: { type: 'string' },
                  example: {
                    lessonPlan: 'Advanced Mathematics',
                    slideId: 'slide_001'
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Template preview generated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      template_id: { type: 'string', example: 'tpl_123abc' },
                      template_name: { type: 'string', example: 'Default Lesson Plan Watermark' },
                      content_type: { type: 'string', example: 'svg' },
                      preview: {
                        oneOf: [
                          {
                            type: 'string',
                            title: 'SVG Preview',
                            description: 'Complete SVG with watermark applied'
                          },
                          {
                            type: 'object',
                            title: 'PDF Preview',
                            properties: {
                              template_data: { type: 'object' },
                              variables: { type: 'object' },
                              note: { type: 'string' }
                            }
                          }
                        ]
                      },
                      variables_used: {
                        type: 'object',
                        description: 'All variables used in preview',
                        additionalProperties: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid content type or not a watermark template',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                invalidContentType: {
                  summary: 'Unsupported content type',
                  value: {
                    error: 'Unsupported content type. Use "svg" or "pdf"'
                  }
                },
                notWatermarkTemplate: {
                  summary: 'Not a watermark template',
                  value: {
                    error: 'Template is not a watermark template'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Template not found',
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

  '/system-templates/test-variables': {
    post: {
      tags: ['System Templates'],
      summary: 'Test template variables',
      description: `**Variable Testing System**: Test variable substitution in watermark template data without creating or modifying templates.

**Testing Features:**
- **Variable Extraction**: Automatically finds all variables in template content
- **Substitution Preview**: Shows content with variables replaced
- **Missing Variable Detection**: Identifies variables without provided values
- **Template Validation**: Validates template structure during testing

**Variable Discovery**: Uses regex pattern matching to find {{variableName}} patterns in template text content.

**Testing Workflow**: Perfect for template debugging and variable requirement analysis before template deployment.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['template_data'],
              properties: {
                template_data: {
                  type: 'object',
                  description: 'Template data to test variables in'
                },
                variables: {
                  type: 'object',
                  description: 'Variables to substitute',
                  additionalProperties: { type: 'string' }
                }
              }
            },
            examples: {
              variableTest: {
                summary: 'Test variables in template',
                value: {
                  template_data: {
                    textElements: [
                      {
                        id: 'test-text',
                        content: 'Created by {{user}} on {{date}} for {{lessonPlan}}'
                      }
                    ]
                  },
                  variables: {
                    user: 'teacher@example.com',
                    date: '2024-12-11',
                    lessonPlan: 'Mathematics Basics'
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Variable testing completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      original_template: {
                        type: 'object',
                        description: 'Original template data'
                      },
                      processed_template: {
                        type: 'object',
                        description: 'Template with variables substituted'
                      },
                      variables_found: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Variables discovered in template',
                        example: ['user', 'date', 'lessonPlan']
                      },
                      variables_provided: {
                        type: 'object',
                        description: 'Variables provided for substitution',
                        additionalProperties: { type: 'string' }
                      },
                      missing_variables: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Variables found but not provided',
                        example: []
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid template data',
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

  '/system-templates/{id}/usage': {
    get: {
      tags: ['System Templates'],
      summary: 'Get template usage statistics',
      description: `**Template Usage Analytics**: Comprehensive usage statistics for watermark templates across the platform.

**Usage Tracking:**
- **File Usage**: Count of files using the template
- **Lesson Plan Usage**: Count of lesson plans using the template
- **Total Usage**: Combined usage across all content types
- **Sample Entities**: Preview of entities using the template

**Deletion Safety**: Includes can_delete flag to indicate if template is safe to delete (no active usage).

**Admin Feature**: Provides detailed usage analytics for template management and cleanup decisions.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Template ID to get usage statistics for',
          example: 'tpl_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Template usage statistics retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      template_id: { type: 'string', example: 'tpl_123abc' },
                      template_name: { type: 'string', example: 'Default Lesson Plan Watermark' },
                      usage: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer', example: 25 },
                          files: { type: 'integer', example: 15 },
                          lesson_plans: { type: 'integer', example: 10 }
                        }
                      },
                      samples: {
                        type: 'object',
                        properties: {
                          files: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                file_name: { type: 'string' }
                              }
                            }
                          },
                          lesson_plans: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                description: { type: 'string' }
                              }
                            }
                          }
                        }
                      },
                      can_delete: { type: 'boolean', example: false }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Template is not a watermark template',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        404: {
          description: 'Template not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/{id}/export': {
    get: {
      tags: ['System Templates'],
      summary: 'Export watermark template',
      description: `**Template Export System**: Export watermark templates for backup, sharing, or migration purposes.

**Export Features:**
- **Complete Template Data**: Exports all template configuration and metadata
- **Version Tracking**: Includes export version and timestamp
- **Audit Trail**: Records who exported the template and when
- **Portable Format**: JSON format suitable for import/backup

**Export Format**: Standardized JSON structure with version information for compatibility tracking.

**Use Cases:**
- Template backup before modifications
- Template sharing between environments
- Template migration and deployment
- Template version control`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Watermark template ID to export',
          example: 'tpl_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Template exported successfully',
          headers: {
            'Content-Disposition': {
              schema: { type: 'string' },
              description: 'Attachment filename for download',
              example: 'attachment; filename="watermark-template-Default-Lesson-Plan-Watermark.json"'
            },
            'Content-Type': {
              schema: { type: 'string', example: 'application/json' }
            }
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  version: { type: 'string', example: '1.0' },
                  export_date: { type: 'string', format: 'date-time' },
                  exported_by: { type: 'string', example: 'admin@ludora.app' },
                  template: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      template_type: { type: 'string', example: 'watermark' },
                      target_format: { type: 'string' },
                      template_data: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Template is not a watermark template',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        404: {
          description: 'Template not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  },

  '/system-templates/import': {
    post: {
      tags: ['System Templates'],
      summary: 'Import watermark template',
      description: `**Template Import System**: Import watermark templates from exported files with validation and conflict resolution.

**Import Features:**
- **Format Validation**: Validates exported template format and structure
- **Template Validation**: Full watermark template data validation
- **Name Conflict Resolution**: Optional custom naming for imported templates
- **Never Default**: Imported templates are never set as default automatically

**Import Safety:**
- Complete validation before creation
- Name customization to avoid conflicts
- Full template data structure validation
- Import audit trail with creator tracking

**Supported Format**: JSON exports from the template export system with version compatibility checking.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['template_data'],
              properties: {
                template_data: {
                  type: 'object',
                  description: 'Exported template data from export endpoint',
                  properties: {
                    version: { type: 'string' },
                    template: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        template_type: { type: 'string', enum: ['watermark'] },
                        target_format: { type: 'string' },
                        template_data: { type: 'object' }
                      }
                    }
                  }
                },
                new_name: {
                  type: 'string',
                  description: 'Optional custom name for imported template',
                  example: 'Imported Watermark Template'
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Template imported successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/SystemTemplate' },
                  message: { type: 'string', example: 'Watermark template imported successfully' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid import data or template validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                invalidFormat: {
                  summary: 'Invalid import format',
                  value: {
                    error: 'Invalid import data. Expected exported template format.'
                  }
                },
                notWatermarkTemplate: {
                  summary: 'Not a watermark template',
                  value: {
                    error: 'Import data is not a watermark template'
                  }
                },
                invalidTemplateData: {
                  summary: 'Invalid template structure',
                  value: {
                    error: 'Invalid watermark template data: Watermark template must contain at least one watermark element'
                  }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [], AdminRole: [] }]
    }
  }
};