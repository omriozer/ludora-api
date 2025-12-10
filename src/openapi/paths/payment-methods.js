export default {
  '/payment-methods': {
    get: {
      tags: ['Payment Methods'],
      summary: 'Get user saved payment methods',
      description: `**Saved Payment Methods Management**: Retrieve all saved payment methods for the authenticated user with comprehensive card information and status.

**Features:**
- **Complete Card Details**: Last 4 digits, brand, expiration status
- **Default Method Identification**: Clear indication of default payment method
- **Security**: Only returns masked card information (last 4 digits)
- **Status Tracking**: Expiration detection and validation status

**Use Cases:**
- Payment method selection in checkout flows
- Account payment method management
- One-click purchase enablement
- Default payment method identification`,
      responses: {
        200: {
          description: 'Payment methods retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  count: { type: 'integer', example: 2 },
                  payment_methods: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/PaymentMethod' }
                  }
                }
              },
              examples: {
                userPaymentMethods: {
                  summary: 'User with saved payment methods',
                  value: {
                    success: true,
                    count: 2,
                    payment_methods: [
                      {
                        id: 'pm_123abc',
                        display_name: 'Visa ending in 4242',
                        card_last4: '4242',
                        card_brand: 'visa',
                        card_exp_month: 12,
                        card_exp_year: 2025,
                        is_default: true,
                        is_expired: false,
                        created_at: '2024-11-01T10:30:00Z'
                      },
                      {
                        id: 'pm_456def',
                        display_name: 'Mastercard ending in 5555',
                        card_last4: '5555',
                        card_brand: 'mastercard',
                        card_exp_month: 8,
                        card_exp_year: 2026,
                        is_default: false,
                        is_expired: false,
                        created_at: '2024-10-15T14:20:00Z'
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/payment-methods/{id}/set-default': {
    put: {
      tags: ['Payment Methods'],
      summary: 'Set default payment method',
      description: `**Default Payment Method Management**: Set a specific payment method as the user's default with atomic transaction safety.

**Features:**
- **Ownership Validation**: Ensures payment method belongs to authenticated user
- **Atomic Operations**: Database transaction safety for consistent state
- **Automatic Default Management**: Removes default status from other methods
- **Immediate Confirmation**: Returns updated payment method with default status

**Business Logic**: Only one payment method can be default per user - setting a new default automatically removes the previous default.

**Security**: Comprehensive ownership validation prevents unauthorized default changes.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Payment method ID to set as default',
          example: 'pm_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Default payment method updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Default payment method updated successfully' },
                  payment_method: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'pm_123abc' },
                      display_name: { type: 'string', example: 'Visa ending in 4242' },
                      is_default: { type: 'boolean', example: true }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Failed to set default payment method',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: 'Failed to set default payment method'
              }
            }
          }
        },
        404: {
          description: 'Payment method not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: 'Payment method not found or access denied'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/payments/charge-token': {
    post: {
      tags: ['Payment Methods'],
      summary: 'Charge using saved payment token',
      description: `**One-Click Purchase System**: Process payments using saved payment methods for seamless checkout experience.

**Features:**
- **Token-Based Charging**: Direct PayPlus token charging without payment pages
- **Multi-Item Cart Support**: Purchase multiple products in single transaction
- **Automatic Purchase Record Creation**: Creates individual Purchase records for each cart item
- **Transaction Safety**: Atomic database operations with automatic rollback on failure
- **Comprehensive Metadata**: Detailed transaction tracking and audit trail

**Payment Flow:**
1. Validate saved payment method ownership
2. Calculate total amount from cart items
3. Charge PayPlus token directly
4. Create transaction and purchase records
5. Return complete purchase confirmation

**Security**: Full ownership validation and secure token handling through PayPlus integration.`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['payment_method_id', 'cart_items'],
              properties: {
                payment_method_id: {
                  type: 'string',
                  description: 'Saved payment method ID to charge',
                  example: 'pm_123abc'
                },
                cart_items: {
                  type: 'array',
                  minItems: 1,
                  description: 'Items to purchase',
                  items: {
                    type: 'object',
                    required: ['purchasable_type', 'purchasable_id', 'price'],
                    properties: {
                      purchasable_type: {
                        type: 'string',
                        enum: ['file', 'workshop', 'course', 'game', 'tool', 'bundle'],
                        example: 'workshop'
                      },
                      purchasable_id: {
                        type: 'string',
                        description: 'ID of the product to purchase',
                        example: 'ws_123abc'
                      },
                      price: {
                        type: 'number',
                        description: 'Price in ILS',
                        example: 49.90
                      },
                      quantity: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                        description: 'Quantity to purchase',
                        example: 1
                      },
                      metadata: {
                        type: 'object',
                        description: 'Additional item metadata',
                        additionalProperties: true
                      }
                    }
                  }
                }
              }
            },
            examples: {
              singleWorkshopPurchase: {
                summary: 'Purchase single workshop',
                value: {
                  payment_method_id: 'pm_123abc',
                  cart_items: [
                    {
                      purchasable_type: 'workshop',
                      purchasable_id: 'ws_123abc',
                      price: 49.90,
                      quantity: 1
                    }
                  ]
                }
              },
              multiItemPurchase: {
                summary: 'Purchase multiple items',
                value: {
                  payment_method_id: 'pm_123abc',
                  cart_items: [
                    {
                      purchasable_type: 'workshop',
                      purchasable_id: 'ws_123abc',
                      price: 49.90
                    },
                    {
                      purchasable_type: 'file',
                      purchasable_id: 'file_456def',
                      price: 19.90
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
          description: 'Payment processed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  transaction_id: { type: 'string', example: 'txn_789ghi' },
                  amount: { type: 'number', example: 69.80 },
                  currency: { type: 'string', example: 'ILS' },
                  purchase_count: { type: 'integer', example: 2 },
                  purchases: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'purch_111aaa' },
                        type: { type: 'string', example: 'workshop' },
                        entity_id: { type: 'string', example: 'ws_123abc' },
                        amount: { type: 'number', example: 49.90 }
                      }
                    }
                  },
                  message: { type: 'string', example: 'Payment processed successfully using saved payment method' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request or payment failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                missingParameters: {
                  summary: 'Missing required parameters',
                  value: {
                    success: false,
                    error: 'Missing required parameters: payment_method_id, cart_items'
                  }
                },
                invalidAmount: {
                  summary: 'Invalid total amount',
                  value: {
                    success: false,
                    error: 'Invalid total amount'
                  }
                },
                paymentFailed: {
                  summary: 'Payment processing failed',
                  value: {
                    success: false,
                    error: 'Payment failed',
                    details: 'Insufficient funds',
                    error_code: 'CARD_DECLINED'
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment method not found or access denied',
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

  '/payment-methods/{id}': {
    delete: {
      tags: ['Payment Methods'],
      summary: 'Delete payment method',
      description: `**Payment Method Removal**: Safely remove a saved payment method with ownership validation.

**Features:**
- **Soft Deletion**: Payment method is marked as inactive rather than physically deleted
- **Ownership Validation**: Ensures only the owner can delete their payment methods
- **Audit Trail**: Maintains record of deletion for security and compliance
- **Default Handling**: Automatic handling if deleting the current default method

**Security**: Comprehensive ownership checks prevent unauthorized payment method deletion.

**Data Retention**: Payment methods are soft-deleted to maintain transaction history integrity.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Payment method ID to delete',
          example: 'pm_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Payment method removed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Payment method removed successfully' }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment method not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: 'Payment method not found or access denied'
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/payment-methods/default': {
    get: {
      tags: ['Payment Methods'],
      summary: 'Get default payment method',
      description: `**Default Payment Method Retrieval**: Get the user's current default payment method for checkout processes.

**Features:**
- **Quick Default Access**: Optimized for checkout flows
- **Expiration Detection**: Automatically detects expired cards
- **Null-Safe Response**: Graceful handling when no default method exists
- **Security**: Returns masked card information only

**Use Cases:**
- Checkout page initialization
- One-click purchase button enablement
- Default payment method display
- Payment method validation in UI`,
      responses: {
        200: {
          description: 'Default payment method information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  has_default: { type: 'boolean', example: true },
                  payment_method: {
                    oneOf: [
                      {
                        type: 'object',
                        title: 'Default Method Available',
                        properties: {
                          id: { type: 'string', example: 'pm_123abc' },
                          display_name: { type: 'string', example: 'Visa ending in 4242' },
                          card_last4: { type: 'string', example: '4242' },
                          card_brand: { type: 'string', example: 'visa' },
                          is_default: { type: 'boolean', example: true },
                          is_expired: { type: 'boolean', example: false }
                        }
                      },
                      {
                        type: 'null',
                        title: 'No Default Method'
                      }
                    ]
                  }
                }
              },
              examples: {
                hasDefaultMethod: {
                  summary: 'User with default payment method',
                  value: {
                    success: true,
                    has_default: true,
                    payment_method: {
                      id: 'pm_123abc',
                      display_name: 'Visa ending in 4242',
                      card_last4: '4242',
                      card_brand: 'visa',
                      is_default: true,
                      is_expired: false
                    }
                  }
                },
                noDefaultMethod: {
                  summary: 'User without default payment method',
                  value: {
                    success: true,
                    has_default: false,
                    payment_method: null
                  }
                }
              }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  },

  '/payment-methods/{id}/validate': {
    post: {
      tags: ['Payment Methods'],
      summary: 'Validate payment method token',
      description: `**Payment Method Validation**: Validate a saved payment method token with PayPlus to ensure it's still active and usable.

**Features:**
- **Token Health Check**: Validates token status with PayPlus
- **Expiration Detection**: Identifies expired or invalid tokens
- **Card Information Update**: Retrieves current card status and details
- **Ownership Validation**: Ensures user owns the payment method being validated

**Use Cases:**
- Pre-purchase validation
- Payment method health monitoring
- Checkout flow validation
- Account management token verification

**Integration**: Direct validation with PayPlus payment processor for real-time status checking.`,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Payment method ID to validate',
          example: 'pm_123abc'
        }
      ],
      responses: {
        200: {
          description: 'Payment method validation completed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  payment_method_id: { type: 'string', example: 'pm_123abc' },
                  validation: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean', example: true },
                      expired: { type: 'boolean', example: false },
                      last4: { type: 'string', example: '4242' },
                      brand: { type: 'string', example: 'visa' },
                      error: {
                        type: 'string',
                        description: 'Error message if validation failed',
                        nullable: true,
                        example: null
                      }
                    }
                  }
                }
              },
              examples: {
                validToken: {
                  summary: 'Valid payment method',
                  value: {
                    success: true,
                    payment_method_id: 'pm_123abc',
                    validation: {
                      valid: true,
                      expired: false,
                      last4: '4242',
                      brand: 'visa',
                      error: null
                    }
                  }
                },
                expiredToken: {
                  summary: 'Expired payment method',
                  value: {
                    success: true,
                    payment_method_id: 'pm_456def',
                    validation: {
                      valid: false,
                      expired: true,
                      last4: '5555',
                      brand: 'mastercard',
                      error: 'Card has expired'
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Payment method not found or access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      security: [{ BearerAuth: [] }]
    }
  }
};