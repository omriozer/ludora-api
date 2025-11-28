import models from '../models/index.js';
import { Op } from 'sequelize';
import { ludlog, luderror } from '../lib/ludlog.js';

/**
 * SubscriptionAllowanceService
 *
 * Manages subscription-based product allowances and claiming system.
 * Phase 2 of the subscription allowance system implementation.
 *
 * Business Rules:
 * - Each subscription plan has benefits: true = unlimited, number = monthly limit
 * - Allowances limit claiming, not usage
 * - Once claimed, access lasts while subscribed to plan with benefit type
 * - No monthly rollover - fresh allowances each month
 * - Confirmation required only for limited benefits
 */
class SubscriptionAllowanceService {

  /**
   * Get current month-year string in YYYY-MM format
   * @returns {string} Current month in format '2025-11'
   */
  static getCurrentMonthYear() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Map product types to Sequelize model names
   * @param {string} productType - Product type identifier
   * @returns {string} Sequelize model name
   */
  static getEntityModel(productType) {
    const modelMap = {
      'file': 'File',
      'game': 'Game',
      'lesson_plan': 'LessonPlan',
      'workshop': 'Workshop',
      'course': 'Course',
      'tool': 'Tool'
    };

    const modelName = modelMap[productType];
    if (!modelName) {
      throw new Error(`Unsupported product type: ${productType}`);
    }

    return modelName;
  }

  /**
   * Get user's active subscription with plan details
   * @param {string} userId - User ID
   * @returns {Object|null} Active subscription with plan, or null
   */
  static async getActiveSubscription(userId) {
    try {
      const activeSubscription = await models.SubscriptionHistory.findOne({
        where: {
          user_id: userId,
          status: 'active',
          [Op.or]: [
            { end_date: null },                              // Ongoing subscription
            { end_date: { [Op.gte]: new Date() } }           // Not expired yet
          ]
        },
        include: [{
          model: models.SubscriptionPlan,
          attributes: ['id', 'name', 'benefits']
        }]
      });

      return activeSubscription;
    } catch (error) {
      luderror.db('Error fetching active subscription:', { userId, error });
      return null;
    }
  }

  /**
   * Calculate monthly allowances for a user
   * @param {string} userId - User ID
   * @param {string} monthYear - Month in YYYY-MM format (optional, defaults to current)
   * @returns {Object|null} Allowances object with usage details
   */
  static async calculateMonthlyAllowances(userId, monthYear = null) {
    try {
      const targetMonth = monthYear || this.getCurrentMonthYear();
      ludlog.generic('Calculating monthly allowances:', { userId, monthYear: targetMonth });

      // 1. Get active subscription with plan benefits
      const activeSubscription = await this.getActiveSubscription(userId);

      if (!activeSubscription?.SubscriptionPlan?.benefits) {
        ludlog.generic('No active subscription or plan benefits found:', { userId });
        return null;
      }

      const planBenefits = activeSubscription.SubscriptionPlan.benefits;
      ludlog.generic('Found subscription plan benefits:', {
        userId,
        planId: activeSubscription.SubscriptionPlan.id,
        planName: activeSubscription.SubscriptionPlan.name,
        benefits: planBenefits
      });

      // 2. Count current month usage by product type
      const monthlyUsage = await models.SubscriptionPurchase.findAll({
        attributes: [
          'product_type',
          [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
        ],
        where: {
          user_id: userId,
          month_year: targetMonth,
          status: 'active'
        },
        group: ['product_type'],
        raw: true
      });

      // Convert to lookup object: { games: 3, files: 15, ... }
      const usageByType = Object.fromEntries(
        monthlyUsage.map(row => [row.product_type, parseInt(row.count)])
      );

      ludlog.generic('Current month usage by type:', { userId, targetMonth, usageByType });

      // 3. Calculate allowances for each benefit type
      const allowances = {};

      for (const [productType, allowedAmount] of Object.entries(planBenefits)) {
        const used = usageByType[productType] || 0;

        if (allowedAmount === true) {
          // Unlimited benefit
          allowances[productType] = {
            allowed: 'unlimited',
            used: used,
            remaining: 'unlimited',
            isLimited: false,
            hasReachedLimit: false
          };
        } else if (typeof allowedAmount === 'number' && allowedAmount > 0) {
          // Limited benefit
          const remaining = Math.max(0, allowedAmount - used);
          allowances[productType] = {
            allowed: allowedAmount,
            used: used,
            remaining: remaining,
            isLimited: true,
            hasReachedLimit: used >= allowedAmount
          };
        } else {
          // Benefit not included (false, 0, or invalid)
          allowances[productType] = {
            allowed: 0,
            used: 0,
            remaining: 0,
            isLimited: true,
            hasReachedLimit: true,
            notIncluded: true
          };
        }
      }

      ludlog.generic('Calculated allowances:', { userId, targetMonth, allowances });

      return {
        subscription: activeSubscription,
        monthYear: targetMonth,
        allowances
      };

    } catch (error) {
      luderror.db('Error calculating monthly allowances:', { userId, monthYear, error });
      return null;
    }
  }

  /**
   * Validate that product exists and user can access it for claiming
   * @param {string} productType - Product type
   * @param {string} productId - Product ID
   * @param {string} userId - User ID
   * @returns {Object} Validation result with isValid flag and reason
   */
  static async validateProductAccess(productType, productId, userId) {
    try {
      ludlog.generic('Validating product access for claiming:', { productType, productId, userId });

      // Check if product exists using the entity model
      const EntityModel = models[this.getEntityModel(productType)];
      if (!EntityModel) {
        return {
          isValid: false,
          reason: `Invalid product type: ${productType}`
        };
      }

      const entity = await EntityModel.findByPk(productId);
      if (!entity) {
        return {
          isValid: false,
          reason: `${productType} not found`
        };
      }

      // Check if product is published/available for claiming
      if (entity.status && entity.status !== 'published') {
        return {
          isValid: false,
          reason: `${productType} is not available for claiming`
        };
      }

      // Check if user already owns this product via direct purchase
      const existingPurchase = await models.Purchase.findOne({
        where: {
          buyer_user_id: userId,
          purchasable_type: productType,
          purchasable_id: productId,
          payment_status: 'completed'
        }
      });

      if (existingPurchase) {
        return {
          isValid: false,
          reason: 'You already own this product via direct purchase'
        };
      }

      // Check if user is the creator (creators don't need to claim their own products)
      const product = await models.Product.findOne({
        where: {
          product_type: productType,
          entity_id: productId
        }
      });

      if (product && product.creator_user_id === userId) {
        return {
          isValid: false,
          reason: 'You cannot claim your own products'
        };
      }

      ludlog.generic('Product validation passed:', { productType, productId, userId });

      return {
        isValid: true,
        entity,
        product
      };

    } catch (error) {
      luderror.db('Error validating product access:', { productType, productId, userId, error });
      return {
        isValid: false,
        reason: 'Error validating product access'
      };
    }
  }

  /**
   * Quick check if user can claim specific product type
   * @param {string} userId - User ID
   * @param {string} productType - Product type to check
   * @returns {Object} Object with canClaim flag and details
   */
  static async canClaimProductType(userId, productType) {
    try {
      ludlog.generic('Checking if user can claim product type:', { userId, productType });

      const allowances = await this.calculateMonthlyAllowances(userId);

      if (!allowances) {
        return {
          canClaim: false,
          reason: 'No active subscription'
        };
      }

      const typeAllowance = allowances.allowances[productType];

      if (!typeAllowance) {
        return {
          canClaim: false,
          reason: `Product type '${productType}' not supported by subscription plan`
        };
      }

      if (typeAllowance.notIncluded) {
        return {
          canClaim: false,
          reason: `${productType} not included in your subscription plan`
        };
      }

      if (typeAllowance.hasReachedLimit) {
        return {
          canClaim: false,
          reason: `Monthly limit reached for ${productType}`,
          used: typeAllowance.used,
          allowed: typeAllowance.allowed
        };
      }

      return {
        canClaim: true,
        remaining: typeAllowance.remaining,
        isLimited: typeAllowance.isLimited,
        requiresConfirmation: typeAllowance.isLimited,
        subscription: allowances.subscription
      };

    } catch (error) {
      luderror.generic('Error checking product type claim eligibility:', { userId, productType, error });
      return {
        canClaim: false,
        reason: 'Error checking claim eligibility'
      };
    }
  }

  /**
   * Check if user can claim a specific product
   * @param {string} userId - User ID
   * @param {string} productType - Product type
   * @param {string} productId - Product ID
   * @returns {Object} Detailed claiming eligibility
   */
  static async canClaimProduct(userId, productType, productId) {
    try {
      ludlog.generic('Checking if user can claim product:', { userId, productType, productId });

      // Check product validation first
      const productValidation = await this.validateProductAccess(productType, productId, userId);
      if (!productValidation.isValid) {
        return {
          canClaim: false,
          reason: productValidation.reason,
          productValidation
        };
      }

      // Check allowance limits
      const allowanceCheck = await this.canClaimProductType(userId, productType);
      if (!allowanceCheck.canClaim) {
        return {
          canClaim: false,
          reason: allowanceCheck.reason,
          allowanceCheck
        };
      }

      // Check for existing claim
      const existingClaim = await models.SubscriptionPurchase.findOne({
        where: {
          user_id: userId,
          product_type: productType,
          product_id: productId,
          status: 'active'
        }
      });

      if (existingClaim) {
        return {
          canClaim: true,
          alreadyClaimed: true,
          existingClaim,
          reason: 'Product already claimed via subscription'
        };
      }

      return {
        canClaim: true,
        requiresConfirmation: allowanceCheck.requiresConfirmation,
        remaining: allowanceCheck.remaining,
        allowanceCheck
      };

    } catch (error) {
      luderror.generic('Error checking product claim eligibility:', { userId, productType, productId, error });
      return {
        canClaim: false,
        reason: 'Error checking claim eligibility'
      };
    }
  }

  /**
   * Claim a product using subscription allowance
   * @param {string} userId - User ID
   * @param {string} productType - Product type
   * @param {string} productId - Product ID
   * @param {Object} options - Options including skipConfirmation
   * @returns {Object} Claim result
   */
  static async claimProduct(userId, productType, productId, options = {}) {
    const transaction = await models.sequelize.transaction();

    try {
      ludlog.generic('Starting product claim process:', { userId, productType, productId, options });

      // 🔍 STEP 1: Validate Product Exists & Access
      const productValidation = await this.validateProductAccess(productType, productId, userId);
      if (!productValidation.isValid) {
        await transaction.rollback();
        return {
          success: false,
          reason: productValidation.reason,
          step: 'product_validation'
        };
      }

      // 🔍 STEP 2: Check Subscription & Allowances
      const allowanceCheck = await this.canClaimProductType(userId, productType);
      if (!allowanceCheck.canClaim) {
        await transaction.rollback();
        return {
          success: false,
          reason: allowanceCheck.reason,
          step: 'allowance_check',
          used: allowanceCheck.used,
          allowed: allowanceCheck.allowed
        };
      }

      // 🔍 STEP 3: Check for Existing Claim
      const existingClaim = await models.SubscriptionPurchase.findOne({
        where: {
          user_id: userId,
          product_type: productType,
          product_id: productId,
          status: 'active'
        },
        transaction
      });

      if (existingClaim) {
        await transaction.rollback();
        // Already claimed - return success with existing claim info
        return {
          success: true,
          alreadyClaimed: true,
          claim: existingClaim,
          message: 'Product already claimed via subscription'
        };
      }

      // 🔍 STEP 4: Handle Confirmation for Limited Benefits
      if (allowanceCheck.requiresConfirmation && !options.skipConfirmation) {
        await transaction.rollback();
        return {
          success: false,
          needsConfirmation: true,
          remainingClaims: allowanceCheck.remaining,
          message: `You have ${allowanceCheck.remaining} ${productType} claims remaining this month. Confirm to proceed.`,
          step: 'confirmation_required'
        };
      }

      // 🔍 STEP 5: Atomic Claim Creation (Database constraint handles concurrency)
      const currentMonth = this.getCurrentMonthYear();
      const subscription = allowanceCheck.subscription;

      ludlog.generic('Creating subscription purchase claim:', {
        userId,
        subscriptionId: subscription.id,
        productType,
        productId,
        monthYear: currentMonth
      });

      const subscriptionPurchase = await models.SubscriptionPurchase.create({
        user_id: userId,
        subscription_id: subscription.id,
        product_type: productType,
        product_id: productId,
        claimed_at: new Date(),
        month_year: currentMonth,
        status: 'active',
        usage_tracking: {
          claimed_at: new Date().toISOString(),
          claim_source: 'subscription_allowance',
          total_sessions: 0,
          total_usage_minutes: 0,
          sessions: [],
          engagement_metrics: {
            days_since_claimed: 0,
            average_session_duration: 0,
            peak_usage_hour: 0,
            usage_pattern: 'inactive',
            retention_score: 0
          },
          feature_usage: {}
        }
      }, { transaction });

      await transaction.commit();

      ludlog.generic('Product claimed successfully:', {
        userId,
        productType,
        productId,
        claimId: subscriptionPurchase.id,
        monthYear: currentMonth
      });

      return {
        success: true,
        claim: subscriptionPurchase,
        message: 'Product successfully claimed via subscription',
        remainingClaims: allowanceCheck.remaining === 'unlimited' ?
                        'unlimited' : Math.max(0, allowanceCheck.remaining - 1)
      };

    } catch (error) {
      await transaction.rollback();

      // Handle specific database constraint violations
      if (error.name === 'SequelizeUniqueConstraintError') {
        ludlog.generic('Concurrent claim attempt detected:', { userId, productType, productId });

        // Check if claim exists now (someone else got there first)
        const existingClaim = await models.SubscriptionPurchase.findOne({
          where: {
            user_id: userId,
            product_type: productType,
            product_id: productId,
            month_year: this.getCurrentMonthYear()
          }
        });

        if (existingClaim) {
          return {
            success: true,
            alreadyClaimed: true,
            claim: existingClaim,
            message: 'Product already claimed via subscription'
          };
        }

        return {
          success: false,
          reason: 'Unable to claim product due to concurrent request. Please try again.',
          step: 'concurrent_claim_conflict'
        };
      }

      luderror.db('Error claiming product:', { userId, productType, productId, error });
      return {
        success: false,
        reason: 'An error occurred while claiming the product. Please try again.',
        step: 'database_error'
      };
    }
  }

  /**
   * Get monthly allowance status for user
   * @param {string} userId - User ID
   * @param {string} monthYear - Month in YYYY-MM format (optional)
   * @returns {Object} Allowance summary with used/remaining counts
   */
  static async getMonthlyAllowances(userId, monthYear = null) {
    try {
      const targetMonth = monthYear || this.getCurrentMonthYear();
      ludlog.generic('Getting monthly allowances:', { userId, monthYear: targetMonth });

      const allowances = await this.calculateMonthlyAllowances(userId, targetMonth);
      return allowances;

    } catch (error) {
      luderror.generic('Error getting monthly allowances:', { userId, monthYear, error });
      return null;
    }
  }

  /**
   * Check if user has subscription-based access to a product
   * @param {string} userId - User ID
   * @param {string} productType - Product type
   * @param {string} productId - Product ID
   * @returns {boolean} Has access via subscription claim
   */
  static async hasClaimedAccess(userId, productType, productId) {
    try {
      ludlog.generic('Checking subscription-based access:', { userId, productType, productId });

      // Find active subscription claim
      const claim = await models.SubscriptionPurchase.findOne({
        where: {
          user_id: userId,
          product_type: productType,
          product_id: productId,
          status: 'active'
        },
        include: [{
          model: models.SubscriptionHistory,
          where: { status: 'active' },
          include: [{
            model: models.SubscriptionPlan,
            attributes: ['benefits']
          }]
        }]
      });

      if (!claim) {
        ludlog.generic('No active subscription claim found:', { userId, productType, productId });
        return false;
      }

      // Verify subscription still has this benefit
      const currentBenefits = claim.SubscriptionHistory.SubscriptionPlan.benefits;
      const hasCurrentBenefit = currentBenefits[productType] === true ||
                               (typeof currentBenefits[productType] === 'number' && currentBenefits[productType] > 0);

      if (!hasCurrentBenefit) {
        ludlog.generic('Subscription no longer includes this product type:', {
          userId,
          productType,
          productId,
          currentBenefits
        });
        return false;
      }

      ludlog.generic('Subscription access confirmed:', { userId, productType, productId });
      return true;

    } catch (error) {
      luderror.db('Error checking subscription access:', { userId, productType, productId, error });
      return false;
    }
  }

  /**
   * Record actual usage of a claimed product
   * @param {string} userId - User ID
   * @param {string} productType - Product type
   * @param {string} productId - Product ID
   * @param {Object} usageData - Usage session data
   * @returns {Object} Updated usage tracking
   */
  static async recordUsage(userId, productType, productId, usageData) {
    try {
      ludlog.generic('Recording product usage:', { userId, productType, productId, usageData });

      const claim = await models.SubscriptionPurchase.findOne({
        where: {
          user_id: userId,
          product_type: productType,
          product_id: productId,
          status: 'active'
        }
      });

      if (!claim) {
        luderror.generic('No active subscription claim found for usage recording:', {
          userId, productType, productId
        });
        throw new Error('No active subscription claim found for this product');
      }

      const currentUsage = claim.usage_tracking || {};
      const now = new Date().toISOString();

      // Update core metrics
      const updatedUsage = {
        ...currentUsage,
        last_accessed: now,
        first_accessed: currentUsage.first_accessed || now,
        total_sessions: (currentUsage.total_sessions || 0) + 1,
        total_usage_minutes: (currentUsage.total_usage_minutes || 0) + (usageData.duration_minutes || 0)
      };

      // Add session record
      const sessions = currentUsage.sessions || [];
      const newSession = {
        session_id: usageData.session_id || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        started_at: usageData.started_at || now,
        ended_at: usageData.ended_at || now,
        duration_minutes: usageData.duration_minutes || 0,
        activity_type: usageData.activity_type || 'view',
        completion_percent: Math.min(100, Math.max(0, usageData.completion_percent || 0)),
        device_info: usageData.device_info || 'unknown',
        ip_address: usageData.ip_address || null
      };

      sessions.push(newSession);

      // Keep only last 50 sessions to prevent JSONB bloat
      if (sessions.length > 50) {
        sessions.splice(0, sessions.length - 50);
      }

      updatedUsage.sessions = sessions;

      // Calculate engagement metrics
      updatedUsage.engagement_metrics = this.calculateEngagementMetrics(updatedUsage);

      // Update feature usage if provided
      if (usageData.feature_action) {
        updatedUsage.feature_usage = updatedUsage.feature_usage || {};
        const currentFeatureCount = updatedUsage.feature_usage[usageData.feature_action] || 0;
        updatedUsage.feature_usage[usageData.feature_action] = currentFeatureCount + 1;
      }

      // Update completion status based on completion_percent
      if (newSession.completion_percent >= 100) {
        updatedUsage.completion_status = 'completed';
      } else if (newSession.completion_percent > 0) {
        updatedUsage.completion_status = 'in_progress';
      } else if (!updatedUsage.completion_status) {
        updatedUsage.completion_status = 'not_started';
      }

      await models.SubscriptionPurchase.update({
        usage_tracking: updatedUsage
      }, {
        where: { id: claim.id }
      });

      ludlog.generic('Usage recorded successfully:', {
        userId,
        productType,
        productId,
        sessionId: newSession.session_id,
        totalSessions: updatedUsage.total_sessions,
        totalMinutes: updatedUsage.total_usage_minutes
      });

      return updatedUsage;

    } catch (error) {
      luderror.db('Error recording product usage:', { userId, productType, productId, error });
      throw error;
    }
  }

  /**
   * Calculate engagement metrics from usage data
   * @param {Object} usageData - Raw usage tracking data
   * @returns {Object} Calculated engagement metrics
   */
  static calculateEngagementMetrics(usageData) {
    try {
      if (!usageData.claimed_at) {
        return {
          days_since_claimed: 0,
          average_session_duration: 0,
          peak_usage_hour: 0,
          usage_pattern: 'inactive',
          retention_score: 0
        };
      }

      const claimedDate = new Date(usageData.claimed_at);
      const now = new Date();
      const daysSinceClaimed = Math.floor((now - claimedDate) / (1000 * 60 * 60 * 24));

      const sessions = usageData.sessions || [];
      const totalSessions = sessions.length;
      const totalMinutes = usageData.total_usage_minutes || 0;

      // Calculate average session duration
      const avgSessionDuration = totalSessions > 0 ? Math.round((totalMinutes / totalSessions) * 100) / 100 : 0;

      // Calculate usage pattern based on activity level
      let usagePattern = 'inactive';
      if (totalSessions >= 20 && avgSessionDuration >= 45) {
        usagePattern = 'power_user';
      } else if (totalSessions >= 8 && totalMinutes >= 60) {
        usagePattern = 'regular_user';
      } else if (totalSessions >= 2 && totalMinutes >= 10) {
        usagePattern = 'casual_user';
      }

      // Calculate peak usage hour
      let peakHour = 0;
      if (sessions.length > 0) {
        const hourCounts = {};
        sessions.forEach(session => {
          try {
            const sessionDate = new Date(session.started_at);
            const hour = sessionDate.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          } catch (error) {
            // Skip invalid session dates
          }
        });

        if (Object.keys(hourCounts).length > 0) {
          peakHour = parseInt(Object.keys(hourCounts).reduce((a, b) =>
            hourCounts[a] > hourCounts[b] ? a : b));
        }
      }

      // Calculate retention score (0-10)
      // Based on expected usage vs actual usage over time
      const expectedSessions = Math.min(daysSinceClaimed * 0.3, 15); // Expected 0.3 sessions per day, max 15
      const retentionMultiplier = Math.min(2.0, totalSessions / Math.max(expectedSessions, 1));

      // Bonus for consistent usage (sessions spread over multiple days)
      const uniqueDays = new Set();
      sessions.forEach(session => {
        try {
          const sessionDate = new Date(session.started_at);
          const dayKey = `${sessionDate.getFullYear()}-${sessionDate.getMonth()}-${sessionDate.getDate()}`;
          uniqueDays.add(dayKey);
        } catch (error) {
          // Skip invalid session dates
        }
      });

      const consistencyBonus = Math.min(1.5, uniqueDays.size / Math.max(daysSinceClaimed, 1));
      const retentionScore = Math.min(10, retentionMultiplier * consistencyBonus * 5);

      return {
        days_since_claimed: daysSinceClaimed,
        average_session_duration: avgSessionDuration,
        peak_usage_hour: peakHour,
        usage_pattern: usagePattern,
        retention_score: Math.round(retentionScore * 10) / 10,
        unique_usage_days: uniqueDays.size,
        sessions_per_day: daysSinceClaimed > 0 ? Math.round((totalSessions / daysSinceClaimed) * 100) / 100 : 0
      };

    } catch (error) {
      luderror.generic('Error calculating engagement metrics:', error);
      return {
        days_since_claimed: 0,
        average_session_duration: 0,
        peak_usage_hour: 0,
        usage_pattern: 'inactive',
        retention_score: 0,
        unique_usage_days: 0,
        sessions_per_day: 0
      };
    }
  }

  /**
   * Get subscription usage analytics for admin dashboard
   * @param {Object} options - Query options (startDate, endDate, productType, userId)
   * @returns {Object} Analytics summary
   */
  static async getUsageAnalytics(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate = new Date(),
        productType = null,
        userId = null
      } = options;

      ludlog.generic('Getting usage analytics:', { startDate, endDate, productType, userId });

      const whereClause = {
        claimed_at: {
          [Op.between]: [startDate, endDate]
        }
      };

      if (productType) whereClause.product_type = productType;
      if (userId) whereClause.user_id = userId;

      const claims = await models.SubscriptionPurchase.findAll({
        where: whereClause,
        attributes: ['user_id', 'product_type', 'product_id', 'claimed_at', 'usage_tracking']
      });

      // Aggregate analytics
      const analytics = {
        totalClaims: claims.length,
        activeUsers: new Set(claims.map(c => c.user_id)).size,
        claimsByType: {},
        usagePatterns: { power_user: 0, regular_user: 0, casual_user: 0, inactive: 0 },
        totalUsageMinutes: 0,
        averageSessionsPerClaim: 0,
        completionRates: { completed: 0, in_progress: 0, not_started: 0 },
        topProducts: {},
        dailyActivity: {}
      };

      let totalSessions = 0;

      claims.forEach(claim => {
        // Claims by type
        analytics.claimsByType[claim.product_type] =
          (analytics.claimsByType[claim.product_type] || 0) + 1;

        // Usage metrics
        const usage = claim.usage_tracking || {};
        analytics.totalUsageMinutes += usage.total_usage_minutes || 0;
        totalSessions += usage.total_sessions || 0;

        // Usage patterns
        const pattern = usage.engagement_metrics?.usage_pattern || 'inactive';
        if (analytics.usagePatterns.hasOwnProperty(pattern)) {
          analytics.usagePatterns[pattern]++;
        }

        // Completion rates
        const completionStatus = usage.completion_status || 'not_started';
        if (analytics.completionRates.hasOwnProperty(completionStatus)) {
          analytics.completionRates[completionStatus]++;
        }

        // Top products by usage
        const productKey = `${claim.product_type}:${claim.product_id}`;
        if (!analytics.topProducts[productKey]) {
          analytics.topProducts[productKey] = {
            type: claim.product_type,
            id: claim.product_id,
            claims: 0,
            totalMinutes: 0,
            totalSessions: 0
          };
        }
        analytics.topProducts[productKey].claims++;
        analytics.topProducts[productKey].totalMinutes += usage.total_usage_minutes || 0;
        analytics.topProducts[productKey].totalSessions += usage.total_sessions || 0;

        // Daily activity
        const claimDate = new Date(claim.claimed_at).toISOString().split('T')[0];
        analytics.dailyActivity[claimDate] = (analytics.dailyActivity[claimDate] || 0) + 1;
      });

      analytics.averageSessionsPerClaim = claims.length > 0 ?
        Math.round((totalSessions / claims.length) * 100) / 100 : 0;

      // Convert topProducts to sorted array (top 10)
      analytics.topProducts = Object.values(analytics.topProducts)
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        .slice(0, 10);

      ludlog.generic('Usage analytics calculated:', {
        totalClaims: analytics.totalClaims,
        activeUsers: analytics.activeUsers,
        totalMinutes: analytics.totalUsageMinutes
      });

      return analytics;

    } catch (error) {
      luderror.db('Error getting usage analytics:', error);
      return {
        totalClaims: 0,
        activeUsers: 0,
        claimsByType: {},
        usagePatterns: { power_user: 0, regular_user: 0, casual_user: 0, inactive: 0 },
        totalUsageMinutes: 0,
        averageSessionsPerClaim: 0
      };
    }
  }

  /**
   * Get user's subscription usage summary
   * @param {string} userId - User ID
   * @param {string} monthYear - Month in YYYY-MM format (optional)
   * @returns {Object} User usage summary
   */
  static async getUserUsageSummary(userId, monthYear = null) {
    try {
      const currentMonth = monthYear || this.getCurrentMonthYear();
      ludlog.generic('Getting user usage summary:', { userId, monthYear: currentMonth });

      const claims = await models.SubscriptionPurchase.findAll({
        where: {
          user_id: userId,
          month_year: currentMonth,
          status: 'active'
        },
        attributes: ['product_type', 'product_id', 'claimed_at', 'usage_tracking'],
        order: [['claimed_at', 'DESC']]
      });

      const summary = {
        totalClaims: claims.length,
        claimsByType: {},
        recentActivity: [],
        recommendations: [],
        monthlyStats: {
          totalUsageMinutes: 0,
          totalSessions: 0,
          averageEngagement: 0,
          mostActiveDay: null,
          completionRate: 0
        }
      };

      let totalUsageMinutes = 0;
      let totalSessions = 0;
      let completedClaims = 0;
      const engagementScores = [];
      const dailyActivity = {};

      claims.forEach(claim => {
        // Claims by type
        summary.claimsByType[claim.product_type] =
          (summary.claimsByType[claim.product_type] || 0) + 1;

        const usage = claim.usage_tracking || {};
        totalUsageMinutes += usage.total_usage_minutes || 0;
        totalSessions += usage.total_sessions || 0;

        // Completion tracking
        if (usage.completion_status === 'completed') {
          completedClaims++;
        }

        // Engagement tracking
        const engagementScore = usage.engagement_metrics?.retention_score || 0;
        engagementScores.push(engagementScore);

        // Recent activity
        if (usage.last_accessed) {
          summary.recentActivity.push({
            productType: claim.product_type,
            productId: claim.product_id,
            lastAccessed: usage.last_accessed,
            totalSessions: usage.total_sessions || 0,
            totalMinutes: usage.total_usage_minutes || 0,
            usagePattern: usage.engagement_metrics?.usage_pattern || 'inactive',
            completionStatus: usage.completion_status || 'not_started'
          });

          // Daily activity tracking
          try {
            const accessDate = new Date(usage.last_accessed).toISOString().split('T')[0];
            dailyActivity[accessDate] = (dailyActivity[accessDate] || 0) + 1;
          } catch (error) {
            // Skip invalid dates
          }
        }
      });

      // Calculate monthly stats
      summary.monthlyStats.totalUsageMinutes = totalUsageMinutes;
      summary.monthlyStats.totalSessions = totalSessions;
      summary.monthlyStats.averageEngagement = engagementScores.length > 0 ?
        Math.round((engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length) * 100) / 100 : 0;
      summary.monthlyStats.completionRate = claims.length > 0 ?
        Math.round((completedClaims / claims.length) * 100) : 0;

      // Find most active day
      if (Object.keys(dailyActivity).length > 0) {
        summary.monthlyStats.mostActiveDay = Object.keys(dailyActivity).reduce((a, b) =>
          dailyActivity[a] > dailyActivity[b] ? a : b);
      }

      // Sort recent activity by last accessed (most recent first)
      summary.recentActivity.sort((a, b) =>
        new Date(b.lastAccessed) - new Date(a.lastAccessed)
      );

      // Limit recent activity to last 10 items
      summary.recentActivity = summary.recentActivity.slice(0, 10);

      // Generate recommendations based on usage patterns
      summary.recommendations = this.generateUserRecommendations(summary, claims);

      ludlog.generic('User usage summary calculated:', {
        userId,
        monthYear: currentMonth,
        totalClaims: summary.totalClaims,
        totalMinutes: summary.monthlyStats.totalUsageMinutes
      });

      return summary;

    } catch (error) {
      luderror.db('Error getting user usage summary:', { userId, monthYear, error });
      return {
        totalClaims: 0,
        claimsByType: {},
        recentActivity: [],
        recommendations: [],
        monthlyStats: {
          totalUsageMinutes: 0,
          totalSessions: 0,
          averageEngagement: 0,
          mostActiveDay: null,
          completionRate: 0
        }
      };
    }
  }

  /**
   * Generate personalized recommendations for user
   * @param {Object} summary - User summary data
   * @param {Array} claims - User's claims
   * @returns {Array} Array of recommendation objects
   */
  static generateUserRecommendations(summary, claims) {
    const recommendations = [];

    // Low usage recommendation
    if (summary.monthlyStats.totalSessions < 3 && claims.length > 0) {
      recommendations.push({
        type: 'low_usage',
        message: 'You have claimed content but haven\'t used it much. Try exploring your claimed products!',
        action: 'view_claimed_content',
        priority: 'medium'
      });
    }

    // Incomplete content recommendation
    const incompleteClaims = summary.recentActivity.filter(
      activity => activity.completionStatus !== 'completed'
    );
    if (incompleteClaims.length > 0) {
      recommendations.push({
        type: 'incomplete_content',
        message: `You have ${incompleteClaims.length} claimed items to finish. Complete them to get the most value!`,
        action: 'complete_content',
        priority: 'high'
      });
    }

    // Variety recommendation
    const uniqueTypes = Object.keys(summary.claimsByType).length;
    if (uniqueTypes === 1 && claims.length > 2) {
      recommendations.push({
        type: 'variety',
        message: 'Try exploring different types of content to diversify your learning experience.',
        action: 'explore_variety',
        priority: 'low'
      });
    }

    // Engagement recommendation
    if (summary.monthlyStats.averageEngagement < 3 && claims.length > 1) {
      recommendations.push({
        type: 'low_engagement',
        message: 'Spend more time with each piece of content to improve your learning outcomes.',
        action: 'increase_engagement',
        priority: 'medium'
      });
    }

    return recommendations.slice(0, 3); // Limit to top 3 recommendations
  }
}

export default SubscriptionAllowanceService;