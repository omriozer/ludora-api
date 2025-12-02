import models from '../models/index.js';
import { Op } from 'sequelize';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { luderror, ludlog } from '../lib/ludlog.js';
import { nowInIsrael, createExpirationDate, isExpired } from '../utils/dateUtils.js';
import SubscriptionAllowanceService from './SubscriptionAllowanceService.js';

class AccessControlService {
  constructor() {
    this.models = models;
  }

  /**
   * Enhanced Three-Layer Access Control System
   * Layer 1: Creator Access (user owns the content)
   * Layer 2: Purchase Access (user bought the content)
   * Layer 3: Subscription Claim Access (user claimed via subscription allowance)
   *
   * @param {string} userId - User ID to check access for
   * @param {string} entityType - Type of entity (workshop, course, file, game, tool)
   * @param {string} productId - Product ID (marketplace facade ID)
   * @returns {Object} Access result with hasAccess, accessType, and relevant data
   */
  async checkAccess(userId, entityType, productId) {
    try {
      ludlog.auth(`🔍 Checking three-layer access for user ${userId}, ${entityType}:${productId}`);

      // Layer 1: Creator Access Check (highest priority)
      const creatorAccess = await this.checkCreatorAccess(userId, entityType, productId);
      if (creatorAccess.hasAccess) {
        ludlog.auth(`✅ Creator access granted for ${entityType}:${productId}`);

        // Apply content-type specific validation
        const contentValidation = await this.validateContentTypeSpecificAccess(
          userId, entityType, creatorAccess.entityId, { ...creatorAccess, accessType: 'creator' }
        );
        return contentValidation;
      }

      // Layer 2: Purchase Access Check (existing logic)
      const purchaseAccess = await this.checkPurchaseAccess(userId, entityType, productId);
      if (purchaseAccess.hasAccess) {
        ludlog.auth(`✅ Purchase access granted for ${entityType}:${productId}`);

        // Apply content-type specific validation
        const contentValidation = await this.validateContentTypeSpecificAccess(
          userId, entityType, purchaseAccess.entityId, { ...purchaseAccess, accessType: 'purchase' }
        );
        return contentValidation;
      }

      // Layer 3: Subscription Claim Access Check (new)
      const subscriptionAccess = await this.checkSubscriptionClaimAccess(userId, entityType, productId);
      if (subscriptionAccess.hasAccess) {
        ludlog.auth(`✅ Subscription claim access granted for ${entityType}:${productId}`);

        // Apply content-type specific validation
        const contentValidation = await this.validateContentTypeSpecificAccess(
          userId, entityType, subscriptionAccess.entityId, { ...subscriptionAccess, accessType: 'subscription_claim' }
        );
        return contentValidation;
      }

      // No access found through any layer
      ludlog.auth(`❌ No access found for user ${userId}, ${entityType}:${productId}`);
      return {
        hasAccess: false,
        accessType: 'none',
        reason: 'No valid access method found',
        checkedLayers: ['creator', 'purchase', 'subscription_claim']
      };
    } catch (error) {
      luderror.api('Error in three-layer access check:', error);
      throw new Error(`Failed to check access: ${error.message}`);
    }
  }

  /**
   * Layer 1: Check Creator Access
   * User has access if they created/own the content via Product.creator_user_id
   *
   * @param {string} userId - User ID to check
   * @param {string} entityType - Type of entity
   * @param {string} productId - Product ID
   * @returns {Object} Creator access result
   */
  async checkCreatorAccess(userId, entityType, productId) {
    try {
      // Find the product record by Product ID
      const product = await this.models.Product.findOne({
        where: {
          id: productId,
          product_type: entityType,
          creator_user_id: userId
        },
        attributes: ['id', 'entity_id', 'creator_user_id', 'title', 'is_published'],
        include: [
          {
            model: this.models.User,
            as: 'creator',
            attributes: ['id', 'email', 'full_name'],
            required: false
          }
        ]
      });

      if (product) {
        return {
          hasAccess: true,
          reason: 'creator_ownership',
          message: 'User is the creator/owner of this content',
          productId: product.id,
          entityId: product.entity_id,
          product: {
            id: product.id,
            title: product.title,
            isPublished: product.is_published
          },
          creator: product.creator,
          allowUnpublished: true, // Creators can access their own unpublished content
          isLifetimeAccess: true,
          expiresAt: null
        };
      }

      return {
        hasAccess: false,
        reason: 'not_creator',
        message: 'User is not the creator of this content'
      };
    } catch (error) {
      luderror.auth('Error checking creator access:', error);
      return {
        hasAccess: false,
        reason: 'creator_check_error',
        message: `Failed to verify creator access: ${error.message}`
      };
    }
  }

  /**
   * Layer 2: Check Purchase Access (Enhanced version of original logic)
   * User has access if they purchased the content
   *
   * @param {string} userId - User ID to check
   * @param {string} entityType - Type of entity
   * @param {string} productId - Product ID
   * @returns {Object} Purchase access result
   */
  async checkPurchaseAccess(userId, entityType, productId) {
    try {
      // First get the Product to find entity ID
      const product = await this.models.Product.findOne({
        where: {
          id: productId,
          product_type: entityType
        },
        attributes: ['id', 'entity_id']
      });

      if (!product) {
        return {
          hasAccess: false,
          reason: 'product_not_found',
          message: 'Product not found'
        };
      }

      // Get the purchase record for this user and product
      const purchase = await this.models.Purchase.findOne({
        where: {
          buyer_user_id: userId,
          purchasable_type: entityType,
          purchasable_id: productId, // Purchase records use Product ID
          payment_status: 'completed', // Only successful payments
          [Op.or]: [
            { access_expires_at: null }, // Lifetime access
            { access_expires_at: { [Op.gt]: nowInIsrael() } } // Not expired (Israel timezone)
          ]
        },
        include: [
          {
            model: this.models.User,
            as: 'buyer',
            attributes: ['id', 'email', 'full_name']
          }
        ]
      });

      if (purchase) {
        return {
          hasAccess: true,
          reason: 'valid_purchase',
          message: 'User has valid purchase access',
          productId: productId,
          entityId: product.entity_id,
          purchase: purchase,
          buyer: purchase.buyer,
          isLifetimeAccess: !purchase.access_expires_at,
          expiresAt: purchase.access_expires_at,
          purchasedAt: purchase.created_at,
          paymentAmount: purchase.payment_amount
        };
      }

      return {
        hasAccess: false,
        reason: 'no_purchase',
        message: 'User has not purchased this content or purchase has expired'
      };
    } catch (error) {
      luderror.auth('Error checking purchase access:', error);
      return {
        hasAccess: false,
        reason: 'purchase_check_error',
        message: `Failed to verify purchase access: ${error.message}`
      };
    }
  }

  /**
   * Layer 3: Check Subscription Claim Access (NEW)
   * User has access if they claimed content via subscription allowance
   * OR if they are a student whose teacher claimed the content
   *
   * @param {string} userId - User ID to check
   * @param {string} entityType - Type of entity
   * @param {string} productId - Product ID
   * @returns {Object} Subscription claim access result
   */
  async checkSubscriptionClaimAccess(userId, entityType, productId) {
    try {
      // Check direct subscription claim access
      const directClaim = await this.checkDirectSubscriptionClaim(userId, entityType, productId);
      if (directClaim.hasAccess) {
        return { ...directClaim, accessMethod: 'direct_subscription_claim' };
      }

      // Check student access via teacher claims
      const studentAccess = await this.checkStudentAccessViaTeacher(userId, entityType, productId);
      if (studentAccess.hasAccess) {
        return { ...studentAccess, accessMethod: 'student_via_teacher_claim' };
      }

      return {
        hasAccess: false,
        reason: 'no_subscription_claim',
        message: 'User has no subscription claim access to this content'
      };
    } catch (error) {
      luderror.auth('Error checking subscription claim access:', error);
      return {
        hasAccess: false,
        reason: 'subscription_check_error',
        message: `Failed to verify subscription claim access: ${error.message}`
      };
    }
  }

  /**
   * Check if user has directly claimed this content via their own subscription
   *
   * @param {string} userId - User ID to check
   * @param {string} entityType - Type of entity
   * @param {string} productId - Product ID
   * @returns {Object} Direct subscription claim result
   */
  async checkDirectSubscriptionClaim(userId, entityType, productId) {
    try {
      ludlog.auth(`🔍 DEBUG: Checking direct subscription claim for user ${userId}, ${entityType}:${productId}`);

      // Get the Product record to find entity ID
      const product = await this.models.Product.findOne({
        where: {
          id: productId,
          product_type: entityType
        },
        attributes: ['id', 'entity_id']
      });

      if (!product) {
        ludlog.auth(`❌ DEBUG: Product not found for ${entityType}:${productId}`);
        return {
          hasAccess: false,
          reason: 'product_not_found',
          message: 'Product record not found'
        };
      }

      ludlog.auth(`✅ DEBUG: Product found - ID: ${product.id}, Entity ID: ${product.entity_id}`);

      // DEBUG: Log what we're searching for
      ludlog.auth(`🚨 DEBUG: Searching for SubscriptionPurchase with user_id: ${userId}, product_type: ${entityType}, product_id: ${productId}`);

      // Find active subscription purchases for this user and product
      const subscriptionPurchase = await this.models.SubscriptionPurchase.findOne({
        where: {
          user_id: userId,
          product_type: entityType,
          product_id: productId  // Direct Product ID lookup
        },
        include: [
          {
            model: this.models.Subscription,
            as: 'subscription',
            where: {
              status: 'active',
              [Op.or]: [
                { end_date: null }, // Ongoing subscription
                { end_date: { [Op.gt]: nowInIsrael() } } // Not expired
              ]
            },
            include: [
              {
                model: this.models.SubscriptionPlan,
                as: 'subscriptionPlan',
                attributes: ['id', 'name', 'benefits']
              }
            ]
          }
        ]
      });

      // DEBUG: Also try to find any SubscriptionPurchase without the subscription include to see if records exist
      const allUserPurchases = await this.models.SubscriptionPurchase.findAll({
        where: {
          user_id: userId,
          product_type: entityType,
          product_id: productId
        },
        attributes: ['id', 'user_id', 'product_type', 'product_id', 'subscription_id', 'created_at']
      });

      ludlog.auth(`🚨 DEBUG: Found ${allUserPurchases.length} SubscriptionPurchase records without subscription filter:`,
        allUserPurchases.map(sp => ({
          id: sp.id,
          subscription_id: sp.subscription_id,
          created_at: sp.created_at
        }))
      );

      // DEBUG: Also check if there are any active subscriptions for this user
      const activeSubscriptions = await this.models.Subscription.findAll({
        where: {
          user_id: userId,
          status: 'active',
          [Op.or]: [
            { end_date: null },
            { end_date: { [Op.gt]: nowInIsrael() } }
          ]
        },
        attributes: ['id', 'user_id', 'status', 'start_date', 'end_date']
      });

      ludlog.auth(`🚨 DEBUG: Found ${activeSubscriptions.length} active subscriptions for user ${userId}:`,
        activeSubscriptions.map(sub => ({
          id: sub.id,
          status: sub.status,
          start_date: sub.start_date,
          end_date: sub.end_date
        }))
      );

      ludlog.auth(`🔍 DEBUG: SubscriptionPurchase query result: ${subscriptionPurchase ? 'FOUND' : 'NOT FOUND'}`);

      if (subscriptionPurchase) {
        ludlog.auth(`✅ DEBUG: Subscription purchase found - ID: ${subscriptionPurchase.id}, Subscription Status: ${subscriptionPurchase.subscription?.status}`);
        return {
          hasAccess: true,
          reason: 'subscription_claim',
          message: 'User has claimed this content via subscription allowance',
          productId: productId,
          entityId: product.entity_id,
          subscriptionPurchase: subscriptionPurchase,
          subscription: subscriptionPurchase.subscription,
          plan: subscriptionPurchase.subscription?.subscriptionPlan,
          claimedAt: subscriptionPurchase.created_at,
          usageTracking: subscriptionPurchase.usage_tracking,
          isLifetimeAccess: false, // Subscription access depends on active subscription
          expiresAt: subscriptionPurchase.subscription?.end_date
        };
      }

      ludlog.auth(`❌ DEBUG: No subscription purchase found for user ${userId}, ${entityType}:${productId}`);
      return {
        hasAccess: false,
        reason: 'no_direct_subscription_claim',
        message: 'User has not claimed this content via subscription'
      };
    } catch (error) {
      luderror.auth('Error checking direct subscription claim:', error);
      return {
        hasAccess: false,
        reason: 'direct_claim_check_error',
        message: `Failed to verify direct subscription claim: ${error.message}`
      };
    }
  }

  /**
   * Check if user (student) has access via their teacher's subscription claims
   *
   * @param {string} studentUserId - Student user ID to check
   * @param {string} entityType - Type of entity
   * @param {string} productId - Product ID
   * @returns {Object} Student via teacher access result
   */
  async checkStudentAccessViaTeacher(studentUserId, entityType, productId) {
    try {
      // Step 1: Find all teachers connected to this student
      const teacherIds = await this.findStudentTeachers(studentUserId);

      if (teacherIds.length === 0) {
        return {
          hasAccess: false,
          reason: 'no_teachers_found',
          message: 'Student is not connected to any teachers'
        };
      }

      ludlog.auth(`🔍 Found ${teacherIds.length} teachers for student ${studentUserId}: ${teacherIds.join(', ')}`);

      // Step 2: Check if any of these teachers have subscription claims for this content
      for (const teacherId of teacherIds) {
        const teacherClaim = await this.checkDirectSubscriptionClaim(teacherId, entityType, productId);

        if (teacherClaim.hasAccess) {
          // Step 3: Record student usage of teacher's claim
          await this.recordStudentUsage(studentUserId, teacherId, entityType, teacherClaim.entityId);

          ludlog.auth(`✅ Student ${studentUserId} granted access via teacher ${teacherId} claim`);

          return {
            hasAccess: true,
            reason: 'teacher_subscription_claim',
            message: `Access granted via teacher's subscription claim`,
            productId: productId,
            entityId: teacherClaim.entityId,
            teacherId: teacherId,
            teacherSubscriptionPurchase: teacherClaim.subscriptionPurchase,
            teacherSubscription: teacherClaim.subscription,
            plan: teacherClaim.plan,
            isLifetimeAccess: false,
            expiresAt: teacherClaim.expiresAt,
            studentUsageRecorded: true
          };
        }
      }

      return {
        hasAccess: false,
        reason: 'no_teacher_claims',
        message: 'No teachers have subscription claims for this content',
        checkedTeachers: teacherIds
      };
    } catch (error) {
      luderror.auth('Error checking student access via teacher:', error);
      return {
        hasAccess: false,
        reason: 'student_teacher_check_error',
        message: `Failed to verify student-teacher access: ${error.message}`
      };
    }
  }

  /**
   * Find all teachers connected to a student user
   *
   * @param {string} studentUserId - Student user ID
   * @returns {Array<string>} Array of teacher user IDs
   */
  async findStudentTeachers(studentUserId) {
    try {
      const teacherIds = new Set();

      // Method 1: Check if student is a Player with teacher_id
      const playerRecord = await this.models.Player.findOne({
        where: {
          user_id: studentUserId,
          is_active: true,
          teacher_id: { [Op.not]: null }
        },
        attributes: ['teacher_id']
      });

      if (playerRecord?.teacher_id) {
        teacherIds.add(playerRecord.teacher_id);
        ludlog.auth(`📋 Found teacher via Player relationship: ${playerRecord.teacher_id}`);
      }

      // Method 2: Check classroom memberships
      const memberships = await this.models.ClassroomMembership.findAll({
        where: {
          student_user_id: studentUserId,
          status: 'active',
          teacher_id: { [Op.not]: null }
        },
        attributes: ['teacher_id']
      });

      memberships.forEach(membership => {
        if (membership.teacher_id) {
          teacherIds.add(membership.teacher_id);
          ludlog.auth(`📋 Found teacher via ClassroomMembership: ${membership.teacher_id}`);
        }
      });

      return Array.from(teacherIds);
    } catch (error) {
      luderror.auth('Error finding student teachers:', error);
      return [];
    }
  }

  /**
   * Record student usage of teacher's subscription claim
   *
   * @param {string} studentUserId - Student user ID
   * @param {string} teacherId - Teacher user ID
   * @param {string} entityType - Type of entity
   * @param {string} entityId - Entity ID
   */
  async recordStudentUsage(studentUserId, teacherId, entityType, entityId) {
    try {
      // Use SubscriptionAllowanceService to record usage
      await SubscriptionAllowanceService.recordUsage(
        teacherId,
        entityType,
        entityId,
        {
          studentUserId: studentUserId,
          accessType: 'student_via_teacher',
          recordedAt: new Date().toISOString()
        }
      );

      ludlog.auth(`📊 Recorded student usage: ${studentUserId} using ${teacherId}'s claim for ${entityType}:${entityId}`);
    } catch (error) {
      // Don't fail access check if usage recording fails, but log the error
      luderror.auth('Warning: Failed to record student usage:', error);
    }
  }

  /**
   * Validate content-type specific access requirements
   * Additional validation layer that runs after basic access is granted
   *
   * @param {string} userId - User ID
   * @param {string} entityType - Type of entity
   * @param {string} entityId - Entity ID
   * @param {Object} baseAccess - Base access result from three-layer check
   * @returns {Object} Enhanced access result with content-specific validation
   */
  async validateContentTypeSpecificAccess(userId, entityType, entityId, baseAccess) {
    try {
      ludlog.auth(`🔍 Applying content-type validation for ${entityType}:${entityId}`);

      switch (entityType) {
        case 'workshop':
          return await this.validateWorkshopAccess(userId, entityId, baseAccess);

        case 'course':
          return await this.validateCourseAccess(userId, entityId, baseAccess);

        case 'game':
          return await this.validateGameAccess(userId, entityId, baseAccess);

        case 'file':
          return await this.validateFileAccess(userId, entityId, baseAccess);

        case 'tool':
          return await this.validateToolAccess(userId, entityId, baseAccess);

        case 'lesson_plan':
          return await this.validateLessonPlanAccess(userId, entityId, baseAccess);

        default:
          // No specific validation needed for this content type
          return {
            ...baseAccess,
            contentValidation: {
              applied: false,
              reason: `No specific validation for ${entityType}`
            }
          };
      }
    } catch (error) {
      luderror.auth('Error in content-type specific validation:', error);
      // Don't fail access check due to validation errors, but log them
      return {
        ...baseAccess,
        contentValidation: {
          applied: false,
          error: error.message,
          reason: 'Validation error occurred'
        }
      };
    }
  }

  /**
   * Workshop-specific access validation
   * Checks publication status, video content access, and restrictions
   */
  async validateWorkshopAccess(userId, workshopId, baseAccess) {
    try {
      const workshop = await this.models.Workshop.findByPk(workshopId, {
        attributes: ['id', 'title', 'is_published', 'video_url', 'duration_minutes', 'access_restrictions']
      });

      if (!workshop) {
        return {
          hasAccess: false,
          reason: 'workshop_not_found',
          message: 'Workshop not found'
        };
      }

      // Check publication status (creators can access unpublished)
      if (!workshop.is_published && baseAccess.accessType !== 'creator') {
        return {
          hasAccess: false,
          reason: 'workshop_not_published',
          message: 'Workshop is not published'
        };
      }

      // Check age restrictions if present
      if (workshop.access_restrictions?.min_age) {
        const user = await this.models.User.findByPk(userId, {
          attributes: ['id', 'birth_date']
        });

        if (user?.birth_date) {
          const userAge = Math.floor((Date.now() - new Date(user.birth_date)) / (365.25 * 24 * 60 * 60 * 1000));
          if (userAge < workshop.access_restrictions.min_age) {
            return {
              hasAccess: false,
              reason: 'age_restriction',
              message: `Workshop requires minimum age of ${workshop.access_restrictions.min_age}`
            };
          }
        }
      }

      return {
        ...baseAccess,
        workshop: {
          id: workshop.id,
          title: workshop.title,
          isPublished: workshop.is_published,
          hasVideoContent: !!workshop.video_url,
          duration: workshop.duration_minutes,
          restrictions: workshop.access_restrictions
        },
        contentValidation: {
          applied: true,
          type: 'workshop',
          checks: ['publication_status', 'age_restrictions'],
          passed: true
        }
      };
    } catch (error) {
      luderror.auth('Error validating workshop access:', error);
      return { ...baseAccess, contentValidation: { applied: false, error: error.message } };
    }
  }

  /**
   * Course-specific access validation
   * Checks module requirements and sequential completion rules
   */
  async validateCourseAccess(userId, courseId, baseAccess) {
    try {
      const course = await this.models.Course.findByPk(courseId, {
        attributes: ['id', 'title', 'is_published', 'modules', 'requires_sequential_completion']
      });

      if (!course) {
        return {
          hasAccess: false,
          reason: 'course_not_found',
          message: 'Course not found'
        };
      }

      if (!course.is_published && baseAccess.accessType !== 'creator') {
        return {
          hasAccess: false,
          reason: 'course_not_published',
          message: 'Course is not published'
        };
      }

      // Check sequential completion requirements
      let userProgress = null;
      if (course.requires_sequential_completion) {
        userProgress = await this.getCourseProgress(userId, courseId);
      }

      return {
        ...baseAccess,
        course: {
          id: course.id,
          title: course.title,
          isPublished: course.is_published,
          requiresSequential: course.requires_sequential_completion,
          totalModules: course.modules?.length || 0,
          unlockedModules: userProgress?.unlockedModules || [],
          completedModules: userProgress?.completedModules || []
        },
        contentValidation: {
          applied: true,
          type: 'course',
          checks: ['publication_status', 'sequential_requirements'],
          passed: true
        }
      };
    } catch (error) {
      luderror.auth('Error validating course access:', error);
      return { ...baseAccess, contentValidation: { applied: false, error: error.message } };
    }
  }

  /**
   * Game-specific access validation
   * Checks session creation permissions and multiplayer limits
   */
  async validateGameAccess(userId, gameId, baseAccess) {
    try {
      const game = await this.models.Game.findByPk(gameId, {
        attributes: ['id', 'game_type', 'digital', 'game_settings']
      });

      if (!game) {
        return {
          hasAccess: false,
          reason: 'game_not_found',
          message: 'Game not found'
        };
      }

      // Determine permissions based on access type
      const canCreateSessions = baseAccess.accessType === 'creator' ||
                                baseAccess.accessType === 'purchase' ||
                                baseAccess.accessType === 'subscription_claim';

      const canJoinOnly = baseAccess.accessMethod === 'student_via_teacher_claim';

      return {
        ...baseAccess,
        game: {
          id: game.id,
          type: game.game_type,
          isDigital: game.digital,
          canCreateSessions,
          canJoinOnly,
          maxPlayers: game.game_settings?.max_players || 10,
          settings: game.game_settings
        },
        contentValidation: {
          applied: true,
          type: 'game',
          checks: ['session_permissions', 'multiplayer_limits'],
          passed: true
        }
      };
    } catch (error) {
      luderror.auth('Error validating game access:', error);
      return { ...baseAccess, contentValidation: { applied: false, error: error.message } };
    }
  }

  /**
   * File-specific access validation
   * Checks file availability and download permissions
   */
  async validateFileAccess(userId, fileId, baseAccess) {
    try {
      // Get the file entity data (only query fields that exist in File model)
      const file = await this.models.File.findByPk(fileId, {
        attributes: ['id', 'title', 'file_name', 'file_type', 'allow_preview', 'is_asset_only']
      });

      if (!file) {
        return {
          hasAccess: false,
          reason: 'file_not_found',
          message: 'File not found'
        };
      }

      // Get the Product record to check publication status (is_published is in Product, not File)
      const product = await this.models.Product.findOne({
        where: {
          product_type: 'file',
          entity_id: fileId
        },
        attributes: ['id', 'is_published']
      });

      if (!product) {
        return {
          hasAccess: false,
          reason: 'product_not_found',
          message: 'Product record not found for this file'
        };
      }

      if (!product.is_published && baseAccess.accessType !== 'creator') {
        return {
          hasAccess: false,
          reason: 'file_not_published',
          message: 'File is not published'
        };
      }

      return {
        ...baseAccess,
        file: {
          id: file.id,
          title: file.title,
          fileName: file.file_name,
          fileType: file.file_type,
          isPublished: product.is_published,
          allowPreview: file.allow_preview,
          canDownload: true
        },
        contentValidation: {
          applied: true,
          type: 'file',
          checks: ['publication_status', 'availability'],
          passed: true
        }
      };
    } catch (error) {
      luderror.auth('Error validating file access:', error);
      return { ...baseAccess, contentValidation: { applied: false, error: error.message } };
    }
  }

  /**
   * Tool-specific access validation
   * Checks tool availability and usage restrictions
   */
  async validateToolAccess(userId, toolId, baseAccess) {
    try {
      const tool = await this.models.Tool.findByPk(toolId, {
        attributes: ['id', 'title', 'is_published', 'tool_settings']
      });

      if (!tool) {
        return {
          hasAccess: false,
          reason: 'tool_not_found',
          message: 'Tool not found'
        };
      }

      if (!tool.is_published && baseAccess.accessType !== 'creator') {
        return {
          hasAccess: false,
          reason: 'tool_not_published',
          message: 'Tool is not published'
        };
      }

      return {
        ...baseAccess,
        tool: {
          id: tool.id,
          title: tool.title,
          isPublished: tool.is_published,
          settings: tool.tool_settings
        },
        contentValidation: {
          applied: true,
          type: 'tool',
          checks: ['publication_status'],
          passed: true
        }
      };
    } catch (error) {
      luderror.auth('Error validating tool access:', error);
      return { ...baseAccess, contentValidation: { applied: false, error: error.message } };
    }
  }

  /**
   * Lesson Plan-specific access validation
   * Checks template availability and customization permissions
   */
  async validateLessonPlanAccess(userId, lessonPlanId, baseAccess) {
    try {
      const lessonPlan = await this.models.LessonPlan.findByPk(lessonPlanId, {
        attributes: ['id', 'title', 'is_published', 'template_data']
      });

      if (!lessonPlan) {
        return {
          hasAccess: false,
          reason: 'lesson_plan_not_found',
          message: 'Lesson plan not found'
        };
      }

      if (!lessonPlan.is_published && baseAccess.accessType !== 'creator') {
        return {
          hasAccess: false,
          reason: 'lesson_plan_not_published',
          message: 'Lesson plan is not published'
        };
      }

      return {
        ...baseAccess,
        lessonPlan: {
          id: lessonPlan.id,
          title: lessonPlan.title,
          isPublished: lessonPlan.is_published,
          canCustomize: baseAccess.accessType !== 'student_via_teacher_claim'
        },
        contentValidation: {
          applied: true,
          type: 'lesson_plan',
          checks: ['publication_status', 'customization_permissions'],
          passed: true
        }
      };
    } catch (error) {
      luderror.auth('Error validating lesson plan access:', error);
      return { ...baseAccess, contentValidation: { applied: false, error: error.message } };
    }
  }

  /**
   * Get course progress for a user (placeholder implementation)
   * TODO: Implement actual course progress tracking
   */
  async getCourseProgress(userId, courseId) {
    try {
      // Placeholder implementation - would need actual progress tracking
      return {
        unlockedModules: [1], // First module always unlocked
        completedModules: []
      };
    } catch (error) {
      luderror.auth('Error getting course progress:', error);
      return { unlockedModules: [], completedModules: [] };
    }
  }

  // Get all purchases for a user
  async getUserPurchases(userId, options = {}) {
    try {
      const whereClause = {
        buyer_user_id: userId,
        payment_status: 'completed',
        purchasable_type: { [Op.not]: null } // Only polymorphic purchases
      };

      // Filter by entity type if specified
      if (options.entityType) {
        whereClause.purchasable_type = options.entityType;
      }

      // Filter by access status
      if (options.activeOnly) {
        whereClause[Op.or] = [
          { access_expires_at: null }, // Lifetime access
          { access_expires_at: { [Op.gt]: nowInIsrael() } } // Not expired (Israel timezone)
        ];
      }

      const purchases = await this.models.Purchase.findAll({
        where: whereClause,
        include: this.buildEntityIncludes(),
        order: [['created_at', 'DESC']]
      });

      return purchases.map(purchase => this.formatPurchaseWithEntity(purchase));
    } catch (error) {
      luderror.payment('Error getting user purchases:', error);
      throw new Error(`Failed to get user purchases: ${error.message}`);
    }
  }

  // Get all users who have access to a specific entity
  async getEntityUsers(entityType, entityId) {
    try {
      const purchases = await this.models.Purchase.findAll({
        where: {
          purchasable_type: entityType,
          purchasable_id: entityId,
          payment_status: 'completed',
          [Op.or]: [
            { access_expires_at: null }, // Lifetime access
            { access_expires_at: { [Op.gt]: nowInIsrael() } } // Not expired (Israel timezone)
          ]
        },
        include: [
          {
            model: this.models.User,
            as: 'buyer',
            attributes: ['id', 'email', 'full_name']
          }
        ],
        attributes: ['buyer_user_id', 'access_expires_at', 'created_at'],
        order: [['created_at', 'DESC']]
      });

      return purchases.map(purchase => ({
        userId: purchase.buyer_user_id,
        email: purchase.buyer?.email,
        fullName: purchase.buyer?.full_name,
        purchasedAt: purchase.created_at,
        isLifetimeAccess: !purchase.access_expires_at,
        expiresAt: purchase.access_expires_at
      }));
    } catch (error) {
      luderror.api('Error getting entity users:', error);
      throw new Error(`Failed to get entity users: ${error.message}`);
    }
  }

  // Create a new purchase and grant access
  async grantAccess(userId, entityType, entityId, options = {}) {
    try {
      const {
        accessDays = null,
        isLifetimeAccess = false,
        price = 0
      } = options;

      // Calculate access expiration (using Israel timezone)
      let accessExpiresAt = null;
      if (!isLifetimeAccess && accessDays && accessDays > 0) {
        accessExpiresAt = createExpirationDate(accessDays);
      }

      // Create clean purchase record
      const purchaseData = {
        id: this.generatePurchaseId(),
        buyer_user_id: userId,
        purchasable_type: entityType,
        purchasable_id: entityId,
        payment_status: 'completed',
        payment_amount: price,
        original_price: price,
        access_expires_at: accessExpiresAt,
        metadata: options.metadata || {}
      };

      const purchase = await this.models.Purchase.create(purchaseData);
      return purchase;
    } catch (error) {
      luderror.api('Error granting access:', error);
      throw new Error(`Failed to grant access: ${error.message}`);
    }
  }

  // Revoke access for a user to an entity
  async revokeAccess(userId, entityType, entityId) {
    try {
      const deletedCount = await this.models.Purchase.destroy({
        where: {
          buyer_user_id: userId,
          purchasable_type: entityType,
          purchasable_id: entityId
        }
      });

      return { revoked: deletedCount > 0, deletedCount };
    } catch (error) {
      luderror.api('Error revoking access:', error);
      throw new Error(`Failed to revoke access: ${error.message}`);
    }
  }

  // Get access statistics for an entity
  async getEntityAccessStats(entityType, entityId) {
    try {
      const stats = await this.models.Purchase.findAll({
        where: {
          purchasable_type: entityType,
          purchasable_id: entityId,
          payment_status: 'completed'
        },
        attributes: [
          [this.models.sequelize.fn('COUNT', this.models.sequelize.col('id')), 'totalPurchases'],
          [this.models.sequelize.fn('COUNT', this.models.sequelize.literal('CASE WHEN access_expires_at IS NULL THEN 1 END')), 'lifetimeAccess'],
          [this.models.sequelize.fn('COUNT', this.models.sequelize.literal('CASE WHEN access_expires_at > NOW() THEN 1 END')), 'activeAccess'],
          [this.models.sequelize.fn('SUM', this.models.sequelize.col('payment_amount')), 'totalRevenue']
        ],
        raw: true
      });

      return stats[0] || {
        totalPurchases: 0,
        lifetimeAccess: 0,
        activeAccess: 0,
        totalRevenue: 0
      };
    } catch (error) {
      luderror.api('Error getting entity access stats:', error);
      throw new Error(`Failed to get entity access stats: ${error.message}`);
    }
  }

  // Build includes for different entity types
  buildEntityIncludes() {
    return [
      {
        model: this.models.Workshop,
        as: 'workshop',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.Course,
        as: 'course',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.File,
        as: 'file',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.Tool,
        as: 'tool',
        attributes: ['id', 'title', 'description', 'price'],
        required: false
      },
      {
        model: this.models.Game,
        as: 'game',
        attributes: ['id', 'game_type', 'digital', 'game_settings'],
        required: false
      }
    ];
  }

  // Format purchase with entity information
  formatPurchaseWithEntity(purchase) {
    const entityData = purchase.workshop || purchase.course || purchase.file || 
                      purchase.tool || purchase.game;
    
    return {
      id: purchase.id,
      entityType: purchase.purchasable_type,
      entityId: purchase.purchasable_id,
      entity: entityData,
      purchasedAt: purchase.created_at,
      isLifetimeAccess: !purchase.access_expires_at,
      expiresAt: purchase.access_expires_at,
      paymentAmount: purchase.payment_amount,
      isActive: !purchase.access_expires_at || !isExpired(purchase.access_expires_at)
    };
  }

  // Generate unique purchase ID
  generatePurchaseId() {
    return 'pur_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}

export default new AccessControlService();