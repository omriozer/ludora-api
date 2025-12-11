import models from '../models/index.js';
import { Op } from 'sequelize';
import { ludlog, luderror } from '../lib/ludlog.js';
import SubscriptionAllowanceService from './SubscriptionAllowanceService.js';

/**
 * SubscriptionPermissionsService
 *
 * Provides EXPLICIT subscription-based permissions for features and resources.
 * This service is the SINGLE SOURCE OF TRUTH for subscription permissions,
 * preventing frontend logic from trying to deduce permissions.
 *
 * Architecture Pattern:
 * - Backend-determined permissions (no frontend deduction)
 * - Embedded in currentUser data for instant access
 * - Supports all subscription-based features
 * - Real-time subscription state reflection
 *
 * Permissions Covered:
 * - Classroom management (create, manage, limits)
 * - Product allowances (file, game, workshop, etc.)
 * - Reports access
 * - Premium features
 */
class SubscriptionPermissionsService {

  /**
   * Get user's complete subscription permissions
   * @param {string} userId - User ID
   * @returns {Object|null} Complete permissions object or null if no subscription
   */
  static async getUserSubscriptionPermissions(userId) {
    try {
      ludlog.auth('Getting subscription permissions for user:', { userId });

      // Get user's active subscription with plan details
      const activeSubscription = await SubscriptionAllowanceService.getActiveSubscription(userId);

      if (!activeSubscription) {
        ludlog.auth('No active subscription found for user:', { userId });
        return null;
      }

      // Get the subscription plan (should already be attached by getActiveSubscription)
      const subscriptionPlan = activeSubscription.subscriptionPlan;

      if (!subscriptionPlan || !subscriptionPlan.benefits) {
        ludlog.auth('Subscription has no plan or benefits:', {
          userId,
          subscriptionId: activeSubscription.id,
          hasPlan: !!subscriptionPlan
        });
        return null;
      }

      // Use plan snapshot to preserve benefits user signed up for (critical for plan changes)
      const rawBenefits = activeSubscription.metadata?.planSnapshot?.benefits ||
                          subscriptionPlan.benefits; // Fallback for old subscriptions

      ludlog.auth('Raw subscription benefits:', {
        userId,
        subscriptionId: activeSubscription.id,
        planId: subscriptionPlan.id,
        planName: subscriptionPlan.name,
        benefits: rawBenefits
      });

      // Build comprehensive permissions object
      const permissions = {
        // Subscription metadata
        subscription_id: activeSubscription.id,
        subscription_plan_id: subscriptionPlan.id,
        subscription_plan_name: subscriptionPlan.name,
        subscription_status: activeSubscription.status,
        subscription_start_date: activeSubscription.start_date,
        subscription_end_date: activeSubscription.end_date,

        // Classroom management permissions
        classroom_management: this.extractClassroomPermissions(rawBenefits),

        // Product allowances (for claim system)
        product_allowances: this.extractProductAllowances(rawBenefits),

        // Reports access
        reports_access: rawBenefits.reports_access === true,

        // Premium features (can be extended as needed)
        premium_features: {
          analytics_dashboard: rawBenefits.analytics_access === true,
          priority_support: rawBenefits.priority_support === true,
          white_label: rawBenefits.white_label === true,
          api_access: rawBenefits.api_access === true
        }
      };

      ludlog.auth('Subscription permissions calculated:', {
        userId,
        hasClassroomAccess: permissions.classroom_management.enabled,
        maxClassrooms: permissions.classroom_management.max_classrooms,
        unlimitedClassrooms: permissions.classroom_management.unlimited_classrooms
      });

      return permissions;

    } catch (error) {
      luderror.auth('Error getting subscription permissions:', {
        userId,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Extract classroom management permissions from benefits
   * @param {Object} benefits - Raw subscription plan benefits
   * @returns {Object} Classroom permissions
   */
  static extractClassroomPermissions(benefits) {
    const classroomBenefit = benefits.classroom_management;

    if (!classroomBenefit || !classroomBenefit.enabled) {
      return {
        enabled: false,
        max_classrooms: 0,
        max_students_total: 0,
        unlimited_classrooms: false,
        unlimited_students: false
      };
    }

    return {
      enabled: true,
      max_classrooms: classroomBenefit.unlimited_classrooms ?
        'unlimited' : (classroomBenefit.max_classrooms || 0),
      max_students_total: classroomBenefit.unlimited_students ?
        'unlimited' : (classroomBenefit.max_total_students || 0),
      unlimited_classrooms: classroomBenefit.unlimited_classrooms === true,
      unlimited_students: classroomBenefit.unlimited_students === true,
      // Additional classroom features
      can_archive_classrooms: true, // All plans with classroom access can archive
      can_bulk_invite_students: true, // All plans with classroom access can bulk invite
      max_students_per_classroom: classroomBenefit.max_students_per_classroom || null
    };
  }

  /**
   * Extract product allowances from benefits
   * @param {Object} benefits - Raw subscription plan benefits
   * @returns {Object} Product allowances summary
   */
  static extractProductAllowances(benefits) {
    const allowances = {
      files: this.extractSingleProductAllowance(benefits.files_access),
      games: this.extractSingleProductAllowance(benefits.games_access),
      lesson_plans: this.extractSingleProductAllowance(benefits.lesson_plans_access),
      workshops: this.extractSingleProductAllowance(benefits.workshops_access),
      courses: this.extractSingleProductAllowance(benefits.courses_access),
      tools: this.extractSingleProductAllowance(benefits.tools_access)
    };

    // Calculate total monthly allowance (for UI display)
    let total_monthly_limit = 0;
    let has_unlimited = false;

    Object.values(allowances).forEach(allowance => {
      if (allowance.unlimited) {
        has_unlimited = true;
      } else if (allowance.monthly_limit > 0) {
        total_monthly_limit += allowance.monthly_limit;
      }
    });

    return {
      ...allowances,
      total_monthly_limit: has_unlimited ? 'unlimited' : total_monthly_limit,
      has_unlimited_products: has_unlimited
    };
  }

  /**
   * Extract single product type allowance
   * @param {Object} productBenefit - Single product benefit config
   * @returns {Object} Allowance info
   */
  static extractSingleProductAllowance(productBenefit) {
    if (!productBenefit || !productBenefit.enabled) {
      return {
        enabled: false,
        unlimited: false,
        monthly_limit: 0
      };
    }

    return {
      enabled: true,
      unlimited: productBenefit.unlimited === true,
      monthly_limit: productBenefit.unlimited ? null : (productBenefit.monthly_limit || 0)
    };
  }

  /**
   * Check if user has specific permission
   * @param {string} userId - User ID
   * @param {string} permissionType - Permission type to check
   * @returns {boolean} Has permission
   */
  static async hasPermission(userId, permissionType) {
    try {
      const permissions = await this.getUserSubscriptionPermissions(userId);

      if (!permissions) {
        return false;
      }

      // Permission check routing
      switch (permissionType) {
        case 'classroom_management':
          return permissions.classroom_management.enabled;

        case 'reports':
          return permissions.reports_access;

        case 'analytics':
          return permissions.premium_features.analytics_dashboard;

        case 'priority_support':
          return permissions.premium_features.priority_support;

        default:
          ludlog.auth('Unknown permission type requested:', { userId, permissionType });
          return false;
      }

    } catch (error) {
      luderror.auth('Error checking permission:', { userId, permissionType, error });
      return false;
    }
  }

  /**
   * Get current classroom usage for user
   * @param {string} userId - User ID
   * @returns {Object} Current usage counts
   */
  static async getClassroomUsage(userId) {
    try {
      // Count user's classrooms
      const classroomCount = await models.Classroom.count({
        where: { teacher_id: userId }
      });

      // Count total students across all classrooms
      const studentCount = await models.ClassroomMembership.count({
        include: [{
          model: models.Classroom,
          as: 'classroom',
          where: { teacher_id: userId },
          attributes: []
        }]
      });

      return {
        current_classrooms: classroomCount,
        current_students_total: studentCount
      };

    } catch (error) {
      luderror.db('Error getting classroom usage:', { userId, error });
      return {
        current_classrooms: 0,
        current_students_total: 0
      };
    }
  }

  /**
   * Check if user can create a new classroom
   * @param {string} userId - User ID
   * @returns {Object} Can create status with reason
   */
  static async canCreateClassroom(userId) {
    try {
      const permissions = await this.getUserSubscriptionPermissions(userId);

      if (!permissions) {
        return {
          canCreate: false,
          reason: 'No active subscription',
          current: 0,
          limit: 0
        };
      }

      if (!permissions.classroom_management.enabled) {
        return {
          canCreate: false,
          reason: 'Classroom management not included in subscription plan',
          current: 0,
          limit: 0
        };
      }

      // If unlimited, always can create
      if (permissions.classroom_management.unlimited_classrooms) {
        return {
          canCreate: true,
          reason: 'Unlimited classrooms',
          current: null,
          limit: 'unlimited'
        };
      }

      // Check current usage against limit
      const usage = await this.getClassroomUsage(userId);
      const limit = permissions.classroom_management.max_classrooms;

      if (usage.current_classrooms >= limit) {
        return {
          canCreate: false,
          reason: `Classroom limit reached (${limit} classrooms maximum)`,
          current: usage.current_classrooms,
          limit: limit
        };
      }

      return {
        canCreate: true,
        reason: 'Within classroom limit',
        current: usage.current_classrooms,
        limit: limit,
        remaining: limit - usage.current_classrooms
      };

    } catch (error) {
      luderror.auth('Error checking classroom creation permission:', { userId, error });
      return {
        canCreate: false,
        reason: 'Error checking permissions',
        current: 0,
        limit: 0
      };
    }
  }

  /**
   * Get enriched permissions including current usage
   * @param {string} userId - User ID
   * @returns {Object|null} Permissions with usage data
   */
  static async getEnrichedPermissions(userId) {
    try {
      const permissions = await this.getUserSubscriptionPermissions(userId);

      if (!permissions) {
        return null;
      }

      // Get current classroom usage
      const classroomUsage = await this.getClassroomUsage(userId);

      // Get product allowances with current month usage
      const allowanceData = await SubscriptionAllowanceService.calculateMonthlyAllowances(userId);

      // Enrich classroom permissions with usage
      const enrichedClassroom = {
        ...permissions.classroom_management,
        current_classrooms: classroomUsage.current_classrooms,
        current_students_total: classroomUsage.current_students_total,
        remaining_classrooms: permissions.classroom_management.unlimited_classrooms ?
          'unlimited' : Math.max(0, permissions.classroom_management.max_classrooms - classroomUsage.current_classrooms),
        remaining_students: permissions.classroom_management.unlimited_students ?
          'unlimited' : Math.max(0, permissions.classroom_management.max_students_total - classroomUsage.current_students_total),
        can_create_classroom: permissions.classroom_management.unlimited_classrooms ||
          classroomUsage.current_classrooms < permissions.classroom_management.max_classrooms
      };

      // Enrich product allowances with monthly usage
      const enrichedAllowances = allowanceData ? {
        month_year: allowanceData.monthYear,
        files: this.enrichProductAllowance('file', permissions.product_allowances.files, allowanceData.allowances),
        games: this.enrichProductAllowance('game', permissions.product_allowances.games, allowanceData.allowances),
        lesson_plans: this.enrichProductAllowance('lesson_plan', permissions.product_allowances.lesson_plans, allowanceData.allowances),
        workshops: this.enrichProductAllowance('workshop', permissions.product_allowances.workshops, allowanceData.allowances),
        courses: this.enrichProductAllowance('course', permissions.product_allowances.courses, allowanceData.allowances),
        tools: this.enrichProductAllowance('tool', permissions.product_allowances.tools, allowanceData.allowances)
      } : permissions.product_allowances;

      return {
        ...permissions,
        classroom_management: enrichedClassroom,
        product_allowances: enrichedAllowances
      };

    } catch (error) {
      luderror.auth('Error getting enriched permissions:', { userId, error });
      return null;
    }
  }

  /**
   * Enrich single product allowance with usage data
   * @param {string} productType - Product type
   * @param {Object} allowanceConfig - Static allowance config
   * @param {Object} usageData - Current month usage data
   * @returns {Object} Enriched allowance
   */
  static enrichProductAllowance(productType, allowanceConfig, usageData) {
    const usage = usageData?.[productType];

    if (!usage || !allowanceConfig.enabled) {
      return {
        ...allowanceConfig,
        used: 0,
        remaining: allowanceConfig.unlimited ? 'unlimited' : (allowanceConfig.monthly_limit || 0),
        can_claim: false
      };
    }

    return {
      ...allowanceConfig,
      used: usage.used || 0,
      remaining: usage.remaining,
      can_claim: !usage.hasReachedLimit,
      has_reached_limit: usage.hasReachedLimit
    };
  }
}

export default SubscriptionPermissionsService;
