import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { BadRequestError } from '../middleware/errorHandler.js';

/**
 * LessonPlanValidationService
 *
 * Validates lesson plan linked products composition according to business rules:
 * - Min 0 linked products (lesson plans can work without linked products)
 * - Max 50 linked products per lesson plan (same as bundles)
 * - All linked products must be published and available
 * - Mixed product types allowed (file + game + workshop, etc.)
 * - No circular references (lesson plan can't link to bundle that links back)
 * - Lesson plans can link to any published product regardless of creator
 * - No duplicate linked products allowed
 */
class LessonPlanValidationService {
  /**
   * Validate lesson plan linked products composition
   *
   * @param {Array} linkedProducts - Array of {product_id, product_type, title}
   * @param {string} lessonPlanId - Lesson plan product ID (for circular reference check)
   * @param {string} creatorId - User ID creating the lesson plan
   * @returns {Object} { valid, errors, products }
   */
  async validateLinkedProducts(linkedProducts, lessonPlanId, creatorId) {
    const errors = [];

    try {
      // Basic constraints
      if (linkedProducts && linkedProducts.length > 50) {
        errors.push('מקסימום 50 מוצרים מקושרים בתכנית השיעור');
      }

      // Empty linked products is valid
      if (!linkedProducts || linkedProducts.length === 0) {
        return { valid: true, errors: [], products: [] };
      }

      ludlog.auth('Validating lesson plan linked products:', {
        linkedProductsCount: linkedProducts.length,
        lessonPlanId,
        creatorId
      });

      // Fetch actual products from database
      const productIds = linkedProducts.map(item => item.product_id);
      const products = await models.Product.findAll({
        where: {
          id: productIds
        },
        attributes: [
          'id', 'title', 'product_type', 'price', 'is_published',
          'creator_user_id', 'type_attributes', 'entity_id'
        ]
      });

      ludlog.auth('Validating linked products composition:', {
        requestedProducts: productIds.length,
        foundProducts: products.length
      });

      // Validate all products exist
      if (products.length !== productIds.length) {
        const foundIds = products.map(p => p.id);
        const missingIds = productIds.filter(id => !foundIds.includes(id));
        errors.push(`לא נמצאו מוצרים מקושרים: ${missingIds.join(', ')}`);
      }

      // Validate all products are published
      const unpublishedProducts = products.filter(p => !p.is_published);
      if (unpublishedProducts.length > 0) {
        const unpublishedTitles = unpublishedProducts.map(p => p.title).join(', ');
        errors.push(`לא ניתן לקשר למוצרים לא מפורסמים: ${unpublishedTitles}`);
      }

      // Validate product types match declared types
      for (const linkedProduct of linkedProducts) {
        const actualProduct = products.find(p => p.id === linkedProduct.product_id);
        if (actualProduct && actualProduct.product_type !== linkedProduct.product_type) {
          errors.push(`סוג מוצר לא תואם עבור ${linkedProduct.product_id}: מצופה ${linkedProduct.product_type}, נמצא ${actualProduct.product_type}`);
        }
      }

      // Check for circular references (lesson plan linking to bundle that includes this lesson plan)
      await this.validateNoCircularReferences(products, lessonPlanId, errors);

      // Check for self-reference (lesson plan linking to itself)
      if (productIds.includes(lessonPlanId)) {
        errors.push('תכנית שיעור לא יכולה להפנות לעצמה');
      }

      // Duplicate products check
      const uniqueProductIds = new Set(productIds);
      if (uniqueProductIds.size !== productIds.length) {
        errors.push('לא ניתן לקשר לאותו מוצר פעמיים');
      }

      // Validate product type distribution (warn if too many of same type)
      this.validateProductTypeDistribution(products, errors);

      return {
        valid: errors.length === 0,
        errors,
        products: products.map(p => p.toJSON())
      };
    } catch (error) {
      luderror.auth('Lesson plan linked products validation failed:', error);
      throw new BadRequestError(`שגיאה בבדיקת תקינות המוצרים המקושרים: ${error.message}`);
    }
  }

  /**
   * Validate that there are no circular references between lesson plans and bundles
   *
   * @param {Array} products - Array of Product records
   * @param {string} lessonPlanId - Current lesson plan ID
   * @param {Array} errors - Errors array to append to
   */
  async validateNoCircularReferences(products, lessonPlanId, errors) {
    try {
      // Check if any linked product is a bundle that includes this lesson plan
      const bundles = products.filter(p => p.type_attributes?.is_bundle === true);

      for (const bundle of bundles) {
        const bundleItems = bundle.type_attributes.bundle_items || [];

        // Check if this lesson plan is included in the bundle
        const includesThisLessonPlan = bundleItems.some(item =>
          item.product_id === lessonPlanId && item.product_type === 'lesson_plan'
        );

        if (includesThisLessonPlan) {
          errors.push(`זוהתה התייחסות מעגלית: הקיט "${bundle.title}" מכיל את תכנית השיעור הזו`);
        }
      }

      // Check if any linked product is a lesson plan that links back to this one
      const linkedLessonPlans = products.filter(p => p.product_type === 'lesson_plan');

      for (const linkedLessonPlan of linkedLessonPlans) {
        if (linkedLessonPlan.type_attributes?.supports_derived_access) {
          const linkedProducts = linkedLessonPlan.type_attributes.linked_products || [];

          // Check if the linked lesson plan links back to this one
          const linksBackToThis = linkedProducts.some(lp => lp.product_id === lessonPlanId);

          if (linksBackToThis) {
            errors.push(`זוהתה התייחסות מעגלית: תכנית השיעור "${linkedLessonPlan.title}" מקשרת חזרה לתכנית שיעור זו`);
          }
        }
      }
    } catch (error) {
      luderror.auth('Circular reference validation failed:', error);
      // Don't throw - just add error to the list
      errors.push('שגיאה בבדיקת התייחסויות מעגליות');
    }
  }

  /**
   * Validate product type distribution and provide warnings
   *
   * @param {Array} products - Array of Product records
   * @param {Array} errors - Errors array to append warnings to
   */
  validateProductTypeDistribution(products, errors) {
    const typeCounts = {};

    products.forEach(product => {
      const type = product.product_type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Warn if more than 10 products of the same type (not an error, just a warning)
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > 10) {
        errors.push(`אזהרה: ${count} מוצרים מסוג ${type} - שקול לפצל לכמה תכניות שיעור`);
      }
    });

    ludlog.auth('Lesson plan product type distribution:', typeCounts);
  }

  /**
   * Validate lesson plan with linked products (main validation method)
   *
   * @param {Object} lessonPlanData - Lesson plan data with type_attributes.linked_products
   * @param {string} lessonPlanId - Lesson plan product ID (null for new lesson plans)
   * @param {string} creatorId - User ID creating/updating the lesson plan
   * @returns {Object} { valid, errors, products, statistics }
   */
  async validateLessonPlan(lessonPlanData, lessonPlanId, creatorId) {
    try {
      const linkedProducts = lessonPlanData.type_attributes?.linked_products || [];

      ludlog.auth('Validating complete lesson plan:', {
        lessonPlanId,
        creatorId,
        supportsDeriviedAccess: lessonPlanData.type_attributes?.supports_derived_access,
        linkedProductsCount: linkedProducts.length
      });

      // If lesson plan doesn't support derived access, no validation needed
      if (!lessonPlanData.type_attributes?.supports_derived_access) {
        return {
          valid: true,
          errors: [],
          products: [],
          statistics: {
            linkedProductsCount: 0,
            productTypes: {},
            supportsDeriviedAccess: false
          }
        };
      }

      // Validate linked products
      const validationResult = await this.validateLinkedProducts(linkedProducts, lessonPlanId, creatorId);

      // Generate statistics
      const statistics = this.generateStatistics(validationResult.products);

      return {
        valid: validationResult.valid,
        errors: validationResult.errors,
        products: validationResult.products,
        statistics
      };
    } catch (error) {
      luderror.auth('Complete lesson plan validation failed:', error);
      throw error;
    }
  }

  /**
   * Generate statistics for lesson plan validation results
   *
   * @param {Array} products - Array of validated Product records
   * @returns {Object} Statistics object
   */
  generateStatistics(products) {
    const productTypes = {};
    let totalValue = 0;

    products.forEach(product => {
      const type = product.product_type;
      productTypes[type] = (productTypes[type] || 0) + 1;
      totalValue += parseFloat(product.price) || 0;
    });

    return {
      linkedProductsCount: products.length,
      productTypes,
      totalLinkedValue: totalValue,
      supportsDeriviedAccess: true,
      averageProductValue: products.length > 0 ? totalValue / products.length : 0
    };
  }

  /**
   * Get products available for linking to lesson plans
   *
   * @param {string} userId - User ID (for filtering if needed)
   * @param {Array} excludeProductIds - Product IDs to exclude (e.g., already linked)
   * @param {Object} filters - Additional filters (product_type, creator_user_id, etc.)
   * @returns {Array} Available products for linking
   */
  async getAvailableProductsForLinking(userId, excludeProductIds = [], filters = {}) {
    try {
      const whereClause = {
        is_published: true,
        product_type: { [models.sequelize.Op.not]: 'lesson_plan' } // Can't link to other lesson plans
      };

      // Exclude specified products
      if (excludeProductIds.length > 0) {
        whereClause.id = { [models.sequelize.Op.notIn]: excludeProductIds };
      }

      // Apply additional filters
      if (filters.product_type) {
        whereClause.product_type = filters.product_type;
      }

      if (filters.creator_user_id) {
        whereClause.creator_user_id = filters.creator_user_id;
      }

      const products = await models.Product.findAll({
        where: whereClause,
        attributes: [
          'id', 'title', 'description', 'product_type', 'price',
          'entity_id', 'image_filename', 'has_image', 'creator_user_id'
        ],
        include: [
          {
            model: models.User,
            as: 'creator',
            attributes: ['id', 'full_name'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 100 // Prevent too large results
      });

      // Filter out bundles that might create circular references
      // (More sophisticated filtering could be added here)
      const nonProblematicProducts = products.filter(() => {
        // For now, allow all non-lesson-plan products
        return true;
      });

      ludlog.auth('Retrieved available products for lesson plan linking:', {
        userId,
        excludeCount: excludeProductIds.length,
        filters,
        totalProducts: nonProblematicProducts.length
      });

      return nonProblematicProducts.map(p => ({
        ...p.toJSON(),
        linkable: true
      }));
    } catch (error) {
      luderror.auth('Failed to get available products for linking:', error);
      throw error;
    }
  }

  /**
   * Validate a single linked product reference
   *
   * @param {Object} linkedProduct - Single linked product object {product_id, product_type, title}
   * @returns {Object} { valid, errors, product }
   */
  async validateSingleLinkedProduct(linkedProduct) {
    try {
      if (!linkedProduct.product_id || !linkedProduct.product_type) {
        return {
          valid: false,
          errors: ['product_id ו-product_type נדרשים'],
          product: null
        };
      }

      const product = await models.Product.findOne({
        where: {
          id: linkedProduct.product_id,
          product_type: linkedProduct.product_type
        }
      });

      if (!product) {
        return {
          valid: false,
          errors: ['המוצר לא נמצא או סוג המוצר לא תואם'],
          product: null
        };
      }

      if (!product.is_published) {
        return {
          valid: false,
          errors: ['לא ניתן לקשר למוצר לא מפורסם'],
          product: product.toJSON()
        };
      }

      return {
        valid: true,
        errors: [],
        product: product.toJSON()
      };
    } catch (error) {
      luderror.auth('Single linked product validation failed:', error);
      return {
        valid: false,
        errors: [`שגיאת מערכת: ${error.message}`],
        product: null
      };
    }
  }
}

export default new LessonPlanValidationService();