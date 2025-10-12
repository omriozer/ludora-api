import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import PaymentService from '../services/PaymentService.js';
import PaymentCleanupService from '../services/PaymentCleanupService.js';
import EmailService from '../services/EmailService.js';
import SubscriptionService from '../services/SubscriptionService.js';
import CouponValidationService from '../services/CouponValidationService.js';
import CouponCodeGenerator from '../utils/couponCodeGenerator.js';
import models from '../models/index.js';
import EntityService from '../services/EntityService.js';

const router = express.Router();

// Payment Functions
router.post('/sendPaymentConfirmation', authenticateToken, validateBody(schemas.paymentConfirmation), async (req, res) => {
  try {
    const result = await PaymentService.sendPaymentConfirmation(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error sending payment confirmation:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/testPayplusConnection', authenticateToken, async (req, res) => {
  try {
    const result = await PaymentService.testPayplusConnection();
    res.json(result);
  } catch (error) {
    console.error('PayPlus connection test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/applyCoupon', authenticateToken, validateBody(schemas.applyCoupon), async (req, res) => {
  try {
    // Support both legacy single purchase and new multi-item cart parameters
    const { couponCode, userId, productId, purchaseAmount, purchaseIds, cartItems } = req.body;

    // Build parameters for enhanced applyCoupon method
    const applyCouponParams = {
      couponCode,
      userId,
      purchaseAmount
    };

    // Handle legacy single purchase format
    if (productId && !purchaseIds && !cartItems) {
      // Legacy format - convert to new format
      applyCouponParams.cartItems = [{
        id: `legacy_${Date.now()}`,
        purchasable_type: 'unknown', // Legacy calls don't specify type
        purchasable_id: productId,
        payment_amount: purchaseAmount
      }];
    }
    // Handle new multi-item cart formats
    else if (purchaseIds) {
      applyCouponParams.purchaseIds = purchaseIds;
    } else if (cartItems) {
      applyCouponParams.cartItems = cartItems;
    }
    // No cart info provided - create minimal cart
    else {
      applyCouponParams.cartItems = [{
        id: `minimal_${Date.now()}`,
        purchasable_type: 'general',
        purchasable_id: 'general',
        payment_amount: purchaseAmount
      }];
    }

    const result = await PaymentService.applyCoupon(applyCouponParams);
    res.json(result);
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    console.error('Error getting applicable coupons:', error);
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
    console.error('Error getting best coupon:', error);
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
    console.error('Error validating coupon stacking:', error);
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
    console.error('Error generating coupon codes:', error);
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
    console.error('Error validating coupon pattern:', error);
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
    console.error('Error getting preset patterns:', error);
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
    console.error('Error getting pattern statistics:', error);
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
    console.error('Error deactivating coupons by pattern:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/createPayplusPaymentPage', authenticateToken, validateBody(schemas.createPaymentPage), async (req, res) => {
  try {
    const result = await PaymentService.createPayplusPaymentPage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating PayPlus payment page:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/handlePayplusCallback', authenticateToken, async (req, res) => {
  try {
    const result = await PaymentService.handlePayplusCallback(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error handling PayPlus callback:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/checkPaymentStatus', authenticateToken, async (req, res) => {
  try {
    const result = await PaymentService.checkPaymentStatus(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: error.message });
  }
});


// Registration Functions
router.post('/updateExistingRegistrations', authenticateToken, async (req, res) => {
  try {
    const { registrationData } = req.body;
    
    if (!Array.isArray(registrationData)) {
      return res.status(400).json({ error: 'registrationData must be an array' });
    }

    const results = [];
    for (const registration of registrationData) {
      try {
        const updated = await EntityService.update('Registration', registration.id, registration);
        results.push({ id: registration.id, status: 'updated', data: updated });
      } catch (error) {
        results.push({ id: registration.id, status: 'failed', error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Registrations update completed',
      data: { 
        total: registrationData.length,
        updated: results.filter(r => r.status === 'updated').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }
    });
  } catch (error) {
    console.error('Error updating registrations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sendRegistrationEmail', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.sendRegistrationEmail(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error sending registration email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email Functions
router.post('/processEmailTriggers', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.processEmailTriggers(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing email triggers:', error);
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
    console.error('Error scheduling email processor:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/triggerEmailAutomation', authenticateToken, async (req, res) => {
  try {
    const { automationId, userId, recipientEmail, data } = req.body;
    
    // Find automation template
    const automation = await models.EmailTemplate.findOne({
      where: { id: automationId, is_active: true }
    });

    if (!automation) {
      return res.status(404).json({ error: 'Email automation not found' });
    }

    // Trigger the email using EmailService
    const result = await EmailService.processEmailTriggers({
      triggers: [{
        type: automation.trigger_type,
        recipient: recipientEmail,
        data,
        entityId: userId
      }]
    });

    res.json({
      success: true,
      message: 'Email automation triggered',
      data: { automationId, triggered: true, result }
    });
  } catch (error) {
    console.error('Error triggering email automation:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sendInvitationEmails', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.sendInvitationEmails(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error sending invitation emails:', error);
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
        const updated = await EntityService.update('Game', gameUpdate.id, gameUpdate);
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
    console.error('Error updating games:', error);
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
    console.error('Error uploading verbs:', error);
    res.status(500).json({ error: error.message });
  }
});


// File Functions
router.post('/deleteFile', authenticateToken, async (req, res) => {
  try {
    const { fileId, filePath, entityType } = req.body;

    if (fileId && entityType) {
      // Delete File entity from database (includes automatic S3 cleanup via EntityService)
      const result = await EntityService.delete(entityType, fileId);
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
        console.error('Error deleting file from storage:', error);
        res.status(500).json({
          error: 'Failed to delete file from storage',
          details: error.message
        });
      }
    } else {
      res.status(400).json({ error: 'Either fileId with entityType or filePath is required' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
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
    console.error('Error creating signed URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email Template Functions
router.post('/initializeSystemEmailTemplates', authenticateToken, async (req, res) => {
  try {
    const result = await EmailService.initializeSystemEmailTemplates();
    res.json(result);
  } catch (error) {
    console.error('Error initializing email templates:', error);
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
    console.error('Error updating email templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subscription Functions
router.post('/createPayplusSubscriptionPage', authenticateToken, validateBody(schemas.createSubscriptionPage), async (req, res) => {
  try {
    const result = await SubscriptionService.createPayplusSubscriptionPage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating subscription page:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/handlePayplusSubscriptionCallback', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.handlePayplusSubscriptionCallback(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error handling subscription callback:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/checkSubscriptionStatus', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.checkSubscriptionStatus(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/processSubscriptionCallbacks', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.processSubscriptionCallbacks(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing subscription callbacks:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/getPayplusRecurringStatus', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.getPayplusRecurringStatus(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error getting recurring status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/cancelPayplusRecurringSubscription', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.cancelPayplusRecurringSubscription(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling recurring subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test Functions
router.post('/testCallback', authenticateToken, async (req, res) => {
  try {
    const { testData } = req.body;
    
    // Log test callback for debugging
    await models.WebhookLog?.create({
      webhook_type: 'test_callback',
      payload: JSON.stringify(testData),
      status: 'received',
      created_at: new Date(),
      updated_at: new Date()
    }).catch(err => console.log('WebhookLog not available:', err.message));

    res.json({
      success: true,
      message: 'Test callback processed',
      data: { received: testData, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error processing test callback:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/handlePayplusProductCallback', authenticateToken, async (req, res) => {
  try {
    const { productId, paymentData, status } = req.body;
    
    // Log the callback
    await models.WebhookLog?.create({
      webhook_type: 'payplus_product_callback',
      payload: JSON.stringify(req.body),
      status: 'received',
      created_at: new Date(),
      updated_at: new Date()
    }).catch(err => console.log('WebhookLog not available:', err.message));

    // If payment was successful, could trigger fulfillment processes
    if (status === 'success' && productId) {
      // Find product and process fulfillment
      const product = await models.Product?.findByPk(productId);
      if (product) {
        console.log('Product payment successful:', product.title);
        // Could trigger email notifications, access grants, etc.
      }
    }

    res.json({
      success: true,
      message: 'Product callback processed',
      data: { productId, status, processed: true }
    });
  } catch (error) {
    console.error('Error handling product callback:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/cleanupAbandonedCartItems', authenticateToken, async (req, res) => {
  try {
    const { maxHours = 24 } = req.body;
    const result = await PaymentCleanupService.cleanupAbandonedCartItems(maxHours);
    res.json(result);
  } catch (error) {
    console.error('Error cleaning up abandoned cart items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/runFullPaymentCleanup', authenticateToken, async (req, res) => {
  try {
    const { stalePaymentMinutes = 2, abandonedCartHours = 24 } = req.body;
    const result = await PaymentCleanupService.runFullCleanup({
      stalePaymentMinutes,
      abandonedCartHours
    });
    res.json(result);
  } catch (error) {
    console.error('Error running full payment cleanup:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;