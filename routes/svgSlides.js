import express from 'express';
import multer from 'multer';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireRole, requireTeacher, requireAdmin, optionalAuth } from '../middleware/auth.js';
import models from '../models/index.js';
import DirectSlideService from '../services/DirectSlideService.js';
import { checkLessonPlanAccess } from '../utils/lessonPlanPresentationHelper.js';
import { mergeSvgTemplate } from '../utils/svgTemplateMerge.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Custom middleware to allow both admin role and teacher user_type
function requireAdminOrTeacher(req, res, next) {
  // Check if user is admin (by role)
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  // Check if user is teacher (by user_type) - delegate to requireTeacher middleware
  requireTeacher(req, res, next);
}

/**
 * Get placeholder SVG content for restricted slides
 * Loads from static placeholder file for consistency and maintainability
 */
function getPlaceholderSlideContent() {
  try {
    const placeholderPath = path.join(process.cwd(), 'assets', 'placeholders', 'preview-not-available.svg');

    if (fs.existsSync(placeholderPath)) {
      return fs.readFileSync(placeholderPath, 'utf8');
    }

    // Fallback to inline SVG if file not found (should not happen)
    console.error('⚠️ Placeholder SVG file not found, using fallback inline SVG');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#f8f9fa"/>
  <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#495057">
    Content Restricted
  </text>
  <text x="400" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#6c757d">
    This content is available to purchased users only
  </text>
</svg>`;
  } catch (error) {
    console.error('❌ Error loading placeholder SVG:', error);
    // Return minimal fallback
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#f8f9fa"/>
  <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#495057">
    Content Restricted
  </text>
</svg>`;
  }
}

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
  authenticateToken,
  requireAdminOrTeacher,
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
 * @route GET /api/svg-slides/:lessonPlanId/preview
 * @desc Get lesson plan slides with preview functionality (handles both full access and preview mode)
 * @access Public (with access control)
 */
router.get(
  '/:lessonPlanId/preview',
  optionalAuth,
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
      const userId = req.user?.uid || null;
      const isPreviewRequest = req.query.preview === 'true';

      // Get lesson plan entity to check preview settings
      const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
      if (!lessonPlan) {
        return res.status(404).json({
          success: false,
          message: 'Lesson plan not found'
        });
      }

      // Check user access to the lesson plan
      const hasAccess = userId ? await checkLessonPlanAccess(userId, lessonPlanId) : false;

      // Determine access level
      let accessType;
      let isPreviewMode = false;

      if (hasAccess) {
        // User has full access - no preview mode needed
        accessType = 'full';
      } else if (lessonPlan.allow_slide_preview) {
        // User doesn't have access but preview is allowed
        accessType = 'preview';
        isPreviewMode = true;
      } else {
        // No access and preview not allowed
        accessType = 'denied';
        return res.status(403).json({
          success: false,
          message: 'Access denied. Purchase required to view this lesson plan.',
          access_info: {
            has_access: false,
            preview_allowed: false,
            lesson_plan_id: lessonPlanId
          }
        });
      }

      // Get slides using DirectSlideService with content loaded for template processing
      const slidesResult = await DirectSlideService.getSlides(lessonPlanId, { includeContent: true });
      if (!slidesResult.success) {
        return res.status(404).json({
          success: false,
          message: 'Lesson plan slides not found'
        });
      }

      let processedSlides = slidesResult.slides;
      let accessibleCount = slidesResult.totalSlides;

      // Get template settings for accessible slides
      let brandingTemplateSettings = null;
      let watermarkTemplateSettings = null;

      // Check if branding is enabled for this lesson plan
      const shouldApplyBranding = lessonPlan.add_branding === true;

      // Get branding template (only if branding is enabled)
      if (shouldApplyBranding && lessonPlan.branding_template_id) {
        try {
          const brandingTemplate = await models.SystemTemplate.findByPk(lessonPlan.branding_template_id);
          if (brandingTemplate) {
            brandingTemplateSettings = brandingTemplate.template_data;
          }
        } catch (error) {
          // Template error - continue without branding elements
        }
      }

      // Use custom branding settings if available, otherwise use system template (only if branding is enabled)
      if (shouldApplyBranding && lessonPlan.branding_settings) {
        brandingTemplateSettings = lessonPlan.branding_settings;
      }

      // Get watermark template
      if (lessonPlan.watermark_template_id) {
        try {
          const watermarkTemplate = await models.SystemTemplate.findByPk(lessonPlan.watermark_template_id);
          if (watermarkTemplate) {
            watermarkTemplateSettings = watermarkTemplate.template_data;
          }
        } catch (error) {
          // Template error - continue without watermark elements
        }
      }

      // Prepare variables for template processing
      const templateVariables = {
        lessonPlanTitle: lessonPlan.title || 'Lesson Plan',
        userId: userId || 'Anonymous',
        accessType: isPreviewMode ? 'Preview' : 'Full Access'
      };

      // Helper function to apply both templates in sequence
      const applyTemplates = async (slideContent) => {
        let processedContent = slideContent;

        // Apply branding template first (base layer)
        if (brandingTemplateSettings && slideContent) {
          try {
            processedContent = await mergeSvgTemplate(
              processedContent,
              brandingTemplateSettings,
              templateVariables
            );
          } catch (error) {
            // Branding template processing failed - continue with original content
          }
        }

        // Apply watermark template second (overlay layer)
        if (watermarkTemplateSettings && processedContent) {
          try {
            processedContent = await mergeSvgTemplate(
              processedContent,
              watermarkTemplateSettings,
              templateVariables
            );
          } catch (error) {
            // Watermark template processing failed - continue with branding-processed content
          }
        }

        return processedContent;
      };

      // Apply access control in preview mode
      if (isPreviewMode) {
        const accessibleSlideIndices = lessonPlan.accessible_slides || null;

        if (accessibleSlideIndices && accessibleSlideIndices.length > 0) {
          // Preview mode with restrictions - only show specific slides
          processedSlides = await Promise.all(slidesResult.slides.map(async (slide, index) => {
            const isAccessible = accessibleSlideIndices.includes(index);

            if (isAccessible) {
              // Apply both branding and watermark templates to accessible slides
              const processedContent = await applyTemplates(slide.content);

              return {
                ...slide,
                content: processedContent,
                access_type: 'preview',
                is_placeholder: false
              };
            } else {
              // Return placeholder for restricted slides
              return {
                id: `placeholder-${index}`,
                slide_order: index + 1,
                title: `Slide ${index + 1} (Preview Restricted)`,
                filename: `slide-${index + 1}-placeholder.svg`,
                content: getPlaceholderSlideContent(),
                s3_key: null,
                access_type: 'denied',
                is_placeholder: true
              };
            }
          }));

          accessibleCount = accessibleSlideIndices.length;
        } else {
          // Preview mode without restrictions - all slides accessible with templates
          processedSlides = await Promise.all(slidesResult.slides.map(async (slide) => {
            // Apply both branding and watermark templates to all slides
            const processedContent = await applyTemplates(slide.content);

            return {
              ...slide,
              content: processedContent,
              access_type: 'preview',
              is_placeholder: false
            };
          }));
        }
      } else {
        // Full access - apply templates to all slides
        processedSlides = await Promise.all(slidesResult.slides.map(async (slide) => {
          // Apply both branding and watermark templates to all slides with full access
          const processedContent = await applyTemplates(slide.content);

          return {
            ...slide,
            content: processedContent,
            access_type: 'full',
            is_placeholder: false
          };
        }));
      }

      res.json({
        success: true,
        data: {
          lessonPlanId,
          slides: processedSlides,
          totalSlides: slidesResult.totalSlides,
          access_info: {
            has_full_access: hasAccess,
            is_preview_mode: isPreviewMode,
            access_type: accessType,
            accessible_count: accessibleCount,
            preview_allowed: lessonPlan.allow_slide_preview || false,
            has_restrictions: isPreviewMode && lessonPlan.accessible_slides && lessonPlan.accessible_slides.length > 0
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lesson plan slides',
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
  requireAdminOrTeacher,
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
  requireAdminOrTeacher,
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
  requireAdminOrTeacher,
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
  requireAdminOrTeacher,
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