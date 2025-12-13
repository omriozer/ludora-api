import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import { haveAdminAccess } from '../constants/adminAccess.js';

/**
 * BundleValidationService
 *
 * Validates bundle composition and pricing according to business rules:
 * - Min 2 items, max 20 items per bundle
 * - All items must be published products
 * - All items must be same product type
 * - No nested bundles allowed
 * - Content creators can only bundle their own products (admins can bundle any)
 * - Bundle price must be lower than sum of individual prices
 * - Minimum 5% savings required
 */
class BundleValidationService {
  /**
   * Validate bundle composition
   *
   * @param {Array} bundleItems - Array of {product_id, entity_id, title, price}
   * @param {string} creatorId - User ID creating the bundle
   * @param {string} userRole - User role (admin/sysadmin can bundle others' products)
   * @returns {Object} { valid, errors, products }
   */
  async validateBundleComposition(bundleItems, creatorId, userRole = null) {
    const errors = [];

    try {
      // Basic constraints
      if (!bundleItems || bundleItems.length < 2) {
        errors.push('קיט חייב לכלול לפחות 2 מוצרים');
      }

      if (bundleItems && bundleItems.length > 20) {
        errors.push('מקסימום 20 מוצרים בקיט');
      }

      // If basic validation fails, return early
      if (errors.length > 0) {
        return { valid: false, errors, products: [] };
      }

      // Fetch actual products from database
      const productIds = bundleItems.map(item => item.product_id);
      const products = await models.Product.findAll({
        where: {
          id: productIds
        },
        attributes: [
          'id', 'title', 'product_type', 'price', 'is_published',
          'creator_user_id', 'type_attributes', 'entity_id'
        ]
      });

      ludlog.payments('Validating bundle composition:', {
        requestedProducts: productIds.length,
        foundProducts: products.length
      });

      // Validate all products exist
      if (products.length !== productIds.length) {
        const foundIds = products.map(p => p.id);
        const missingIds = productIds.filter(id => !foundIds.includes(id));
        errors.push(`לא נמצאו מוצרים: ${missingIds.join(', ')}`);
      }

      // Validate all products are published
      const unpublishedProducts = products.filter(p => !p.is_published);
      if (unpublishedProducts.length > 0) {
        errors.push('לא ניתן לכלול מוצרים לא מפורסמים בקיט');
      }

      // Same type validation
      const productTypes = [...new Set(products.map(p => p.product_type))];
      if (productTypes.length > 1) {
        errors.push(`כל המוצרים בקיט חייבים להיות מאותו סוג. נמצאו: ${productTypes.join(', ')}`);
      }

      // No nested bundles
      const hasNestedBundle = products.some(p => p.type_attributes?.is_bundle === true);
      if (hasNestedBundle) {
        errors.push('לא ניתן לכלול קיט בתוך קיט');
      }

      // Ownership validation (content creators can only bundle own products)
      const isAdmin = haveAdminAccess(userRole, 'bundle_others_products');
      if (!isAdmin) {
        const otherProducts = products.filter(p => {
          // Product without creator = Ludora product (allowed)
          if (!p.creator_user_id) {
            return false;
          }
          // Product by different creator
          return String(p.creator_user_id) !== String(creatorId);
        });

        if (otherProducts.length > 0) {
          errors.push('רק מנהלים יכולים לכלול מוצרים של יוצרים אחרים');
        }
      }

      // Duplicate products check
      const uniqueProductIds = new Set(productIds);
      if (uniqueProductIds.size !== productIds.length) {
        errors.push('לא ניתן לכלול את אותו מוצר פעמיים בקיט');
      }

      return {
        valid: errors.length === 0,
        errors,
        products: products.map(p => p.toJSON())
      };
    } catch (error) {
      luderror.payments('Bundle composition validation failed:', error);
      throw new BadRequestError(`שגיאה בבדיקת תקינות הקיט: ${error.message}`);
    }
  }

  /**
   * Validate bundle pricing
   *
   * @param {Array} products - Array of Product records
   * @param {number} bundlePrice - Proposed bundle price
   * @returns {Object} { valid, errors, originalTotal, savings, savingsPercentage }
   */
  validateBundlePricing(products, bundlePrice) {
    const errors = [];

    try {
      // Calculate original total
      const originalTotal = products.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        return sum + price;
      }, 0);

      const bundlePriceNum = parseFloat(bundlePrice) || 0;

      ludlog.payments('Validating bundle pricing:', {
        productCount: products.length,
        originalTotal,
        bundlePrice: bundlePriceNum
      });

      // Bundle price must be lower than original total
      if (bundlePriceNum >= originalTotal) {
        errors.push('מחיר הקיט חייב להיות נמוך ממחיר המוצרים בנפרד');
      }

      // Calculate savings
      const savings = originalTotal - bundlePriceNum;
      const savingsPercentage = originalTotal > 0
        ? (savings / originalTotal) * 100
        : 0;

      // Minimum 5% savings required
      if (savingsPercentage < 5) {
        errors.push('נדרש חיסכון מינימלי של 5% (חיסכון נוכחי: ' + savingsPercentage.toFixed(1) + '%)');
      }

      // Bundle price cannot be negative or zero
      if (bundlePriceNum <= 0) {
        errors.push('מחיר הקיט חייב להיות גדול מ-0');
      }

      return {
        valid: errors.length === 0,
        errors,
        originalTotal,
        savings,
        savingsPercentage: Math.round(savingsPercentage)
      };
    } catch (error) {
      luderror.payments('Bundle pricing validation failed:', error);
      throw new BadRequestError(`שגיאה בבדיקת מחיר הקיט: ${error.message}`);
    }
  }

  /**
   * Validate complete bundle data (composition + pricing)
   *
   * @param {Array} bundleItems - Array of {product_id, entity_id, title, price}
   * @param {number} bundlePrice - Proposed bundle price
   * @param {string} creatorId - User ID creating the bundle
   * @param {string} userRole - User role
   * @returns {Object} { valid, errors, products, pricingInfo }
   */
  async validateBundle(bundleItems, bundlePrice, creatorId, userRole = null) {
    try {
      // Validate composition
      const compositionResult = await this.validateBundleComposition(bundleItems, creatorId, userRole);

      if (!compositionResult.valid) {
        return {
          valid: false,
          errors: compositionResult.errors,
          products: [],
          pricingInfo: null
        };
      }

      // Validate pricing
      const pricingResult = this.validateBundlePricing(compositionResult.products, bundlePrice);

      // Combine results
      return {
        valid: pricingResult.valid,
        errors: pricingResult.errors,
        products: compositionResult.products,
        pricingInfo: {
          originalTotal: pricingResult.originalTotal,
          bundlePrice: parseFloat(bundlePrice),
          savings: pricingResult.savings,
          savingsPercentage: pricingResult.savingsPercentage
        }
      };
    } catch (error) {
      luderror.payments('Complete bundle validation failed:', error);
      throw error;
    }
  }

  /**
   * Get products available for bundling by a user
   *
   * @param {string} userId - User ID
   * @param {string} productType - Product type to filter by
   * @param {string} userRole - User role
   * @returns {Array} Available products for bundling
   */
  async getAvailableProductsForBundling(userId, productType, userRole = null) {
    try {
      const isAdmin = haveAdminAccess(userRole, 'bundle_others_products');

      const whereClause = {
        product_type: productType,
        is_published: true
      };

      // Non-admins can only bundle their own products + Ludora products
      if (!isAdmin) {
        whereClause[models.sequelize.Op.or] = [
          { creator_user_id: userId },
          { creator_user_id: null } // Ludora products
        ];
      }

      const products = await models.Product.findAll({
        where: whereClause,
        attributes: [
          'id', 'title', 'description', 'product_type', 'price',
          'entity_id', 'image_filename', 'has_image', 'creator_user_id'
        ],
        order: [['created_at', 'DESC']]
      });

      // Filter out existing bundles
      const nonBundleProducts = products.filter(p => !p.type_attributes?.is_bundle);

      ludlog.payments('Retrieved available products for bundling:', {
        userId,
        productType,
        isAdmin,
        totalProducts: nonBundleProducts.length
      });

      return nonBundleProducts.map(p => p.toJSON());
    } catch (error) {
      luderror.payments('Failed to get available products for bundling:', error);
      throw error;
    }
  }
}

export default new BundleValidationService();
