import express from 'express';
import CurriculumLinkingService from '../services/CurriculumLinkingService.js';
import { authenticateToken, requireUserType } from '../middleware/auth.js';
import { rateLimiters, validateBody } from '../middleware/validation.js';
import models from '../models/index.js';
import Joi from 'joi';
import { ludlog, luderror } from '../lib/ludlog.js';
import { haveAdminAccess } from '../constants/adminAccess.js';

const router = express.Router();

/**
 * Curriculum Linking API Routes
 *
 * These routes provide automatic curriculum linking based on product metadata
 * (grade ranges and subjects) already stored in products.
 */

// Validation schemas
const applyCurriculumLinksSchema = Joi.object({
  productId: Joi.string().required(),
  curriculumItemIds: Joi.array().items(Joi.string()).min(1).max(50).required()
});

const removeCurriculumLinkSchema = Joi.object({
  curriculumProductId: Joi.string().required()
});

const browseCurriculaSchema = Joi.object({
  subject: Joi.string().allow('').optional(),
  gradeMin: Joi.number().integer().min(1).max(12).optional(),
  gradeMax: Joi.number().integer().min(1).max(12).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  subjects: Joi.string().valid('true').optional(),
  gradeRanges: Joi.string().valid('true').optional()
});

const bulkOperationsSchema = Joi.object({
  operations: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('apply', 'remove').required(),
      productId: Joi.string().when('type', { is: 'apply', then: Joi.required() }),
      curriculumItemIds: Joi.array().items(Joi.string()).when('type', { is: 'apply', then: Joi.required() }),
      curriculumProductId: Joi.string().when('type', { is: 'remove', then: Joi.required() })
    })
  ).min(1).max(20).required()
});

/**
 * GET /api/curriculum-linking/suggestions/:productId
 * Get curriculum suggestions for a product based on its grade/subject metadata
 */
router.get('/suggestions/:productId',
  authenticateToken,
  requireUserType('teacher'),
  rateLimiters.general, // General API rate limiting
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { productId } = req.params;
      const userId = req.user.id;

      ludlog.api('Getting curriculum suggestions for product:', {
        productId,
        userId,
        userRole: req.user.role
      });

      // Verify product exists and user has access
      // Admin users can access orphaned products (null creator_user_id)
      const whereClause = haveAdminAccess(req.user.role, 'curriculum_access', req)
        ? { id: productId }
        : { id: productId, creator_user_id: userId };

      const product = await models.Product.findOne({
        where: whereClause
      });

      if (!product) {
        ludlog.api('Product not found or access denied for curriculum suggestions:', {
          productId,
          userId,
          userRole: req.user.role,
          isAdminAccess: haveAdminAccess(req.user.role, 'curriculum_access', req)
        });
        return res.status(404).json({
          error: {
            message: 'Product not found or access denied',
            code: 'PRODUCT_NOT_FOUND',
            statusCode: 404
          }
        });
      }

      // Log access details
      ludlog.api('Product access verified for curriculum suggestions:', {
        productId,
        userId,
        userRole: req.user.role,
        productCreatorId: product.creator_user_id,
        isOrphanedProduct: product.creator_user_id === null,
        isAdminAccessToOrphaned: haveAdminAccess(req.user.role, 'curriculum_access', req) && product.creator_user_id === null
      });

      ludlog.api('Product found for curriculum suggestions:', {
        productId,
        productType: product.product_type,
        productTitle: product.title,
        typeAttributes: product.type_attributes
      });

      // Only support curriculum linking for specific product types
      const supportedTypes = ['file', 'game', 'lesson_plan'];
      if (!supportedTypes.includes(product.product_type)) {
        ludlog.api('Unsupported product type for curriculum linking:', {
          productId,
          productType: product.product_type,
          supportedTypes
        });
        return res.status(400).json({
          error: {
            message: `Curriculum linking not supported for product type: ${product.product_type}`,
            code: 'UNSUPPORTED_PRODUCT_TYPE',
            statusCode: 400
          }
        });
      }

      const suggestions = await CurriculumLinkingService.findMatchingCurricula(productId);
      const processingTime = Date.now() - startTime;

      ludlog.api('Curriculum suggestions found successfully:', {
        productId,
        userId,
        matchesCount: {
          perfect: suggestions.matches?.perfect?.length || 0,
          good: suggestions.matches?.good?.length || 0,
          partial: suggestions.matches?.partial?.length || 0,
          suggestions: suggestions.matches?.suggestions?.length || 0
        },
        gradeRanges: suggestions.gradeRanges,
        subjects: suggestions.subjects,
        existingLinksCount: suggestions.existingLinks?.length || 0,
        processingTimeMs: processingTime
      });

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      luderror.api('Error getting curriculum suggestions:', {
        productId: req.params.productId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime
      });
      res.status(500).json({
        error: {
          message: 'Failed to get curriculum suggestions',
          code: 'SUGGESTIONS_ERROR',
          statusCode: 500
        }
      });
    }
  }
);

/**
 * GET /api/curriculum-linking/existing/:productId
 * Get existing curriculum links for a product
 */
router.get('/existing/:productId',
  authenticateToken,
  requireUserType('teacher'),
  rateLimiters.general, // General API rate limiting
  async (req, res) => {
    try {
      const { productId } = req.params;
      const userId = req.user.id;

      ludlog.api('Getting existing curriculum links for product:', {
        productId,
        userId
      });

      // Verify product exists and user has access
      // Admin users can access orphaned products (null creator_user_id)
      const whereClause = haveAdminAccess(req.user.role, 'curriculum_access', req)
        ? { id: productId }
        : { id: productId, creator_user_id: userId };

      const product = await models.Product.findOne({
        where: whereClause
      });

      if (!product) {
        ludlog.api('Product not found or access denied for existing links:', {
          productId,
          userId,
          userRole: req.user.role,
          isAdminAccess: haveAdminAccess(req.user.role, 'curriculum_access', req)
        });
        return res.status(404).json({
          error: {
            message: 'Product not found or access denied',
            code: 'PRODUCT_NOT_FOUND',
            statusCode: 404
          }
        });
      }

      // Log access details
      ludlog.api('Product access verified for existing links:', {
        productId,
        userId,
        userRole: req.user.role,
        productCreatorId: product.creator_user_id,
        isOrphanedProduct: product.creator_user_id === null,
        isAdminAccessToOrphaned: haveAdminAccess(req.user.role, 'curriculum_access', req) && product.creator_user_id === null
      });

      const existingLinks = await CurriculumLinkingService.getExistingLinks(productId);

      ludlog.api('Existing curriculum links retrieved successfully:', {
        productId,
        userId,
        linksCount: existingLinks?.length || 0,
        linkIds: existingLinks?.map(link => link.id) || []
      });

      res.json({
        success: true,
        data: {
          productId,
          links: existingLinks
        }
      });

    } catch (error) {
      luderror.api('Error getting existing curriculum links:', {
        productId: req.params.productId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        error: {
          message: 'Failed to get existing curriculum links',
          code: 'EXISTING_LINKS_ERROR',
          statusCode: 500
        }
      });
    }
  }
);

/**
 * POST /api/curriculum-linking/apply
 * Apply curriculum links to a product
 */
router.post('/apply',
  authenticateToken,
  requireUserType('teacher'),
  validateBody(applyCurriculumLinksSchema),
  rateLimiters.general, // General API rate limiting
  async (req, res) => {
    try {
      const { productId, curriculumItemIds } = req.body;
      const userId = req.user.id;

      ludlog.api('Applying curriculum links to product:', {
        productId,
        userId,
        curriculumItemIds,
        itemCount: curriculumItemIds.length
      });

      // Verify product exists and user has access
      // Admin users can access orphaned products (null creator_user_id)
      const whereClause = haveAdminAccess(req.user.role, 'curriculum_access', req)
        ? { id: productId }
        : { id: productId, creator_user_id: userId };

      const product = await models.Product.findOne({
        where: whereClause
      });

      if (!product) {
        ludlog.api('Product not found or access denied for applying links:', {
          productId,
          userId,
          userRole: req.user.role,
          isAdminAccess: haveAdminAccess(req.user.role, 'curriculum_access', req)
        });
        return res.status(404).json({
          error: {
            message: 'Product not found or access denied',
            code: 'PRODUCT_NOT_FOUND',
            statusCode: 404
          }
        });
      }

      // Log access details
      ludlog.api('Product access verified for applying links:', {
        productId,
        userId,
        userRole: req.user.role,
        productCreatorId: product.creator_user_id,
        isOrphanedProduct: product.creator_user_id === null,
        isAdminAccessToOrphaned: haveAdminAccess(req.user.role, 'curriculum_access', req) && product.creator_user_id === null
      });

      ludlog.api('Product verified for curriculum linking:', {
        productId,
        productType: product.product_type,
        productTitle: product.title
      });

      // Verify all curriculum items exist
      const curriculumItems = await models.CurriculumItem.findAll({
        where: { id: curriculumItemIds }
      });

      if (curriculumItems.length !== curriculumItemIds.length) {
        const foundIds = curriculumItems.map(item => item.id);
        const missingIds = curriculumItemIds.filter(id => !foundIds.includes(id));

        luderror.api('Some curriculum items not found:', {
          productId,
          userId,
          requestedIds: curriculumItemIds,
          foundIds,
          missingIds,
          foundCount: curriculumItems.length,
          requestedCount: curriculumItemIds.length
        });

        return res.status(400).json({
          error: {
            message: 'Some curriculum items not found',
            code: 'CURRICULUM_ITEMS_NOT_FOUND',
            statusCode: 400,
            details: {
              missingIds,
              foundCount: curriculumItems.length,
              requestedCount: curriculumItemIds.length
            }
          }
        });
      }

      ludlog.api('All curriculum items verified, applying links:', {
        productId,
        userId,
        curriculumItemsData: curriculumItems.map(item => ({
          id: item.id,
          curriculum_id: item.curriculum_id,
          name: item.name
        }))
      });

      const results = await CurriculumLinkingService.applyLinks(productId, curriculumItemIds);

      ludlog.api('Curriculum links applied successfully:', {
        productId,
        userId,
        results: {
          successCount: results.success.length,
          errorCount: results.errors.length,
          skippedCount: results.skipped.length,
          successIds: results.success.map(s => s.curriculumItemId),
          errorDetails: results.errors,
          skippedDetails: results.skipped
        }
      });

      res.json({
        success: true,
        data: results,
        message: `Successfully linked ${results.success.length} curriculum items`
      });

    } catch (error) {
      luderror.api('Error applying curriculum links:', {
        productId: req.body?.productId,
        userId: req.user?.id,
        curriculumItemIds: req.body?.curriculumItemIds,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        error: {
          message: 'Failed to apply curriculum links',
          code: 'APPLY_LINKS_ERROR',
          statusCode: 500
        }
      });
    }
  }
);

/**
 * DELETE /api/curriculum-linking/:curriculumProductId
 * Remove a curriculum link
 */
router.delete('/:curriculumProductId',
  authenticateToken,
  requireUserType('teacher'),
  rateLimiters.general, // General API rate limiting
  async (req, res) => {
    try {
      const { curriculumProductId } = req.params;
      const userId = req.user.id;

      ludlog.api('Removing curriculum link:', {
        curriculumProductId,
        userId
      });

      // Verify the curriculum link exists and user has access to the product
      // Admin users can access links for orphaned products (null creator_user_id)
      const productWhereClause = haveAdminAccess(req.user.role, 'curriculum_access', req)
        ? {} // No creator restriction for admins
        : { creator_user_id: userId };

      const link = await models.CurriculumProduct.findOne({
        where: { id: curriculumProductId },
        include: [
          {
            model: models.Product,
            where: productWhereClause
          },
          {
            model: models.CurriculumItem,
            include: [{
              model: models.Curriculum
            }]
          }
        ]
      });

      if (!link) {
        ludlog.api('Curriculum link not found or access denied:', {
          curriculumProductId,
          userId,
          userRole: req.user.role,
          isAdminAccess: haveAdminAccess(req.user.role, 'curriculum_access', req)
        });
        return res.status(404).json({
          error: {
            message: 'Curriculum link not found or access denied',
            code: 'LINK_NOT_FOUND',
            statusCode: 404
          }
        });
      }

      ludlog.api('Curriculum link found, proceeding with removal:', {
        curriculumProductId,
        userId,
        userRole: req.user.role,
        productId: link.product_id,
        productTitle: link.Product?.title,
        productCreatorId: link.Product?.creator_user_id,
        isOrphanedProduct: link.Product?.creator_user_id === null,
        isAdminAccessToOrphaned: haveAdminAccess(req.user.role, 'curriculum_access', req) && link.Product?.creator_user_id === null,
        curriculumItemId: link.curriculum_item_id,
        curriculumItemName: link.CurriculumItem?.name,
        curriculumId: link.CurriculumItem?.curriculum_id
      });

      const success = await CurriculumLinkingService.removeLink(curriculumProductId);

      if (success) {
        ludlog.api('Curriculum link removed successfully:', {
          curriculumProductId,
          userId,
          productId: link.product_id,
          curriculumItemId: link.curriculum_item_id
        });

        res.json({
          success: true,
          message: 'Curriculum link removed successfully'
        });
      } else {
        ludlog.api('Curriculum link removal failed (not found):', {
          curriculumProductId,
          userId
        });

        res.status(404).json({
          error: {
            message: 'Curriculum link not found',
            code: 'LINK_NOT_FOUND',
            statusCode: 404
          }
        });
      }

    } catch (error) {
      luderror.api('Error removing curriculum link:', {
        curriculumProductId: req.params.curriculumProductId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        error: {
          message: 'Failed to remove curriculum link',
          code: 'REMOVE_LINK_ERROR',
          statusCode: 500
        }
      });
    }
  }
);

/**
 * GET /api/curriculum-linking/browse
 * Browse curricula by manually selected subject and grade for products without metadata
 * Also supports getting available subjects and grade ranges for manual browsing UI
 */
router.get('/browse',
  authenticateToken,
  requireUserType('teacher'),
  rateLimiters.general, // General API rate limiting
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { subject, gradeMin, gradeMax, limit, subjects, gradeRanges } = req.query;
      const userId = req.user.id;

      // Handle special requests for available options
      if (subjects === 'true') {
        ludlog.api('Getting available subjects for manual browsing:', {
          userId,
          userRole: req.user.role
        });

        const availableSubjects = await CurriculumLinkingService.getAvailableSubjects();

        ludlog.api('Available subjects retrieved successfully:', {
          userId,
          subjectsCount: availableSubjects.length,
          subjects: availableSubjects
        });

        return res.json({
          success: true,
          data: {
            subjects: availableSubjects
          }
        });
      }

      if (gradeRanges === 'true') {
        ludlog.api('Getting available grade ranges for manual browsing:', {
          userId,
          userRole: req.user.role
        });

        const availableGradeRanges = await CurriculumLinkingService.getAvailableGradeRanges();

        // Transform to format expected by frontend
        const formattedGradeRanges = availableGradeRanges.map(range => ({
          min: range.from,
          max: range.to,
          type: range.type,
          display: range.display,
          key: range.key
        }));

        ludlog.api('Available grade ranges retrieved successfully:', {
          userId,
          gradeRangesCount: formattedGradeRanges.length,
          ranges: formattedGradeRanges.map(r => r.display)
        });

        return res.json({
          success: true,
          data: {
            gradeRanges: formattedGradeRanges
          }
        });
      }

      // Continue with normal curriculum browsing
      // Validate query parameters
      const { error, value } = browseCurriculaSchema.validate({
        subject: subject || '',
        gradeMin: gradeMin ? parseInt(gradeMin) : undefined,
        gradeMax: gradeMax ? parseInt(gradeMax) : undefined,
        limit: limit ? parseInt(limit) : 50,
        subjects: subjects,
        gradeRanges: gradeRanges
      });

      if (error) {
        return res.status(400).json({
          error: {
            message: 'Invalid query parameters',
            code: 'VALIDATION_ERROR',
            statusCode: 400,
            details: error.details.map(detail => detail.message)
          }
        });
      }

      ludlog.api('Browsing curricula with manual selection:', {
        userId,
        userRole: req.user.role,
        subject: value.subject,
        gradeMin: value.gradeMin,
        gradeMax: value.gradeMax,
        limit: value.limit
      });

      // If no grade range specified, return all active curricula
      const whereConditions = {
        teacher_user_id: null, // Only system curricula
        class_id: null,        // Not class-specific
        is_active: true        // Active curricula only
      };

      const { Op } = models.sequelize.Sequelize;

      // Add subject filter if provided
      if (value.subject && value.subject.trim()) {
        // Convert Hebrew display name to database key if needed
        const subjectKey = CurriculumLinkingService.getSubjectKeyFromDisplayName(value.subject.trim());

        ludlog.api('Subject filter conversion:', {
          originalSubject: value.subject.trim(),
          convertedKey: subjectKey,
          userId,
          userRole: req.user.role
        });

        whereConditions.subject = {
          [Op.iLike]: `%${subjectKey}%` // Case-insensitive partial match with proper key
        };
      }

      // Add grade range filter if provided
      if (value.gradeMin !== undefined && value.gradeMax !== undefined) {
        whereConditions[Op.or] = [
          // Legacy single grade curricula within range
          {
            grade: { [Op.between]: [value.gradeMin, value.gradeMax] },
            is_grade_range: false
          },
          // Range curricula that overlap with the specified range
          {
            [Op.and]: [
              { grade_from: { [Op.lte]: value.gradeMax } },
              { grade_to: { [Op.gte]: value.gradeMin } }
            ],
            is_grade_range: true
          }
        ];
      } else if (value.gradeMin !== undefined) {
        // Only minimum grade specified
        whereConditions[Op.or] = [
          {
            grade: { [Op.gte]: value.gradeMin },
            is_grade_range: false
          },
          {
            grade_to: { [Op.gte]: value.gradeMin },
            is_grade_range: true
          }
        ];
      } else if (value.gradeMax !== undefined) {
        // Only maximum grade specified
        whereConditions[Op.or] = [
          {
            grade: { [Op.lte]: value.gradeMax },
            is_grade_range: false
          },
          {
            grade_from: { [Op.lte]: value.gradeMax },
            is_grade_range: true
          }
        ];
      }

      // Find matching curricula
      const curricula = await models.Curriculum.findAll({
        where: whereConditions,
        limit: value.limit,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: models.CurriculumItem,
            as: 'items',
            where: { is_active: true },
            required: true, // Only include curricula that have active items
            include: [
              {
                model: models.Product,
                as: 'products',
                through: { attributes: [] }, // Don't include junction table data
                required: false // Include curriculum items even if no products linked
              }
            ]
          }
        ]
      });

      // Format the response with curriculum items
      const formattedCurricula = curricula.map(curriculum => ({
        id: curriculum.id,
        name: curriculum.name,
        description: curriculum.description,
        subject: curriculum.subject,
        gradeRange: curriculum.getGradeRange(),
        isActive: curriculum.is_active,
        items: curriculum.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          order_index: item.order_index,
          linkedProductsCount: item.products ? item.products.length : 0
        }))
      }));

      const processingTime = Date.now() - startTime;

      ludlog.api('Curriculum browsing completed successfully:', {
        userId,
        searchCriteria: {
          subject: value.subject,
          gradeMin: value.gradeMin,
          gradeMax: value.gradeMax
        },
        resultsCount: {
          curricula: curricula.length,
          totalItems: curricula.reduce((sum, c) => sum + (c.items?.length || 0), 0)
        },
        processingTimeMs: processingTime
      });

      res.json({
        success: true,
        data: {
          curricula: formattedCurricula,
          searchCriteria: {
            subject: value.subject,
            gradeMin: value.gradeMin,
            gradeMax: value.gradeMax
          },
          total: curricula.length
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      luderror.api('Error browsing curricula:', {
        userId: req.user?.id,
        searchParams: req.query,
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime
      });
      res.status(500).json({
        error: {
          message: 'Failed to browse curricula',
          code: 'BROWSE_ERROR',
          statusCode: 500
        }
      });
    }
  }
);

/**
 * POST /api/curriculum-linking/bulk
 * Perform bulk curriculum linking operations
 */
router.post('/bulk',
  authenticateToken,
  requireUserType('teacher'),
  validateBody(bulkOperationsSchema),
  rateLimiters.general, // General API rate limiting
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { operations } = req.body;
      const userId = req.user.id;

      ludlog.api('Starting bulk curriculum operations:', {
        userId,
        operationCount: operations.length,
        operationTypes: operations.map(op => op.type),
        operations: operations.map(op => ({
          type: op.type,
          productId: op.productId,
          curriculumProductId: op.curriculumProductId,
          itemCount: op.curriculumItemIds?.length
        }))
      });

      const results = {
        success: [],
        errors: []
      };

      // Process each operation
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const operationStartTime = Date.now();

        try {
          ludlog.api(`Processing bulk operation ${i + 1}/${operations.length}:`, {
            userId,
            operation: {
              type: operation.type,
              productId: operation.productId,
              curriculumProductId: operation.curriculumProductId,
              curriculumItemIds: operation.curriculumItemIds
            }
          });

          if (operation.type === 'apply') {
            // Verify product ownership
            // Admin users can access orphaned products (null creator_user_id)
            const whereClause = haveAdminAccess(req.user.role, 'curriculum_access', req)
              ? { id: operation.productId }
              : { id: operation.productId, creator_user_id: userId };

            const product = await models.Product.findOne({
              where: whereClause
            });

            if (!product) {
              ludlog.api('Bulk operation failed - product not found:', {
                userId,
                userRole: req.user.role,
                productId: operation.productId,
                operationIndex: i,
                isAdminAccess: haveAdminAccess(req.user.role, 'curriculum_access', req)
              });

              results.errors.push({
                operation,
                error: 'Product not found or access denied'
              });
              continue;
            }

            // Log access details for bulk operation
            ludlog.api('Bulk operation - product access verified:', {
              productId: operation.productId,
              userId,
              userRole: req.user.role,
              productCreatorId: product.creator_user_id,
              isOrphanedProduct: product.creator_user_id === null,
              isAdminAccessToOrphaned: haveAdminAccess(req.user.role, 'curriculum_access', req) && product.creator_user_id === null,
              operationIndex: i
            });

            const result = await CurriculumLinkingService.applyLinks(
              operation.productId,
              operation.curriculumItemIds
            );

            const operationTime = Date.now() - operationStartTime;

            ludlog.api(`Bulk apply operation completed:`, {
              userId,
              operationIndex: i,
              productId: operation.productId,
              result: {
                successCount: result.success.length,
                errorCount: result.errors.length,
                skippedCount: result.skipped.length
              },
              operationTimeMs: operationTime
            });

            results.success.push({
              type: 'apply',
              productId: operation.productId,
              result
            });

          } else if (operation.type === 'remove') {
            // Verify link ownership
            // Admin users can access links for orphaned products (null creator_user_id)
            const productWhereClause = haveAdminAccess(req.user.role, 'curriculum_access', req)
              ? {} // No creator restriction for admins
              : { creator_user_id: userId };

            const link = await models.CurriculumProduct.findOne({
              where: { id: operation.curriculumProductId },
              include: [
                {
                  model: models.Product,
                  where: productWhereClause
                }
              ]
            });

            if (!link) {
              ludlog.api('Bulk operation failed - link not found:', {
                userId,
                userRole: req.user.role,
                curriculumProductId: operation.curriculumProductId,
                operationIndex: i,
                isAdminAccess: haveAdminAccess(req.user.role, 'curriculum_access', req)
              });

              results.errors.push({
                operation,
                error: 'Curriculum link not found or access denied'
              });
              continue;
            }

            // Log access details for bulk remove operation
            ludlog.api('Bulk remove operation - link access verified:', {
              curriculumProductId: operation.curriculumProductId,
              userId,
              userRole: req.user.role,
              productCreatorId: link.Product?.creator_user_id,
              isOrphanedProduct: link.Product?.creator_user_id === null,
              isAdminAccessToOrphaned: haveAdminAccess(req.user.role, 'curriculum_access', req) && link.Product?.creator_user_id === null,
              operationIndex: i
            });

            const success = await CurriculumLinkingService.removeLink(
              operation.curriculumProductId
            );

            const operationTime = Date.now() - operationStartTime;

            ludlog.api(`Bulk remove operation completed:`, {
              userId,
              operationIndex: i,
              curriculumProductId: operation.curriculumProductId,
              success,
              operationTimeMs: operationTime
            });

            results.success.push({
              type: 'remove',
              curriculumProductId: operation.curriculumProductId,
              success
            });
          }

        } catch (error) {
          const operationTime = Date.now() - operationStartTime;

          luderror.api(`Bulk operation ${i + 1} failed:`, {
            userId,
            operationIndex: i,
            operation,
            error: error.message,
            stack: error.stack,
            operationTimeMs: operationTime
          });

          results.errors.push({
            operation,
            error: error.message
          });
        }
      }

      const totalTime = Date.now() - startTime;

      ludlog.api('Bulk curriculum operations completed:', {
        userId,
        totalOperations: operations.length,
        successCount: results.success.length,
        errorCount: results.errors.length,
        successRate: ((results.success.length / operations.length) * 100).toFixed(2) + '%',
        totalTimeMs: totalTime,
        avgTimePerOperation: (totalTime / operations.length).toFixed(2) + 'ms'
      });

      res.json({
        success: true,
        data: results,
        message: `Processed ${results.success.length} operations successfully, ${results.errors.length} errors`
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;

      luderror.api('Error processing bulk curriculum operations:', {
        userId: req.user?.id,
        operationCount: req.body?.operations?.length,
        error: error.message,
        stack: error.stack,
        totalTimeMs: totalTime
      });

      res.status(500).json({
        error: {
          message: 'Failed to process bulk operations',
          code: 'BULK_OPERATIONS_ERROR',
          statusCode: 500
        }
      });
    }
  }
);

export default router;