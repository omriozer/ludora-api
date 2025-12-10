// OpenAPI documentation for webhook endpoints
// Comprehensive webhook handling for payment processing and third-party integrations

export default {
  '/webhooks/payplus': {
    post: {
      tags: ['Webhooks'],
      summary: 'PayPlus payment webhook handler',
      description: `
        Critical endpoint for PayPlus payment processing. Handles:
        - Payment completion and failure notifications
        - Subscription renewal processing
        - Automatic payment token capture
        - Comprehensive webhook logging and security verification

        Security Features:
        - Webhook signature verification to prevent fraud
        - Rate limiting (100 requests per 5 minutes)
        - Comprehensive sender information capture
        - Process logging for debugging and monitoring

        Processing Features:
        - Handles both first payments (via payment_page_request_uid) and recurring charges (via subscription_uid)
        - Automatic token extraction for future one-click payments
        - Service layer delegation to PaymentService and SubscriptionService
        - Transaction safety with rollback on errors

        This endpoint is production-critical for revenue processing.
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                transaction_uid: {
                  type: 'string',
                  description: 'Unique PayPlus transaction identifier'
                },
                subscription_uid: {
                  type: 'string',
                  description: 'PayPlus subscription UID for recurring charges',
                  nullable: true
                },
                status: {
                  type: 'string',
                  enum: ['success', 'failed', 'pending', 'approved', 'declined'],
                  description: 'Payment status from PayPlus'
                },
                transaction: {
                  type: 'object',
                  properties: {
                    payment_page_request_uid: {
                      type: 'string',
                      description: 'First payment identifier linking to Transaction record',
                      nullable: true
                    },
                    status_code: {
                      type: 'integer',
                      description: 'PayPlus numeric status code'
                    },
                    amount: {
                      type: 'number',
                      description: 'Transaction amount in Israeli Shekels'
                    },
                    currency: {
                      type: 'string',
                      default: 'ILS',
                      description: 'Transaction currency'
                    },
                    reason: {
                      type: 'string',
                      description: 'Failure reason for declined payments',
                      nullable: true
                    }
                  },
                  required: ['status_code']
                },
                transaction_type: {
                  type: 'string',
                  description: 'Type of transaction being processed'
                },
                charge_number: {
                  type: 'integer',
                  description: 'Charge number for subscription renewals',
                  nullable: true
                },
                custom_fields: {
                  type: 'object',
                  description: 'Custom fields passed during payment creation',
                  nullable: true
                },
                recurring_info: {
                  type: 'object',
                  description: 'Information about recurring subscription payments',
                  nullable: true
                }
              },
              required: ['transaction_uid', 'transaction'],
              example: {
                transaction_uid: 'txn_abc123',
                subscription_uid: 'sub_def456',
                status: 'success',
                transaction: {
                  payment_page_request_uid: 'req_ghi789',
                  status_code: 000,
                  amount: 99.90,
                  currency: 'ILS'
                },
                transaction_type: 'J4',
                charge_number: 2
              }
            }
          }
        }
      },
      parameters: [
        {
          name: 'hash',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'PayPlus webhook signature for security verification'
        },
        {
          name: 'X-PayPlus-Signature',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'Alternative PayPlus signature header'
        }
      ],
      responses: {
        200: {
          description: 'Webhook processed successfully or safely ignored',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    enum: [
                      'PayPlus webhook processed successfully',
                      'PayPlus webhook received and logged but processing is disabled',
                      'PayPlus webhook received but processing failed'
                    ]
                  },
                  status: {
                    type: 'string',
                    enum: ['success', 'failed', 'pending', 'ignored']
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time'
                  },
                  webhookId: {
                    type: 'string',
                    description: 'Database ID of webhook log record'
                  },
                  transactionId: {
                    type: 'string',
                    description: 'Associated transaction ID',
                    nullable: true
                  },
                  reason: {
                    type: 'string',
                    description: 'Reason for ignored status',
                    nullable: true
                  },
                  error: {
                    type: 'string',
                    description: 'Error message for failed processing',
                    nullable: true
                  }
                },
                required: ['message', 'timestamp', 'webhookId']
              },
              examples: {
                success: {
                  summary: 'Payment success processed',
                  value: {
                    message: 'PayPlus webhook processed successfully',
                    timestamp: '2025-12-11T10:30:00Z',
                    webhookId: 'wh_123abc',
                    transactionId: 'txn_456def',
                    status: 'success'
                  }
                },
                ignored: {
                  summary: 'Processing disabled',
                  value: {
                    message: 'PayPlus webhook received and logged but processing is disabled',
                    status: 'ignored',
                    reason: 'PAYMENTS_WEBHOOK_ACTIVE environment variable is set to false',
                    timestamp: '2025-12-11T10:30:00Z',
                    webhookId: 'wh_123abc'
                  }
                },
                error: {
                  summary: 'Processing failed',
                  value: {
                    message: 'PayPlus webhook received but processing failed',
                    error: 'No transaction found for payment_page_request_uid: req_invalid',
                    timestamp: '2025-12-11T10:30:00Z',
                    webhookId: 'wh_123abc'
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid webhook signature',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Unauthorized' },
                  message: { type: 'string', example: 'Invalid webhook signature' },
                  webhookId: { type: 'string' }
                },
                required: ['error', 'message']
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
                  error: { type: 'string', example: 'Webhook rate limit exceeded' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/webhooks/github': {
    post: {
      tags: ['Webhooks'],
      summary: 'GitHub webhook handler',
      description: `
        Handles GitHub webhooks for repository events and integrations.
        Currently a placeholder implementation for future GitHub integration features.

        Security:
        - Webhook signature verification
        - Rate limiting protection
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'GitHub webhook payload - varies by event type'
            }
          }
        }
      },
      parameters: [
        {
          name: 'X-GitHub-Event',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            enum: ['push', 'pull_request', 'issues', 'release', 'star', 'fork']
          },
          description: 'GitHub event type'
        },
        {
          name: 'X-Hub-Signature',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'GitHub webhook signature for verification'
        }
      ],
      responses: {
        200: {
          description: 'GitHub webhook received successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'GitHub webhook received' },
                  event: { type: 'string', example: 'push' }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid webhook signature',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid webhook signature' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/webhooks/stripe': {
    post: {
      tags: ['Webhooks'],
      summary: 'Stripe webhook handler',
      description: `
        Handles Stripe webhooks for payment processing integration.
        Currently a placeholder implementation for future Stripe payment features.

        Security:
        - Stripe signature verification
        - Rate limiting protection
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Stripe event ID' },
                object: { type: 'string', enum: ['event'] },
                type: {
                  type: 'string',
                  enum: [
                    'payment_intent.succeeded',
                    'payment_intent.payment_failed',
                    'invoice.payment_succeeded',
                    'customer.subscription.created',
                    'customer.subscription.updated'
                  ],
                  description: 'Stripe event type'
                },
                data: {
                  type: 'object',
                  description: 'Stripe event data object'
                }
              },
              required: ['id', 'type', 'data']
            }
          }
        }
      },
      parameters: [
        {
          name: 'Stripe-Signature',
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'Stripe webhook signature for verification'
        }
      ],
      responses: {
        200: {
          description: 'Stripe webhook received successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Stripe webhook received' },
                  type: { type: 'string', example: 'payment_intent.succeeded' }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid webhook signature',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid webhook signature' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/webhooks/paypal': {
    post: {
      tags: ['Webhooks'],
      summary: 'PayPal webhook handler',
      description: `
        Handles PayPal webhooks for payment processing integration.
        Currently a placeholder implementation for future PayPal payment features.

        Security:
        - PayPal signature verification
        - Rate limiting protection
      `,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'PayPal event ID' },
                event_type: {
                  type: 'string',
                  enum: [
                    'PAYMENT.CAPTURE.COMPLETED',
                    'PAYMENT.CAPTURE.DENIED',
                    'BILLING.SUBSCRIPTION.CREATED',
                    'BILLING.SUBSCRIPTION.ACTIVATED'
                  ],
                  description: 'PayPal event type'
                },
                resource: {
                  type: 'object',
                  description: 'PayPal resource data'
                }
              },
              required: ['id', 'event_type', 'resource']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'PayPal webhook received successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'PayPal webhook received' },
                  type: { type: 'string', example: 'PAYMENT.CAPTURE.COMPLETED' }
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid webhook signature',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid webhook signature' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/webhooks/generic/{provider}': {
    post: {
      tags: ['Webhooks'],
      summary: 'Generic webhook handler',
      description: `
        Flexible webhook endpoint for handling webhooks from various providers.
        Useful for testing, development, and integrating with new webhook providers.

        Security:
        - Configurable signature verification
        - Rate limiting protection
      `,
      parameters: [
        {
          name: 'provider',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[a-zA-Z0-9_-]+$'
          },
          description: 'Provider name (alphanumeric, hyphens, underscores only)',
          example: 'custom-provider'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Generic webhook payload - format depends on provider'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Generic webhook received successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Generic webhook received' },
                  provider: { type: 'string', example: 'custom-provider' },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-12-11T10:30:00Z'
                  }
                },
                required: ['message', 'provider', 'timestamp']
              }
            }
          }
        },
        401: {
          description: 'Invalid webhook signature',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid webhook signature' }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid provider name',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Invalid provider name format' }
                }
              }
            }
          }
        }
      }
    }
  }
};