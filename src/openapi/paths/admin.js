// OpenAPI documentation for admin endpoints
// Comprehensive administrative tools for subscription management and system monitoring

export default {
  '/admin/subscriptions/audit': {
    get: {
      tags: ['Admin'],
      summary: 'Comprehensive subscription audit',
      description: `
        **ADMIN ONLY**: Generates a comprehensive audit report by cross-referencing PayPlus bulk API
        with local database to find discrepancies.

        Key Features:
        - Detects missing webhook notifications
        - Finds subscriptions missing in local database
        - Identifies status mismatches between PayPlus and local records
        - Generates actionable recommendations
        - Saves detailed report to temporary markdown file

        Use Cases:
        - Monthly subscription reconciliation
        - Troubleshooting subscription sync issues
        - Identifying missing webhook notifications
        - Auditing subscription revenue integrity

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Audit completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Subscription audit completed successfully' },
                  audit_summary: {
                    type: 'object',
                    properties: {
                      total_discrepancies: { type: 'integer', example: 3 },
                      missing_activation_webhooks: { type: 'integer', example: 1 },
                      missing_in_database: { type: 'integer', example: 1 },
                      status_mismatches: { type: 'integer', example: 1 },
                      perfect_matches: { type: 'integer', example: 47 },
                      payplus_total: { type: 'integer', example: 50 },
                      local_total: { type: 'integer', example: 49 }
                    }
                  },
                  recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                      'Manual webhook replay needed for subscription sub_abc123',
                      'Check PayPlus webhook configuration for missing notifications'
                    ]
                  },
                  report_file: { type: 'string', example: '/tmp/subscription_audit_2025-12-11.md' },
                  audit_timestamp: { type: 'string', format: 'date-time' },
                  next_steps: { type: 'string', example: 'Review discrepancies in the generated report and take recommended actions' }
                }
              }
            }
          }
        },
        500: {
          description: 'Audit generation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to generate subscription audit report' },
                  details: { type: 'object' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscriptions/payplus-raw': {
    get: {
      tags: ['Admin'],
      summary: 'Raw PayPlus subscription data',
      description: `
        **ADMIN ONLY**: Retrieves raw PayPlus subscription data without analysis.
        Useful for debugging PayPlus API responses and verifying subscription details.

        Returns:
        - Complete PayPlus subscription list
        - API endpoint information
        - Raw subscription objects with full PayPlus metadata

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'PayPlus data retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'PayPlus subscriptions retrieved successfully' },
                  total_subscriptions: { type: 'integer', example: 50 },
                  endpoint_used: { type: 'string', example: 'https://restapi.payplus.co.il/api/v1.0/Subscriptions' },
                  retrieved_at: { type: 'string', format: 'date-time' },
                  subscriptions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      description: 'Raw PayPlus subscription object'
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'PayPlus query failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to fetch PayPlus subscriptions' },
                  details: { type: 'object' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/users/{userId}/subscription': {
    get: {
      tags: ['Admin'],
      summary: 'Get complete user subscription details',
      description: `
        **ADMIN ONLY**: Retrieves comprehensive subscription information for a specific user.

        Includes:
        - Current subscription and plan details
        - Benefits usage tracking and allowances
        - PayPlus subscription synchronization data
        - Subscription history with plan changes
        - Next billing information and auto-renewal status
        - Available plan change options

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'User ID to fetch subscription details for'
        }
      ],
      responses: {
        200: {
          description: 'User subscription details retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  hasSubscription: { type: 'boolean', example: true },
                  subscription: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', enum: ['active', 'pending', 'cancelled', 'expired'] },
                      billing_price: { type: 'number', example: 99.90 },
                      original_price: { type: 'number', example: 149.90 },
                      start_date: { type: 'string', format: 'date' },
                      end_date: { type: 'string', format: 'date', nullable: true },
                      next_billing_date: { type: 'string', format: 'date', nullable: true },
                      auto_renew: { type: 'boolean' },
                      metadata: { type: 'object' },
                      payplus_subscription_uid: { type: 'string', nullable: true }
                    }
                  },
                  plan: { $ref: '#/components/schemas/SubscriptionPlan' },
                  allowances: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        limit: { type: ['number', 'string'] },
                        used: { type: 'number' },
                        remaining: { type: ['number', 'string'] }
                      }
                    }
                  },
                  monthYear: { type: 'string', example: '2025-12' },
                  history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        action_type: { type: 'string' },
                        previous_plan_id: { type: 'string', nullable: true },
                        purchased_price: { type: 'number' },
                        notes: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  payplusDetails: {
                    type: 'object',
                    nullable: true,
                    description: 'Raw PayPlus subscription data'
                  },
                  planChangeOptions: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      upgradePlans: { type: 'array', items: { $ref: '#/components/schemas/SubscriptionPlan' } },
                      downgradePlans: { type: 'array', items: { $ref: '#/components/schemas/SubscriptionPlan' } },
                      pendingChange: { type: 'object', nullable: true }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'Failed to fetch subscription details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to fetch subscription details' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/users/{userId}/subscription/poll-payplus': {
    post: {
      tags: ['Admin'],
      summary: 'Poll PayPlus for subscription status',
      description: `
        **ADMIN ONLY**: Polls PayPlus for current subscription status and payment history.
        Includes synchronization status between local database and PayPlus.

        Features:
        - Real-time PayPlus subscription data
        - Payment status checking with staging environment awareness
        - Synchronization validation (amount and status matching)
        - Timeout handling for staging environment limitations

        Note: In staging/development environments, PayPlus status checks may timeout
        due to PayPlus staging limitations.

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'User ID to poll PayPlus data for'
        }
      ],
      responses: {
        200: {
          description: 'PayPlus polling completed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  payplus: {
                    type: 'object',
                    description: 'PayPlus subscription data'
                  },
                  statusCheck: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      error: { type: 'string', nullable: true },
                      message: { type: 'string', nullable: true },
                      stagingLimitation: { type: 'boolean', nullable: true }
                    }
                  },
                  localSubscription: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string' },
                      billing_price: { type: 'number' },
                      next_billing_date: { type: 'string', format: 'date', nullable: true }
                    }
                  },
                  syncStatus: {
                    type: 'object',
                    properties: {
                      amountMatch: { type: 'boolean', nullable: true },
                      statusMatch: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'No active subscription found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'No active subscription with PayPlus UID found' }
                }
              }
            }
          }
        },
        500: {
          description: 'PayPlus polling failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to poll PayPlus' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscriptions/{subscriptionId}/adjust-usage': {
    post: {
      tags: ['Admin'],
      summary: 'Manually adjust user benefits usage',
      description: `
        **ADMIN ONLY**: Manually adjust user benefits usage for the current billing period.
        Add or deduct allowances with full audit trail.

        Features:
        - Add allowances (positive adjustment) - creates SubscriptionPurchase records
        - Deduct allowances (negative adjustment) - tracked in metadata
        - Full audit trail in subscription metadata
        - Validates product type exists in user's plan benefits

        Use Cases:
        - Compensating users for service issues
        - Manual corrections for billing disputes
        - Emergency allowance adjustments

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'subscriptionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Subscription ID to adjust usage for'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                productType: {
                  type: 'string',
                  enum: ['workshop', 'course', 'file', 'lesson_plan', 'game'],
                  description: 'Product type to adjust allowances for'
                },
                adjustment: {
                  type: 'integer',
                  description: 'Adjustment amount (positive to add, negative to deduct)',
                  example: 5
                },
                reason: {
                  type: 'string',
                  minLength: 10,
                  description: 'Administrative reason for the adjustment',
                  example: 'Compensation for service outage on 2025-12-10'
                }
              },
              required: ['productType', 'adjustment', 'reason']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Usage adjustment completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Successfully adjusted workshop allowances by 5' },
                  adjustment: {
                    type: 'object',
                    properties: {
                      productType: { type: 'string' },
                      adjustment: { type: 'integer' },
                      reason: { type: 'string' },
                      adminId: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  },
                  updatedAllowances: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      limit: { type: ['number', 'string'] },
                      used: { type: 'number' },
                      remaining: { type: ['number', 'string'] }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Product type \'invalid\' not included in subscription plan' }
                }
              }
            }
          }
        },
        404: {
          description: 'Subscription not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Subscription not found' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscriptions/{subscriptionId}/change-plan': {
    post: {
      tags: ['Admin'],
      summary: 'Change subscription plan with price override',
      description: `
        **ADMIN ONLY**: Changes subscription plan with optional price override.
        Allows admins to change benefits without changing billing price.

        Features:
        - Plan upgrade/downgrade capabilities
        - Optional price override (change benefits but keep current billing)
        - Full audit trail in subscription metadata and history
        - Transaction safety for multi-step operations

        Use Cases:
        - Customer retention with plan upgrades at discounted rates
        - Plan corrections for billing errors
        - Emergency plan changes for service resolution

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'subscriptionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Subscription ID to change plan for'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                newPlanId: {
                  type: 'string',
                  description: 'ID of the new subscription plan'
                },
                overridePrice: {
                  type: 'number',
                  nullable: true,
                  description: 'Optional price override (null = use plan price)',
                  example: 79.90
                },
                reason: {
                  type: 'string',
                  minLength: 10,
                  description: 'Administrative reason for the plan change',
                  example: 'Customer retention - upgrade with discount'
                }
              },
              required: ['newPlanId', 'reason']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Plan change completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Subscription plan changed successfully' },
                  changes: {
                    type: 'object',
                    properties: {
                      previousPlan: { type: 'string', example: 'Basic Plan' },
                      newPlan: { type: 'string', example: 'Premium Plan' },
                      previousPrice: { type: 'number', example: 49.90 },
                      newPrice: { type: 'number', example: 79.90 },
                      priceOverridden: { type: 'boolean', example: true }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Subscription or plan not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'New plan not found' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscriptions/{subscriptionId}/add-one-time-charge': {
    post: {
      tags: ['Admin'],
      summary: 'Add one-time charge or discount',
      description: `
        **ADMIN ONLY**: Add one-time charge or discount to subscription's next billing cycle.
        Integrates with PayPlus for immediate processing.

        Features:
        - Positive amounts = additional charge
        - Negative amounts = discount
        - Immediate PayPlus integration
        - Full audit trail in subscription metadata
        - Transaction tracking with PayPlus UIDs

        Use Cases:
        - Service charges for custom work
        - Compensation discounts for service issues
        - Billing adjustments and corrections

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'subscriptionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Subscription ID to add charge to'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'Charge amount in Israeli Shekels (negative for discount)',
                  example: -20.00
                },
                description: {
                  type: 'string',
                  minLength: 5,
                  description: 'Customer-visible description of the charge',
                  example: 'Service compensation discount'
                },
                reason: {
                  type: 'string',
                  minLength: 10,
                  description: 'Internal administrative reason',
                  example: 'Compensation for service outage on Dec 10'
                }
              },
              required: ['amount', 'description', 'reason']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'One-time charge added successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Discount of ₪20 applied successfully' },
                  charge: {
                    type: 'object',
                    properties: {
                      amount: { type: 'number', example: -20.00 },
                      description: { type: 'string' },
                      transactionUid: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Subscription not found or missing PayPlus UID',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Subscription not found or missing PayPlus UID' }
                }
              }
            }
          }
        },
        500: {
          description: 'PayPlus charge creation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to add one-time charge' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscription-plans': {
    get: {
      tags: ['Admin'],
      summary: 'Get all available subscription plans',
      description: `
        **ADMIN ONLY**: Retrieves all subscription plans with formatted benefits summary.
        Used for admin selection when creating or changing user subscriptions.

        Returns:
        - Plan details (ID, name, description, price, billing period)
        - JSONB benefits structure
        - Human-readable benefits summary
        - Plans sorted by price (ascending)

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Subscription plans retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  plans: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string', example: 'Premium Plan' },
                        description: { type: 'string' },
                        price: { type: 'number', example: 99.90 },
                        billing_period: { type: 'string', enum: ['daily', 'monthly', 'yearly'] },
                        benefits: { type: 'object' },
                        benefitsSummary: { type: 'string', example: 'Video access, Unlimited workshops, 30 courses/month' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'Failed to fetch subscription plans',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to fetch subscription plans' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscriptions/{subscriptionId}/toggle-auto-renew': {
    post: {
      tags: ['Admin'],
      summary: 'Toggle subscription auto-renewal',
      description: `
        **ADMIN ONLY**: Toggle auto-renewal status for a subscription.
        Updates both local database and PayPlus subscription settings.

        Features:
        - PayPlus integration for recurring billing control
        - Automatic billing date recalculation
        - Full audit trail in subscription metadata
        - Handles billing period transitions (end_date ↔ next_billing_date)

        Use Cases:
        - Customer service requests to disable auto-billing
        - Enabling auto-renewal for promotional subscriptions
        - Emergency billing control for payment disputes

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'subscriptionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Subscription ID to toggle auto-renewal for'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                autoRenew: {
                  type: 'boolean',
                  description: 'Whether to enable or disable auto-renewal'
                },
                reason: {
                  type: 'string',
                  minLength: 10,
                  description: 'Administrative reason for the change',
                  example: 'Customer request to disable auto-billing'
                }
              },
              required: ['autoRenew', 'reason']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Auto-renewal toggle completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Auto renewal disabled successfully' },
                  autoRenew: { type: 'boolean', example: false },
                  previousAutoRenew: { type: 'boolean', example: true },
                  payplusUpdated: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        404: {
          description: 'Subscription not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Subscription not found' }
                }
              }
            }
          }
        },
        500: {
          description: 'PayPlus update failed or database error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Failed to update PayPlus auto renewal' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/subscriptions/{subscriptionId}/reset': {
    post: {
      tags: ['Admin'],
      summary: 'Delete/reset subscription entirely',
      description: `
        **ADMIN ONLY**: Completely deletes a user's subscription and cancels PayPlus billing.
        This is a destructive operation that cannot be undone.

        Features:
        - PayPlus subscription cancellation
        - Complete local database deletion
        - Comprehensive audit trail in subscription history
        - Transaction safety for multi-step operations
        - Continues local deletion even if PayPlus cancellation fails

        **WARNING**: This is a destructive operation. The subscription cannot be recovered.

        Use Cases:
        - Emergency subscription removal for disputes
        - Data privacy compliance (user deletion requests)
        - Correcting duplicate subscriptions

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'subscriptionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Subscription ID to reset/delete'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  minLength: 15,
                  description: 'Administrative reason for the subscription reset (required for audit trail)',
                  example: 'Customer requested complete account deletion for privacy compliance'
                }
              },
              required: ['reason']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Subscription reset completed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Subscription reset successfully' },
                  deletedSubscription: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      planName: { type: 'string', example: 'Premium Plan' },
                      billingPrice: { type: 'number', example: 99.90 },
                      status: { type: 'string', example: 'active' }
                    }
                  },
                  payplusCancelled: { type: 'boolean', example: true },
                  resetBy: { type: 'string' },
                  resetAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        404: {
          description: 'Subscription not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Subscription not found' }
                }
              }
            }
          }
        },
        400: {
          description: 'Missing or invalid reason',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Missing required field: reason' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  },

  '/admin/users/{userId}/subscription/create': {
    post: {
      tags: ['Admin'],
      summary: 'Create subscription for user',
      description: `
        **ADMIN ONLY**: Create a new subscription for a user with complete customization.
        Supports both free and paid subscriptions with custom overrides.

        Features:
        - Free or paid subscription creation
        - Custom pricing (override plan price)
        - Custom start/end dates
        - Custom benefits (override plan benefits)
        - Auto-renewal configuration
        - Full audit trail in subscription history

        Validation:
        - Prevents duplicate active subscriptions per user
        - Validates subscription plan exists
        - Validates user exists
        - Transaction safety for multi-step operations

        Use Cases:
        - Customer service subscription creation
        - Promotional free subscriptions
        - Custom enterprise pricing arrangements
        - Service recovery subscriptions

        Security: Requires admin authentication and authorization.
      `,
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'User ID to create subscription for'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                planId: {
                  type: 'string',
                  description: 'Subscription plan ID to assign'
                },
                subscriptionType: {
                  type: 'string',
                  enum: ['free', 'paid'],
                  description: 'Type of subscription to create'
                },
                customPrice: {
                  type: 'number',
                  nullable: true,
                  description: 'Custom price override (null = use plan price)',
                  example: 49.90
                },
                customStartDate: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  description: 'Custom start date (null = immediate start)'
                },
                customEndDate: {
                  type: 'string',
                  format: 'date',
                  nullable: true,
                  description: 'Custom end date (null = auto-calculated)'
                },
                customBenefits: {
                  type: 'object',
                  nullable: true,
                  description: 'Custom benefits override (null = use plan benefits)'
                },
                adminNotes: {
                  type: 'string',
                  nullable: true,
                  description: 'Internal admin notes for the subscription'
                },
                reason: {
                  type: 'string',
                  minLength: 10,
                  description: 'Administrative reason for creating the subscription',
                  example: 'Customer service request - promotional upgrade'
                },
                enableAutoRenewal: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Auto-renewal setting (null = auto-decide based on price)'
                }
              },
              required: ['planId', 'subscriptionType', 'reason']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Subscription created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Paid subscription created successfully' },
                  subscription: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      planName: { type: 'string', example: 'Premium Plan' },
                      subscriptionType: { type: 'string', enum: ['free', 'paid'] },
                      billingPrice: { type: 'number', example: 49.90 },
                      originalPrice: { type: 'number', example: 99.90 },
                      status: { type: 'string', example: 'active' },
                      startDate: { type: 'string', format: 'date' },
                      endDate: { type: 'string', format: 'date', nullable: true }
                    }
                  },
                  allowances: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        limit: { type: ['number', 'string'] },
                        used: { type: 'number' },
                        remaining: { type: ['number', 'string'] }
                      }
                    }
                  },
                  creation: {
                    type: 'object',
                    properties: {
                      adminId: { type: 'string' },
                      reason: { type: 'string' },
                      notes: { type: 'string', nullable: true },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request or user already has subscription',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'User already has an active subscription' },
                  existingSubscriptionId: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        404: {
          description: 'User or plan not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Subscription plan not found' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/UnauthorizedError' },
        403: { $ref: '#/components/responses/ForbiddenError' }
      }
    }
  }
};