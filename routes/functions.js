import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import EmailService from '../services/EmailService.js';
import CouponValidationService from '../services/CouponValidationService.js';
import CouponCodeGenerator from '../utils/couponCodeGenerator.js';
import models from '../models/index.js';
import ProductServiceRouter from '../services/ProductServiceRouter.js';
import EntityService from '../services/EntityService.js';
import { ludlog } from '../lib/ludlog.js';

const router = express.Router();

// Get applicable public coupons for cart auto-suggestion
router.post('/getApplicableCoupons', authenticateToken, async (req, res) => {
  try {
    const { userId, cartItems, cartTotal } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({ error: 'Valid cart total is required' });
    }

    const result = await CouponValidationService.getApplicablePublicCoupons({
      userId,
      cartItems,
      cartTotal
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get the best single coupon for a cart
router.post('/getBestCoupon', authenticateToken, async (req, res) => {
  try {
    const { userId, cartItems, cartTotal } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({ error: 'Valid cart total is required' });
    }

    const result = await CouponValidationService.getBestCouponForCart({
      userId,
      cartItems,
      cartTotal
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate multiple coupons for stacking
router.post('/validateCouponStacking', authenticateToken, async (req, res) => {
  try {
    const { couponCodes, userId, cartItems, cartTotal } = req.body;

    if (!couponCodes || !Array.isArray(couponCodes) || couponCodes.length === 0) {
      return res.status(400).json({ error: 'Coupon codes are required' });
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    if (!cartTotal || cartTotal <= 0) {
      return res.status(400).json({ error: 'Valid cart total is required' });
    }

    const result = await CouponValidationService.validateCouponStacking({
      couponCodes,
      userId,
      cartItems,
      cartTotal
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply a single coupon to cart and update Purchase records directly (SECURE VERSION)
router.post('/applyCoupon', validateBody(schemas.applyCoupon), async (req, res) => {
  const transaction = await models.sequelize.transaction();

  try {
    const { couponCode, userId, cartItems } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required for cart operations',
        code: 'USER_ID_REQUIRED'
      });
    }

    // Find the coupon
    const coupon = await models.Coupon.findOne({
      where: {
        code: couponCode.toUpperCase(),
        is_active: true
      },
      transaction
    });

    if (!coupon) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'Coupon not found',
        code: 'NOT_FOUND'
      });
    }

    // Check if coupon is expired
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Coupon has expired',
        code: 'EXPIRED'
      });
    }

    // Check usage limits
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Coupon usage limit exceeded',
        code: 'USAGE_LIMIT_EXCEEDED'
      });
    }

    // Check user-specific usage limit
    if (coupon.user_usage_limit) {
      const userUsageCount = coupon.user_usage_tracking?.[userId] || 0;
      if (userUsageCount >= coupon.user_usage_limit) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'User usage limit exceeded for this coupon',
          code: 'USER_USAGE_LIMIT_EXCEEDED'
        });
      }
    }

    // SECURITY FIX: Get cart items directly from database (authoritative source)
    const cartPurchases = await models.Purchase.findAll({
      where: {
        buyer_user_id: userId,
        payment_status: 'cart'
      },
      transaction
    });

    if (!cartPurchases || cartPurchases.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'No items found in cart',
        code: 'EMPTY_CART'
      });
    }

    // Calculate current cart total from database records (before coupon)
    // FIXED: Use original_price if available (in case coupon was previously applied and removed)
    const originalCartTotal = cartPurchases.reduce((total, purchase) => {
      return total + parseFloat(purchase.original_price || purchase.payment_amount || 0);
    }, 0);

    // Build cart data for validation
    const validationCartItems = cartPurchases.map(purchase => ({
      id: purchase.id,
      purchasable_type: purchase.purchasable_type,
      purchasable_id: purchase.purchasable_id,
      payment_amount: parseFloat(purchase.payment_amount || 0)
    }));

    // Get user object for validation
    const user = await models.User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get cart details for validation using the service method
    const cartDetails = CouponValidationService.getCartDetails(validationCartItems);

    // Check if coupon applies to cart
    const isApplicable = await CouponValidationService.isCouponApplicableToCart(
      coupon,
      user,
      cartDetails,
      originalCartTotal
    );

    if (!isApplicable) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Coupon is not applicable to this cart',
        code: 'NOT_APPLICABLE'
      });
    }

    // Calculate discount amount
    let totalDiscountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      totalDiscountAmount = (originalCartTotal * coupon.discount_value) / 100;
      // Apply discount cap if set
      if (coupon.max_discount_cap && totalDiscountAmount > coupon.max_discount_cap) {
        totalDiscountAmount = coupon.max_discount_cap;
      }
    } else if (coupon.discount_type === 'fixed') {
      totalDiscountAmount = Math.min(coupon.discount_value, originalCartTotal);
    }

    const finalCartTotal = Math.max(0, originalCartTotal - totalDiscountAmount);

    // CRITICAL SECURITY FIX: Update Purchase records directly in database
    const updatePromises = cartPurchases.map(async (purchase) => {
      const purchaseOriginalAmount = parseFloat(purchase.payment_amount || 0);

      // Calculate proportional discount for this purchase
      const proportionalDiscount = originalCartTotal > 0
        ? (purchaseOriginalAmount / originalCartTotal) * totalDiscountAmount
        : 0;

      const newPaymentAmount = Math.max(0, purchaseOriginalAmount - proportionalDiscount);

      // Update Purchase record with coupon data
      return purchase.update({
        original_price: purchase.original_price || purchaseOriginalAmount, // Preserve original if not set
        discount_amount: proportionalDiscount,
        payment_amount: newPaymentAmount,
        coupon_code: coupon.code,
        metadata: {
          ...purchase.metadata,
          coupon_applied_at: new Date().toISOString(),
          coupon_id: coupon.id,
          coupon_discount_type: coupon.discount_type,
          coupon_discount_value: coupon.discount_value,
          proportional_discount: proportionalDiscount
        },
        updated_at: new Date()
      }, { transaction });
    });

    await Promise.all(updatePromises);

    // Log coupon application
    ludlog.payments('Applying coupon to Purchase records', {
      couponCode: coupon.code,
      couponId: coupon.id,
      userId,
      totalDiscountAmount,
      originalCartTotal,
      finalCartTotal,
      affectedPurchases: cartPurchases.length,
      usageCountBefore: coupon.usage_count
    });

    // Update coupon usage counts
    await CouponValidationService.incrementUserUsage(coupon.id, userId, transaction);

    await models.Coupon.increment('usage_count', {
      where: { id: coupon.id },
      transaction
    });

    await transaction.commit();

    ludlog.payments('Coupon applied successfully to Purchase records', {
      couponCode: coupon.code,
      userId,
      finalCartTotal,
      purchasesUpdated: cartPurchases.length
    });

    // Return success response with updated data
    res.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        usage_count: coupon.usage_count + 1
      },
      discount: {
        amount: totalDiscountAmount,
        percentage: coupon.discount_type === 'percentage' ? coupon.discount_value : (totalDiscountAmount / originalCartTotal) * 100
      },
      totals: {
        original_amount: originalCartTotal,
        discount_amount: totalDiscountAmount,
        final_amount: finalCartTotal
      },
      affected_purchases: cartPurchases.length,
      database_updated: true, // Indicates this is the secure version
      free_checkout: finalCartTotal === 0
    });
  } catch (error) {
    await transaction.rollback();
    ludlog.payments('Error applying coupon to Purchase records:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove a coupon from cart and restore original Purchase pricing
router.post('/removeCoupon', validateBody(schemas.removeCoupon), async (req, res) => {
  const transaction = await models.sequelize.transaction();

  try {
    const { couponCode, userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required for cart operations',
        code: 'USER_ID_REQUIRED'
      });
    }

    if (!couponCode) {
      return res.status(400).json({
        error: 'Coupon code is required',
        code: 'COUPON_CODE_REQUIRED'
      });
    }

    // Find all Purchase records with this coupon applied
    const cartPurchasesWithCoupon = await models.Purchase.findAll({
      where: {
        buyer_user_id: userId,
        payment_status: 'cart',
        coupon_code: couponCode.toUpperCase()
      },
      transaction
    });

    if (!cartPurchasesWithCoupon || cartPurchasesWithCoupon.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'No cart items found with this coupon',
        code: 'COUPON_NOT_FOUND_IN_CART'
      });
    }

    // Calculate totals before and after removal
    let totalDiscountRemoved = 0;
    let originalCartTotal = 0;

    // Update each Purchase record to remove coupon
    const updatePromises = cartPurchasesWithCoupon.map(async (purchase) => {
      const originalPrice = purchase.original_price || purchase.payment_amount;
      const discountAmount = parseFloat(purchase.discount_amount || 0);

      totalDiscountRemoved += discountAmount;
      originalCartTotal += originalPrice;

      // Clear coupon data and restore original pricing
      return purchase.update({
        payment_amount: originalPrice, // Restore original price
        discount_amount: 0,
        coupon_code: null,
        metadata: {
          ...purchase.metadata,
          // Remove coupon-related metadata
          coupon_applied_at: undefined,
          coupon_id: undefined,
          coupon_discount_type: undefined,
          coupon_discount_value: undefined,
          proportional_discount: undefined,
          coupon_removed_at: new Date().toISOString()
        },
        updated_at: new Date()
      }, { transaction });
    });

    await Promise.all(updatePromises);

    await transaction.commit();

    ludlog.payments('Coupon removed successfully from Purchase records', {
      couponCode: couponCode.toUpperCase(),
      userId,
      totalDiscountRemoved,
      originalCartTotal,
      purchasesUpdated: cartPurchasesWithCoupon.length
    });

    // Return success response
    res.json({
      success: true,
      message: 'Coupon removed successfully',
      removed_coupon: {
        code: couponCode.toUpperCase(),
        discount_removed: totalDiscountRemoved
      },
      totals: {
        original_amount: originalCartTotal,
        discount_removed: totalDiscountRemoved,
        new_total: originalCartTotal
      },
      affected_purchases: cartPurchasesWithCoupon.length,
      database_updated: true
    });

  } catch (error) {
    await transaction.rollback();
    ludlog.payments('Error removing coupon from Purchase records:', error);
    res.status(500).json({ error: error.message });
  }
});

// Coupon Code Generation Endpoints
// Generate coupon codes with custom patterns
router.post('/generateCouponCodes', authenticateToken, async (req, res) => {
  try {
    const { pattern, count = 1, charSet = 'alphanumeric', couponData = {} } = req.body;

    // Basic validation
    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    if (count < 1 || count > 1000) {
      return res.status(400).json({ error: 'Count must be between 1 and 1000' });
    }

    // Validate pattern first
    const validation = CouponCodeGenerator.validatePattern(pattern);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await CouponCodeGenerator.generateAndCreateCoupons({
      pattern,
      count,
      charSet,
      couponData
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate coupon code pattern
router.post('/validateCouponPattern', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const validation = CouponCodeGenerator.validatePattern(pattern);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get preset patterns for common use cases
router.get('/getCouponPresetPatterns', authenticateToken, async (req, res) => {
  try {
    const { type, suffix } = req.query;

    const presets = {
      student: CouponCodeGenerator.generatePresetPattern('student', suffix),
      vip: CouponCodeGenerator.generatePresetPattern('vip', suffix),
      holiday: CouponCodeGenerator.generatePresetPattern('holiday', suffix),
      general: CouponCodeGenerator.generatePresetPattern('general', suffix),
      referral: CouponCodeGenerator.generatePresetPattern('referral', suffix),
      welcome: CouponCodeGenerator.generatePresetPattern('welcome', suffix),
      flashsale: CouponCodeGenerator.generatePresetPattern('flashsale', suffix),
      earlybird: CouponCodeGenerator.generatePresetPattern('earlybird', suffix),
      loyalty: CouponCodeGenerator.generatePresetPattern('loyalty', suffix),
      creator: CouponCodeGenerator.generatePresetPattern('creator', suffix)
    };

    if (type) {
      const pattern = presets[type.toLowerCase()];
      if (!pattern) {
        return res.status(400).json({ error: 'Invalid preset type' });
      }
      return res.json({ pattern, validation: CouponCodeGenerator.validatePattern(pattern) });
    }

    res.json({ presets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics for a coupon pattern
router.get('/getCouponPatternStats', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.query;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const stats = await CouponCodeGenerator.getPatternStatistics(pattern);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk deactivate coupons by pattern
router.post('/deactivateCouponsByPattern', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Pattern is required' });
    }

    const result = await CouponCodeGenerator.deactivateCouponsByPattern(pattern);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registration Functions - DEPRECATED: Registration model removed

router.post('/sendRegistrationEmail', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.sendRegistrationEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Functions
router.post('/processEmailTriggers', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.processEmailTriggers(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/scheduleEmailProcessor', authenticateToken, async (req, res) => {
  try {
    const { schedule, triggers } = req.body;

    // Create a scheduled task record for future processing
    const scheduledTask = await models.EmailSchedule?.create({
      schedule_time: schedule.time || new Date(),
      triggers: JSON.stringify(triggers || []),
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }) || null;

    res.json({
      success: true,
      message: 'Email processor scheduled',
      data: {
        scheduled: true,
        schedule,
        taskId: scheduledTask?.id || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/triggerEmailAutomation', authenticateToken, async (req, res) => {
  try {
    const { triggerType, data } = req.body;

    // Validate required fields
    if (!triggerType) {
      return res.status(400).json({ error: 'triggerType is required' });
    }

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }

    // Extract recipient email from data (different trigger types have different email fields)
    let recipientEmail;
    if (triggerType === 'parent_consent_request') {
      recipientEmail = data.parent_email;
    } else if (triggerType === 'student_invitation') {
      recipientEmail = data.student_email;
    } else {
      // Fallback for other trigger types
      recipientEmail = data.recipient_email || data.email;
    }

    if (!recipientEmail) {
      return res.status(400).json({
        error: 'Recipient email is required in data object',
        hint: 'Use parent_email for parent_consent_request, student_email for student_invitation'
      });
    }

    // Find automation template by trigger_type
    const automation = await models.EmailTemplate.findOne({
      where: { trigger_type: triggerType, is_active: true }
    });

    if (!automation) {
      return res.status(404).json({
        error: `No active email template found for trigger type: ${triggerType}`,
        availableTypes: ['parent_consent_request', 'student_invitation', 'registration_confirmation', 'payment_confirmation']
      });
    }

    // Trigger the email using EmailService
    const result = await EmailService.processEmailTriggers({
      triggers: [{
        type: triggerType,
        recipient: recipientEmail,
        data,
        entityId: data.userId || data.student_id
      }]
    });

    res.json({
      success: true,
      message: 'Email automation triggered successfully',
      data: {
        triggerType,
        templateId: automation.id,
        templateName: automation.name,
        recipient: recipientEmail,
        triggered: true,
        result
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sendInvitationEmails', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.sendInvitationEmails(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send example email with placeholder values
router.post('/sendExampleEmail', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    // Find the email template
    const template = await models.EmailTemplate.findByPk(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    // Get current user's email as recipient
    const currentUser = req.user;
    if (!currentUser || !currentUser.email) {
      return res.status(400).json({ error: 'Current user email not found' });
    }

    // Generate placeholder values for all variables
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const nextYear = currentYear + 1;
    const workshopDate = new Date();
    workshopDate.setDate(currentDate.getDate() + 7); // 7 days from now

    const placeholderData = {
      // Names
      student_name: 'ישראל ישראלי',
      teacher_name: 'ישראלה ישראלית',
      recipient_name: 'ישראל ישראלי',
      buyer_name: 'ישראל ישראלי',
      participant_name: 'ישראל ישראלי',
      admin_name: currentUser.display_name || currentUser.email || 'מנהל מערכת',

      // Contact Info
      recipient_email: currentUser.email,
      buyer_email: 'email@ludora.example',
      participant_email: 'email@ludora.example',
      buyer_phone: '054-1234567',
      participant_phone: '054-1234567',

      // Site/System
      site_name: process.env.SITE_NAME || 'לודורא',
      classroom_name: 'שם הכיתה',
      classroom_grade: 'ו',
      classroom_year: `${currentYear} - ${nextYear}`,

      // Products & Content
      product_title: 'שם מוצר',
      product_type: 'קובץ',
      workshop_title: 'הדרכה בתשלום',

      // Dates & Numbers (Hebrew format)
      current_date: currentDate.toLocaleDateString('he-IL'),
      purchase_date: currentDate.toLocaleDateString('he-IL'),
      workshop_date: workshopDate.toLocaleDateString('he-IL'),
      access_until: 'גישה לכל החיים',
      payment_amount: '99',
      days_remaining: 'ללא הגבלה',
      registered_participants_count: '76',
      max_participants: '300',

      // Links
      consent_link: 'https://ludora.app',
      privacy_policy_link: process.env.PRIVACY_POLICY_URL || 'https://ludora.app/privacy',
      terms_of_service_link: process.env.TERMS_OF_SERVICE_URL || 'https://ludora.app/terms',
      invitation_link: 'https://ludora.app',
      zoom_link: 'https://zoom.us/j/1234567890?pwd=example123',
      zoom_password: 'zoom123',
      recording_url: 'https://ludora.app/recordings/example-recording',

      // Optional Content
      personal_message: 'היי, אנחנו צריכים אישור הורה כדי להירשם ללודורא, אני אשמח שתמלאו את הטופס בהקדם.'
    };

    // Process template with placeholder data
    const processedSubject = EmailService.processEmailTemplate(template.subject, placeholderData);
    const processedContent = EmailService.processEmailTemplate(template.html_content, placeholderData);

    // Send the example email
    const emailResult = await EmailService.sendEmail({
      to: currentUser.email,
      subject: `[דוגמה] ${processedSubject}`,
      html: `
        <div style="border: 3px solid #f39c12; border-radius: 8px; padding: 20px; margin: 20px 0; background-color: #fff3cd;">
          <h2 style="color: #856404; margin-top: 0;">📧 זהו מייל דוגמה</h2>
          <p style="color: #856404; font-weight: bold;">
            זהו מייל דוגמה לתבנית "${template.name}".<br>
            הנתונים הם פלייסהולדרים לצורך הדוגמה ולא נתונים אמיתיים.
          </p>
        </div>
        ${processedContent}
        <div style="border-top: 2px solid #e9ecef; margin-top: 30px; padding-top: 20px;">
          <p style="font-size: 12px; color: #6c757d; text-align: center;">
            מייל דוגמה נשלח מהמערכת • ${new Date().toLocaleString('he-IL')}
          </p>
        </div>
      `,
      templateId: template.id
    });

    ludlog.generic('Example email sent successfully', {
      templateId: template.id,
      templateName: template.name,
      triggerType: template.trigger_type,
      recipient: currentUser.email,
      messageId: emailResult.data.messageId
    });

    res.json({
      success: true,
      message: 'Email example sent successfully',
      data: {
        templateId: template.id,
        templateName: template.name,
        triggerType: template.trigger_type,
        recipient: currentUser.email,
        subject: processedSubject,
        sent: true,
        messageId: emailResult.data.messageId,
        placeholderValuesUsed: Object.keys(placeholderData).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Game Functions
router.post('/updateExistingGames', authenticateToken, async (req, res) => {
  try {
    const { gameUpdates } = req.body;

    if (!Array.isArray(gameUpdates)) {
      return res.status(400).json({ error: 'gameUpdates must be an array' });
    }

    const results = [];
    for (const gameUpdate of gameUpdates) {
      try {
        const updated = await ProductServiceRouter.update('game', gameUpdate.id, gameUpdate);
        results.push({ id: gameUpdate.id, status: 'updated', data: updated });
      } catch (error) {
        results.push({ id: gameUpdate.id, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Games update completed',
      data: {
        total: gameUpdates.length,
        updated: results.filter(r => r.status === 'updated').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/uploadVerbsBulk', authenticateToken, async (req, res) => {
  try {
    const { verbs } = req.body;

    if (!Array.isArray(verbs)) {
      return res.status(400).json({ error: 'verbs must be an array' });
    }

    // Use Word model to store verbs with proper categorization
    const verbEntries = verbs.map(verb => ({
      ...verb,
      category: verb.category || 'verb',
      language: verb.language || 'he', // Default to Hebrew
      is_active: true
    }));

    const results = await EntityService.bulkCreate('Word', verbEntries);

    res.json({
      success: true,
      message: 'Verbs uploaded successfully',
      data: {
        uploaded: results.length,
        verbs: results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File Functions
router.post('/deleteFile', authenticateToken, async (req, res) => {
  try {
    const { fileId, filePath, entityType } = req.body;

    if (fileId && entityType) {
      // Delete entity from database (includes automatic S3 cleanup)
      // Route to appropriate service based on entity type
      const productTypes = ['file', 'game', 'bundle', 'lesson_plan', 'workshop', 'course', 'tool'];
      const result = productTypes.includes(entityType)
        ? await ProductServiceRouter.delete(entityType, fileId)
        : await EntityService.delete(entityType, fileId);
      res.json({
        success: true,
        message: `${entityType} record and associated files deleted successfully`,
        data: result
      });
    } else if (filePath) {
      // Direct file path deletion from S3
      try {
        const { deleteFileFromStorage } = await import('./media.js');

        // Extract file entity ID and user ID from the file path if possible
        // Expected format: environment/userId/fileEntityId/filename
        const pathParts = filePath.split('/');
        if (pathParts.length >= 3) {
          const userId = pathParts[1];
          const fileEntityId = pathParts[2];

          const deleted = await deleteFileFromStorage(fileEntityId, userId);

          res.json({
            success: deleted,
            message: deleted ? 'File deleted from storage successfully' : 'File not found in storage',
            data: { filePath, deleted }
          });
        } else {
          res.status(400).json({
            error: 'Invalid file path format. Expected: environment/userId/fileEntityId/filename'
          });
        }
      } catch (error) {
        res.status(500).json({
          error: 'Failed to delete file from storage',
          details: error.message
        });
      }
    } else {
      res.status(400).json({ error: 'Either fileId with entityType or filePath is required' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/createSignedUrl', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType, operation = 'upload' } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }

    // Generate a secure token for the URL
    const token = Buffer.from(`${fileName}_${Date.now()}_${Math.random()}`).toString('base64url');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // In a real implementation, this would integrate with cloud storage
    const signedUrl = `https://storage.ludora.app/files/${operation}/${encodeURIComponent(fileName)}?token=${token}&expires=${expiresAt.getTime()}`;

    res.json({
      success: true,
      message: 'Signed URL created',
      data: {
        signedUrl,
        fileName,
        fileType,
        operation,
        expiresAt: expiresAt.toISOString(),
        token
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Template Functions
router.post('/initializeSystemEmailTemplates', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.initializeSystemEmailTemplates();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/updateSystemEmailTemplates', authenticateToken, async (req, res) => {
  try {
    const { templates } = req.body;

    if (!Array.isArray(templates)) {
      return res.status(400).json({ error: 'templates must be an array' });
    }

    const results = [];
    for (const template of templates) {
      try {
        const updated = await EntityService.update('EmailTemplate', template.id, template);
        results.push({ id: template.id, status: 'updated', data: updated });
      } catch (error) {
        results.push({ id: template.id, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'System email templates update completed',
      data: {
        total: templates.length,
        updated: results.filter(r => r.status === 'updated').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Functions
router.post('/testCallback', authenticateToken, async (req, res) => {
  try {
    const { testData } = req.body;

    res.json({
      success: true,
      message: 'Test callback processed',
      data: { received: testData, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;