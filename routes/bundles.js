import express from 'express';
import BundleValidationService from '../services/BundleValidationService.js';
import BundlePurchaseService from '../services/BundlePurchaseService.js';
import ProductServiceRouter from '../services/ProductServiceRouter.js';
import { authenticateToken } from '../middleware/auth.js';
import { haveAdminAccess } from '../constants/adminAccess.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import models from '../models/index.js';

const router = express.Router();

/**
 * GET /api/bundles/available-products/:type
 * Get products available for bundling
 */
router.get('/available-products/:type', authenticateToken, async (req, res, next) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    ludlog.payments('Fetching available products for bundling:', {
      userId,
      productType: type,
      userRole
    });

    const products = await BundleValidationService.getAvailableProductsForBundling(
      userId,
      type,
      userRole
    );

    res.json({
      products,
      count: products.length
    });
  } catch (error) {
    luderror.payments('Failed to fetch available products:', error);
    next(error);
  }
});

/**
 * POST /api/bundles/validate
 * Validate bundle composition and pricing
 */
router.post('/validate', authenticateToken, async (req, res, next) => {
  try {
    const { bundleItems, bundlePrice } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    ludlog.payments('Validating bundle:', {
      userId,
      itemCount: bundleItems?.length,
      bundlePrice
    });

    if (!bundleItems || !Array.isArray(bundleItems)) {
      return res.status(400).json({
        valid: false,
        errors: ['bundleItems חייב להיות מערך של מוצרים']
      });
    }

    if (bundlePrice === undefined || bundlePrice === null) {
      return res.status(400).json({
        valid: false,
        errors: ['bundlePrice הינו שדה חובה']
      });
    }

    const validationResult = await BundleValidationService.validateBundle(
      bundleItems,
      bundlePrice,
      userId,
      userRole
    );

    res.json(validationResult);
  } catch (error) {
    luderror.payments('Bundle validation failed:', error);
    next(error);
  }
});

/**
 * POST /api/bundles/create
 * Create bundle product
 */
router.post('/create', authenticateToken, async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      bundleItems,
      bundlePrice,
      productType,
      tags,
      target_audience,
      image_filename,
      has_image
    } = req.body;

    const userId = req.user.id;
    const userRole = req.user.role;

    ludlog.payments('Creating bundle product:', {
      userId,
      title,
      productType,
      itemCount: bundleItems?.length,
      bundlePrice
    });

    // Validate bundle before creation
    const validationResult = await BundleValidationService.validateBundle(
      bundleItems,
      bundlePrice,
      userId,
      userRole
    );

    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Bundle validation failed',
        errors: validationResult.errors
      });
    }

    // Create dummy entity for ProductServiceRouter compatibility
    // Bundle products need an entity_id but don't have real entity data
    const dummyEntity = await models.File.create({
      id: models.sequelize.fn('gen_random_uuid'),
      content_metadata: {
        is_bundle: true,
        bundle_type: productType
      },
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create Product record with bundle metadata
    const bundleProduct = await models.Product.create({
      title,
      description,
      category,
      product_type: productType,
      entity_id: dummyEntity.id,
      price: parseFloat(bundlePrice),
      is_published: false, // Bundles start as draft
      creator_user_id: userId,
      image_filename,
      has_image: has_image || false,
      tags: tags || [],
      target_audience: target_audience || null,
      type_attributes: {
        is_bundle: true,
        bundle_type: productType,
        bundle_items: bundleItems.map(item => ({
          product_id: item.product_id,
          entity_id: item.entity_id,
          title: item.title,
          price: item.price
        })),
        original_total_price: validationResult.pricingInfo.originalTotal,
        savings: validationResult.pricingInfo.savings,
        savings_percentage: validationResult.pricingInfo.savingsPercentage
      },
      created_at: new Date(),
      updated_at: new Date()
    });

    ludlog.payments('Bundle product created successfully:', {
      bundleProductId: bundleProduct.id,
      title,
      itemCount: bundleItems.length
    });

    res.status(201).json({
      ...bundleProduct.toJSON(),
      bundleItems: bundleItems.length,
      savings: validationResult.pricingInfo.savings
    });
  } catch (error) {
    luderror.payments('Failed to create bundle:', error);
    next(error);
  }
});

/**
 * GET /api/bundles/:id/contents
 * Get bundle contents for display
 */
router.get('/:id/contents', async (req, res, next) => {
  try {
    const { id } = req.params;

    ludlog.payments('Fetching bundle contents:', { bundleId: id });

    // Get bundle product
    const bundleProduct = await models.Product.findByPk(id);

    if (!bundleProduct) {
      return res.status(404).json({
        error: 'Bundle not found'
      });
    }

    if (!bundleProduct.type_attributes?.is_bundle) {
      return res.status(400).json({
        error: 'Product is not a bundle'
      });
    }

    const bundleItems = bundleProduct.type_attributes.bundle_items || [];

    // Fetch full product details for each bundled item
    const productIds = bundleItems.map(item => item.product_id);
    const products = await models.Product.findAll({
      where: { id: productIds },
      attributes: [
        'id', 'title', 'description', 'product_type', 'price',
        'entity_id', 'image_filename', 'has_image', 'is_published'
      ]
    });

    // Map products with bundle metadata
    const enrichedItems = bundleItems.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        ...item,
        ...(product ? product.toJSON() : {})
      };
    });

    res.json({
      bundle: {
        id: bundleProduct.id,
        title: bundleProduct.title,
        description: bundleProduct.description,
        price: bundleProduct.price,
        original_total_price: bundleProduct.type_attributes.original_total_price,
        savings: bundleProduct.type_attributes.savings,
        savings_percentage: bundleProduct.type_attributes.savings_percentage
      },
      items: enrichedItems,
      itemCount: enrichedItems.length
    });
  } catch (error) {
    luderror.payments('Failed to fetch bundle contents:', error);
    next(error);
  }
});

/**
 * GET /api/bundles/purchase/:id
 * Get bundle purchase details (main purchase + individual purchases)
 */
router.get('/purchase/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const purchase = await models.Purchase.findByPk(id);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (purchase.buyer_user_id !== userId && !haveAdminAccess(req.user.role, 'purchase_access')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const bundleDetails = await BundlePurchaseService.getBundlePurchaseDetails(id);

    res.json(bundleDetails);
  } catch (error) {
    luderror.payments('Failed to get bundle purchase details:', error);
    next(error);
  }
});

export default router;
