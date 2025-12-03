import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import SubscriptionAllowanceService from './SubscriptionAllowanceService.js';

/**
 * LessonPlanSubscriptionService
 *
 * Handles subscription claiming flow for lesson plans with linked products using auto-claim pattern:
 * 1. Creates main lesson plan subscription claim record
 * 2. Auto-creates individual subscription claims for each linked product
 * 3. Properly tracks allowance consumption for each item
 * 4. Existing AccessControlService handles access via normal subscription claim checks
 *
 * This approach requires ZERO changes to access control logic - lesson plans with linked products work
 * automatically through existing subscription-based access patterns.
 */
class LessonPlanSubscriptionService {
  /**
   * Create lesson plan subscription claim with auto-created linked product claims
   *
   * @param {Object} lessonPlanProduct - The lesson plan Product record with type_attributes.linked_products
   * @param {string} userId - User ID claiming the content
   * @param {string} subscriptionId - Active subscription ID
   * @param {Object} claimData - Additional claim metadata
   * @param {Object} transaction - Optional Sequelize transaction
   * @returns {Object} { lessonPlanClaim, linkedProductClaims }
   */
  async createLessonPlanClaim(lessonPlanProduct, userId, subscriptionId, claimData = {}, transaction = null) {
    const shouldCommit = !transaction;
    const txn = transaction || await models.sequelize.transaction();

    try {
      // Validate lesson plan product structure
      if (lessonPlanProduct.product_type !== 'lesson_plan') {
        throw new BadRequestError('Product is not a lesson plan');
      }

      if (!lessonPlanProduct.type_attributes?.supports_derived_access) {
        throw new BadRequestError('Lesson plan does not support derived access');
      }

      const linkedProducts = lessonPlanProduct.type_attributes.linked_products || [];
      const totalItemsToClaim = linkedProducts.length + 1; // +1 for lesson plan itself

      ludlog.auth('Creating lesson plan subscription claim:', {
        lessonPlanProductId: lessonPlanProduct.id,
        userId,
        subscriptionId,
        linkedProductCount: linkedProducts.length,
        totalClaims: totalItemsToClaim
      });

      // 1. Validate subscription allowances BEFORE claiming anything
      await this.validateAllowancesBeforeClaiming(
        userId,
        subscriptionId,
        lessonPlanProduct,
        linkedProducts,
        txn
      );

      const monthYear = models.SubscriptionPurchase.getMonthYear();

      // 2. Create main lesson plan subscription claim
      const lessonPlanClaim = await models.SubscriptionPurchase.create({
        id: generateId(),
        user_id: userId,
        subscription_id: subscriptionId,
        product_type: 'lesson_plan',
        product_id: lessonPlanProduct.id,
        claimed_at: new Date(),
        month_year: monthYear,
        status: 'active',
        usage: {
          times_used: 0,
          claimed_via: 'subscription',
          lesson_plan_title: lessonPlanProduct.title,
          linked_products_count: linkedProducts.length,
          auto_claimed_linked: true,
          ...claimData.metadata
        }
      }, { transaction: txn });

      ludlog.auth('Main lesson plan claim created:', {
        lessonPlanClaimId: lessonPlanClaim.id
      });

      // 3. Auto-create subscription claims for each linked product
      const linkedProductClaims = [];

      for (const linkedProduct of linkedProducts) {
        // Validate linked product exists and is published
        const targetProduct = await models.Product.findOne({
          where: {
            id: linkedProduct.product_id,
            product_type: linkedProduct.product_type,
            is_published: true
          },
          transaction: txn
        });

        if (!targetProduct) {
          throw new BadRequestError(`Linked product ${linkedProduct.product_id} (${linkedProduct.product_type}) not found or not published`);
        }

        const linkedClaim = await models.SubscriptionPurchase.create({
          id: generateId(),
          user_id: userId,
          subscription_id: subscriptionId,
          product_type: linkedProduct.product_type,
          product_id: linkedProduct.product_id,
          claimed_at: new Date(),
          month_year: monthYear,
          status: 'active',
          usage: {
            times_used: 0,
            claimed_via: 'lesson_plan_auto_claim',
            source_lesson_plan_id: lessonPlanProduct.id,
            source_lesson_plan_title: lessonPlanProduct.title,
            main_lesson_plan_claim_id: lessonPlanClaim.id,
            linked_product_info: {
              title: linkedProduct.title,
              original_price: linkedProduct.price
            },
            ...claimData.metadata
          }
        }, { transaction: txn });

        linkedProductClaims.push(linkedClaim);

        ludlog.auth('Linked product claim created:', {
          linkedClaimId: linkedClaim.id,
          productType: linkedProduct.product_type,
          productId: linkedProduct.product_id
        });
      }

      // 4. Record allowance consumption for subscription tracking
      try {
        // Record usage for main lesson plan
        await SubscriptionAllowanceService.recordUsage(
          userId,
          'lesson_plan',
          lessonPlanProduct.entity_id,
          {
            claimType: 'lesson_plan_with_linked_products',
            totalItems: totalItemsToClaim,
            linkedProductTypes: linkedProducts.map(lp => lp.product_type),
            subscriptionClaimId: lessonPlanClaim.id,
            autoClaimedLinkedIds: linkedProductClaims.map(lpc => lpc.id),
            recordedAt: new Date().toISOString()
          }
        );

        // Record usage for each linked product individually
        for (const linkedClaim of linkedProductClaims) {
          try {
            await SubscriptionAllowanceService.recordUsage(
              userId,
              linkedClaim.product_type,
              linkedClaim.product_id,
              {
                claimType: 'lesson_plan_linked_claim',
                sourceLessonPlanId: lessonPlanProduct.id,
                sourceLessonPlanTitle: lessonPlanProduct.title,
                mainClaimId: lessonPlanClaim.id,
                linkedClaimId: linkedClaim.id,
                recordedAt: new Date().toISOString()
              }
            );
          } catch (linkedAllowanceError) {
            // Log warning for individual linked product but continue with others
            luderror.auth('Warning: Failed to record linked product allowance usage (non-critical):', {
              linkedProductType: linkedClaim.product_type,
              linkedProductId: linkedClaim.product_id,
              error: linkedAllowanceError
            });
          }
        }
      } catch (allowanceError) {
        // Log warning but don't fail the transaction
        luderror.auth('Warning: Failed to record allowance usage (non-critical):', allowanceError);
      }

      if (shouldCommit) {
        await txn.commit();
      }

      ludlog.auth('Lesson plan subscription claim completed successfully:', {
        lessonPlanClaimId: lessonPlanClaim.id,
        linkedProductClaims: linkedProductClaims.length,
        totalClaimsCreated: totalItemsToClaim
      });

      return {
        lessonPlanClaim,
        linkedProductClaims,
        totalClaimsCreated: totalItemsToClaim
      };
    } catch (error) {
      if (shouldCommit) {
        await txn.rollback();
      }
      luderror.auth('Lesson plan subscription claim failed:', error);
      throw error;
    }
  }

  /**
   * Validate that user has sufficient allowances before creating any claims
   * This prevents partial claiming scenarios
   *
   * @param {string} userId - User ID
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} lessonPlanProduct - Lesson plan Product record
   * @param {Array} linkedProducts - Array of linked product definitions
   * @param {Object} transaction - Sequelize transaction
   */
  async validateAllowancesBeforeClaiming(userId, subscriptionId, lessonPlanProduct, linkedProducts, transaction) {
    try {
      // Get subscription with plan details
      const subscription = await models.Subscription.findOne({
        where: {
          id: subscriptionId,
          user_id: userId,
          status: 'active'
        },
        include: [
          {
            model: models.SubscriptionPlan,
            as: 'subscriptionPlan',
            attributes: ['id', 'name', 'benefits']
          }
        ],
        transaction
      });

      if (!subscription) {
        throw new BadRequestError('No active subscription found for user');
      }

      const benefits = subscription.subscriptionPlan?.benefits || {};

      // Count current month usage for each product type
      const monthYear = models.SubscriptionPurchase.getMonthYear();

      // Create map of product types to check
      const productTypesToCheck = new Set(['lesson_plan']);
      linkedProducts.forEach(lp => productTypesToCheck.add(lp.product_type));

      // Check allowances for each product type
      for (const productType of productTypesToCheck) {
        const currentUsage = await models.SubscriptionPurchase.count({
          where: {
            user_id: userId,
            subscription_id: subscriptionId,
            product_type: productType,
            month_year: monthYear,
            status: 'active'
          },
          transaction
        });

        // Get monthly limit for this product type
        const monthlyLimit = benefits[`${productType}_monthly_limit`] || benefits.default_monthly_limit;

        if (monthlyLimit && currentUsage >= monthlyLimit) {
          throw new BadRequestError(`Monthly allowance exceeded for ${productType}. Used: ${currentUsage}/${monthlyLimit}`);
        }
      }

      ludlog.auth('Allowance validation passed:', {
        userId,
        productTypesToCheck: Array.from(productTypesToCheck),
        subscriptionPlan: subscription.subscriptionPlan?.name
      });
    } catch (error) {
      luderror.auth('Allowance validation failed:', error);
      throw error;
    }
  }

  /**
   * Revoke lesson plan claim and all related linked product claims
   *
   * @param {string} lessonPlanClaimId - ID of the main lesson plan claim
   * @returns {Object} { revokedCount, lessonPlanClaimId }
   */
  async revokeLessonPlanClaim(lessonPlanClaimId) {
    const transaction = await models.sequelize.transaction();

    try {
      // 1. Find and validate main lesson plan claim
      const lessonPlanClaim = await models.SubscriptionPurchase.findByPk(lessonPlanClaimId, { transaction });

      if (!lessonPlanClaim) {
        throw new NotFoundError('Lesson plan claim not found');
      }

      if (lessonPlanClaim.product_type !== 'lesson_plan') {
        throw new BadRequestError('Claim is not for a lesson plan');
      }

      if (lessonPlanClaim.status === 'revoked') {
        throw new BadRequestError('Lesson plan claim already revoked');
      }

      ludlog.auth('Revoking lesson plan claim:', { lessonPlanClaimId });

      // 2. Revoke main lesson plan claim
      await lessonPlanClaim.update({
        status: 'revoked',
        updated_at: new Date()
      }, { transaction });

      // 3. Find and revoke all linked product claims created from this lesson plan
      const linkedProductClaims = await models.SubscriptionPurchase.findAll({
        where: {
          user_id: lessonPlanClaim.user_id,
          subscription_id: lessonPlanClaim.subscription_id,
          [models.sequelize.Op.and]: [
            models.sequelize.where(
              models.sequelize.fn('jsonb_extract_path_text', models.sequelize.col('usage'), 'main_lesson_plan_claim_id'),
              lessonPlanClaimId
            )
          ]
        },
        transaction
      });

      let revokedCount = 0;
      for (const claim of linkedProductClaims) {
        await claim.update({
          status: 'revoked',
          updated_at: new Date()
        }, { transaction });
        revokedCount++;
      }

      await transaction.commit();

      ludlog.auth('Lesson plan claim revocation completed:', {
        lessonPlanClaimId,
        revokedLinkedClaims: revokedCount
      });

      return {
        lessonPlanClaimId,
        revokedCount: revokedCount + 1 // +1 for main lesson plan claim
      };
    } catch (error) {
      await transaction.rollback();
      luderror.auth('Lesson plan claim revocation failed:', error);
      throw error;
    }
  }

  /**
   * Get lesson plan claim details with linked product claims
   *
   * @param {string} lessonPlanClaimId - ID of the lesson plan claim
   * @returns {Object} Lesson plan claim with linkedProductClaims array
   */
  async getLessonPlanClaimDetails(lessonPlanClaimId) {
    try {
      const lessonPlanClaim = await models.SubscriptionPurchase.findByPk(lessonPlanClaimId, {
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['id', 'email', 'full_name']
          },
          {
            model: models.Subscription,
            as: 'subscription',
            attributes: ['id', 'status'],
            include: [
              {
                model: models.SubscriptionPlan,
                as: 'subscriptionPlan',
                attributes: ['id', 'name']
              }
            ]
          }
        ]
      });

      if (!lessonPlanClaim) {
        throw new NotFoundError('Lesson plan claim not found');
      }

      // Get all linked product claims created from this lesson plan
      const linkedProductClaims = await models.SubscriptionPurchase.findAll({
        where: {
          user_id: lessonPlanClaim.user_id,
          subscription_id: lessonPlanClaim.subscription_id,
          [models.sequelize.Op.and]: [
            models.sequelize.where(
              models.sequelize.fn('jsonb_extract_path_text', models.sequelize.col('usage'), 'main_lesson_plan_claim_id'),
              lessonPlanClaimId
            )
          ]
        }
      });

      return {
        ...lessonPlanClaim.toJSON(),
        linkedProductClaims: linkedProductClaims.map(c => c.toJSON())
      };
    } catch (error) {
      luderror.auth('Failed to get lesson plan claim details:', error);
      throw error;
    }
  }

  /**
   * Check if a subscription claim is from a lesson plan auto-claim
   *
   * @param {Object} subscriptionPurchase - SubscriptionPurchase record
   * @returns {boolean}
   */
  isFromLessonPlanAutoClaim(subscriptionPurchase) {
    return subscriptionPurchase.usage?.claimed_via === 'lesson_plan_auto_claim';
  }

  /**
   * Check if a subscription claim is a lesson plan claim
   *
   * @param {Object} subscriptionPurchase - SubscriptionPurchase record
   * @returns {boolean}
   */
  isLessonPlanClaim(subscriptionPurchase) {
    return subscriptionPurchase.product_type === 'lesson_plan' && subscriptionPurchase.usage?.auto_claimed_linked === true;
  }

  /**
   * Get usage statistics for lesson plan claims by user
   *
   * @param {string} userId - User ID
   * @param {Object} options - Query options (month_year, subscription_id)
   * @returns {Object} Usage statistics
   */
  async getLessonPlanClaimStats(userId, options = {}) {
    try {
      const whereClause = {
        user_id: userId,
        product_type: 'lesson_plan',
        status: 'active'
      };

      if (options.month_year) {
        whereClause.month_year = options.month_year;
      }

      if (options.subscription_id) {
        whereClause.subscription_id = options.subscription_id;
      }

      const claims = await models.SubscriptionPurchase.findAll({
        where: whereClause,
        attributes: ['id', 'claimed_at', 'usage'],
        order: [['claimed_at', 'DESC']]
      });

      const totalClaims = claims.length;
      const totalLinkedProducts = claims.reduce((sum, claim) => {
        return sum + (claim.usage?.linked_products_count || 0);
      }, 0);

      return {
        totalLessonPlanClaims: totalClaims,
        totalLinkedProductsClaimed: totalLinkedProducts,
        totalItemsClaimed: totalClaims + totalLinkedProducts,
        claims: claims.map(claim => ({
          id: claim.id,
          claimedAt: claim.claimed_at,
          linkedProductsCount: claim.usage?.linked_products_count || 0,
          title: claim.usage?.lesson_plan_title
        }))
      };
    } catch (error) {
      luderror.auth('Failed to get lesson plan claim stats:', error);
      throw error;
    }
  }
}

export default new LessonPlanSubscriptionService();