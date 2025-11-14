import express from 'express';
import multer from 'multer';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import models from '../models/index.js';
import DirectSlideService from '../services/DirectSlideService.js';

const router = express.Router();

// Configure multer for SVG file uploads with higher limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for individual SVG files (matching DirectSlideService)
    files: 50, // Allow up to 50 files for chunked upload
    fieldSize: 100 * 1024 * 1024, // 100MB field size limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/svg+xml') {
      cb(null, true);
    } else {
      cb(new Error('Only SVG files are allowed for presentation slides'), false);
    }
  }
});

/**
 * @route POST /api/svg-slides/:lessonPlanId/upload
 * @desc Upload SVG slide(s) for a lesson plan presentation (supports chunked uploads)
 * @access Admin/Teacher
 */
router.post(
  '/:lessonPlanId/upload',
  // Add specific CORS headers for file uploads
  (req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  },
  authenticateToken,
  requireRole(['admin', 'teacher']),
  upload.array('slides', 50), // Allow up to 50 slides for chunked uploads
  [
    param('lessonPlanId').isString().notEmpty().withMessage('Lesson plan ID is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { lessonPlanId } = req.params;
      const files = req.files;
      const userId = req.user.id;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No SVG files provided'
        });
      }

      // Find the lesson plan
      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
      if (!lessonPlan) {
        return res.status(404).json({
          success: false,
          message: 'Lesson plan not found'
        });
      }

      const transaction = await models.sequelize.transaction();

      try {
        // Use DirectSlideService for multiple file upload
        const uploadResult = await DirectSlideService.uploadMultipleSlides({
          files,
          lessonPlanId,
          userId,
          transaction,
          logger: console
        });

        await transaction.commit();

        if (!uploadResult.success && uploadResult.failedUploads.length === files.length) {
          return res.status(500).json({
            success: false,
            message: 'All slides failed to upload',
            failures: uploadResult.failedUploads
          });
        }

        // Get updated lesson plan slides
        const updatedLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
        const allSlides = updatedLessonPlan.getDirectPresentationSlides();

        res.json({
          success: uploadResult.success,
          message: uploadResult.success
            ? `Successfully uploaded ${uploadResult.totalUploaded} SVG slide(s)`
            : `Uploaded ${uploadResult.totalUploaded} slides, ${uploadResult.totalFailed} failed`,
          data: {
            lessonPlanId,
            uploadedSlides: uploadResult.uploadedSlides,
            failedUploads: uploadResult.failedUploads,
            totalUploaded: uploadResult.totalUploaded,
            totalFailed: uploadResult.totalFailed,
            totalSlides: allSlides.length,
            allSlides
          }
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to upload SVG slides',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/svg-slides/:lessonPlanId
 * @desc Get all SVG slides for a lesson plan presentation
 * @access Admin/Teacher
 */
router.get(
  '/:lessonPlanId',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  [
    param('lessonPlanId').isString().notEmpty().withMessage('Lesson plan ID is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { lessonPlanId } = req.params;

      // Use DirectSlideService to get slides
      const slidesResult = await DirectSlideService.getSlides(lessonPlanId);

      if (!slidesResult.success) {
        return res.status(404).json({
          success: false,
          message: 'Lesson plan not found'
        });
      }

      res.json({
        success: true,
        data: {
          lessonPlanId,
          slides: slidesResult.slides,
          totalSlides: slidesResult.totalSlides
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SVG slides',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/svg-slides/:lessonPlanId/reorder
 * @desc Reorder SVG slides in a lesson plan presentation
 * @access Admin/Teacher
 */
router.put(
  '/:lessonPlanId/reorder',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  [
    param('lessonPlanId').isString().notEmpty().withMessage('Lesson plan ID is required'),
    body('slideOrder').isArray().withMessage('slideOrder must be an array of slide IDs'),
    body('slideOrder.*').isString().withMessage('Each slide ID must be a string'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { lessonPlanId } = req.params;
      const { slideOrder } = req.body;

      const transaction = await models.sequelize.transaction();

      try {
        // Use DirectSlideService to reorder slides
        const reorderResult = await DirectSlideService.reorderSlides({
          lessonPlanId,
          slideIds: slideOrder,
          transaction
        });

        await transaction.commit();

        if (!reorderResult.success) {
          return res.status(404).json({
            success: false,
            message: 'Lesson plan not found'
          });
        }

        res.json({
          success: true,
          message: 'Slides reordered successfully',
          data: {
            lessonPlanId,
            slides: reorderResult.slides,
            newOrder: reorderResult.newOrder
          }
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to reorder SVG slides',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/svg-slides/:lessonPlanId/:slideId
 * @desc Delete a specific SVG slide from a lesson plan presentation
 * @access Admin/Teacher
 */
router.delete(
  '/:lessonPlanId/:slideId',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  [
    param('lessonPlanId').isString().notEmpty().withMessage('Lesson plan ID is required'),
    param('slideId').isString().notEmpty().withMessage('Slide ID is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { lessonPlanId, slideId } = req.params;
      const userId = req.user.id;

      const transaction = await models.sequelize.transaction();

      try {
        // Use DirectSlideService to delete slide
        const deleteResult = await DirectSlideService.deleteSlide({
          lessonPlanId,
          slideId,
          userId,
          transaction,
          logger: console
        });

        await transaction.commit();

        if (!deleteResult.success) {
          return res.status(404).json({
            success: false,
            message: 'Slide or lesson plan not found'
          });
        }

        // Get remaining slides
        const updatedLessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
        const remainingSlides = updatedLessonPlan.getDirectPresentationSlides();

        res.json({
          success: true,
          message: 'SVG slide deleted successfully',
          data: {
            lessonPlanId,
            deletedSlideId: slideId,
            deletedSlide: deleteResult.deletedSlide,
            remainingSlides,
            totalSlides: remainingSlides.length,
            s3Deleted: deleteResult.s3Deleted
          }
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete SVG slide',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/svg-slides/:lessonPlanId/validate
 * @desc Validate that lesson plan has at least one presentation slide for publishing
 * @access Admin/Teacher
 */
router.get(
  '/:lessonPlanId/validate',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  [
    param('lessonPlanId').isString().notEmpty().withMessage('Lesson plan ID is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { lessonPlanId } = req.params;

      // Use DirectSlideService to get slides
      const slidesResult = await DirectSlideService.getSlides(lessonPlanId);

      if (!slidesResult.success) {
        return res.status(404).json({
          success: false,
          message: 'Lesson plan not found'
        });
      }

      const hasMinimumSlides = slidesResult.totalSlides >= 1;

      res.json({
        success: true,
        data: {
          lessonPlanId,
          isValid: hasMinimumSlides,
          slideCount: slidesResult.totalSlides,
          minimumRequired: 1,
          message: hasMinimumSlides
            ? 'Lesson plan has sufficient slides for publishing'
            : 'Lesson plan requires at least 1 presentation slide to publish'
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to validate lesson plan slides',
        error: error.message
      });
    }
  }
);

export default router;