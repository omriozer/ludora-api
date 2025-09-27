import { Op } from 'sequelize';
import db from '../models/index.js';

/**
 * Video Access Control Service
 * 
 * This service handles checking if a user has access to video content
 * based on their purchases and subscription status.
 */

/**
 * Check if a user has access to a specific video
 * @param {string} userId - The user's ID
 * @param {string} videoId - The video ID (can be product_id or video file reference)
 * @param {string} userEmail - The user's email (for purchase lookup)
 * @returns {Promise<Object>} Access result with status and details
 */
export async function checkVideoAccess(userId, videoId, userEmail) {
  try {
    // First, find the product that contains this video
    const product = await findProductByVideoId(videoId);
    
    if (!product) {
      return {
        hasAccess: false,
        reason: 'video_not_found',
        message: 'Video not found in system'
      };
    }

    // Check if user has purchased this specific product
    const purchaseAccess = await checkPurchaseAccess(userEmail, product.id);
    if (purchaseAccess.hasAccess) {
      return purchaseAccess;
    }

    // Check if user has subscription access to this video type
    const subscriptionAccess = await checkSubscriptionAccess(userId, product);
    if (subscriptionAccess.hasAccess) {
      return subscriptionAccess;
    }

    // Check if user is the creator of the content
    const creatorAccess = await checkCreatorAccess(userId, product.id);
    if (creatorAccess.hasAccess) {
      return creatorAccess;
    }

    return {
      hasAccess: false,
      reason: 'no_access',
      message: 'User does not have access to this video',
      productId: product.id,
      productTitle: product.title,
      productType: product.product_type
    };

  } catch (error) {
    console.error('Error checking video access:', error);
    return {
      hasAccess: false,
      reason: 'error',
      message: 'Error checking access permissions',
      error: error.message
    };
  }
}

/**
 * Find a product that contains the specified video
 * @param {string} videoId - Video identifier
 * @returns {Promise<Object|null>} Product object or null
 */
async function findProductByVideoId(videoId) {
  // Strategy 1: Direct product ID match
  let product = await db.Product.findOne({
    where: { id: videoId, is_published: true }
  });
  
  if (product) return product;

  // Strategy 2: Look for video in workshop video URLs
  product = await db.Product.findOne({
    where: {
      [Op.or]: [
        { video_file_url: { [Op.iLike]: `%${videoId}%` } },
        { file_url: { [Op.iLike]: `%${videoId}%` } }
      ],
      is_published: true
    }
  });
  
  if (product) return product;

  // Strategy 3: Look for video in course modules (JSONB search)
  product = await db.Product.findOne({
    where: {
      product_type: 'course',
      course_modules: {
        [Op.contains]: [{
          video_url: { [Op.iLike]: `%${videoId}%` }
        }]
      },
      is_published: true
    }
  });

  return product;
}

/**
 * Check if user has purchased access to the product
 * @param {string} userEmail - User's email
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Access result
 */
async function checkPurchaseAccess(userEmail, productId) {
  // First find the user by email
  const user = await db.User.findOne({
    where: { email: userEmail }
  });

  if (!user) {
    return { hasAccess: false, reason: 'user_not_found' };
  }

  // Then find purchase by user ID and product ID
  const purchase = await db.Purchase.findOne({
    where: {
      buyer_user_id: user.id,
      purchasable_id: productId, // Use new polymorphic field
      purchasable_type: 'product', // Specify it's a product
      payment_status: 'completed'
    },
    order: [['created_at', 'DESC']] // Get the most recent purchase
  });

  if (!purchase) {
    return { hasAccess: false, reason: 'no_purchase' };
  }

  // Check if purchase has lifetime access
  if (purchase.purchased_lifetime_access) {
    return {
      hasAccess: true,
      reason: 'lifetime_purchase',
      message: 'User has lifetime access via purchase',
      purchaseId: purchase.id,
      accessType: 'lifetime'
    };
  }

  // Check if purchase access period is still valid
  if (purchase.access_until) {
    const accessUntil = new Date(purchase.access_until);
    const now = new Date();
    
    if (now <= accessUntil) {
      return {
        hasAccess: true,
        reason: 'valid_purchase',
        message: 'User has valid purchase access',
        purchaseId: purchase.id,
        accessType: 'time_limited',
        accessUntil: purchase.access_until
      };
    } else {
      return {
        hasAccess: false,
        reason: 'expired_purchase',
        message: 'Purchase access has expired',
        expiredAt: purchase.access_until
      };
    }
  }

  // If no access_until date but there's a purchase, check purchased_access_days
  if (purchase.purchased_access_days && purchase.created_at) {
    const purchaseDate = new Date(purchase.created_at);
    const expirationDate = new Date(purchaseDate.getTime() + (purchase.purchased_access_days * 24 * 60 * 60 * 1000));
    const now = new Date();

    if (now <= expirationDate) {
      return {
        hasAccess: true,
        reason: 'valid_purchase',
        message: 'User has valid purchase access',
        purchaseId: purchase.id,
        accessType: 'time_limited',
        accessUntil: expirationDate.toISOString()
      };
    } else {
      return {
        hasAccess: false,
        reason: 'expired_purchase',
        message: 'Purchase access has expired',
        expiredAt: expirationDate.toISOString()
      };
    }
  }

  // Purchase exists but no clear access period defined
  return {
    hasAccess: true,
    reason: 'purchase_no_expiration',
    message: 'User has purchase access (no expiration defined)',
    purchaseId: purchase.id,
    accessType: 'indefinite'
  };
}

/**
 * Check if user has subscription access to the video
 * @param {string} userId - User ID
 * @param {Object} product - Product object
 * @returns {Promise<Object>} Access result
 */
async function checkSubscriptionAccess(userId, product) {
  // Get user's current active subscription
  const currentSubscription = await db.SubscriptionHistory.findOne({
    where: {
      user_id: userId,
      status: 'active',
      start_date: { [Op.lte]: new Date() },
      [Op.or]: [
        { end_date: { [Op.gte]: new Date() } },
        { end_date: null } // No end date means ongoing
      ]
    },
    include: [{
      model: db.SubscriptionPlan,
      as: 'SubscriptionPlan',
      required: true
    }],
    order: [['start_date', 'DESC']]
  });

  if (!currentSubscription) {
    return { hasAccess: false, reason: 'no_active_subscription' };
  }

  const plan = currentSubscription.SubscriptionPlan;
  const benefits = plan.benefits || {};

  // Check if the subscription plan includes video access for this product type
  const hasVideoAccess = checkSubscriptionVideoAccess(benefits, product.product_type);

  if (hasVideoAccess) {
    return {
      hasAccess: true,
      reason: 'subscription_access',
      message: 'User has video access via subscription',
      subscriptionPlanId: plan.id,
      planName: plan.name,
      accessType: 'subscription',
      validUntil: currentSubscription.end_date
    };
  }

  return {
    hasAccess: false,
    reason: 'subscription_no_video_access',
    message: 'Current subscription does not include video access for this content type'
  };
}

/**
 * Check if subscription benefits include video access for the product type
 * @param {Object} benefits - Subscription plan benefits
 * @param {string} productType - Product type (workshop, course, file)
 * @returns {boolean} Whether subscription includes video access
 */
function checkSubscriptionVideoAccess(benefits, productType) {
  // Check for general video access
  if (benefits.video_access === true) {
    return true;
  }

  // Check for product-type specific access
  switch (productType) {
    case 'workshop':
      return benefits.workshop_videos === true || 
             benefits.workshop_access === true ||
             benefits.all_content === true;
    
    case 'course':
      return benefits.course_videos === true || 
             benefits.course_access === true ||
             benefits.all_content === true;
    
    case 'file':
      return benefits.file_videos === true || 
             benefits.tool_access === true ||
             benefits.all_content === true;
    
    default:
      return false;
  }
}

/**
 * Check if user is the creator of the content
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Access result
 */
async function checkCreatorAccess(userId, productId) {
  const product = await db.Product.findOne({
    where: {
      id: productId,
      creator_user_id: userId
    }
  });

  if (product) {
    return {
      hasAccess: true,
      reason: 'creator_access',
      message: 'User is the creator of this content',
      accessType: 'creator'
    };
  }

  return { hasAccess: false, reason: 'not_creator' };
}

/**
 * Get detailed access information for a user and video
 * @param {string} userId - User ID
 * @param {string} videoId - Video ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} Detailed access information
 */
export async function getVideoAccessDetails(userId, videoId, userEmail) {
  const accessResult = await checkVideoAccess(userId, videoId, userEmail);
  
  if (!accessResult.hasAccess) {
    return accessResult;
  }

  // If user has access, get additional details
  const product = await findProductByVideoId(videoId);
  
  return {
    ...accessResult,
    product: {
      id: product.id,
      title: product.title,
      description: product.description,
      product_type: product.product_type,
      total_duration_minutes: product.total_duration_minutes
    }
  };
}

/**
 * Middleware to check video access before serving content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export async function videoAccessMiddleware(req, res, next) {
  try {
    const { videoId } = req.params;
    const user = req.user; // Assumes auth middleware has already set req.user

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access video content'
      });
    }

    const accessResult = await checkVideoAccess(user.id, videoId, user.email);

    if (!accessResult.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: accessResult.message,
        reason: accessResult.reason,
        productId: accessResult.productId,
        productTitle: accessResult.productTitle
      });
    }

    // Add access info to request for logging/analytics
    req.videoAccess = accessResult;
    
    next();
  } catch (error) {
    console.error('Video access middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify video access'
    });
  }
}