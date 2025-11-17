/**
 * EduContent API Routes
 *
 * RESTful API for educational content management with file upload support
 * and streaming endpoints following established Ludora patterns.
 */

import express from 'express';
import multer from 'multer';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import models from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import EduContentService from '../services/EduContentService.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();
const { sequelize } = models;

// Configure multer for file uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow images and certain document types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'image/webp',
      'application/pdf',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Rate limiting for content creation
const createContentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 content items per window per user
  message: { error: 'Too many content creation requests, please try again later' }
});

// Validation schemas
const contentCreateSchema = Joi.object({
  element_type: Joi.string()
    .valid('data', 'playing_card_complete', 'playing_card_bg')
    .required()
    .messages({
      'any.only': 'element_type must be one of: data, playing_card_complete, playing_card_bg'
    }),
  content: Joi.string()
    .max(1000)
    .required()
    .messages({
      'string.max': 'content must be less than 1000 characters'
    }),
  content_metadata: Joi.object()
    .optional()
    .default({})
});

const contentUpdateSchema = Joi.object({
  content: Joi.string()
    .max(1000)
    .optional(),
  content_metadata: Joi.object()
    .optional()
});

const contentSearchSchema = Joi.object({
  search: Joi.string().max(100).optional(),
  element_type: Joi.string()
    .valid('data', 'playing_card_complete', 'playing_card_bg')
    .optional(),
  limit: Joi.number().min(1).max(100).default(20),
  offset: Joi.number().min(0).default(0)
});

// Middleware for validation
const validateContentCreate = (req, res, next) => {
  const { error, value } = contentCreateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  req.validatedData = value;
  next();
};

const validateContentUpdate = (req, res, next) => {
  const { error, value } = contentUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  req.validatedData = value;
  next();
};

const validateContentSearch = (req, res, next) => {
  const { error, value } = contentSearchSchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details[0].message
    });
  }
  req.validatedQuery = value;
  next();
};

// Routes

/**
 * GET /api/edu-content
 * List/search educational content with pagination
 */
router.get('/', validateContentSearch, async (req, res) => {
  try {
    const results = await EduContentService.findContent(req.validatedQuery);
    res.json(results);
  } catch (error) {
    cerror('Error in GET /edu-content:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/edu-content
 * Create new text-based educational content
 */
router.post('/',
  authenticateToken,
  createContentLimiter,
  validateContentCreate,
  async (req, res) => {
    try {
      const content = await EduContentService.createContent({
        ...req.validatedData,
        userId: req.user.id
      });

      res.status(201).json(content);
    } catch (error) {
      cerror('Error in POST /edu-content:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/edu-content/upload
 * Create educational content with file upload
 */
router.post('/upload',
  authenticateToken,
  createContentLimiter,
  upload.single('file'),
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      // Validate file is provided
      if (!req.file) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Parse and validate form data
      const formData = {
        element_type: req.body.element_type,
        content: req.body.content,
        content_metadata: req.body.content_metadata
          ? JSON.parse(req.body.content_metadata)
          : {}
      };

      const { error } = contentCreateSchema.validate(formData);
      if (error) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      clog(`Creating content with file upload: ${req.file.originalname}`);

      // Create content with file
      const content = await EduContentService.createContent({
        ...formData,
        file: req.file,
        userId: req.user.id,
        transaction
      });

      await transaction.commit();

      res.status(201).json(content);

    } catch (error) {
      await transaction.rollback();
      cerror('Error in POST /edu-content/upload:', error);

      if (error.message.includes('File type') || error.message.includes('file size')) {
        return res.status(400).json({
          error: 'File validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/edu-content/:id
 * Get single educational content item
 */
router.get('/:id', async (req, res) => {
  try {
    const content = await EduContentService.findById(req.params.id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json(content);
  } catch (error) {
    cerror(`Error in GET /edu-content/${req.params.id}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/edu-content/:id/file
 * Stream file for educational content (following media.js pattern)
 */
router.get('/:id/file', async (req, res) => {
  try {
    await EduContentService.streamContentFile(req.params.id, res);
  } catch (error) {
    cerror(`Error streaming file for content ${req.params.id}:`, error);

    if (error.message === 'Content not found') {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (error.message === 'File not found') {
      return res.status(404).json({ error: 'File not found for this content' });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * PUT /api/edu-content/:id
 * Update educational content metadata
 */
router.put('/:id',
  authenticateToken,
  validateContentUpdate,
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const content = await EduContentService.updateContent(
        req.params.id,
        req.validatedData,
        transaction
      );

      await transaction.commit();

      res.json(content);
    } catch (error) {
      await transaction.rollback();
      cerror(`Error in PUT /edu-content/${req.params.id}:`, error);

      if (error.message === 'Content not found') {
        return res.status(404).json({ error: 'Content not found' });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/edu-content/:id
 * Delete educational content with S3 cleanup
 */
router.delete('/:id',
  authenticateToken,
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      await EduContentService.deleteContent(req.params.id, transaction);
      await transaction.commit();

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });
    } catch (error) {
      await transaction.rollback();
      cerror(`Error in DELETE /edu-content/${req.params.id}:`, error);

      if (error.message === 'Content not found') {
        return res.status(404).json({ error: 'Content not found' });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/edu-content/:id/usage
 * Get content usage statistics
 */
router.get('/:id/usage', async (req, res) => {
  try {
    const usage = await EduContentService.getContentUsage(req.params.id);
    res.json(usage);
  } catch (error) {
    cerror(`Error getting usage for content ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 50MB'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: error.message
    });
  }
  next(error);
});

export default router;