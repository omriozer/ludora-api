import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { GAME_TYPE_KEYS } from '../config/gameTypes.js';

// Generic validation middleware
export function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages
      });
    }

    req.body = value; // Use sanitized values
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        error: 'Query validation failed',
        details: errorMessages
      });
    }
    
    // Replace query parameters with validated values
    Object.keys(req.query).forEach(key => delete req.query[key]);
    Object.assign(req.query, value);
    next();
  };
}

// Common validation schemas
export const schemas = {
  // Authentication
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(1).required().messages({
      'string.min': 'Password cannot be empty',
      'any.required': 'Password is required'
    })
  }),

  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)')).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required'
    }),
    fullName: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name cannot exceed 100 characters'
    }),
    role: Joi.string().valid('user', 'admin', 'sysadmin').default('user'),
    user_type: Joi.string().valid('teacher', 'student', 'parent', 'headmaster').optional().allow(null)
  }),

  passwordReset: Joi.object({
    email: Joi.string().email().required()
  }),

  newPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)')).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    })
  }),

  // Entity operations
  entityCreate: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string().allow(''), // Allow empty strings
      Joi.number(),
      Joi.boolean(),
      Joi.object(),
      Joi.array(),
      Joi.allow(null) // Allow null values
    )
  ).min(1),

  entityUpdate: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string().allow(''), // Allow empty strings
      Joi.number(),
      Joi.boolean(),
      Joi.object(),
      Joi.array(),
      Joi.allow(null) // Allow null values
    )
  ).min(1),

  entityQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(1000).default(50),
    offset: Joi.number().integer().min(0).default(0),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }).unknown(true), // Allow additional query parameters

  bulkOperation: Joi.object({
    operation: Joi.string().valid('create', 'delete').required(),
    data: Joi.array().min(1).max(100).required().messages({
      'array.min': 'At least one item is required',
      'array.max': 'Cannot process more than 100 items at once'
    })
  }),

  // Email
  sendEmail: Joi.object({
    to: Joi.alternatives().try(
      Joi.string().email(),
      Joi.array().items(Joi.string().email()).min(1).max(50)
    ).required(),
    subject: Joi.string().min(1).max(200).required(),
    html: Joi.string().max(100000).optional(),
    text: Joi.string().max(50000).optional(),
    from: Joi.string().email().optional()
  }).or('html', 'text'),

  // File upload
  signedUrl: Joi.object({
    fileName: Joi.string().min(1).max(255).required(),
    operation: Joi.string().valid('read', 'write').default('read'),
    expiresIn: Joi.number().integer().min(60).max(86400).default(3600), // 1 minute to 24 hours
    contentType: Joi.string().max(100).optional()
  }),

  // Payment
  paymentConfirmation: Joi.object({
    paymentId: Joi.string().required(),
    userId: Joi.string().optional(),
    amount: Joi.number().positive().required(),
    email: Joi.string().email().optional()
  }),

  applyCoupon: Joi.object({
    couponCode: Joi.string().min(1).max(50).required(),
    userId: Joi.string().optional(),
    // Support both legacy single purchase and new multi-item cart
    productId: Joi.string().optional(), // Legacy support
    purchaseAmount: Joi.number().positive().required(),
    purchaseIds: Joi.array().items(Joi.string()).optional(), // For multi-item carts
    cartItems: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        purchasable_type: Joi.string().required(),
        purchasable_id: Joi.string().required(),
        payment_amount: Joi.number().positive().required()
      })
    ).optional() // Alternative to purchaseIds for direct cart data
  }),

  createPaymentPage: Joi.object({
    // Support multi-cart flow, single purchase flow, and legacy product-based flow
    purchaseId: Joi.string().optional(),
    purchaseIds: Joi.array().items(Joi.string()).optional(), // Multi-cart support
    amount: Joi.number().positive().optional(),
    totalAmount: Joi.number().positive().optional(), // Multi-cart total amount
    productId: Joi.string().optional(),
    userId: Joi.string().required().messages({
      'any.required': 'User ID is required for payment session management',
      'string.empty': 'User ID cannot be empty'
    }),
    returnUrl: Joi.string().uri().optional(),
    callbackUrl: Joi.string().uri().optional(),
    environment: Joi.string().valid('test', 'production').optional(),
    frontendOrigin: Joi.string().uri().optional(),
    // Coupon-related parameters for multi-cart checkout
    appliedCoupons: Joi.array().items(
      Joi.object({
        code: Joi.string().required(),
        id: Joi.string().required(),
        discountAmount: Joi.number().positive().required(),
        discountType: Joi.string().valid('percentage', 'fixed').required()
      })
    ).optional(),
    originalAmount: Joi.number().positive().optional(), // Amount before discounts
    totalDiscount: Joi.number().min(0).optional() // Total discount applied
  }).custom((value, helpers) => {
    if (value.purchaseIds && value.purchaseIds.length > 0) {
      // Multi-cart flow - purchaseIds and totalAmount are required
      if (!value.totalAmount) {
        return helpers.error('any.custom', {
          message: 'totalAmount is required when purchaseIds is provided'
        });
      }
      return value;
    } else if (value.purchaseId) {
      // Single purchase flow - purchaseId is required
      return value;
    } else if (value.productId && (value.amount || value.totalAmount)) {
      // Legacy product-based flow - productId and amount/totalAmount are required
      return value;
    } else {
      return helpers.error('any.custom', {
        message: 'Either purchaseIds with totalAmount, purchaseId, or productId with amount/totalAmount are required'
      });
    }
  }),

  // Subscription
  createSubscriptionPage: Joi.object({
    planId: Joi.string().required(),
    userId: Joi.string().optional(),
    userEmail: Joi.string().email().optional(),
    environment: Joi.string().valid('test', 'production').optional()
  }),

  // Workshop-specific validation
  workshopCreate: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().allow(null, ''),
    short_description: Joi.string().allow(null, ''),
    category: Joi.string().allow(null, ''),
    price: Joi.number().min(0).required(),
    is_published: Joi.boolean().default(false),
    image_url: Joi.string().uri().allow(null, ''),
    image_is_private: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string()).default([]),
    target_audience: Joi.string().allow(null, ''),
    access_days: Joi.number().integer().min(0).allow(null), // null = lifetime access
    
    // Workshop type validation
    workshop_type: Joi.string().valid('recorded', 'online_live').required(),
    
    // Fields for recorded workshops
    video_file_url: Joi.when('workshop_type', {
      is: 'recorded',
      then: Joi.string().allow(null, ''), // Optional for recorded workshops
      otherwise: Joi.string().allow(null, '') // Not needed for online workshops
    }),
    
    // Fields for online live workshops
    scheduled_date: Joi.when('workshop_type', {
      is: 'online_live',
      then: Joi.date().iso().required().messages({
        'date.base': 'Scheduled date is required for online live workshops',
        'any.required': 'Scheduled date is required for online live workshops'
      }),
      otherwise: Joi.date().iso().allow(null)
    }),
    
    meeting_link: Joi.when('workshop_type', {
      is: 'online_live',
      then: Joi.string().uri().required().messages({
        'string.uri': 'Meeting link must be a valid URL',
        'any.required': 'Meeting link is required for online live workshops'
      }),
      otherwise: Joi.string().allow(null, '')
    }),
    
    meeting_platform: Joi.when('workshop_type', {
      is: 'online_live',
      then: Joi.string().valid('zoom', 'google_meet', 'teams', 'other').required().messages({
        'any.only': 'Meeting platform must be one of: zoom, google_meet, teams, other',
        'any.required': 'Meeting platform is required for online live workshops'
      }),
      otherwise: Joi.string().valid('zoom', 'google_meet', 'teams', 'other').allow(null)
    }),
    
    meeting_password: Joi.string().allow(null, ''),
    max_participants: Joi.number().integer().min(1).allow(null),
    duration_minutes: Joi.number().integer().min(1).allow(null),
    
    // Optional marketing video fields that may be sent from frontend
    marketing_video_type: Joi.string().valid('youtube', 'uploaded').allow(null),
    marketing_video_id: Joi.string().allow(null, ''),
    marketing_video_title: Joi.string().allow(null, ''),
    marketing_video_duration: Joi.number().integer().min(1).allow(null),
    file_url: Joi.string().allow(null, ''),
    preview_file_url: Joi.string().allow(null, ''),
    file_type: Joi.string().allow(null, ''),
    total_duration_minutes: Joi.number().integer().min(1).allow(null)
  }),

  // Workshop update (same as create but without required fields)
  workshopUpdate: Joi.object({
    title: Joi.string().min(1).max(255),
    description: Joi.string().allow(null, ''),
    short_description: Joi.string().allow(null, ''),
    category: Joi.string().allow(null, ''),
    price: Joi.number().min(0),
    is_published: Joi.boolean(),
    image_url: Joi.string().uri().allow(null, ''),
    image_is_private: Joi.boolean(),
    tags: Joi.array().items(Joi.string()),
    target_audience: Joi.string().allow(null, ''),
    access_days: Joi.number().integer().min(0).allow(null), // null = lifetime access
    workshop_type: Joi.string().valid('recorded', 'online_live'),
    video_file_url: Joi.string().allow(null, ''),
    scheduled_date: Joi.date().iso().allow(null),
    meeting_link: Joi.string().uri().allow(null, ''),
    meeting_platform: Joi.string().valid('zoom', 'google_meet', 'teams', 'other').allow(null),
    meeting_password: Joi.string().allow(null, ''),
    max_participants: Joi.number().integer().min(1).allow(null),
    duration_minutes: Joi.number().integer().min(1).allow(null),
    
    // Optional marketing video fields that may be sent from frontend
    marketing_video_type: Joi.string().valid('youtube', 'uploaded').allow(null),
    marketing_video_id: Joi.string().allow(null, ''),
    marketing_video_title: Joi.string().allow(null, ''),
    marketing_video_duration: Joi.number().integer().min(1).allow(null),
    file_url: Joi.string().allow(null, ''),
    preview_file_url: Joi.string().allow(null, ''),
    file_type: Joi.string().allow(null, ''),
    total_duration_minutes: Joi.number().integer().min(1).allow(null)
  }).min(1),

  // Game validation schemas
  gameCreate: Joi.object({
    title: Joi.string().min(3).max(100).required().messages({
      'string.min': 'Title must be at least 3 characters long',
      'string.max': 'Title cannot exceed 100 characters',
      'any.required': 'Title is required'
    }),
    short_description: Joi.string().min(10).max(500).required().messages({
      'string.min': 'Short description must be at least 10 characters long',
      'string.max': 'Short description cannot exceed 500 characters',
      'any.required': 'Short description is required'
    }),
    description: Joi.string().allow(null, ''),
    game_type: Joi.string().valid(...GAME_TYPE_KEYS).required().messages({
      'any.only': 'Invalid game type',
      'any.required': 'Game type is required'
    }),
    price: Joi.number().min(0).max(1000).default(0).messages({
      'number.min': 'Price cannot be negative',
      'number.max': 'Price cannot exceed 1000'
    }),
    digital: Joi.boolean().default(true),
    is_published: Joi.boolean().default(false),
    subject: Joi.string().allow(null, ''),
    skills: Joi.array().items(Joi.string()).default([]),
    age_range: Joi.object({
      min: Joi.number().integer().min(0).max(100).allow(null),
      max: Joi.number().integer().min(0).max(100).allow(null)
    }).allow(null),
    grade_range: Joi.object({
      min: Joi.number().integer().min(1).max(12).allow(null),
      max: Joi.number().integer().min(1).max(12).allow(null)
    }).allow(null),
    language: Joi.string().valid('hebrew', 'english', 'arabic').default('hebrew'),
    tags: Joi.array().items(Joi.string()).default([]),
    image_url: Joi.string().uri().allow(null, ''),
    game_settings: Joi.object().required().messages({
      'any.required': 'Game settings are required'
    })
  }),

  // Game update (same as create but without required fields)
  gameUpdate: Joi.object({
    title: Joi.string().min(3).max(100),
    short_description: Joi.string().min(10).max(500),
    description: Joi.string().allow(null, ''),
    game_type: Joi.string().valid(...GAME_TYPE_KEYS),
    price: Joi.number().min(0).max(1000),
    digital: Joi.boolean(),
    is_published: Joi.boolean(),
    subject: Joi.string().allow(null, ''),
    skills: Joi.array().items(Joi.string()),
    age_range: Joi.object({
      min: Joi.number().integer().min(0).max(100).allow(null),
      max: Joi.number().integer().min(0).max(100).allow(null)
    }).allow(null),
    grade_range: Joi.object({
      min: Joi.number().integer().min(1).max(12).allow(null),
      max: Joi.number().integer().min(1).max(12).allow(null)
    }).allow(null),
    language: Joi.string().valid('hebrew', 'english', 'arabic'),
    tags: Joi.array().items(Joi.string()),
    image_url: Joi.string().uri().allow(null, ''),
    game_settings: Joi.object()
  }).min(1)
};

// Rate limiting middleware
export const rateLimiters = {
  // Authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // General API endpoints
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.ENVIRONMENT === 'development' ? 10000 : 1000, // Stricter in production
    message: {
      error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Note: onLimitReached was deprecated in express-rate-limit v7
    // Rate limit violations are now logged via middleware instead
  }),

  // File upload endpoints
  upload: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per 15 minutes
    message: {
      error: 'Too many file uploads, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Email endpoints
  email: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // 200 emails per hour
    message: {
      error: 'Email rate limit exceeded, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),

  // Payment status checking endpoints (CRITICAL: Prevent API overload)
  paymentStatusCheck: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.ENVIRONMENT === 'development' ? 100 : 20, // 20 calls per 15 minutes in production
    message: {
      error: 'Too many payment status check requests, please wait before trying again',
      details: 'This endpoint checks PayPlus payment status and has rate limiting to protect system performance',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Add custom key generator to limit per user
    keyGenerator: (req) => {
      return req.user?.id || req.ip; // Rate limit per authenticated user, fallback to IP
    }
  })
};

// Custom validators
export const customValidators = {
  // Validate entity type
  validateEntityType: (req, res, next) => {
    const validEntityTypes = [
      'user', 'settings', 'configuration', 'registration', 'emailtemplate', 'category',
      'coupon', 'supportmessage', 'notification', 'product',
      'purchase', 'transaction', 'workshop', 'course', 'file', 'tool', 'emaillog',
      'game', 'gamecontent', 'audiofile', 'gameaudiosettings', 'word', 'worden', 'image',
      'qa', 'grammar', 'contentlist', 'contentrelationship', 'subscriptionplan',
      'webhooklog', 'pendingsubscription', 'subscriptionhistory', 'gamesession',
      'attribute', 'gamecontenttag', 'contenttag', 'contenttopic',
      'school', 'classroom', 'studentinvitation', 'parentconsent',
      'classroommembership', 'curriculum', 'curriculumitem', 'curriculumproduct',
      'lessonplan'
    ];

    const entityType = req.params.type?.toLowerCase();
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        validTypes: validEntityTypes
      });
    }

    req.params.type = entityType;
    next();
  },

  // Validate file upload
  validateFileUpload: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    const file = req.file;
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (file.size > maxSize) {
      return res.status(400).json({
        error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`
      });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/m4a', 'audio/mp4',
      'video/mp4', 'video/avi', 'video/mov'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: `File type ${file.mimetype} not allowed`,
        allowedTypes
      });
    }

    next();
  },

  // Strict video upload validation for secure streaming
  validateVideoUpload: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No video file uploaded'
      });
    }

    const file = req.file;
    const maxVideoSize = 500 * 1024 * 1024; // 500MB for videos

    if (file.size > maxVideoSize) {
      return res.status(400).json({
        error: `Video file too large. Maximum size is ${maxVideoSize / 1024 / 1024}MB`
      });
    }

    // Only allow secure video formats that support streaming
    const allowedVideoTypes = [
      'video/mp4',  // H.264/H.265 in MP4 container
      'video/webm', // VP8/VP9 in WebM container
      'video/ogg'   // Theora in OGG container
    ];

    if (!allowedVideoTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: `Video format ${file.mimetype} not supported for secure streaming`,
        allowedFormats: ['MP4 (H.264)', 'WebM (VP8/VP9)', 'OGG (Theora)'],
        message: 'Only streaming-optimized video formats are allowed to prevent downloads'
      });
    }

    // Additional security checks
    const fileName = file.originalname.toLowerCase();
    const secureExtensions = ['.mp4', '.webm', '.ogg'];

    if (!secureExtensions.some(ext => fileName.endsWith(ext))) {
      return res.status(400).json({
        error: 'Invalid file extension',
        allowedExtensions: secureExtensions
      });
    }

    next();
  }
};

// Student access control middleware
export async function studentsAccessMiddleware(req, res, next) {
  try {
    // This middleware controls student access based on settings.students_access
    // For now, we'll allow all student access by default
    // The actual access control logic can be implemented later based on requirements

    // In the future, this could check:
    // 1. 'invite_only' - Only allow with lobby codes or teacher invitations
    // 2. 'authed_only' - Require some form of authentication
    // 3. 'all' - Allow all access including anonymous

    // For now, simply pass through to allow player authentication endpoints to work
    next();
  } catch (error) {
    console.error('[studentsAccessMiddleware] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Sanitize HTML content
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return html;

  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
}