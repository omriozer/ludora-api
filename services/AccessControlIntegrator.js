import AccessControlService from './AccessControlService.js';
import SubscriptionAllowanceService from './SubscriptionAllowanceService.js';
import { ludlog, luderror } from '../lib/ludlog.js';

/**
 * AccessControlIntegrator Service
 *
 * Embeds complete access control information directly into product API responses.
 * This eliminates the need for separate access control API calls and provides a
 * single source of truth for ALL access decisions.
 *
 * Core Principles:
 * - Backend determines ALL access decisions (no client-side logic)
 * - Embedded access info includes everything frontend needs for UI
 * - Supports all product types and all access methods
 * - Handles bulk operations efficiently
 * - Includes user context (subscription allowances) for real-time state sync
 *
 * Access Types Supported:
 * - creator: User owns the content
 * - purchase: User purchased the content (one-time or free)
 * - subscription_claim: User claimed via active subscription
 * - student_via_teacher: Student accessing via teacher subscription
 * - none: No access
 */
class AccessControlIntegrator {
  /**
   * Get user's access context (subscription allowances, active subscriptions, etc.)
   * This context is used to determine UI states like "can claim" buttons
   *
   * @param {string|null} userId - User ID
   * @returns {Object} User access context
   */
  async getUserAccessContext(userId) {
    if (!userId) {
      return {
        subscriptionAllowances: null,
        activeSubscriptions: [],
        userRole: null
      };
    }

    try {
      // Get user's subscription allowances (if any)
      const allowances = await SubscriptionAllowanceService.calculateMonthlyAllowances(userId);

      // Extract active subscription info
      const activeSubscriptions = allowances?.subscription ? [{
        id: allowances.subscription.id,
        planId: allowances.subscription.subscription_plan_id,
        planName: allowances.subscription.subscriptionPlan?.name,
        status: allowances.subscription.status,
        startDate: allowances.subscription.start_date,
        endDate: allowances.subscription.end_date
      }] : [];

      return {
        subscriptionAllowances: allowances ? {
          monthYear: allowances.monthYear,
          allowances: allowances.allowances,
          // Calculate remaining total across all product types
          remainingTotal: this.calculateRemainingTotal(allowances.allowances)
        } : null,
        activeSubscriptions,
        userRole: null // Could be enhanced to include user role if needed
      };
    } catch (error) {
      luderror.auth('Error getting user access context:', error);
      return {
        subscriptionAllowances: null,
        activeSubscriptions: [],
        userRole: null
      };
    }
  }

  /**
   * Calculate total remaining allowances across all product types
   *
   * @param {Object} allowances - Allowances object by product type
   * @returns {number|string} Total remaining allowances (or 'unlimited')
   */
  calculateRemainingTotal(allowances) {
    if (!allowances) return 0;

    let hasUnlimited = false;
    let total = 0;

    Object.values(allowances).forEach(allowance => {
      if (allowance.remaining === 'unlimited') {
        hasUnlimited = true;
      } else if (typeof allowance.remaining === 'number') {
        total += allowance.remaining;
      }
    });

    return hasUnlimited ? 'unlimited' : total;
  }

  /**
   * Enrich a single product with complete access control information
   *
   * @param {Object} product - Product record (can be plain object or Sequelize instance)
   * @param {string|null} userId - User ID to check access for (null for anonymous)
   * @param {Object|null} userContext - Pre-fetched user context (for bulk operations)
   * @returns {Object} Product with embedded access information
   */
  async enrichProductWithAccess(product, userId = null, userContext = null) {
    try {
      // Convert Sequelize instance to plain object if needed
      const productData = product.toJSON ? product.toJSON() : { ...product };

      // If no user, return product with no-access info
      if (!userId) {
        return {
          ...productData,
          access: this.formatNoAccess()
        };
      }

      // Get user context if not provided (for single product enrichment)
      if (!userContext) {
        userContext = await this.getUserAccessContext(userId);
      }

      // Check access using AccessControlService (single source of truth)
      const accessResult = await AccessControlService.checkAccess(
        userId,
        productData.product_type,
        productData.id // Use Product ID directly
      );

      // Format access info for frontend consumption
      const accessInfo = this.formatAccessInfo(accessResult, productData, userContext);

      return {
        ...productData,
        access: accessInfo
      };
    } catch (error) {
      luderror.auth('Error enriching product with access:', error);

      // On error, return product with no-access info (fail-safe)
      const productData = product.toJSON ? product.toJSON() : { ...product };
      return {
        ...productData,
        access: this.formatNoAccess()
      };
    }
  }

  /**
   * Enrich multiple products with access control information
   * Optimized for bulk operations - fetches user context once for all products
   *
   * @param {Array<Object>} products - Array of product records
   * @param {string|null} userId - User ID to check access for
   * @returns {Array<Object>} Products with embedded access information
   */
  async enrichProductsWithAccess(products, userId = null) {
    try {
      // If no user, return all products with no-access info
      if (!userId) {
        return products.map(product => {
          const productData = product.toJSON ? product.toJSON() : { ...product };
          return {
            ...productData,
            access: this.formatNoAccess()
          };
        });
      }

      // Get user context ONCE for all products (performance optimization)
      const userContext = await this.getUserAccessContext(userId);

      // Process all products with access checks, passing shared userContext
      const enrichedProducts = await Promise.all(
        products.map(product => this.enrichProductWithAccess(product, userId, userContext))
      );

      return enrichedProducts;
    } catch (error) {
      luderror.auth('Error enriching products with access:', error);

      // On error, return products with no-access info (fail-safe)
      return products.map(product => {
        const productData = product.toJSON ? product.toJSON() : { ...product };
        return {
          ...productData,
          access: this.formatNoAccess()
        };
      });
    }
  }

  /**
   * Format access information for frontend consumption
   * This includes all UI display logic decisions
   *
   * @param {Object} accessResult - Result from AccessControlService.checkAccess()
   * @param {Object} productData - Product data for context
   * @param {Object} userContext - User access context (subscription allowances, etc.)
   * @returns {Object} Formatted access information
   */
  formatAccessInfo(accessResult, productData, userContext) {
    const hasAccess = accessResult.hasAccess || false;
    const accessType = accessResult.accessType || 'none';
    const reason = accessResult.reason || 'no_access';

    // Determine UI display flags based on access type
    const uiFlags = this.determineUIFlags(accessResult, productData, userContext);

    // Build comprehensive access object
    const accessInfo = {
      // Core access status
      hasAccess,
      accessType,
      reason,

      // UI Display Flags (what to show/hide)
      canDownload: uiFlags.canDownload,
      canPreview: uiFlags.canPreview,
      canPlay: uiFlags.canPlay,
      canCreateSessions: uiFlags.canCreateSessions,
      canClaim: uiFlags.canClaim,
      showPurchaseButton: uiFlags.showPurchaseButton,
      showSubscriptionPrompt: uiFlags.showSubscriptionPrompt,
      showFullContent: uiFlags.showFullContent,
      showWatermark: uiFlags.showWatermark,

      // Subscription Allowance Info (for "Claim" button logic)
      remainingAllowances: this.getRemainingAllowancesForProduct(productData, userContext),
      allowanceType: this.getAllowanceType(productData, userContext),

      // Access Details
      isLifetimeAccess: accessResult.isLifetimeAccess || false,
      expiresAt: accessResult.expiresAt || null,
      purchasedAt: accessResult.purchasedAt || null,
      claimedAt: accessResult.claimedAt || null,

      // Subscription Info (if applicable)
      subscriptionAccess: accessType === 'subscription_claim' || accessType === 'student_via_teacher_claim',
      subscriptionPlan: accessResult.plan ? {
        id: accessResult.plan.id,
        name: accessResult.plan.name,
        benefits: accessResult.plan.benefits
      } : null,

      // Teacher Access Info (for students)
      teacherAccess: accessResult.teacherId ? {
        teacherId: accessResult.teacherId,
        accessMethod: 'student_via_teacher'
      } : null,

      // Content-Specific Access Info
      contentAccess: this.extractContentAccess(accessResult)
    };

    return accessInfo;
  }

  /**
   * Determine UI display flags based on access result
   *
   * @param {Object} accessResult - Result from AccessControlService.checkAccess()
   * @param {Object} productData - Product data for context
   * @param {Object} userContext - User access context
   * @returns {Object} UI flags
   */
  determineUIFlags(accessResult, productData, userContext) {
    const hasAccess = accessResult.hasAccess || false;
    const accessType = accessResult.accessType || 'none';
    const isFree = productData.price === 0 || productData.is_free === true;

    // Base flags for no access
    if (!hasAccess) {
      // Determine if user can claim this product via subscription
      const canClaim = this.determineCanClaim(productData, userContext);

      return {
        canDownload: false,
        canPreview: this.determinePreviewAccess(productData),
        canPlay: false,
        canCreateSessions: false,
        canClaim, // NEW: Can user claim via subscription?
        showPurchaseButton: !isFree && !canClaim, // Hide purchase if can claim
        showSubscriptionPrompt: !isFree && !canClaim, // Hide subscription prompt if can claim
        showFullContent: false,
        showWatermark: this.determinePreviewAccess(productData) // Show watermark if preview allowed
      };
    }

    // Flags for full access (creator, purchase, or subscription claim)
    if (accessType === 'creator' || accessType === 'purchase' || accessType === 'subscription_claim') {
      return {
        canDownload: true,
        canPreview: true,
        canPlay: true,
        canCreateSessions: true,
        canClaim: false, // Already has access
        showPurchaseButton: false,
        showSubscriptionPrompt: false,
        showFullContent: true,
        showWatermark: false
      };
    }

    // Flags for student access via teacher
    if (accessType === 'student_via_teacher_claim') {
      return {
        canDownload: false, // Students can't download teacher-claimed content
        canPreview: true,
        canPlay: true,
        canCreateSessions: false, // Students can join but not create
        canClaim: false, // Already has access via teacher
        showPurchaseButton: false,
        showSubscriptionPrompt: false,
        showFullContent: true,
        showWatermark: false
      };
    }

    // Fallback to no access
    return {
      canDownload: false,
      canPreview: false,
      canPlay: false,
      canCreateSessions: false,
      canClaim: false,
      showPurchaseButton: !isFree,
      showSubscriptionPrompt: !isFree,
      showFullContent: false,
      showWatermark: false
    };
  }

  /**
   * Determine if user can claim this product via subscription allowance
   *
   * @param {Object} productData - Product data
   * @param {Object} userContext - User access context
   * @returns {boolean} Whether user can claim this product
   */
  determineCanClaim(productData, userContext) {
    // No subscription allowances = can't claim
    if (!userContext?.subscriptionAllowances) {
      return false;
    }

    const productType = productData.product_type;
    const allowances = userContext.subscriptionAllowances.allowances;

    // Check if this product type has allowances
    if (!allowances || !allowances[productType]) {
      return false;
    }

    const typeAllowance = allowances[productType];

    // Can claim if:
    // 1. Allowance is unlimited, OR
    // 2. Remaining allowances > 0
    if (typeAllowance.remaining === 'unlimited') {
      return true;
    }

    if (typeof typeAllowance.remaining === 'number' && typeAllowance.remaining > 0) {
      return true;
    }

    return false;
  }

  /**
   * Get remaining allowances for this specific product type
   *
   * @param {Object} productData - Product data
   * @param {Object} userContext - User access context
   * @returns {number|string} Remaining allowances for this product type
   */
  getRemainingAllowancesForProduct(productData, userContext) {
    if (!userContext?.subscriptionAllowances) {
      return 0;
    }

    const productType = productData.product_type;
    const allowances = userContext.subscriptionAllowances.allowances;

    if (!allowances || !allowances[productType]) {
      return 0;
    }

    return allowances[productType].remaining;
  }

  /**
   * Get allowance type info for this product
   *
   * @param {Object} productData - Product data
   * @param {Object} userContext - User access context
   * @returns {Object|null} Allowance type information
   */
  getAllowanceType(productData, userContext) {
    if (!userContext?.subscriptionAllowances) {
      return null;
    }

    const productType = productData.product_type;
    const allowances = userContext.subscriptionAllowances.allowances;

    if (!allowances || !allowances[productType]) {
      return null;
    }

    const typeAllowance = allowances[productType];

    return {
      productType,
      isLimited: typeAllowance.isLimited,
      allowed: typeAllowance.allowed,
      used: typeAllowance.used,
      remaining: typeAllowance.remaining,
      hasReachedLimit: typeAllowance.hasReachedLimit
    };
  }

  /**
   * Determine if preview access should be allowed for a product
   *
   * @param {Object} productData - Product data
   * @returns {boolean} Whether preview is allowed
   */
  determinePreviewAccess(productData) {
    // File products with allow_preview flag
    if (productData.product_type === 'file' && productData.allow_preview === true) {
      return true;
    }

    // Lesson plans with slide preview enabled
    if (productData.product_type === 'lesson_plan' && productData.allow_slide_preview === true) {
      return true;
    }

    // Default: no preview
    return false;
  }

  /**
   * Extract content-specific access information from access result
   *
   * @param {Object} accessResult - Result from AccessControlService.checkAccess()
   * @returns {Object|null} Content-specific access info
   */
  extractContentAccess(accessResult) {
    // Workshop access info
    if (accessResult.workshop) {
      return {
        type: 'workshop',
        hasVideoContent: accessResult.workshop.hasVideoContent,
        duration: accessResult.workshop.duration,
        restrictions: accessResult.workshop.restrictions
      };
    }

    // Course access info
    if (accessResult.course) {
      return {
        type: 'course',
        requiresSequential: accessResult.course.requiresSequential,
        totalModules: accessResult.course.totalModules,
        unlockedModules: accessResult.course.unlockedModules,
        completedModules: accessResult.course.completedModules
      };
    }

    // Game access info
    if (accessResult.game) {
      return {
        type: 'game',
        canCreateSessions: accessResult.game.canCreateSessions,
        canJoinOnly: accessResult.game.canJoinOnly,
        maxPlayers: accessResult.game.maxPlayers
      };
    }

    // File access info
    if (accessResult.file) {
      return {
        type: 'file',
        size: accessResult.file.size,
        mimeType: accessResult.file.mimeType,
        canDownload: accessResult.file.canDownload
      };
    }

    // Tool access info
    if (accessResult.tool) {
      return {
        type: 'tool',
        settings: accessResult.tool.settings
      };
    }

    // Lesson plan access info
    if (accessResult.lessonPlan) {
      return {
        type: 'lesson_plan',
        canCustomize: accessResult.lessonPlan.canCustomize
      };
    }

    return null;
  }

  /**
   * Format no-access information for products
   *
   * @returns {Object} No-access information
   */
  formatNoAccess() {
    return {
      hasAccess: false,
      accessType: 'none',
      reason: 'not_authenticated',

      // UI Display Flags
      canDownload: false,
      canPreview: false,
      canPlay: false,
      canCreateSessions: false,
      showPurchaseButton: true,
      showSubscriptionPrompt: true,
      showFullContent: false,
      showWatermark: false,

      // Access Details
      isLifetimeAccess: false,
      expiresAt: null,
      purchasedAt: null,
      claimedAt: null,

      // Subscription Info
      subscriptionAccess: false,
      subscriptionPlan: null,

      // Teacher Access Info
      teacherAccess: null,

      // Content-Specific Access Info
      contentAccess: null
    };
  }
}

export default new AccessControlIntegrator();
