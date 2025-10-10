import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import PaymentIntentService from '../services/PaymentIntentService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Payment-specific rate limiting
const paymentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 payment operations per 5 minutes per IP
  message: {
    error: 'Too many payment requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Note: onLimitReached was deprecated in express-rate-limit v7
});

// Apply rate limiting to all payment routes
router.use(paymentRateLimit);

// Payment request validation schema
const paymentStartSchema = {
  type: 'object',
  properties: {
    cartItems: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          payment_amount: { type: 'number', minimum: 0 }
        },
        required: ['id']
      }
    },
    userId: { type: 'string' },
    appliedCoupons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          discount_amount: { type: 'number' }
        },
        required: ['code']
      },
      default: []
    },
    environment: {
      type: 'string',
      enum: ['production', 'test'],
      default: 'production'
    },
    frontendOrigin: { type: 'string' }
  },
  required: ['cartItems', 'userId'],
  additionalProperties: false
};

/**
 * POST /api/payments/start
 * Start a new payment intent (replaces createPayplusPaymentPage)
 */
router.post('/start',
  authenticateToken,
  validateBody(paymentStartSchema),
  asyncHandler(async (req, res) => {
    try {
      console.log('🚀 Payment start endpoint called:', {
        userId: req.body.userId,
        cartItemCount: req.body.cartItems?.length || 0,
        environment: req.body.environment
      });

      const paymentIntentService = new PaymentIntentService();

      const result = await paymentIntentService.createPaymentIntent({
        cartItems: req.body.cartItems,
        userId: req.body.userId,
        appliedCoupons: req.body.appliedCoupons || [],
        environment: req.body.environment || 'production',
        frontendOrigin: req.body.frontendOrigin || req.get('origin')
      });

      console.log('✅ Payment intent created successfully:', {
        transactionId: result.transactionId,
        status: result.status
      });

      res.json({
        success: true,
        data: {
          transactionId: result.transactionId,
          paymentUrl: result.paymentUrl,
          totalAmount: result.totalAmount,
          status: result.status,
          purchaseCount: result.purchaseCount,
          expiresAt: result.expiresAt
        }
      });

    } catch (error) {
      console.error('❌ Payment start failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'PAYMENT_START_FAILED'
      });
    }
  })
);

/**
 * GET /api/payments/status/:transactionId
 * Get payment status for polling
 */
router.get('/status/:transactionId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { transactionId } = req.params;

      console.log('🔍 Payment status check for transaction:', transactionId);

      const paymentIntentService = new PaymentIntentService();
      const status = await paymentIntentService.getPaymentStatus(transactionId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('❌ Payment status check failed:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: error.message,
        code: 'PAYMENT_STATUS_ERROR'
      });
    }
  })
);

/**
 * POST /api/payments/retry/:transactionId
 * Retry a failed/expired payment
 */
router.post('/retry/:transactionId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const { transactionId } = req.params;

      console.log('🔄 Payment retry requested for transaction:', transactionId);

      const paymentIntentService = new PaymentIntentService();

      // Get current status first
      const currentStatus = await paymentIntentService.getPaymentStatus(transactionId);

      if (!currentStatus.canRetry) {
        return res.status(400).json({
          success: false,
          error: 'Payment cannot be retried in current status',
          code: 'PAYMENT_RETRY_NOT_ALLOWED',
          currentStatus: currentStatus.status
        });
      }

      // Reset to pending status for retry
      await paymentIntentService.updatePaymentStatus(transactionId, 'pending', {
        retry_requested_at: new Date().toISOString(),
        retry_reason: 'user_requested'
      });

      const updatedStatus = await paymentIntentService.getPaymentStatus(transactionId);

      res.json({
        success: true,
        message: 'Payment retry initiated',
        data: updatedStatus
      });

    } catch (error) {
      console.error('❌ Payment retry failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'PAYMENT_RETRY_FAILED'
      });
    }
  })
);

/**
 * GET /api/payments/health
 * Health check endpoint for payment system
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Payment system is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      start: 'POST /api/payments/start',
      status: 'GET /api/payments/status/:transactionId',
      retry: 'POST /api/payments/retry/:transactionId'
    }
  });
});

export default router;